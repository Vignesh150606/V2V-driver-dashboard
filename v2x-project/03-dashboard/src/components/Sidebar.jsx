import { NavLink } from 'react-router-dom';

const links = [
  { to: '/dashboard', label: 'Dashboard', exact: true },
  { to: '/dashboard/live', label: 'Live simulation' },
  { to: '/dashboard/timeline', label: 'Packet timeline' },
  { to: '/dashboard/inspector', label: 'Vehicle inspector' },
  { to: '/dashboard/network', label: 'Network graph' },
  { to: '/dashboard/dataset', label: 'Dataset generator' },
  { to: '/dashboard/analytics', label: 'Analytics' },
  { to: '/dashboard/replay', label: 'Replay previous runs' },
];

export default function Sidebar() {
  return (
    <aside className="w-56 shrink-0 border-r border-line bg-panel flex flex-col">
      <div className="px-5 py-5 border-b border-line">
        <div className="text-sm font-medium tracking-wide text-ink">V2X console</div>
        <div className="text-xs text-ink3 font-mono mt-0.5">cooperative collision detection</div>
      </div>
      <nav className="flex-1 py-3">
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.exact}
            className={({ isActive }) =>
              `block px-5 py-2.5 text-sm border-l-2 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal/50 ${
                isActive
                  ? 'border-teal text-ink bg-panel2'
                  : 'border-transparent text-ink2 hover:text-ink hover:bg-panel2/60'
              }`
            }
          >
            {l.label}
          </NavLink>
        ))}
      </nav>
      <div className="px-5 py-3 border-t border-line">
        <NavLink to="/driver" className="block text-xs text-ink2 hover:text-teal outline-none focus-visible:ring-2 focus-visible:ring-teal/50 rounded mb-2">
          → Open Driver View
        </NavLink>
        <NavLink to="/" className="block text-xs text-ink3 hover:text-ink outline-none focus-visible:ring-2 focus-visible:ring-teal/50 rounded">
          ← Back to menu
        </NavLink>
      </div>
      <div className="px-5 py-4 border-t border-line text-xs text-ink3 leading-relaxed">
        Every position, packet, and decision on this console is emitted by
        HazardApp — nothing here is simulated in the browser.
      </div>
    </aside>
  );
}
