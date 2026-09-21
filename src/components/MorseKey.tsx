import type { useMorseKey } from '../hooks/useMorseKey';

type MorseKeyProps = {
  transmitting: boolean;
  input: ReturnType<typeof useMorseKey>;
};

export function MorseKey({ transmitting, input }: MorseKeyProps) {
  return (
    <button
      type="button"
      autoFocus
      data-morse-key
      aria-label="Morse key"
      aria-describedby="morse-key-help"
      data-transmitting={transmitting}
      className="text-[calc(12px+2vmin)] bg-slate-700 aspect-square min-w-[80vmin] sm:min-w-[65vmin] md:min-w-[50vmin] rounded-3xl gap-3 touch-none select-none hover:bg-slate-600 data-[transmitting=true]:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-400"
      onPointerDown={input.onPointerDown}
      onLostPointerCapture={input.onLostPointerCapture}
      onContextMenu={event => event.preventDefault()}
    >
      <span>{transmitting ? 'Transmitting' : 'beep beep beep'}</span>
    </button>
  );
}
