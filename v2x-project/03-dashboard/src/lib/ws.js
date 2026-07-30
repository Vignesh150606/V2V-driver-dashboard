// Thin WebSocket client. Every message it receives is a real event that
// originated in HazardApp (or, later, an ESP32) and passed through the
// bridge server unchanged -- this file never invents or replays anything
// on its own; it only connects and reconnects.

const DEFAULT_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8080/ws';

export function connectEventStream({ onEvent, onStatusChange }) {
  let socket = null;
  let reconnectDelay = 1000;
  let reconnectTimer = null;
  let closedByCaller = false;

  function connect() {
    socket = new WebSocket(DEFAULT_URL);

    socket.onopen = () => {
      reconnectDelay = 1000;
      onStatusChange?.('connected');
    };

    socket.onmessage = (msg) => {
      try {
        const event = JSON.parse(msg.data);
        if (event.type === 'hello') return; // handshake message, not simulation data
        onEvent?.(event);
      } catch (e) {
        console.warn('[ws] could not parse message', e);
      }
    };

    socket.onclose = () => {
      onStatusChange?.('disconnected');
      if (closedByCaller) return;
      reconnectTimer = setTimeout(connect, reconnectDelay);
      reconnectDelay = Math.min(reconnectDelay * 1.5, 10000);
    };

    socket.onerror = () => {
      socket.close();
    };
  }

  connect();

  return {
    close() {
      closedByCaller = true;
      clearTimeout(reconnectTimer); // otherwise a reconnect already queued from a prior disconnect fires anyway and opens a new socket after the caller thinks this is shut down
      socket?.close();
    },
  };
}

export function getBridgeHttpBase() {
  // Derive the REST base from the WS URL (ws://host:port/ws -> http://host:port)
  return DEFAULT_URL.replace(/^ws/, 'http').replace(/\/ws$/, '');
}
