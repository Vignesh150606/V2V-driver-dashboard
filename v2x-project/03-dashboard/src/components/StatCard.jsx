export default function StatCard({ label, value, tone = 'default', sub }) {
  const toneClass = {
    default: 'text-ink',
    teal: 'text-teal',
    amber: 'text-amber',
    red: 'text-red',
    blue: 'text-blue',
  }[tone];

  return (
    <div className="border border-line bg-panel rounded-lg px-5 py-4">
      <div className="text-xs text-ink2 uppercase tracking-wide">{label}</div>
      <div className={`text-2xl font-mono mt-1.5 ${toneClass}`}>{value}</div>
      {sub && <div className="text-xs text-ink3 mt-1">{sub}</div>}
    </div>
  );
}
