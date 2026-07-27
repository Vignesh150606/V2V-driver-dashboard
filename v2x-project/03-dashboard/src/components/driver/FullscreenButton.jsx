import { useEffect, useState, useCallback } from 'react';

export default function FullscreenButton() {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    function onChange() {
      setIsFullscreen(Boolean(document.fullscreenElement));
    }
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggle = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen().catch(() => {
        // Some browsers block this without a direct user gesture context --
        // the button click itself satisfies that, so this is just a safety net.
      });
    }
  }, []);

  return (
    <button
      onClick={toggle}
      className="h-9 w-9 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-white/80 flex items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-white/50"
      title={isFullscreen ? 'Exit fullscreen (Esc)' : 'Enter fullscreen presentation mode'}
    >
      {isFullscreen ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 3v4a1 1 0 0 1-1 1H4M15 3v4a1 1 0 0 0 1 1h4M9 21v-4a1 1 0 0 0-1-1H4M15 21v-4a1 1 0 0 1 1-1h4" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M8 3H4a1 1 0 0 0-1 1v4M21 8V4a1 1 0 0 0-1-1h-4M3 16v4a1 1 0 0 0 1 1h4M16 21h4a1 1 0 0 0 1-1v-4" />
        </svg>
      )}
    </button>
  );
}
