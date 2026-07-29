// scenarioRegistry.js
//
// Owns every discovered "results/live" directory (one per Veins
// scenario, plus one fixed directory for hardware/ESP32 ingest) and
// decides, at any moment, which run is "active" -- the one whose .jsonl
// file was created most recently across ALL of them. Only the active
// run's events are forwarded live (onLiveEvent); every run's file is
// still written and fully readable afterwards via listAllRunFiles /
// findRunFile, so nothing is lost -- it just isn't shown live once a
// newer run has taken over the dashboard.

import fs from 'fs';
import path from 'path';
import { findLiveDirs } from './scenarioDiscovery.js';
import { createDirTailer, getCreationTimeMs } from './tailer.js';

const RESCAN_INTERVAL_MS = 2000; // low-frequency safety net only -- picks
// up brand-new scenario folders and re-attaches any watcher that died.
// Individual line updates are still fully event-driven via fs.watch
// inside each dir's tailer, never polled.

export const SAFE_RUN_ID = /^[A-Za-z0-9._-]+$/;

export function isSafeRunId(runId) {
  return typeof runId === 'string' && SAFE_RUN_ID.test(runId);
}

function listJsonlFiles(dir) {
  try {
    return fs.readdirSync(dir).filter((f) => f.endsWith('.jsonl')).map((f) => path.join(dir, f));
  } catch {
    return [];
  }
}

export function createScenarioRegistry({ examplesRoot, hardwareDir, onLiveEvent, onActiveChange }) {
  const tailers = new Map(); // dir -> tailer handle
  let active = null; // { filePath, dir, scenario, createdAtMs, runId, runFile }

  function handleRawEvent(event) {
    // Only the currently active run's events reach the live WebSocket
    // feed. Every event is still on disk in its own run's file regardless
    // -- this only gates the live broadcast, so that "always follow the
    // newest active run" holds even if two scenarios happen to be
    // producing events at the same time.
    if (active && event.run_id === active.runId) {
      onLiveEvent?.(event);
    }
  }

  function considerActive(fileInfo) {
    if (!active || fileInfo.createdAtMs >= active.createdAtMs) {
      const runFile = path.basename(fileInfo.filePath);
      const runId = runFile.replace(/\.jsonl$/, '');
      active = { ...fileInfo, runId, runFile };
      onActiveChange?.(active);
    }
  }

  function attachDir(dir, scenario, initialKnownFiles) {
    if (tailers.has(dir)) return; // never create a second watcher for the same directory
    const tailer = createDirTailer({
      dir,
      scenario,
      onEvent: handleRawEvent,
      onNewFile: considerActive,
      initialKnownFiles,
    });
    tailers.set(dir, tailer);
  }

  function bootstrap() {
    try {
      fs.mkdirSync(hardwareDir, { recursive: true });
    } catch (e) {
      console.warn('[scenario-registry] could not create hardware ingest folder:', e.message);
    }

    const discovered = findLiveDirs(examplesRoot);
    const allDirs = [...discovered, { dir: hardwareDir, scenario: 'hardware' }];

    // Figure out which already-existing file (if any) is the newest
    // BEFORE starting any tailer, so a backend restart mid-run recovers
    // the correct active scenario immediately instead of waiting for the
    // next new file to appear.
    let bestAtBoot = null;
    const knownByDir = new Map();
    for (const { dir, scenario } of allDirs) {
      const files = listJsonlFiles(dir);
      knownByDir.set(dir, files);
      for (const filePath of files) {
        const createdAtMs = getCreationTimeMs(filePath);
        if (!bestAtBoot || createdAtMs >= bestAtBoot.createdAtMs) {
          bestAtBoot = { filePath, dir, scenario, createdAtMs };
        }
      }
    }

    for (const { dir, scenario } of allDirs) {
      attachDir(dir, scenario, knownByDir.get(dir) || []);
    }

    if (bestAtBoot) considerActive(bestAtBoot);

    console.log(`[scenario-registry] examples root: ${examplesRoot || '(not set)'}`);
    console.log(`[scenario-registry] watching ${allDirs.length} live folder(s):`);
    allDirs.forEach(({ dir, scenario }) => console.log(`  - ${scenario}: ${dir}`));
    if (!examplesRoot) {
      console.warn('[scenario-registry] VEINS_EXAMPLES_ROOT is not set -- only the hardware ingest folder is being watched.');
    }
  }

  function rescan() {
    const discovered = findLiveDirs(examplesRoot);
    for (const { dir, scenario } of discovered) {
      if (!tailers.has(dir)) {
        console.log(`[scenario-registry] new scenario folder discovered: ${scenario} (${dir})`);
        // Deliberately NOT passing existing files as "already known" here
        // (unlike bootstrap()) -- this directory is new information to the
        // registry, so whatever's already inside it (typically nothing, or
        // the run that's the whole reason we just noticed this folder)
        // gets evaluated as a normal new-file candidate for "active",
        // instead of being silently treated as old history to skip.
        attachDir(dir, scenario, []);
      }
    }
    for (const tailer of tailers.values()) tailer.rescan();
  }

  bootstrap();
  const rescanTimer = setInterval(rescan, RESCAN_INTERVAL_MS);
  rescanTimer.unref?.();

  return {
    getActive: () => active,

    getWatchedDirs: () => [...tailers.values()].map((t) => ({ dir: t.dir, scenario: t.scenario })),

    // Fresh from disk every call, same philosophy as the rest of this
    // project -- the .jsonl files ARE the persistence layer, there's no
    // separate index to fall out of sync with them.
    listAllRunFiles() {
      const out = [];
      for (const tailer of tailers.values()) {
        for (const filePath of listJsonlFiles(tailer.dir)) {
          out.push({ filePath, dir: tailer.dir, scenario: tailer.scenario });
        }
      }
      return out;
    },

    // Resolves a run_id to an absolute path, searching every watched
    // directory. Validates the run_id format first (defense against path
    // traversal) and, per candidate directory, re-confirms the resolved
    // path is still inside that directory (defense in depth).
    findRunFile(runId) {
      if (!isSafeRunId(runId)) return null;
      for (const tailer of tailers.values()) {
        const dirAbs = path.resolve(tailer.dir);
        const candidate = path.resolve(dirAbs, `${runId}.jsonl`);
        if (!candidate.startsWith(dirAbs + path.sep)) continue;
        if (fs.existsSync(candidate)) return candidate;
      }
      return null;
    },

    close() {
      clearInterval(rescanTimer);
      for (const tailer of tailers.values()) tailer.close();
      tailers.clear();
    },
  };
}
