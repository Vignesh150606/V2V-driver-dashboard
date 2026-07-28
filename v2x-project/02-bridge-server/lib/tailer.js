import fs from 'fs';
import path from 'path';

// Watches `dir` for HazardApp's .jsonl event log files and streams only
// newly appended lines (tail -f style) into onEvent. This is the entire
// bridge between "OMNeT++ wrote a line" and "the dashboard saw it" -- no
// polling of positions, no invented timing, just forwarding real bytes.
export function startTailing(dir, onEvent) {
  const offsets = new Map();
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

  function readNewLines(filePath) {
    if (inFlight.has(filePath)) {
      pending.add(filePath);
      return;
    }

    let stat;
    try {
      stat = fs.statSync(filePath);
    } catch {
      return;
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
          console.warn('[tailer] skipped malformed line:', e.message);
        }
      });
      inFlight.delete(filePath);
      if (pending.delete(filePath)) {
        readNewLines(filePath); // catch up on anything written mid-read
      }
    });
    stream.on('error', (e) => {
      console.warn('[tailer] read error:', e.message);
      inFlight.delete(filePath);
      pending.delete(filePath);
    });
  }

  // Don't replay old runs on boot -- start tracking from current EOF.
  fs.readdirSync(dir)
    .filter((f) => f.endsWith('.jsonl'))
    .forEach((f) => {
      const full = path.join(dir, f);
      offsets.set(full, fs.statSync(full).size);
    });

  fs.watch(dir, { persistent: true }, (eventType, filename) => {
    if (!filename || !filename.endsWith('.jsonl')) return;
    const full = path.join(dir, filename);
    if (fs.existsSync(full)) readNewLines(full);
  });

  console.log(`[tailer] watching ${dir} for live HazardApp events`);
}
