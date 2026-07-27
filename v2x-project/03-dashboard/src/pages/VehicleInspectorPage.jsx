import { useState, useMemo } from 'react';
import { useEventStore } from '../store/useEventStore.jsx';

export default function VehicleInspectorPage() {
  const { vehicles, decisions } = useEventStore();
  const list = Object.values(vehicles).sort((a, b) => a.id.localeCompare(b.id));
  const [selectedId, setSelectedId] = useState(null);

  const selected = selectedId ? vehicles[selectedId] : list[0];
  const history = useMemo(
    () => decisions.filter((d) => d.vehicle_id === selected?.id).slice(0, 30),
    [decisions, selected]
  );

  return (
    <div className="p-6 grid grid-cols-3 gap-6">
      <div>
        <div className="text-xs text-ink2 uppercase tracking-wide mb-2">Vehicles</div>
        <div className="border border-line bg-panel rounded-lg divide-y divide-line">
          {list.length === 0 && <div className="px-4 py-6 text-sm text-ink3 text-center">none yet</div>}
          {list.map((v) => (
            <button
              key={v.id}
              onClick={() => setSelectedId(v.id)}
              className={`w-full text-left px-4 py-2.5 text-sm font-mono outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal/50 ${
                selected?.id === v.id ? 'bg-panel2 text-ink' : 'text-ink2 hover:text-ink'
              }`}
            >
              {v.id}
            </button>
          ))}
        </div>
      </div>

      <div className="col-span-2 space-y-5">
        {!selected ? (
          <div className="text-sm text-ink3">Select a vehicle once state events arrive.</div>
        ) : (
          <>
            <div>
              <div className="text-xs text-ink2 uppercase tracking-wide mb-2">Live state — {selected.id}</div>
              <div className="grid grid-cols-4 gap-3 font-mono text-sm">
                {[
                  ['x', selected.x?.toFixed(1)],
                  ['y', selected.y?.toFixed(1)],
                  ['speed (m/s)', selected.speed?.toFixed(1)],
                  ['heading', `${selected.heading?.toFixed(0)}°`],
                ].map(([label, value]) => (
                  <div key={label} className="border border-line bg-panel rounded-lg px-3 py-2.5">
                    <div className="text-ink3 text-xs">{label}</div>
                    <div className="text-ink mt-1">{value ?? '—'}</div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="text-xs text-ink2 uppercase tracking-wide mb-2">Decision history</div>
              <div className="border border-line bg-panel rounded-lg divide-y divide-line max-h-96 overflow-y-auto">
                {history.length === 0 && <div className="px-4 py-6 text-sm text-ink3 text-center">no decisions logged for this vehicle yet</div>}
                {history.map((d) => (
                  <div key={d.key} className="px-4 py-2.5 flex items-center justify-between text-sm font-mono">
                    <span className={d.decision === 'SAFE' ? 'text-teal' : 'text-amber'}>{d.decision}</span>
                    <span className="text-ink2">ttc {d.ttc?.toFixed(2)}s</span>
                    <span className="text-ink2">{d.distance_m?.toFixed(1)} m</span>
                    <span className="text-ink3">t={d.timestamp_sim?.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
