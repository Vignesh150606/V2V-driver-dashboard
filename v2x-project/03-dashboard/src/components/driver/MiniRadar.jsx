import { memo, useMemo } from 'react';

const SIZE = 200;
const CENTER = SIZE / 2;
const MAX_RADIUS = 85;
const MAX_SHOWN = 8; // nearest N -- keeps it glanceable and cheap to render even with 100+ vehicles

function statusColor(decision) {
  if (!decision) return '#8FA3B8';
  if (decision === 'SAFE') return '#29C7B3';
  if (decision.startsWith('CAUTION')) return '#FFB020';
  return '#FF5A5F'; // WAIT_* -- the same "act now" tier as everywhere else in the app
}

function MiniRadar({ vehicles, selfId }) {
  const self = vehicles[selfId];

  const nearby = useMemo(() => {
    if (!self) return [];
    const others = Object.values(vehicles).filter((v) => v.id !== selfId && v.x != null && v.y != null);
    const withDistance = others.map((v) => {
      const dx = v.x - self.x;
      const dy = v.y - self.y;
      return { ...v, dx, dy, dist: Math.sqrt(dx * dx + dy * dy) };
    });
    withDistance.sort((a, b) => a.dist - b.dist);
    return withDistance.slice(0, MAX_SHOWN);
  }, [vehicles, self, selfId]);

  const maxDist = useMemo(() => Math.max(...nearby.map((v) => v.dist), 1), [nearby]);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-4 w-fit">
      <div className="text-[11px] uppercase tracking-wide text-white/40 mb-2 text-center">Nearby vehicles</div>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        {[1, 2, 3].map((ring) => (
          <circle
            key={ring}
            cx={CENTER}
            cy={CENTER}
            r={(MAX_RADIUS / 3) * ring}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="1"
          />
        ))}
        {/* self */}
        <circle cx={CENTER} cy={CENTER} r="7" fill="#4C8DFF" stroke="#0B0F14" strokeWidth="2" />
        <text x={CENTER} y={CENTER + 22} textAnchor="middle" fill="#4C8DFF" fontSize="9" fontFamily="monospace">
          you
        </text>

        {!self && (
          <text x={CENTER} y={CENTER + 40} textAnchor="middle" fill="#5A6B7D" fontSize="10">
            no position data yet
          </text>
        )}

        {nearby.map((v) => {
          const scale = maxDist > MAX_RADIUS ? MAX_RADIUS / maxDist : 1;
          const px = CENTER + v.dx * scale;
          const py = CENTER - v.dy * scale; // flip so "up" reads as ahead
          const clampedX = Math.max(8, Math.min(SIZE - 8, px));
          const clampedY = Math.max(8, Math.min(SIZE - 8, py));
          return (
            <g key={v.id}>
              <circle cx={clampedX} cy={clampedY} r="5" fill={statusColor(v.lastDecision)} stroke="#0B0F14" strokeWidth="1.5" />
              <text x={clampedX} y={clampedY - 9} textAnchor="middle" fill="#8FA3B8" fontSize="8" fontFamily="monospace">
                {v.id}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default memo(MiniRadar);
