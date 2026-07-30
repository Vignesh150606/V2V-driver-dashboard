import { useMemo } from 'react';
import { decisionColorHex } from '../lib/decisionTiers.js';

const VB_W = 800;
const VB_H = 460;
const PAD = 50;
const PULSE_WINDOW_MS = 1100;
const PATH_WINDOW_MS = 1400;

export default function VehicleMap({ vehicles, packets, now }) {
  const list = useMemo(() => Object.values(vehicles), [vehicles]);

  const bounds = useMemo(() => {
    if (list.length === 0) return null;
    const xs = list.map((v) => v.x);
    const ys = list.map((v) => v.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const spanX = Math.max(maxX - minX, 1);
    const spanY = Math.max(maxY - minY, 1);
    return { minX, maxX, minY, maxY, spanX, spanY };
  }, [list]);

  function project(x, y) {
    if (!bounds) return { px: VB_W / 2, py: VB_H / 2 };
    const px = PAD + ((x - bounds.minX) / bounds.spanX) * (VB_W - 2 * PAD);
    // flip Y so it reads like a map (north-up-ish), not SUMO's raw axis
    const py = VB_H - (PAD + ((y - bounds.minY) / bounds.spanY) * (VB_H - 2 * PAD));
    return { px, py };
  }

  const recentTx = packets.filter(
    (p) => (p.kind === 'tx' || p.kind === 'relay') && now - p.receivedAt < PULSE_WINDOW_MS
  );
  const recentRx = packets.filter((p) => p.kind === 'rx' && now - p.receivedAt < PATH_WINDOW_MS);

  return (
    <div className="border border-line bg-panel rounded-lg overflow-hidden">
      <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="w-full h-full block" role="img" aria-label="Live vehicle positions and packet transmissions">
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1A2430" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width={VB_W} height={VB_H} fill="url(#grid)" />

        {list.length === 0 && (
          <text x={VB_W / 2} y={VB_H / 2} textAnchor="middle" fill="#5A6B7D" fontSize="14" fontFamily="monospace">
            waiting for vehicle_state events from HazardApp…
          </text>
        )}

        {/* real relay paths: a straight line drawn only when an actual packet_rx just happened */}
        {recentRx.map((p) => {
          const sender = vehicles[p.sender_id];
          const receiver = vehicles[p.receiver_id];
          if (!sender || !receiver) return null;
          const a = project(sender.x, sender.y);
          const b = project(receiver.x, receiver.y);
          return (
            <line
              key={p.key}
              className="v2x-path"
              x1={a.px} y1={a.py} x2={b.px} y2={b.py}
              stroke="#4C8DFF" strokeWidth="1.5"
            />
          );
        })}

        {/* vehicles, colored by their last real decision from HazardApp */}
        {list.map((v) => {
          const { px, py } = project(v.x, v.y);
          const color = decisionColorHex(v.lastDecision);
          return (
            <g key={v.id}>
              <circle cx={px} cy={py} r="7" fill={color} stroke="#0B0F14" strokeWidth="2" />
              <text x={px} y={py - 13} textAnchor="middle" fill="#8FA3B8" fontSize="11" fontFamily="monospace">
                {v.id}
              </text>
            </g>
          );
        })}

        {/* pulses -- one ring per actual transmitted/relayed packet, nothing looping or invented */}
        {recentTx.map((p) => {
          const id = p.kind === 'relay' ? p.relay_id : p.sender_id;
          const source = vehicles[id];
          if (!source) return null;
          const { px, py } = project(source.x, source.y);
          return (
            <circle
              key={p.key}
              className="v2x-pulse"
              cx={px} cy={py} r="4"
              fill="none"
              stroke={p.kind === 'relay' ? '#FFB020' : '#29C7B3'}
              strokeWidth="1.5"
            />
          );
        })}
      </svg>
    </div>
  );
}
