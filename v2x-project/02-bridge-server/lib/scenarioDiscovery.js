// scenarioDiscovery.js
//
// Finds every Veins scenario's HazardApp live-event folder
// (".../<scenario>/results/live") under one root directory, so the
// bridge server never needs a scenario hardcoded or manually selected.
//
// A "scenario" here is just the name of the folder that directly
// contains "results" -- e.g. for
//   C:\...\examples\scenario4\results\live
// the scenario name is "scenario4". This matches how examples/<scenario>
// folders are already laid out; nothing about that layout changes.

import fs from 'fs';
import path from 'path';

const SKIP_DIR_NAMES = new Set(['node_modules', '.git', '.svn', '.hg', '__pycache__']);
const DEFAULT_MAX_DEPTH = 8;

export function scenarioNameForLiveDir(liveDir) {
  // ".../examples/scenario4/results/live" -> "scenario4"
  return path.basename(path.dirname(path.dirname(liveDir)));
}

function isLiveDir(dir) {
  return path.basename(dir) === 'live' && path.basename(path.dirname(dir)) === 'results';
}

// Recursively finds every "results/live" directory reachable from `root`.
// Returns [{ dir, scenario }]. Never throws -- a permission error, or a
// folder that vanishes mid-scan, is skipped rather than fatal, since this
// runs repeatedly for the lifetime of the process (new scenario folders
// can appear at any time, long after the bridge started).
export function findLiveDirs(root, maxDepth = DEFAULT_MAX_DEPTH) {
  const found = [];
  if (!root) return found;
  if (!fs.existsSync(root)) return found;

  function walk(dir, depth) {
    if (depth > maxDepth) return;

    if (isLiveDir(dir)) {
      found.push({ dir, scenario: scenarioNameForLiveDir(dir) });
      return; // nothing useful to recurse into below a live dir itself
    }

    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return; // permission denied / removed mid-scan -- skip quietly
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (SKIP_DIR_NAMES.has(entry.name)) continue;
      if (entry.name.startsWith('.')) continue;
      walk(path.join(dir, entry.name), depth + 1);
    }
  }

  walk(path.resolve(root), 0);
  return found;
}
