import { useEffect, useId, useReducer, useRef } from 'react';
import { ReadyState } from 'react-use-websocket';

const states = {
  [ReadyState.CONNECTING]: { label: 'Connecting', color: 'bg-warning' },
  [ReadyState.OPEN]: { label: 'Connected', color: 'bg-success' },
  [ReadyState.CLOSING]: { label: 'Reconnecting', color: 'bg-warning' },
  [ReadyState.CLOSED]: { label: 'Reconnecting', color: 'bg-warning' },
  [ReadyState.UNINSTANTIATED]: { label: 'Offline', color: 'bg-muted' },
};

type Interaction = {
  hovered: boolean;
  focused: boolean;
  pinned: boolean;
  dismissed: boolean;
};
type Action =
  | { type: 'hover' | 'focus'; active: boolean }
  | { type: 'toggle' | 'dismiss' };

function updateInteraction(state: Interaction, action: Action): Interaction {
  switch (action.type) {
    case 'hover':
      return {
        ...state,
        hovered: action.active,
        dismissed: action.active ? false : state.dismissed,
      };
    case 'focus':
      return {
        ...state,
        focused: action.active,
        pinned: action.active && state.pinned,
        dismissed: action.active ? false : state.dismissed,
      };
    case 'toggle':
      return { ...state, pinned: !state.pinned, dismissed: state.pinned };
    case 'dismiss':
      // Keep an active hover/focus from reopening the panel after dismissal.
      return { ...state, pinned: false, dismissed: true };
  }
}

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
  const container = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const [interaction, dispatch] = useReducer(updateInteraction, {
    hovered: false,
    focused: false,
    pinned: false,
    dismissed: false,
  });
  const open =
    !interaction.dismissed &&
    (interaction.hovered || interaction.focused || interaction.pinned);

  useEffect(() => {
    if (!open) return;
    const dismiss = () => dispatch({ type: 'dismiss' });
    const onPointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !container.current?.contains(event.target)
      )
        dismiss();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        dismiss();
      }
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('blur', dismiss);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('blur', dismiss);
    };
  }, [open]);

  return (
    <div
      ref={container}
      className="shrink-0 sm:relative"
      onPointerEnter={event => {
        if (event.pointerType !== 'touch')
          dispatch({ type: 'hover', active: true });
      }}
      onPointerLeave={event => {
        if (event.pointerType !== 'touch')
          dispatch({ type: 'hover', active: false });
      }}
      onFocus={() => dispatch({ type: 'focus', active: true })}
      onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget))
          dispatch({ type: 'focus', active: false });
      }}
    >
      <button
        type="button"
        aria-label={`Connection details: ${label}`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => dispatch({ type: 'toggle' })}
        className="flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-xl border border-stroke/60 bg-surface/60 px-2 text-sm text-muted hover:bg-raised aria-expanded:bg-raised aria-expanded:text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent sm:gap-2 sm:px-3"
      >
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
      </button>
      {/* Padding bridges the gap so moving into the panel preserves hover. */}
      <div
        id={panelId}
        role="group"
        aria-label="Connection details"
        hidden={!open}
        className="absolute inset-x-4 top-[calc(100%-1rem)] z-20 pt-6 sm:inset-x-auto sm:right-0 sm:top-full sm:w-64 sm:pt-2"
      >
        <div className="rounded-2xl border border-stroke bg-surface p-4 text-sm shadow-xl">
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
      </div>
    </div>
  );
}
