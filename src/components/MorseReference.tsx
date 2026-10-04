import { useId, useState } from 'react';
import { FaChevronDown } from 'react-icons/fa';
import MorseCodeTable from '../beep/MorseCodeTable';
import type { MorseCodeCharacter } from '../beep/MorseCodeCharacter';

export function MorseReference({
  wpm,
  onPlay,
}: {
  wpm: number;
  onPlay: (character: MorseCodeCharacter) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const contentId = useId();

  return (
    <aside
      aria-label="Morse reference"
      className="min-w-0 rounded-2xl border border-stroke bg-surface"
    >
      <h2>
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={contentId}
          onClick={() => setExpanded(current => !current)}
          className="flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
        >
          Morse reference
          <FaChevronDown
            aria-hidden="true"
            className={`shrink-0 text-xs text-muted ${expanded ? 'rotate-180' : ''}`}
          />
        </button>
      </h2>
      <div id={contentId} hidden={!expanded} className="px-3 pb-3">
        <p className="mb-4 px-1 text-xs text-muted">
          Local playback · {wpm} WPM
        </p>
        <MorseCodeTable onClick={onPlay} />
      </div>
    </aside>
  );
}
