import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'http';
import { WebSocketServer } from 'ws';
import fs from 'fs';
import path from 'path';

import { createHub } from './lib/hub.js';
import { computeRunStats } from './lib/runStats.js';
import { createScenarioRegistry, isSafeRunId } from './lib/scenarioRegistry.js';

const PORT = process.env.PORT || 8080;

// The ONLY path you configure: the root "examples" folder of your Veins
// checkout. The registry recursively discovers every
// "<scenario>/results/live" folder under it and automatically follows
// whichever one most recently started producing events -- you never
// point this at one specific scenario, and never edit this file to
// switch scenarios again.
//
// Example (Windows):
// VEINS_EXAMPLES_ROOT=C:\Users\you\veins-5.3.1\veins-veins-5.3.1\examples
const EXAMPLES_ROOT = process.env.VEINS_EXAMPLES_ROOT
  ? path.resolve(process.env.VEINS_EXAMPLES_ROOT)
  : null;

// Fixed, separate from the discovered scenario folders -- hardware/ESP32
// events aren't produced by a Veins scenario, so they get their own
// always-present "virtual scenario" instead of requiring a folder inside
// VEINS_EXAMPLES_ROOT.
const HARDWARE_DIR = path.resolve('./results/hardware-live');

const app = express();
app.use(cors());
app.use(express.json({ limit: '256kb' }));

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
const hub = createHub(wss);

const registry = createScenarioRegistry({
  examplesRoot: EXAMPLES_ROOT,
  hardwareDir: HARDWARE_DIR,
  onLiveEvent: (event) => hub.broadcast(event),
  onActiveChange: (activeInfo) => {
    console.log(`[scenario-registry] now following: ${activeInfo.scenario} / ${activeInfo.runFile}`);
    hub.broadcast({
      type: 'scenarioChanged',
      scenario: activeInfo.scenario,
      run: activeInfo.runFile,
      run_id: activeInfo.runId,
    });
  },
});

function resolveHardwareFile(runId) {
  if (!isSafeRunId(runId)) return null;
  const dirAbs = path.resolve(HARDWARE_DIR);
  const full = path.resolve(dirAbs, `${runId}.jsonl`);
  if (!full.startsWith(dirAbs + path.sep)) return null; // defense in depth
  return full;
}

// Source B: hardware (ESP32) or anything else, over HTTP -- same schema
// HazardApp writes. Source A (the simulation) is handled entirely inside
// scenarioRegistry/tailer -- this route only ever writes into
// HARDWARE_DIR, one of the directories the registry already watches, so
// hardware runs participate in auto-detection exactly like any scenario.
app.post('/api/ingest', (req, res) => {
  const event = req.body;
  if (!event || !event.type || !event.payload) {
    return res.status(400).json({ error: 'event must include "type" and "payload"' });
  }
  event.source = event.source || 'hardware';
  event.timestamp_wall = Date.now();
  // Stamp these onto the persisted event itself (not just used locally to
  // pick a filename) -- the live-broadcast filter and computeRunStats
  // both key off event.run_id / event.scenario, so a hardware client that
  // omits them would otherwise silently never show up live.
  event.scenario = event.scenario || 'hardware';
  event.run_id = event.run_id || 'hardware_live';

  const filePath = resolveHardwareFile(event.run_id);
  if (!filePath) {
    console.warn(`[ingest] rejected unsafe run_id in event body: ${JSON.stringify(event.run_id)}`);
    return res.status(400).json({ error: 'run_id must be alphanumeric (with _ . -), no path separators' });
  }

  // Persisting to disk is the ONLY broadcast trigger -- the hardware
  // directory's tailer picks up the appended line and calls onLiveEvent
  // itself. Do not also broadcast here: that delivers this same event to
  // every connected client a second time as soon as the tailer's
  // fs.watch fires (this duplicated every hardware-ingested event before
  // it was fixed -- see DEBUG_REPORT.md).
  fs.appendFile(filePath, JSON.stringify(event) + '\n', (err) => {
    if (err) console.warn('[ingest] failed to persist event to', filePath, err.message);
  });

  res.json({ ok: true });
});

// Run history for the Replay page and dataset export -- merged across
// every watched scenario folder plus the hardware folder. Every field is
// computed fresh from the actual recorded files on disk each time this
// is called, same as before; there is still no separate database to fall
// out of sync with them.
app.get('/api/runs', (req, res) => {
  const runs = registry.listAllRunFiles().map(({ filePath, scenario: scenarioDir }) => {
    try {
      return { ...computeRunStats(filePath), scenario_dir: scenarioDir };
    } catch {
      return {
        run_id: path.basename(filePath).replace('.jsonl', ''),
        scenario: 'unknown',
        scenario_dir: scenarioDir,
        event_count: 0,
      };
    }
  });
  res.json(runs.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)));
});

app.get('/api/runs/:runId', (req, res) => {
  if (!isSafeRunId(req.params.runId)) return res.status(400).json({ error: 'invalid run id' });
  const full = registry.findRunFile(req.params.runId);
  if (!full) return res.status(404).json({ error: 'run not found' });
  const events = fs
    .readFileSync(full, 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l));
  res.json(events);
});

// Export: the exact raw file HazardApp wrote, as a download.
app.get('/api/runs/:runId/export', (req, res) => {
  if (!isSafeRunId(req.params.runId)) return res.status(400).json({ error: 'invalid run id' });
  const full = registry.findRunFile(req.params.runId);
  if (!full) return res.status(404).json({ error: 'run not found' });
  res.download(full, `${req.params.runId}.jsonl`);
});

// Delete a single run.
app.delete('/api/runs/:runId', (req, res) => {
  if (!isSafeRunId(req.params.runId)) return res.status(400).json({ error: 'invalid run id' });
  const full = registry.findRunFile(req.params.runId);
  if (!full) return res.status(404).json({ error: 'run not found' });
  fs.unlinkSync(full);
  res.json({ ok: true });
});

// Clear all run history across every watched folder.
app.delete('/api/runs', (req, res) => {
  const files = registry.listAllRunFiles();
  files.forEach(({ filePath }) => {
    try {
      fs.unlinkSync(filePath);
    } catch (e) {
      console.warn('[api] failed to delete', filePath, e.message);
    }
  });
  res.json({ ok: true, deleted: files.length });
});

app.get('/api/health', (req, res) => {
  const active = registry.getActive();
  res.json({
    ok: true,
    clients: hub.clientCount(),
    examples_root: EXAMPLES_ROOT,
    watching: registry.getWatchedDirs(),
    active_scenario: active?.scenario ?? null,
    active_run: active?.runFile ?? null,
  });
});

server.listen(PORT, () => {
  console.log(`V2X bridge server listening on :${PORT}`);
  console.log(`WebSocket endpoint:  ws://localhost:${PORT}/ws`);
});

function shutdown() {
  console.log('\nShutting down -- closing WebSocket clients and HTTP server...');
  registry.close();
  wss.clients.forEach((client) => client.close(1001, 'server shutting down'));
  wss.close(() => {
    server.close(() => process.exit(0));
  });
  // Don't hang forever if a client never acknowledges the close.
  setTimeout(() => process.exit(0), 2000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
