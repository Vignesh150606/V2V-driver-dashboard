import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'http';
import { WebSocketServer } from 'ws';
import fs from 'fs';
import path from 'path';

import { startTailing } from './lib/tailer.js';
import { createHub } from './lib/hub.js';
import { computeRunStats } from './lib/runStats.js';

const PORT = process.env.PORT || 8080;
const LOG_DIR = process.env.HAZARD_LOG_DIR || path.resolve('./results/live');

if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

// Any runId that reaches a filesystem path (from a URL param OR from
// event.run_id in a hardware POST body) must be validated before use --
// otherwise "../../../etc/passwd"-style values let a request read, export,
// or delete arbitrary files outside LOG_DIR. Returns the safe absolute path,
// or null if the runId is invalid.
const SAFE_RUN_ID = /^[A-Za-z0-9._-]+$/;
function resolveRunFile(runId) {
  if (typeof runId !== 'string' || !SAFE_RUN_ID.test(runId)) return null;
  const full = path.resolve(LOG_DIR, `${runId}.jsonl`);
  // Defense in depth: even with the whitelist above this should be
  // unreachable, but confirm the resolved path is still inside LOG_DIR.
  if (!full.startsWith(path.resolve(LOG_DIR) + path.sep)) return null;
  return full;
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '256kb' }));

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
const hub = createHub(wss);

function handleEvent(event) {
  hub.broadcast(event);
}

// Source A: the simulation, via HazardApp's log file
startTailing(LOG_DIR, handleEvent);

// Source B: hardware (ESP32) or anything else, over HTTP -- same schema
app.post('/api/ingest', (req, res) => {
  const event = req.body;
  if (!event || !event.type || !event.payload) {
    return res.status(400).json({ error: 'event must include "type" and "payload"' });
  }
  event.source = event.source || 'hardware';
  event.timestamp_wall = Date.now();

  // Persisting to LOG_DIR is the ONLY broadcast trigger -- the tailer
  // watching this directory picks up the appended line and calls
  // handleEvent() itself. Do not also call handleEvent() here: that
  // delivers this same event to every connected client a second time as
  // soon as the tailer's fs.watch fires (confirmed duplicate delivery of
  // every hardware-ingested vehicle_state/packet/decision when this was
  // tried before).
  const runId = event.run_id || 'hardware_live';
  const filePath = resolveRunFile(runId);
  if (!filePath) {
    console.warn(`[ingest] rejected unsafe run_id in event body: ${JSON.stringify(runId)}`);
    return res.status(400).json({ error: 'run_id must be alphanumeric (with _ . -), no path separators' });
  }
  fs.appendFile(filePath, JSON.stringify(event) + '\n', (err) => {
    if (err) console.warn('[ingest] failed to persist event to', filePath, err.message);
  });

  res.json({ ok: true });
});

// Run history for the Replay page and the Driver View's dynamic vehicle/
// scenario discovery. Every field here is computed fresh from the actual
// recorded file on disk each time this is called -- the .jsonl files
// written by EventLogger ARE the persistence layer; there is no separate
// database to fall out of sync with them, and nothing here survives only
// in memory (a server restart loses zero run history).
app.get('/api/runs', (req, res) => {
  const files = fs.readdirSync(LOG_DIR).filter((f) => f.endsWith('.jsonl'));
  const runs = files.map((f) => {
    try {
      return computeRunStats(path.join(LOG_DIR, f));
    } catch {
      return { run_id: f.replace('.jsonl', ''), scenario: 'unknown', event_count: 0 };
    }
  });
  res.json(runs.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)));
});

app.get('/api/runs/:runId', (req, res) => {
  const full = resolveRunFile(req.params.runId);
  if (!full) return res.status(400).json({ error: 'invalid run id' });
  if (!fs.existsSync(full)) return res.status(404).json({ error: 'run not found' });
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
  const full = resolveRunFile(req.params.runId);
  if (!full) return res.status(400).json({ error: 'invalid run id' });
  if (!fs.existsSync(full)) return res.status(404).json({ error: 'run not found' });
  res.download(full, `${req.params.runId}.jsonl`);
});

// Delete a single run.
app.delete('/api/runs/:runId', (req, res) => {
  const full = resolveRunFile(req.params.runId);
  if (!full) return res.status(400).json({ error: 'invalid run id' });
  if (!fs.existsSync(full)) return res.status(404).json({ error: 'run not found' });
  fs.unlinkSync(full);
  res.json({ ok: true });
});

// Clear all run history.
app.delete('/api/runs', (req, res) => {
  const files = fs.readdirSync(LOG_DIR).filter((f) => f.endsWith('.jsonl'));
  files.forEach((f) => fs.unlinkSync(path.join(LOG_DIR, f)));
  res.json({ ok: true, deleted: files.length });
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true, clients: hub.clientCount(), watching: LOG_DIR });
});

server.listen(PORT, () => {
  console.log(`V2X bridge server listening on :${PORT}`);
  console.log(`WebSocket endpoint:  ws://localhost:${PORT}/ws`);
  console.log(`Watching for HazardApp event logs in: ${LOG_DIR}`);
});

function shutdown() {
  console.log('\nShutting down -- closing WebSocket clients and HTTP server...');
  wss.clients.forEach((client) => client.close(1001, 'server shutting down'));
  wss.close(() => {
    server.close(() => process.exit(0));
  });
  // Don't hang forever if a client never acknowledges the close.
  setTimeout(() => process.exit(0), 2000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
