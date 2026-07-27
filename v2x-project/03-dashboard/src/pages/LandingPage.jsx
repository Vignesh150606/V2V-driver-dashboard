import { useNavigate } from 'react-router-dom';
import { useEventStore } from '../store/useEventStore.jsx';

export default function LandingPage() {
  const navigate = useNavigate();
  const { connected, runId, scenario } = useEventStore();

  return (
    <div className="h-screen bg-base text-ink flex flex-col items-center justify-center px-6">
      <div className="text-center mb-12">
        <div className="text-sm font-mono text-ink3 tracking-widest uppercase mb-2">V2X Cooperative Collision Detection</div>
        <h1 className="text-3xl font-medium text-ink">Choose an interface</h1>
        <div className="mt-3 flex items-center justify-center gap-2 text-xs font-mono text-ink2">
          <span className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-teal' : 'bg-ink3'}`} />
          {connected ? `bridge connected${runId ? ` · ${runId}` : ''}${scenario ? ` · ${scenario}` : ''}` : 'bridge not connected yet'}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl">
        <button
          onClick={() => navigate('/driver')}
          className="group text-left border border-line bg-panel hover:border-teal rounded-2xl p-8 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-teal/50"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-9 h-9 mb-4 text-teal" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <circle cx="12" cy="12" r="2.5" />
            <path d="M12 3v6.5M6.2 15.5l4.6-2.3M17.8 15.5l-4.6-2.3" />
          </svg>
          <div className="text-lg text-ink font-medium mb-2">Driver View</div>
          <div className="text-sm text-ink2 leading-relaxed">
            In-vehicle HMI for demonstrations and presentations. Large glanceable
            warnings, one vehicle at a time, fullscreen-ready for a projector.
          </div>
          <div className="mt-4 text-xs font-mono text-teal opacity-0 group-hover:opacity-100 transition-opacity">
            Open Driver View →
          </div>
        </button>

        <button
          onClick={() => navigate('/dashboard')}
          className="group text-left border border-line bg-panel hover:border-blue rounded-2xl p-8 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue/50"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-9 h-9 mb-4 text-blue" aria-hidden="true">
            <rect x="3" y="4" width="18" height="12" rx="1.5" />
            <path d="M8 20h8M12 16v4M7 8.5l2.5 2.5L7 13.5M12.5 13.5H17" />
          </svg>
          <div className="text-lg text-ink font-medium mb-2">Engineering Dashboard</div>
          <div className="text-sm text-ink2 leading-relaxed">
            Packet timeline, network graph, vehicle inspector, analytics,
            replay, and dataset generation — for debugging and development.
          </div>
          <div className="mt-4 text-xs font-mono text-blue opacity-0 group-hover:opacity-100 transition-opacity">
            Open Dashboard →
          </div>
        </button>
      </div>
    </div>
  );
}
