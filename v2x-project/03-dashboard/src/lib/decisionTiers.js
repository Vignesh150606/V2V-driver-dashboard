// Shared 3-tier tone mapping for decision labels across the engineering
// dashboard (SAFE / CAUTION_* / WAIT_*). Mirrors the same tiers the Driver
// View uses (components/driver/decisionPresentation.js) as plain
// colors/classes instead of full title/subtitle/icon, since these are
// compact table/graph contexts rather than the driver-facing hero card.
export function decisionTone(decision) {
  if (!decision) return 'unknown';
  if (decision === 'SAFE') return 'safe';
  if (decision.startsWith('CAUTION')) return 'watch';
  if (decision.startsWith('WAIT')) return 'critical';
  return 'unknown';
}

export const TONE_TEXT_CLASS = {
  safe: 'text-teal',
  watch: 'text-amber',
  critical: 'text-red',
  unknown: 'text-ink3',
};

export const TONE_HEX = {
  safe: '#29C7B3',
  watch: '#FFB020',
  critical: '#FF5A5F',
  unknown: '#8FA3B8',
};

export function decisionColorClass(decision) {
  return TONE_TEXT_CLASS[decisionTone(decision)];
}

export function decisionColorHex(decision) {
  return TONE_HEX[decisionTone(decision)];
}
