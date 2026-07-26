import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'http';
import { WebSocketServer } from 'ws';
import fs from 'fs';
import path from 'path';

import { startTailing } from './lib/tailer.js';
import { createHub } from './lib/hub.js';

const PORT = process.env.PORT || 8080;
const LOG_DIR = process.env.HAZARD_LOG_DIR || path.resolve('./results/live');

if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

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
  handleEvent(event);

  // Also append to today's run log so hardware runs show up in Replay
  const runId = event.run_id || 'hardware_live';
  const filePath = path.join(LOG_DIR, `${runId}.jsonl`);
  fs.appendFile(filePath, JSON.stringify(event) + '\n', () => {});

  res.json({ ok: true });
});

// Run history for the Replay page
app.get('/api/runs', (req, res) => {
  const files = fs.readdirSync(LOG_DIR).filter((f) => f.endsWith('.jsonl'));
  const runs = files.map((f) => {
    const full = path.join(LOG_DIR, f);
    const stat = fs.statSync(full);
    let scenario = 'unknown';
    let eventCount = 0;
    try {
      const lines = fs.readFileSync(full, 'utf8').trim().split('\n').filter(Boolean);
      eventCount = lines.length;
      if (lines.length) scenario = JSON.parse(lines[0]).scenario || scenario;
    } catch {
      // malformed/partial file -- still list it, just without metadata
    }
    return {
      run_id: f.replace('.jsonl', ''),
      scenario,
      event_count: eventCount,
      updated_at: stat.mtime,
    };
  });
  res.json(runs.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)));
});

app.get('/api/runs/:runId', (req, res) => {
  const full = path.join(LOG_DIR, `${req.params.runId}.jsonl`);
  if (!fs.existsSync(full)) return res.status(404).json({ error: 'run not found' });
  const events = fs
    .readFileSync(full, 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l));
  res.json(events);
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