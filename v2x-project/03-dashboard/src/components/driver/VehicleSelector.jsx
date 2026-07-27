import { useEffect, useMemo, useState, useRef } from 'react';

export default function VehicleSelector({ vehicleIds, selectedId, onSelect }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  const filtered = useMemo(() => {
    if (!query.trim()) return vehicleIds;
    const q = query.toLowerCase();
    return vehicleIds.filter((id) => id.toLowerCase().includes(q));
  }, [vehicleIds, query]);

  const currentIndex = vehicleIds.indexOf(selectedId);

  function step(delta) {
    if (vehicleIds.length === 0) return;
    const next = (currentIndex + delta + vehicleIds.length) % vehicleIds.length;
    onSelect(vehicleIds[next]);
  }

  // Keyboard shortcuts: [ and ] (or arrow keys) cycle vehicles, / focuses search.
  useEffect(() => {
    function onKeyDown(e) {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') {
        if (e.key === 'Escape') { setOpen(false); document.activeElement.blur(); }
        return;
      }
      if (e.key === ']' || e.key === 'ArrowRight') step(1);
      else if (e.key === '[' || e.key === 'ArrowLeft') step(-1);
      else if (e.key === '/') { e.preventDefault(); setOpen(true); }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicleIds, currentIndex]);

  useEffect(() => {
    function onClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  return (
    <div className="flex items-center gap-2" ref={containerRef}>
      <button
        onClick={() => step(-1)}
        disabled={vehicleIds.length < 2}
        className="h-9 w-9 rounded-lg border border-white/10 bg-white/5 text-white/80 hover:bg-white/10 disabled:opacity-30 flex items-center justify-center text-lg outline-none focus-visible:ring-2 focus-visible:ring-white/50"
        title="Previous vehicle ([ or ←)"
      >
        ‹
      </button>

      <div className="relative">
        <button
          onClick={() => setOpen((o) => !o)}
          className="h-9 px-4 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-white font-mono text-sm min-w-[110px] flex items-center justify-between gap-2 outline-none focus-visible:ring-2 focus-visible:ring-white/50"
        >
          {selectedId || 'No vehicle'}
          <span className="text-white/40 text-xs">{vehicleIds.length}</span>
        </button>

        {open && (
          <div className="absolute top-11 left-0 z-20 w-56 rounded-lg border border-white/10 bg-[#121821] shadow-xl overflow-hidden">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search vehicle ID…"
              className="w-full px-3 py-2 bg-transparent border-b border-white/10 text-sm text-white outline-none focus:border-white/40"
            />
            <div className="max-h-64 overflow-y-auto">
              {filtered.length === 0 && (
                <div className="px-3 py-3 text-xs text-white/40 text-center">no match</div>
              )}
              {filtered.map((id) => (
                <button
                  key={id}
                  onClick={() => { onSelect(id); setOpen(false); setQuery(''); }}
                  className={`w-full text-left px-3 py-2 text-sm font-mono outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/50 ${
                    id === selectedId ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/5'
                  }`}
                >
                  {id}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <button
        onClick={() => step(1)}
        disabled={vehicleIds.length < 2}
        className="h-9 w-9 rounded-lg border border-white/10 bg-white/5 text-white/80 hover:bg-white/10 disabled:opacity-30 flex items-center justify-center text-lg outline-none focus-visible:ring-2 focus-visible:ring-white/50"
        title="Next vehicle (] or →)"
      >
        ›
      </button>
    </div>
  );
}
