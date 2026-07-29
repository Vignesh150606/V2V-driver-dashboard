// tailer.js
//
// Watches ONE "results/live" directory for HazardApp's .jsonl event log
// files and streams only newly appended lines (tail -f style) into
// onEvent -- the entire bridge between "OMNeT++ wrote a line" and "the
// dashboard saw it". No polling of byte positions, no invented timing,
// just forwarding real bytes.
//
// This module knows nothing about scenarios or which run is "active" --
// that decision belongs to scenarioRegistry.js, which creates one of
// these per discovered live directory and combines their output.

import fs from 'fs';
import path from 'path';

// "Newest run" is decided by file creation time. Most filesystems
// (including NTFS, which is what this project runs on) report a real
// birthtime; a few (older Linux ext filesystems, some network mounts)
// report 0 for it, so fall back to mtime there -- still a reasonable
// proxy for "when did this run start".
export function getCreationTimeMs(filePath) {
  try {
    const stat = fs.statSync(filePath);
    return stat.birthtimeMs > 0 ? stat.birthtimeMs : stat.mtimeMs;
  } catch {
    return 0;
  }
}

// Creates a tailer for one directory. `initialKnownFiles` are files that
// already existed when this tailer was created (e.g. a backend restart
// picking up a run that was already in progress) -- their read offset
// starts at end-of-file so history isn't replayed, matching the original
// single-directory tailer's behaviour. Any file noticed AFTER that is
// treated as a brand-new run and read from byte 0, and reported via
// onNewFile so the caller can decide whether it's now the active run.
export function createDirTailer({ dir, scenario, onEvent, onNewFile, initialKnownFiles = [] }) {
  const offsets = new Map();
  const known = new Set();
  // fs.watch fires TWICE for a single new-file write on Linux/inotify --
  // once for "rename" (file created) and once for "change" (content
  // written). Without this guard, both firings race to read the file
  // before either has recorded the new offset, and the same line gets
  // broadcast twice. This coalesces overlapping reads per file instead of
  // letting them race, and re-checks after finishing in case more was
  // written during the read -- so it never double-delivers AND never
  // misses data.
  const inFlight = new Set();
  const pending = new Set();
  let fsWatcher = null;
  let closed = false;

  initialKnownFiles.forEach((full) => {
    known.add(full);
    try {
      offsets.set(full, fs.statSync(full).size);
    } catch {
      offsets.set(full, 0);
    }
  });

  function readNewLines(filePath) {
    if (closed) return;
    if (inFlight.has(filePath)) {
      pending.add(filePath);
      return;
    }

    let stat;
    try {
      stat = fs.statSync(filePath);
    } catch {
      return; // gone mid-check -- a later watch event/rescan notices if it comes back
    }
    const prevOffset = offsets.get(filePath) || 0;
    if (stat.size < prevOffset) {
      // file was truncated / a new run reused the name -- start over
      offsets.set(filePath, 0);
    }
    if (stat.size <= (offsets.get(filePath) || 0)) return;

    inFlight.add(filePath);
    const start = offsets.get(filePath) || 0;
    const stream = fs.createReadStream(filePath, { start, end: stat.size - 1, encoding: 'utf8' });
    let buf = '';
    stream.on('data', (chunk) => { buf += chunk; });
    stream.on('end', () => {
      const lastNewline = buf.lastIndexOf('\n');
      if (lastNewline === -1) {
        // No complete line in this read at all -- a write is still in
        // progress. Don't advance the offset; the trailing fragment gets
        // re-read (from the same start position) on the next pass once
        // the rest of the line has been flushed.
        inFlight.delete(filePath);
        if (pending.delete(filePath)) readNewLines(filePath);
        return;
      }
      const complete = buf.slice(0, lastNewline + 1);
      // \n is a single ASCII byte and can never appear inside a multi-byte
      // UTF-8 continuation sequence, so this byte-length split is safe even
      // with non-ASCII vehicle/road IDs in the JSON payload.
      offsets.set(filePath, start + Buffer.byteLength(complete, 'utf8'));
      complete.split('\n').filter(Boolean).forEach((line) => {
        try {
          onEvent(JSON.parse(line));
        } catch (e) {
          console.warn(`[tailer:${scenario}] skipped malformed line:`, e.message);
        }
      });
      inFlight.delete(filePath);
      if (pending.delete(filePath)) {
        readNewLines(filePath); // catch up on anything written mid-read
      }
    });
    stream.on('error', (e) => {
      // Includes Windows file-lock contention (EBUSY/EPERM) while
      // HazardApp still has the file open -- log and retry on the next
      // watch event or periodic re-scan rather than crashing the bridge.
      console.warn(`[tailer:${scenario}] read error:`, e.message);
      inFlight.delete(filePath);
      pending.delete(filePath);
    });
  }

  function noticeFile(full) {
    if (known.has(full)) {
      readNewLines(full);
      return;
    }
    known.add(full);
    offsets.set(full, 0); // brand-new run -- read from the very first line
    if (onNewFile) {
      try {
        onNewFile({ filePath: full, dir, scenario, createdAtMs: getCreationTimeMs(full) });
      } catch (e) {
        console.warn(`[tailer:${scenario}] onNewFile handler threw:`, e.message);
      }
    }
    readNewLines(full);
  }

  function scan() {
    let files;
    try {
      files = fs.readdirSync(dir).filter((f) => f.endsWith('.jsonl'));
    } catch {
      return; // directory missing/unreadable right now -- try again next rescan
    }
    files.forEach((f) => noticeFile(path.join(dir, f)));
  }

  function attachWatcher() {
    try {
      fsWatcher = fs.watch(dir, { persistent: true }, (eventType, filename) => {
        if (!filename || !filename.endsWith('.jsonl')) return;
        const full = path.join(dir, filename);
        if (fs.existsSync(full)) noticeFile(full);
        // A rename event with no existing file means deletion -- nothing
        // to do; readNewLines() already tolerates a file disappearing.
      });
      fsWatcher.on('error', (e) => {
        console.warn(`[tailer:${scenario}] watcher error on ${dir}:`, e.message);
        fsWatcher = null; // rescan() will try to re-attach
      });
    } catch (e) {
      // Directory doesn't exist yet (or was just removed) -- the
      // registry's periodic rescan calls rescan() again, which retries
      // this once the directory reappears.
      console.warn(`[tailer:${scenario}] could not watch ${dir} yet:`, e.message);
    }
  }

  attachWatcher();
  scan(); // catch anything created in the gap between discovery and attachWatcher()

  return {
    dir,
    scenario,
    // Safety net for the registry's periodic rescan: re-attaches the
    // filesystem watcher if it died (directory was removed and
    // recreated), and re-checks every known file's size in case a watch
    // event was silently missed (observed on some Windows/network-drive
    // setups). Cheap -- a readdir + a few stats, not a byte read unless
    // something actually grew.
    rescan() {
      if (!fsWatcher && fs.existsSync(dir)) attachWatcher();
      scan();
    },
    isWatcherAlive() {
      return fsWatcher != null;
    },
    close() {
      closed = true;
      fsWatcher?.close();
      fsWatcher = null;
    },
  };
}
