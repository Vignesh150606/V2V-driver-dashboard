import { NavLink } from 'react-router-dom';

const links = [
  { to: '/', label: 'Dashboard', exact: true },
  { to: '/live', label: 'Live simulation' },
  { to: '/timeline', label: 'Packet timeline' },
  { to: '/inspector', label: 'Vehicle inspector' },
  { to: '/network', label: 'Network graph' },
  { to: '/dataset', label: 'Dataset generator' },
  { to: '/analytics', label: 'Analytics' },
  { to: '/replay', label: 'Replay previous runs' },
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
              `block px-5 py-2.5 text-sm border-l-2 ${
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
      <div className="px-5 py-4 border-t border-line text-xs text-ink3 leading-relaxed">
        Every position, packet, and decision on this console is emitted by
        HazardApp — nothing here is simulated in the browser.
      </div>
    </aside>
  );
}
