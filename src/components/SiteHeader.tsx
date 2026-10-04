import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { FaBroadcastTower } from 'react-icons/fa';

export function SiteHeader({ children }: { children?: ReactNode }) {
  return (
    <header className="relative z-10 border-b border-stroke/60">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-center gap-4 sm:gap-8">
          <div className="flex items-center gap-3">
            <FaBroadcastTower
              aria-hidden="true"
              className="text-xl text-accent"
            />
            <h1 className="text-xl font-semibold tracking-tight">Morse</h1>
          </div>
          <nav aria-label="Main navigation" className="flex gap-1">
            {[
              { to: '/', label: 'Live' },
              { to: '/training', label: 'Training' },
            ].map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent ${isActive ? 'bg-raised text-accent' : 'text-muted hover:bg-raised hover:text-ink'}`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
        {children}
      </div>
    </header>
  );
}
