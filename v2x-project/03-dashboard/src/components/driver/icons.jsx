// Minimal stroke-based icon set for the Driver View. Using inline SVG with
// stroke="currentColor" (the same pattern already established in
// FullscreenButton.jsx) instead of emoji/symbol glyphs (✓ ⛔ ↩ ⇄ ✛ ⚠ 📡)
// guarantees the icon always inherits the intended semantic color (safe /
// caution / critical) and renders identically across every OS and browser --
// several of the glyphs they replaced default to fixed-color emoji
// presentation on common platforms, which would silently ignore the
// surrounding amber/red/emerald theming this screen depends on.
const ICONS = {
  check: (
    <path d="M4 12.5 9.5 18 20 6" />
  ),
  stop: (
    <>
      <path d="M8.5 3h7L21 8.5v7L15.5 21h-7L3 15.5v-7L8.5 3Z" />
      <path d="M8.5 8.5 15.5 15.5M15.5 8.5 8.5 15.5" />
    </>
  ),
  turn: (
    <path d="M8 7 4 11l4 4M4 11h9a5 5 0 0 1 5 5v3" />
  ),
  merge: (
    <path d="M6 4v6a4 4 0 0 0 4 4h4M14 10l4 4-4 4M18 4v6a4 4 0 0 1-1.2 2.8" />
  ),
  intersection: (
    <path d="M12 3v18M3 12h18" />
  ),
  warning: (
    <>
      <path d="M12 3.5 21.5 20h-19L12 3.5Z" />
      <path d="M12 10v4.5" />
      <circle cx="12" cy="17.25" r="0.75" fill="currentColor" stroke="none" />
    </>
  ),
  pending: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.2a2.5 2.5 0 1 1 3.8 2.1c-.9.6-1.3 1.1-1.3 2.1" />
      <circle cx="12" cy="17" r="0.75" fill="currentColor" stroke="none" />
    </>
  ),
  signal: (
    <path d="M12 18.5v.01M8.5 15a5 5 0 0 1 7 0M5.5 12a9 9 0 0 1 13 0M12 18.5a.5.5 0 1 1 0-1 .5.5 0 0 1 0 1Z" />
  ),
};

export default function DecisionIcon({ name, className = '' }) {
  const path = ICONS[name] || ICONS.help;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {path}
    </svg>
  );
}
