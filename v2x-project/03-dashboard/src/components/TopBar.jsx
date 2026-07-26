import { useEventStore } from '../store/useEventStore.jsx';

export default function TopBar({ title }) {
  const { connected, runId, scenario } = useEventStore();

  return (
    <div className="h-14 border-b border-line bg-panel flex items-center justify-between px-6 shrink-0">
      <div className="text-sm font-medium text-ink">{title}</div>
      <div className="flex items-center gap-5 text-xs font-mono text-ink2">
        {runId && (
          <span>
            run <span className="text-ink">{runId}</span>
          </span>
        )}
        {scenario && (
          <span>
            scenario <span className="text-ink">{scenario}</span>
          </span>
        )}
        <span className="flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full ${connected ? 'bg-teal' : 'bg-red'}`}
            aria-hidden="true"
          />
          {connected ? 'bridge connected' : 'bridge disconnected'}
        </span>
      </div>
    </div>
  );
}
