import { memo } from 'react';
import { describeDecision, levelStyles } from './decisionPresentation.js';
import DecisionIcon from './icons.jsx';

function WarningCard({ decisionLabel, message }) {
  const info = describeDecision(decisionLabel);
  const styles = levelStyles(info.level);
  // Prefer the backend's scenario-aware sentence ("Vehicle approaching from
  // left — yield") over the static per-label subtitle -- it's the whole
  // point of the dynamic messaging system. Falls back cleanly for replayed
  // runs recorded before this field existed.
  const supportingText = message || info.subtitle;

  return (
    <div
      key={decisionLabel || 'none'} // remount on change -> re-triggers the entrance animation
      className={`w-full max-w-2xl rounded-3xl border-2 ${styles.border} ${styles.glow} bg-gradient-to-b ${styles.bg} backdrop-blur-xl px-10 py-12 text-center animate-[driverCardIn_0.4s_ease-out]`}
    >
      <div className={`mb-6 flex justify-center ${styles.text}`} aria-hidden="true">
        <DecisionIcon name={info.icon} className="w-20 h-20" />
      </div>
      <div className="text-4xl md:text-5xl font-semibold text-white tracking-tight">
        {info.title}
      </div>
      {supportingText && (
        <div className="mt-3 text-lg md:text-xl text-white/70 break-words">{supportingText}</div>
      )}
    </div>
  );
}

export default memo(WarningCard);
