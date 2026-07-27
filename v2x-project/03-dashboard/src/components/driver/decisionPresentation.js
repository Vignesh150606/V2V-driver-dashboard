// Maps a HazardApp decision label to what a driver should see. This is a
// mapping over the decision VOCABULARY (a stable contract from HazardApp),
// not over specific vehicles or scenarios -- a new scenario introducing a
// new WAIT_* label still renders sensibly via the fallback, with zero
// frontend changes required.
const KNOWN = {
  SAFE: {
    level: 'safe',
    title: 'Road Clear',
    subtitle: 'Maintain current speed',
    icon: 'check',
  },
  WAIT_BRAKE: {
    level: 'critical',
    title: 'Brake Immediately',
    subtitle: 'Vehicle ahead braking hard',
    icon: 'stop',
  },
  WAIT_TURNING: {
    level: 'caution',
    title: 'Vehicle Turning Ahead',
    subtitle: 'Reduce speed and prepare to stop',
    icon: 'turn',
  },
  WAIT_TO_MERGE: {
    level: 'caution',
    title: 'Vehicle Merging Ahead',
    subtitle: 'Yield until the merge completes',
    icon: 'merge',
  },
  WAIT_INTERSECTION: {
    level: 'caution',
    title: 'Intersection Warning',
    subtitle: 'Cross traffic detected, reduce speed',
    icon: 'intersection',
  },
};

const LEVEL_STYLES = {
  safe: {
    bg: 'from-emerald-500/20 to-emerald-500/5',
    border: 'border-emerald-400/40',
    text: 'text-emerald-300',
    glow: 'shadow-[0_0_60px_-10px_rgba(52,211,153,0.4)]',
  },
  caution: {
    bg: 'from-amber-500/20 to-amber-500/5',
    border: 'border-amber-400/40',
    text: 'text-amber-300',
    glow: 'shadow-[0_0_60px_-10px_rgba(251,191,36,0.4)]',
  },
  critical: {
    bg: 'from-red-500/25 to-red-500/5',
    border: 'border-red-400/50',
    text: 'text-red-300',
    glow: 'shadow-[0_0_60px_-10px_rgba(248,113,113,0.5)]',
  },
  unknown: {
    bg: 'from-slate-500/15 to-slate-500/5',
    border: 'border-slate-400/30',
    text: 'text-slate-300',
    glow: '',
  },
};

export function describeDecision(label) {
  if (!label) {
    return { level: 'unknown', title: 'Awaiting Data', subtitle: 'No decision received yet', icon: 'pending' };
  }
  if (KNOWN[label]) return KNOWN[label];
  if (label.startsWith('WAIT')) {
    return {
      level: 'caution',
      title: 'Hazard Detected',
      subtitle: 'Reduce speed and proceed with caution',
      icon: 'warning',
    };
  }
  return { level: 'unknown', title: label, subtitle: '', icon: 'help' };
}

export function levelStyles(level) {
  return LEVEL_STYLES[level] || LEVEL_STYLES.unknown;
}
