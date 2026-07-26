import { useEffect, useState, useMemo } from 'react';
import { useEventStore } from '../store/useEventStore.jsx';
import StatCard from '../components/StatCard.jsx';
import VehicleMap from '../components/VehicleMap.jsx';

export default function DashboardPage() {
  const { vehicles, packets, decisions, runId, scenario, connected } = useEventStore();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 300);
    return () => clearInterval(t);
  }, []);

  const vehicleCount = Object.keys(vehicles).length;
  const waitCount = decisions.filter((d) => d.decision?.startsWith('WAIT')).length;
  const safeCount = decisions.filter((d) => d.decision === 'SAFE').length;

  const recentDecisions = useMemo(() => decisions.slice(0, 6), [decisions]);

  return (
    <div className="p-6 space-y-6">
      {!connected && (
        <div className="border border-red/40 bg-red/5 text-red text-sm rounded-lg px-4 py-3">
          Not connected to the bridge server. Start it with <code className="font-mono">npm start</code> in{' '}
          <code className="font-mono">02-bridge-server</code>, then run a live-scheduled HazardApp simulation.
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Active vehicles" value={vehicleCount} tone="blue" />
        <StatCard label="Packets seen" value={packets.length} sub="last 200 buffered" />
        <StatCard label="SAFE decisions" value={safeCount} tone="teal" />
        <StatCard label="WAIT decisions" value={waitCount} tone="amber" />
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          <div className="text-xs text-ink2 uppercase tracking-wide mb-2">Live map — {runId || 'no run yet'}{scenario ? ` · ${scenario}` : ''}</div>
          <div className="h-80">
            <VehicleMap vehicles={vehicles} packets={packets} now={now} />
          </div>
        </div>

        <div>
          <div className="text-xs text-ink2 uppercase tracking-wide mb-2">Recent decisions</div>
          <div className="border border-line bg-panel rounded-lg divide-y divide-line">
            {recentDecisions.length === 0 && (
              <div className="px-4 py-6 text-sm text-ink3 text-center">no decisions yet</div>
            )}
            {recentDecisions.map((d) => (
              <div key={d.key} className="px-4 py-2.5 flex items-center justify-between text-sm">
                <span className="font-mono text-ink">{d.vehicle_id}</span>
                <span className={`font-mono text-xs ${d.decision === 'SAFE' ? 'text-teal' : 'text-amber'}`}>
                  {d.decision}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
