// Thin wrapper around the WebSocket server: every event handed to
// hub.broadcast() -- whether it came from the simulation tailer or the
// hardware ingest endpoint -- goes out to every connected dashboard
// unchanged. The dashboard never has to know which source produced it.
export function createHub(wss) {
  wss.on('connection', (ws) => {
    ws.send(JSON.stringify({ type: 'hello', payload: { message: 'connected to v2x bridge' } }));
  });

  return {
    broadcast(event) {
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
