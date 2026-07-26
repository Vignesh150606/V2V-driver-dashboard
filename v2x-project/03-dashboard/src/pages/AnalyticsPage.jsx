import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useEventStore } from '../store/useEventStore.jsx';
import StatCard from '../components/StatCard.jsx';

export default function AnalyticsPage() {
  const { decisions } = useEventStore();

  const byLabel = useMemo(() => {
    const counts = {};
    decisions.forEach((d) => {
      counts[d.decision] = (counts[d.decision] || 0) + 1;
    });
    return Object.entries(counts).map(([label, count]) => ({ label, count }));
  }, [decisions]);

  const avgTtc = useMemo(() => {
    const ttcs = decisions.map((d) => d.ttc).filter((v) => Number.isFinite(v));
    if (!ttcs.length) return null;
    return (ttcs.reduce((a, b) => a + b, 0) / ttcs.length).toFixed(2);
  }, [decisions]);

  return (
    <div className="p-6 space-y-6">
      <div className="text-xs text-ink2 uppercase tracking-wide">
        Live session analytics — {decisions.length} decisions observed. For the full 431-row batch
        corpus, aggregate your existing CSV output the same way you do today.
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Total decisions" value={decisions.length} />
        <StatCard label="Average TTC" value={avgTtc ?? '—'} sub="seconds" tone="blue" />
        <StatCard label="Distinct labels" value={byLabel.length} tone="amber" />
      </div>

      <div className="border border-line bg-panel rounded-lg p-4 h-72">
        {byLabel.length === 0 ? (
          <div className="h-full flex items-center justify-center text-sm text-ink3">no data yet this session</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byLabel}>
              <CartesianGrid stroke="#223041" vertical={false} />
              <XAxis dataKey="label" stroke="#8FA3B8" fontSize={12} fontFamily="monospace" />
              <YAxis stroke="#8FA3B8" fontSize={12} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: '#121821', border: '1px solid #223041', fontSize: 12 }}
                labelStyle={{ color: '#E7EDF3' }}
              />
              <Bar dataKey="count" fill="#29C7B3" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
