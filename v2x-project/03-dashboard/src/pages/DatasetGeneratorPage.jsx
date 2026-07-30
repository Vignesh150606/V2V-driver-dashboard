import { useEventStore } from '../store/useEventStore.jsx';
import { decisionColorClass } from '../lib/decisionTiers.js';

const COLUMNS = ['timestamp_sim', 'run_id', 'scenario', 'vehicle_id', 'decision', 'message', 'ttc', 'distance_m', 'relative_speed'];

// message is free text and could in principle contain a comma -- everything
// else here is a short fixed-vocabulary token or a number, never quoted
// before and still safe not to be.
function csvField(value) {
  if (value == null) return '';
  const str = String(value);
  if (!/[",\n\r]/.test(str)) return str;
  return `"${str.replace(/"/g, '""')}"`;
}

function toCsv(rows, runId, scenario) {
  const header = COLUMNS.join(',');
  const lines = rows.map((r) =>
    [r.timestamp_sim, runId, scenario, r.vehicle_id, r.decision, r.message, r.ttc, r.distance_m, r.relative_speed]
      .map(csvField)
      .join(',')
  );
  return [header, ...lines].join('\n');
}

export default function DatasetGeneratorPage() {
  const { decisions, runId, scenario } = useEventStore();
  const rowsChronological = [...decisions].reverse();

  function download() {
    const csv = toCsv(rowsChronological, runId, scenario);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${runId || 'run'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs text-ink2 uppercase tracking-wide">
          Dataset rows — {rowsChronological.length} generated this run
        </div>
        <button
          onClick={download}
          disabled={rowsChronological.length === 0}
          className="text-xs font-mono px-3 py-1.5 rounded border border-line2 text-ink2 hover:text-ink hover:border-teal disabled:opacity-40 disabled:hover:border-line2 outline-none focus-visible:ring-2 focus-visible:ring-teal/50"
        >
          download csv
        </button>
      </div>
      <div className="border border-line bg-panel rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-mono">
            <thead>
              <tr className="text-ink2 text-xs border-b border-line">
                {COLUMNS.map((c) => (
                  <th key={c} className="text-left px-4 py-2 font-normal whitespace-nowrap">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rowsChronological.length === 0 && (
                <tr>
                  <td colSpan={COLUMNS.length} className="px-4 py-8 text-center text-ink3">
                    no rows yet — this table fills in as HazardApp writes decisions, same as your batch CSVs
                  </td>
                </tr>
              )}
              {rowsChronological.slice(-100).reverse().map((r) => (
                <tr key={r.key} className="border-b border-line/60 last:border-0">
                  <td className="px-4 py-2 text-ink2 whitespace-nowrap">{r.timestamp_sim?.toFixed(2)}</td>
                  <td className="px-4 py-2 text-ink3 whitespace-nowrap">{runId}</td>
                  <td className="px-4 py-2 text-ink3 whitespace-nowrap">{scenario}</td>
                  <td className="px-4 py-2 text-ink whitespace-nowrap">{r.vehicle_id}</td>
                  <td className={`px-4 py-2 whitespace-nowrap ${decisionColorClass(r.decision)}`}>{r.decision}</td>
                  <td className="px-4 py-2 text-ink2 max-w-xs truncate" title={r.message}>{r.message || '—'}</td>
                  <td className="px-4 py-2 text-ink2 whitespace-nowrap">{r.ttc?.toFixed(2)}</td>
                  <td className="px-4 py-2 text-ink2 whitespace-nowrap">{r.distance_m?.toFixed(1)}</td>
                  <td className="px-4 py-2 text-ink2 whitespace-nowrap">{r.relative_speed?.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
