import { memo } from 'react';
import { describeDecision } from './decisionPresentation.js';

function riskFromTtc(ttc) {
  if (ttc == null || !Number.isFinite(ttc)) return { label: '—', tone: 'text-white/40' };
  if (ttc < 2) return { label: 'High', tone: 'text-red-300' };
  if (ttc < 4) return { label: 'Medium', tone: 'text-amber-300' };
  return { label: 'Low', tone: 'text-emerald-300' };
}

// Three-tier, matching the SAFE / CAUTION_* / WAIT_* label vocabulary --
// was binary (SAFE vs everything-else) before that middle tier existed, so
// every CAUTION_* decision was showing the same urgent "Reduce speed" as an
// actual WAIT_* one.
function recommendationFromDecision(label) {
  if (!label) return '—';
  if (label === 'SAFE') return 'Maintain speed';
  if (label.startsWith('CAUTION')) return 'Stay alert';
  return 'Reduce speed';
}

function Field({ label, value, tone = 'text-white' }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] uppercase tracking-wide text-white/40">{label}</div>
      <div className={`text-lg font-mono mt-0.5 truncate ${tone}`} title={typeof value === 'string' ? value : undefined}>
        {value}
      </div>
    </div>
  );
}

function DecisionCard({ decision, currentSpeed, messageSource }) {
  const risk = riskFromTtc(decision?.ttc);
  // Same short, human title the big warning card above uses ("Vehicle
  // Turning Ahead") instead of the raw backend label ("WAIT_TURNING") --
  // a driver-facing screen shouldn't surface an internal enum string.
  const decisionTitle = decision?.decision ? describeDecision(decision.decision).title : '—';

  return (
    <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl px-6 py-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4">
        <Field label="Current Decision" value={decisionTitle} />
        <Field label="Recommendation" value={recommendationFromDecision(decision?.decision)} />
        <Field label="Current Speed" value={currentSpeed != null ? `${currentSpeed.toFixed(1)} m/s` : '—'} />
        <Field label="Collision Risk" value={risk.label} tone={risk.tone} />
        <Field label="Distance to Hazard" value={decision?.distance_m != null ? `${decision.distance_m.toFixed(1)} m` : '—'} />
        <Field label="Time to Collision" value={decision?.ttc != null ? `${decision.ttc.toFixed(1)} s` : '—'} />
        <Field label="Message Source" value={messageSource || '—'} />
        <Field
          label="Decision Time"
          value={decision?.timestamp_sim != null ? `t=${decision.timestamp_sim.toFixed(1)}s` : '—'}
        />
      </div>
    </div>
  );
}

export default memo(DecisionCard);
