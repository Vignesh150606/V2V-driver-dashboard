// Thin wrapper around the WebSocket server. Every event handed to
// hub.broadcast() -- whether it came from a simulation tailer, the
// scenario registry's own "scenarioChanged" notifications, or the
// hardware ingest endpoint -- goes out to every connected dashboard
// unchanged, AND is recorded into a small snapshot/backlog so a client
// that connects (or reconnects) mid-run isn't stuck looking at an empty
// dashboard until the next event happens to arrive.
const MAX_PACKETS_BACKLOG = 200;
const MAX_DECISIONS_BACKLOG = 2000;

export function createHub(wss) {
  let currentRunId = null;
  // Most recent scenarioChanged message, resent to late-joining clients
  // so the header never shows "no scenario yet" just because the client
  // connected a moment after the switch happened.
  let lastScenarioStatus = null;
  const vehicleSnapshot = new Map(); // vehicle_id -> latest vehicle_state event
  const packetBacklog = [];
  const decisionBacklog = [];

  function resetSnapshot() {
    vehicleSnapshot.clear();
    packetBacklog.length = 0;
    decisionBacklog.length = 0;
  }

  function record(event) {
    if (event.run_id && event.run_id !== currentRunId) {
      currentRunId = event.run_id;
      resetSnapshot();
    }
    switch (event.type) {
      case 'vehicle_state':
        if (event.payload?.vehicle_id) vehicleSnapshot.set(event.payload.vehicle_id, event);
        break;
      case 'packet_tx':
      case 'packet_rx':
      case 'packet_relay':
        packetBacklog.push(event);
        if (packetBacklog.length > MAX_PACKETS_BACKLOG) packetBacklog.shift();
        break;
      case 'decision':
        decisionBacklog.push(event);
        if (decisionBacklog.length > MAX_DECISIONS_BACKLOG) decisionBacklog.shift();
        break;
      default:
        // scenarioChanged and any other control messages carry no
        // vehicle/packet/decision payload to snapshot -- the run_id check
        // above already reset the snapshot if this was a genuine switch.
        break;
    }
  }

  wss.on('connection', (ws) => {
    ws.send(JSON.stringify({ type: 'hello', payload: { message: 'connected to v2x bridge' } }));

    // Tell a newly-connected client which scenario is currently active
    // even if no vehicle_state event has arrived yet since the switch.
    if (lastScenarioStatus) ws.send(JSON.stringify(lastScenarioStatus));

    // Replay what this client missed -- latest position per vehicle first
    // (so the map is populated immediately), then the packet/decision
    // history in the order it originally happened.
    for (const event of vehicleSnapshot.values()) ws.send(JSON.stringify(event));
    for (const event of [...packetBacklog, ...decisionBacklog]) ws.send(JSON.stringify(event));
  });

  return {
    broadcast(event) {
      if (event.type === 'scenarioChanged') lastScenarioStatus = event;
      record(event);
      const msg = JSON.stringify(event);
      wss.clients.forEach((client) => {
        if (client.readyState === 1) client.send(msg);
      });
    },
    clientCount() {
      return wss.clients.size;
    },
  };
}
