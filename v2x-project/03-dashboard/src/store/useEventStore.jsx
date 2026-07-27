import { createContext, useContext, useReducer, useEffect, useRef } from 'react';
import { connectEventStream } from '../lib/ws.js';

const MAX_PACKETS = 200;
const MAX_DECISIONS = 2000;

const initialState = {
  connected: false,
  runId: null,
  scenario: null,
  vehicles: {}, // id -> { id, x, y, speed, heading, road_id, lastSeen, lastDecision }
  packets: [], // most recent first: { id, kind, ...payload, timestamp_sim, receivedAt }
  decisions: [], // most recent first, full dataset-row equivalents
};

function upsertVehicle(vehicles, payload, extra) {
  const prev = vehicles[payload.vehicle_id] || { id: payload.vehicle_id };
  return {
    ...vehicles,
    [payload.vehicle_id]: { ...prev, ...payload, id: payload.vehicle_id, ...extra },
  };
}

function reducer(state, action) {
  switch (action.type) {
    case 'STATUS':
      return { ...state, connected: action.connected };

    case 'RESET_RUN':
      return {
        ...initialState,
        connected: state.connected,
        runId: action.runId,
        scenario: action.scenario,
      };

    case 'EVENT': {
      const event = action.event;

      // A new run started -- start the live view fresh.
      if (event.run_id && state.runId && event.run_id !== state.runId) {
        state = { ...initialState, connected: state.connected, runId: event.run_id, scenario: event.scenario };
      } else if (!state.runId && event.run_id) {
        state = { ...state, runId: event.run_id, scenario: event.scenario };
      }

      const receivedAt = Date.now();

      switch (event.type) {
        case 'vehicle_state': {
          return {
            ...state,
            vehicles: upsertVehicle(state.vehicles, event.payload, {
              lastSeen: receivedAt,
              timestamp_sim: event.timestamp_sim,
            }),
          };
        }

        case 'packet_tx':
        case 'packet_rx':
        case 'packet_relay': {
          const kind = event.type.replace('packet_', '');
          // EventLogger only writes msg_type on the original tx event --
          // rx/relay events carry sender/receiver/hop info but not the
          // message kind itself. Look it up from the matching tx record
          // (same packet_id) so anything reading msg_type off an rx/relay
          // event (e.g. Driver View's alert feed) actually gets it instead
          // of always seeing undefined.
          let msgType = event.payload.msg_type;
          if (!msgType && event.payload.packet_id) {
            const txMatch = state.packets.find(
              (p) => p.kind === 'tx' && p.packet_id === event.payload.packet_id
            );
            msgType = txMatch?.msg_type;
          }
          const record = {
            key: `${event.type}-${event.payload.packet_id}-${kind}-${receivedAt}-${Math.random()}`,
            kind,
            timestamp_sim: event.timestamp_sim,
            receivedAt,
            ...event.payload,
            msg_type: msgType,
          };
          return {
            ...state,
            packets: [record, ...state.packets].slice(0, MAX_PACKETS),
          };
        }

        case 'decision': {
          const record = {
            key: `decision-${event.payload.vehicle_id}-${receivedAt}-${Math.random()}`,
            timestamp_sim: event.timestamp_sim,
            receivedAt,
            ...event.payload,
          };
          return {
            ...state,
            decisions: [record, ...state.decisions].slice(0, MAX_DECISIONS),
            vehicles: upsertVehicle(
              state.vehicles,
              { vehicle_id: event.payload.vehicle_id },
              { lastDecision: event.payload.decision, lastDecisionAt: receivedAt }
            ),
          };
        }

        default:
          return state;
      }
    }

    default:
      return state;
  }
}

const EventStoreContext = createContext(null);

export function EventStoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const connectionRef = useRef(null);

  useEffect(() => {
    connectionRef.current = connectEventStream({
      onEvent: (event) => dispatch({ type: 'EVENT', event }),
      onStatusChange: (status) => dispatch({ type: 'STATUS', connected: status === 'connected' }),
    });
    return () => connectionRef.current?.close();
  }, []);

  return <EventStoreContext.Provider value={state}>{children}</EventStoreContext.Provider>;
}

export function useEventStore() {
  const ctx = useContext(EventStoreContext);
  if (!ctx) throw new Error('useEventStore must be used inside EventStoreProvider');
  return ctx;
}
