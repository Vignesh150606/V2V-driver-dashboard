import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { getBridgeHttpBase } from '../lib/ws.js';
import VehicleMap from '../components/VehicleMap.jsx';

// A minimal, self-contained event accumulator -- deliberately not reusing
// the live store, so replaying a past run never touches what's on screen
// for an actual live run.
function applyEvent(state, event) {
  const receivedAt = Date.now();
  switch (event.type) {
    case 'vehicle_state':
      return {
        ...state,
        vehicles: {
          ...state.vehicles,
          [event.payload.vehicle_id]: { ...event.payload, id: event.payload.vehicle_id, lastSeen: receivedAt },
        },
      };
    case 'packet_tx':
    case 'packet_rx':
    case 'packet_relay':
      return {
        ...state,
        packets: [
          { key: `${event.type}-${Math.random()}`, kind: event.type.replace('packet_', ''), receivedAt, timestamp_sim: event.timestamp_sim, ...event.payload },
          ...state.packets,
        ].slice(0, 200),
      };
    case 'decision': {
      const vId = event.payload.vehicle_id;
      const prevVehicle = state.vehicles[vId] || { id: vId };
      return {
        ...state,
        vehicles: { ...state.vehicles, [vId]: { ...prevVehicle, lastDecision: event.payload.decision } },
      };
    }
    default:
      return state;
  }
}

function formatDuration(seconds) {
  if (!seconds) return '0s';
  return seconds >= 60 ? `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s` : `${seconds.toFixed(1)}s`;
}

export default function ReplayPage() {
  const [runs, setRuns] = useState([]);
  const [selectedRun, setSelectedRun] = useState(null);
  const [events, setEvents] = useState([]);
  const [playState, setPlayState] = useState({ vehicles: {}, packets: [] });
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [now, setNow] = useState(Date.now());
  const cursorRef = useRef(0);
  const timerRef = useRef(null);

  const refreshRuns = useCallback(() => {
    fetch(`${getBridgeHttpBase()}/api/runs`).then((r) => r.json()).then(setRuns).catch(() => {});
  }, []);

  useEffect(() => { refreshRuns(); }, [refreshRuns]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, []);

  function loadRun(runId) {
    fetch(`${getBridgeHttpBase()}/api/runs/${runId}`)
      .then((r) => r.json())
      .then((evs) => {
        setSelectedRun(runId);
        setEvents(evs);
        setPlayState({ vehicles: {}, packets: [] });
        cursorRef.current = 0;
        setPlaying(false);
      });
  }

  function exportRun(e, runId) {
    e.stopPropagation();
    window.open(`${getBridgeHttpBase()}/api/runs/${runId}/export`, '_blank');
  }

  async function deleteRun(e, runId) {
    e.stopPropagation();
    if (!window.confirm(`Delete run "${runId}"? This cannot be undone.`)) return;
    await fetch(`${getBridgeHttpBase()}/api/runs/${runId}`, { method: 'DELETE' });
    if (selectedRun === runId) {
      setSelectedRun(null);
      setEvents([]);
    }
    refreshRuns();
  }

  async function clearHistory() {
    if (!window.confirm(`Delete all ${runs.length} recorded runs? This cannot be undone.`)) return;
    await fetch(`${getBridgeHttpBase()}/api/runs`, { method: 'DELETE' });
    setSelectedRun(null);
    setEvents([]);
    refreshRuns();
  }

  useEffect(() => {
    if (!playing) {
      clearTimeout(timerRef.current);
      return;
    }
    if (cursorRef.current >= events.length) {
      setPlaying(false);
      return;
    }

    const step = () => {
      const i = cursorRef.current;
      if (i >= events.length) {
        setPlaying(false);
        return;
      }
      const event = events[i];
      setPlayState((s) => applyEvent(s, event));
      cursorRef.current = i + 1;

      const next = events[i + 1];
      const delaySimMs = next ? Math.max((next.timestamp_sim - event.timestamp_sim) * 1000, 0) : 0;
      const delay = Math.min(delaySimMs / speed, 2000); // cap so gaps in the log don't stall the demo
      timerRef.current = setTimeout(step, delay);
    };
    step();

    return () => clearTimeout(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, events, speed]);

  const progress = events.length ? Math.round((cursorRef.current / events.length) * 100) : 0;

  return (
    <div className="p-6 grid grid-cols-3 gap-6">
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs text-ink2 uppercase tracking-wide">Recorded runs ({runs.length})</div>
          {runs.length > 0 && (
            <button onClick={clearHistory} className="text-xs text-ink3 hover:text-red outline-none focus-visible:ring-2 focus-visible:ring-red/50 rounded">
              clear all
            </button>
          )}
        </div>
        <div className="border border-line bg-panel rounded-lg divide-y divide-line max-h-[600px] overflow-y-auto">
          {runs.length === 0 && <div className="px-4 py-6 text-sm text-ink3 text-center">no runs recorded yet</div>}
          {runs.map((r) => (
            <div
              key={r.run_id}
              onClick={() => loadRun(r.run_id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  loadRun(r.run_id);
                }
              }}
              role="button"
              tabIndex={0}
              className={`w-full text-left px-4 py-3 text-sm cursor-pointer group outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal/50 ${
                selectedRun === r.run_id ? 'bg-panel2' : 'hover:bg-panel2/60'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="font-mono text-ink truncate">{r.run_id}</div>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 shrink-0">
                  <button onClick={(e) => exportRun(e, r.run_id)} className="text-xs text-ink2 hover:text-teal outline-none focus-visible:ring-2 focus-visible:ring-teal/50 rounded" title="Export raw .jsonl">
                    export
                  </button>
                  <button onClick={(e) => deleteRun(e, r.run_id)} className="text-xs text-ink2 hover:text-red outline-none focus-visible:ring-2 focus-visible:ring-red/50 rounded" title="Delete this run">
                    delete
                  </button>
                </div>
              </div>
              <div className="text-xs text-ink3 mt-0.5">
                {r.scenario} · {r.vehicle_count ?? '—'} vehicles · {r.event_count} events · {formatDuration(r.duration_sim)}
              </div>
              {r.warning_count > 0 && (
                <div className="text-xs text-amber mt-0.5">{r.warning_count} warning decisions</div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="col-span-2 space-y-3">
        {!selectedRun ? (
          <div className="text-sm text-ink3">Pick a recorded run to replay it at its original pace.</div>
        ) : (
          <>
            <div className="flex items-center gap-3 text-xs font-mono text-ink2">
              <button
                onClick={() => setPlaying((p) => !p)}
                className="px-3 py-1.5 rounded border border-line2 text-ink hover:border-teal outline-none focus-visible:ring-2 focus-visible:ring-teal/50"
              >
                {playing ? 'pause' : 'play'}
              </button>
              <select
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
                className="bg-panel border border-line2 rounded px-2 py-1.5 text-ink outline-none focus-visible:ring-2 focus-visible:ring-teal/50"
              >
                <option value={0.5}>0.5x</option>
                <option value={1}>1x</option>
                <option value={2}>2x</option>
                <option value={4}>4x</option>
              </select>
              <span>{progress}% · {cursorRef.current}/{events.length} events</span>
            </div>
            <div className="h-96">
              <VehicleMap vehicles={playState.vehicles} packets={playState.packets} now={now} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
