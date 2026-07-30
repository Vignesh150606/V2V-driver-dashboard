import { useMemo } from 'react';
import { useEventStore } from '../store/useEventStore.jsx';
import { decisionColorHex } from '../lib/decisionTiers.js';

const VB = 700;
const CENTER = VB / 2;
const RADIUS = 240;

export default function NetworkGraphPage() {
  const { vehicles, packets } = useEventStore();

  const nodeIds = useMemo(() => {
    const ids = new Set(Object.keys(vehicles));
    packets.forEach((p) => {
      if (p.sender_id) ids.add(p.sender_id);
      if (p.receiver_id) ids.add(p.receiver_id);
      if (p.relay_id) ids.add(p.relay_id);
      if (p.original_sender_id) ids.add(p.original_sender_id);
    });
    return Array.from(ids).sort();
  }, [vehicles, packets]);

  const positions = useMemo(() => {
    const map = {};
    nodeIds.forEach((id, i) => {
      const angle = (2 * Math.PI * i) / Math.max(nodeIds.length, 1) - Math.PI / 2;
      map[id] = { x: CENTER + RADIUS * Math.cos(angle), y: CENTER + RADIUS * Math.sin(angle) };
    });
    return map;
  }, [nodeIds]);

  const edges = useMemo(() => {
    const counts = new Map();
    function bump(a, b, kind) {
      if (!a || !b || a === b) return;
      const key = [a, b].sort().join('|');
      const prev = counts.get(key) || { a, b, count: 0, kind };
      prev.count += 1;
      counts.set(key, prev);
    }
    packets.forEach((p) => {
      if (p.kind === 'rx') bump(p.sender_id, p.receiver_id, 'rx');
      if (p.kind === 'relay') bump(p.original_sender_id, p.relay_id, 'relay');
    });
    return Array.from(counts.values());
  }, [packets]);

  return (
    <div className="p-6">
      <div className="text-xs text-ink2 uppercase tracking-wide mb-3">
        Network graph — edges built from real packet_rx / packet_relay events
      </div>
      <div className="border border-line bg-panel rounded-lg">
        <svg viewBox={`0 0 ${VB} ${VB}`} className="w-full max-h-[560px]">
          {nodeIds.length === 0 && (
            <text x={CENTER} y={CENTER} textAnchor="middle" fill="#5A6B7D" fontSize="14" fontFamily="monospace">
              waiting for packet events…
            </text>
          )}
          {edges.map((e) => {
            const a = positions[e.a], b = positions[e.b];
            if (!a || !b) return null;
            return (
              <line
                key={`${e.a}-${e.b}`}
                x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke={e.kind === 'relay' ? '#FFB020' : '#4C8DFF'}
                strokeWidth={Math.min(1 + e.count * 0.4, 6)}
                opacity="0.6"
              />
            );
          })}
          {nodeIds.map((id) => {
            const p = positions[id];
            const decision = vehicles[id]?.lastDecision;
            const color = decisionColorHex(decision);
            return (
              <g key={id}>
                <circle cx={p.x} cy={p.y} r="16" fill="#121821" stroke={color} strokeWidth="2" />
                <text x={p.x} y={p.y + 4} textAnchor="middle" fill="#E7EDF3" fontSize="11" fontFamily="monospace">
                  {id}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
