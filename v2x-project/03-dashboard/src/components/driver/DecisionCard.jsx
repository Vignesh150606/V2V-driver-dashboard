import { memo } from 'react';

function riskFromTtc(ttc) {
  if (ttc == null || !Number.isFinite(ttc)) return { label: '—', tone: 'text-white/40' };
  if (ttc < 2) return { label: 'High', tone: 'text-red-300' };
  if (ttc < 4) return { label: 'Medium', tone: 'text-amber-300' };
  return { label: 'Low', tone: 'text-emerald-300' };
}

function recommendationFromDecision(label) {
  if (!label) return '—';
  if (label === 'SAFE') return 'Maintain speed';
  return 'Reduce speed';
}

function Field({ label, value, tone = 'text-white' }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-white/40">{label}</div>
      <div className={`text-lg font-mono mt-0.5 ${tone}`}>{value}</div>
    </div>
  );
}

function DecisionCard({ decision, currentSpeed, messageSource }) {
  const risk = riskFromTtc(decision?.ttc);

  return (
    <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl px-6 py-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4">
        <Field label="Current Decision" value={decision?.decision || '—'} />
        <Field label="Recommendation" value={recommendationFromDecision(decision?.decision)} />
        <Field label="Current Speed" value={currentSpeed != null ? `${currentSpeed.toFixed(1)} m/s` : '—'} />
        <Field label="Collision Risk" value={risk.label} tone={risk.tone} />
        <Field label="Distance to Hazard" value={decision?.distance_m != null ? `${decision.distance_m.toFixed(1)} m` : '—'} />
        <Field label="Time to Collision" value={decision?.ttc != null ? `${decision.ttc.toFixed(1)} s` : '—'} />
        <Field label="Lane Recommendation" value="—" tone="text-white/30" />
        <Field label="Message Source" value={messageSource || '—'} />
        <Field label="Confidence" value="—" tone="text-white/30" />
        <Field
          label="Decision Time"
          value={decision?.timestamp_sim != null ? `t=${decision.timestamp_sim.toFixed(1)}s` : '—'}
        />
      </div>
    </div>
  );
}

export default memo(DecisionCard);
