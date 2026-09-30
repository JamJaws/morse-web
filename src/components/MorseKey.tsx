import type { useMorseKey } from '../hooks/useMorseKey';

type MorseKeyProps = {
  transmitting: boolean;
  connected: boolean;
  input: ReturnType<typeof useMorseKey>;
};

export function MorseKey({
  transmitting,
  connected,
  input: { keyRef, onKeyDown, onPointerDown, onLostPointerCapture },
}: MorseKeyProps) {
  return (
    <button
      ref={keyRef}
      type="button"
      autoFocus
      data-morse-key
      aria-label="Morse key"
      aria-describedby="morse-key-help"
      data-transmitting={transmitting}
      className="group flex aspect-square w-[min(100%,24rem,65svh)] touch-none select-none flex-col items-center justify-center gap-6 rounded-[2rem] border border-stroke bg-surface text-ink shadow-lg transition-shadow duration-200 motion-reduce:transition-none hover:bg-raised focus:border-accent/50 focus:shadow-key-focus focus:outline-hidden data-[transmitting=true]:border-accent data-[transmitting=true]:bg-accent data-[transmitting=true]:text-accent-ink"
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onLostPointerCapture={onLostPointerCapture}
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
    </button>
  );
}
