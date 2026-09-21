import { ReadyState } from 'react-use-websocket';

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
    <details className="sm:relative">
      <summary className="flex min-h-11 list-none items-center gap-2 rounded-xl px-3 text-sm text-muted hover:bg-raised focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent [&::-webkit-details-marker]:hidden">
        <span aria-hidden="true" className={`size-2 rounded-full ${color}`} />
        <span role="status">{label}</span>
        {connected && (
          <span className="hidden sm:inline">
            · {operators} {operators === 1 ? 'operator' : 'operators'}
          </span>
        )}
        <span aria-hidden="true" className="text-xs">
          ⌄
        </span>
      </summary>
      <div className="absolute inset-x-4 top-full z-20 mt-2 sm:inset-x-auto sm:right-0 sm:w-64 rounded-2xl border border-stroke bg-surface p-4 text-sm shadow-xl">
        {connected ? (
          <>
            <p className="font-medium">
              {operators} {operators === 1 ? 'operator' : 'operators'} connected
            </p>
            <p className="mt-1 text-muted">
              {latency === null
                ? 'Measuring latency…'
                : `${latency} ms round-trip latency`}
            </p>
            <p className="mt-3 text-xs leading-relaxed text-muted">
              The count includes you and others connected to this channel. Each
              person enables their own audio.
            </p>
          </>
        ) : (
          <p className="leading-relaxed text-muted">
            Trying to connect automatically. You can still practise locally
            after enabling sound.
          </p>
        )}
      </div>
    </details>
  );
}
