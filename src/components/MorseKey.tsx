import type { useMorseKey } from '../hooks/useMorseKey';

type MorseKeyProps = {
  transmitting: boolean;
  connected: boolean;
  input: ReturnType<typeof useMorseKey>;
};

export function MorseKey({ transmitting, connected, input }: MorseKeyProps) {
  return (
    <button
      type="button"
      autoFocus
      data-morse-key
      aria-label="Morse key"
      aria-describedby="morse-key-help"
      data-transmitting={transmitting}
      className="group flex aspect-square w-[min(100%,24rem,65svh)] touch-none select-none flex-col items-center justify-center gap-6 rounded-[2rem] border border-stroke bg-surface text-ink shadow-lg hover:bg-raised focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent data-[transmitting=true]:border-accent data-[transmitting=true]:bg-accent data-[transmitting=true]:text-accent-ink"
      onPointerDown={input.onPointerDown}
      onLostPointerCapture={input.onLostPointerCapture}
      onContextMenu={event => event.preventDefault()}
    >
      <span
        aria-hidden="true"
        className="flex items-center gap-3 text-accent group-data-[transmitting=true]:text-accent-ink"
      >
        <span className="size-4 rounded-full bg-current" />
        <span className="h-4 w-12 rounded-full bg-current" />
        <span className="size-4 rounded-full bg-current" />
      </span>
      <span className="text-2xl font-semibold tracking-tight sm:text-3xl">
        {transmitting
          ? connected
            ? 'Transmitting'
            : 'Local tone'
          : 'Hold to transmit'}
      </span>
      <span
        aria-hidden="true"
        className="font-mono text-xs uppercase tracking-[0.2em] text-muted group-data-[transmitting=true]:text-accent-ink"
      >
        {transmitting ? 'Key down' : 'Ready'}
      </span>
    </button>
  );
}
