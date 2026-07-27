import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useEventStore } from '../store/useEventStore.jsx';
import VehicleSelector from '../components/driver/VehicleSelector.jsx';
import FullscreenButton from '../components/driver/FullscreenButton.jsx';
import WarningCard from '../components/driver/WarningCard.jsx';
import DecisionCard from '../components/driver/DecisionCard.jsx';
import MiniRadar from '../components/driver/MiniRadar.jsx';
import AlertFeed from '../components/driver/AlertFeed.jsx';

export default function DriverView() {
  const { connected, runId, scenario, vehicles, decisions, packets } = useEventStore();
  const [selectedId, setSelectedId] = useState(null);

  // Never hardcoded -- whatever vehicle IDs are actually present in this run.
  const vehicleIds = useMemo(() => Object.keys(vehicles).sort(), [vehicles]);

  // Auto-select the first available vehicle, and re-select if the current
  // one disappears (e.g. it left the simulation) -- never a stale/dead pick.
  useEffect(() => {
    if (vehicleIds.length === 0) { setSelectedId(null); return; }
    if (!selectedId || !vehicleIds.includes(selectedId)) {
      setSelectedId(vehicleIds[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicleIds]);

  const vehicleState = selectedId ? vehicles[selectedId] : null;

  const latestDecision = useMemo(
    () => decisions.find((d) => d.vehicle_id === selectedId) || null,
    [decisions, selectedId]
  );

  const messageSource = useMemo(() => {
    if (!latestDecision?.related_packet_id) return null;
    const pkt = packets.find((p) => p.packet_id === latestDecision.related_packet_id);
    return pkt?.sender_id || latestDecision.related_packet_id;
  }, [latestDecision, packets]);

  const incomingForVehicle = useMemo(
    () => packets.filter((p) => p.kind === 'rx' && p.receiver_id === selectedId),
    [packets, selectedId]
  );

  return (
    <div className="h-screen w-screen bg-base text-white flex flex-col overflow-hidden">
      {/* Top bar -- vehicle id, connection, position, sim time, scenario */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-4 text-sm">
          <Link to="/" className="text-white/40 hover:text-white/70 text-xs outline-none focus-visible:ring-2 focus-visible:ring-white/50 rounded">← menu</Link>
          <div className="h-4 w-px bg-white/10" />
          <div className="font-mono text-white font-medium">{selectedId || '—'}</div>
          <span className="flex items-center gap-1.5 text-xs text-white/50">
            <span className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-emerald-400' : 'bg-red-400'}`} />
            {connected ? 'connected' : 'disconnected'}
          </span>
        </div>

        <div className="hidden md:flex items-center gap-6 text-xs font-mono text-white/40">
          <span>pos {vehicleState ? `${vehicleState.x?.toFixed(0)}, ${vehicleState.y?.toFixed(0)}` : '—'}</span>
          <span>t={vehicleState?.timestamp_sim?.toFixed(1) ?? '—'}s</span>
          <span>{scenario || 'no scenario yet'}</span>
          {runId && <span>{runId}</span>}
        </div>

        <div className="flex items-center gap-3">
          <VehicleSelector vehicleIds={vehicleIds} selectedId={selectedId} onSelect={setSelectedId} />
          <FullscreenButton />
        </div>
      </div>

      {/* Main HMI */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6 py-6 overflow-y-auto">
        {!selectedId ? (
          <div className="text-white/40 text-lg">Waiting for a vehicle to appear in the simulation…</div>
        ) : (
          <>
            <WarningCard decisionLabel={latestDecision?.decision} />
            <DecisionCard
              decision={latestDecision}
              currentSpeed={vehicleState?.speed}
              messageSource={messageSource}
            />
            <div className="w-full max-w-4xl flex flex-col md:flex-row items-center justify-center gap-6">
              <MiniRadar vehicles={vehicles} selfId={selectedId} />
              <AlertFeed incomingForVehicle={incomingForVehicle} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
