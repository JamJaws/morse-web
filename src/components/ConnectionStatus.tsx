import { ReadyState } from 'react-use-websocket';
import { FiChevronDown } from 'react-icons/fi';

const states = {
  [ReadyState.CONNECTING]: { label: 'Connecting', color: 'bg-warning' },
  [ReadyState.OPEN]: { label: 'Connected', color: 'bg-success' },
  [ReadyState.CLOSING]: { label: 'Reconnecting', color: 'bg-warning' },
  [ReadyState.CLOSED]: { label: 'Reconnecting', color: 'bg-warning' },
  [ReadyState.UNINSTANTIATED]: { label: 'Offline', color: 'bg-muted' },
};

export function ConnectionStatus({
  readyState,
  operators,
  latency,
}: {
  readyState: ReadyState;
  operators: number;
  latency: number | null;
}) {
  const { label, color } = states[readyState];
  const connected = readyState === ReadyState.OPEN;
  return (
    <details className="group/connection shrink-0 sm:relative">
      <summary className="flex min-h-11 list-none items-center gap-1.5 whitespace-nowrap rounded-xl px-2 text-sm text-muted hover:bg-raised group-open/connection:bg-raised group-open/connection:text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent sm:gap-2 sm:px-3 [&::-webkit-details-marker]:hidden">
        <span
          aria-hidden="true"
          className={`size-2 shrink-0 rounded-full ${color}`}
        />
        <span role="status">{label}</span>
        {connected && (
          <span className="hidden sm:inline">
            · {operators} {operators === 1 ? 'operator' : 'operators'}
          </span>
        )}
        <FiChevronDown
          aria-hidden="true"
          focusable="false"
          className="size-3.5 shrink-0 transition-transform duration-150 group-open/connection:rotate-180 motion-reduce:transition-none"
        />
      </summary>
      <div className="absolute inset-x-4 top-full z-20 mt-2 sm:inset-x-auto sm:right-0 sm:w-64 rounded-2xl border border-stroke bg-surface p-4 text-sm shadow-xl">
        {connected ? (
          <dl className="space-y-2">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted">Operators</dt>
              <dd className="font-mono tabular-nums">{operators}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted">Latency</dt>
              <dd className="font-mono tabular-nums">
                {latency === null ? 'Measuring…' : `${latency} ms`}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="leading-relaxed text-muted">Local playback only.</p>
        )}
      </div>
    </details>
  );
}
