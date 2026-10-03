import { useId, useState } from 'react';
import { FaChevronDown } from 'react-icons/fa';
import type { Operator } from '../network/protocol';

function initials(name: string): string {
  const words = name.trim().split(/\s+/);
  const first = Array.from(words[0] ?? '');
  return (
    words.length > 1
      ? `${first[0] ?? ''}${Array.from(words[words.length - 1])[0] ?? ''}`
      : first.slice(0, 2).join('')
  ).toUpperCase();
}

export function OperatorList({
  operators,
  myOperatorId,
  activeOperatorIds,
  connected,
}: {
  operators: readonly Operator[];
  myOperatorId: string | undefined;
  activeOperatorIds: ReadonlySet<string>;
  connected: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const listId = useId();
  const headingId = useId();
  const activeCount = operators.filter(operator =>
    activeOperatorIds.has(operator.id),
  ).length;

  return (
    <aside
      aria-labelledby={headingId}
      className="min-w-0 rounded-2xl border border-stroke bg-surface lg:sticky lg:top-6"
    >
      <div className="hidden items-center justify-between gap-3 px-4 py-3 lg:flex">
        <h2 id={headingId} className="text-sm font-semibold">
          Operators
        </h2>
        <span className="font-mono text-xs tabular-nums text-muted">
          {operators.length}
        </span>
      </div>
      <button
        type="button"
        aria-label={`Operators, ${operators.length} connected${activeCount > 0 ? `, ${activeCount} transmitting` : ''}`}
        aria-expanded={expanded}
        aria-controls={listId}
        onClick={() => setExpanded(current => !current)}
        className="flex min-h-12 w-full items-center gap-2 rounded-2xl px-4 py-3 text-left text-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent lg:hidden"
      >
        <span className="font-semibold">Operators</span>
        <span className="font-mono text-xs tabular-nums text-muted">
          {operators.length}
        </span>
        {activeCount > 0 && (
          <span className="ml-auto text-xs text-accent">
            {activeCount} transmitting
          </span>
        )}
        <FaChevronDown
          aria-hidden="true"
          className={`${activeCount === 0 ? 'ml-auto' : ''} shrink-0 text-xs text-muted ${expanded ? 'rotate-180' : ''}`}
        />
      </button>
      <div
        id={listId}
        role="region"
        aria-label="Operator list"
        tabIndex={0}
        className={`${expanded ? 'block' : 'hidden'} max-h-72 overflow-y-auto rounded-xl px-2 pb-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent lg:block lg:max-h-[calc(100dvh-12rem)]`}
      >
        {operators.length > 0 ? (
          <ul aria-label="Connected operators" className="space-y-1">
            {operators.map(operator => {
              const active = activeOperatorIds.has(operator.id);
              return (
                <li
                  key={operator.id}
                  className={`flex min-w-0 items-center gap-2.5 rounded-lg px-2 py-1 ${active ? 'bg-accent/10' : 'transition-colors motion-reduce:transition-none'}`}
                >
                  <span
                    aria-hidden="true"
                    className={`flex size-8 shrink-0 items-center justify-center rounded-full border font-mono text-xs font-semibold ${active ? 'border-accent bg-accent text-accent-ink' : 'border-stroke bg-raised text-muted transition-colors motion-reduce:transition-none'}`}
                  >
                    {initials(operator.name)}
                  </span>
                  <div className="flex min-w-0 flex-1 items-baseline gap-2">
                    <span
                      className={`truncate text-sm font-medium ${active ? 'text-accent' : 'text-ink'}`}
                      title={operator.name}
                    >
                      {operator.name}
                    </span>
                    {operator.id === myOperatorId && (
                      <span className="ml-auto shrink-0 text-xs text-muted">
                        You
                      </span>
                    )}
                    {active && <span className="sr-only">Transmitting</span>}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="px-2 py-3 text-sm text-muted">
            {connected ? 'No operators connected.' : 'Connecting…'}
          </p>
        )}
      </div>
    </aside>
  );
}
