import type { MorseCodeCharacter } from './MorseCodeCharacter';
import { morseCodeCharacters } from './MorseCodeCharacters';
import { FaChevronDown } from 'react-icons/fa';

const groups = [
  { type: 'letter', label: 'Letters' },
  { type: 'number', label: 'Numbers' },
] as const;

export default function MorseCodeTable({
  onClick,
}: {
  onClick: (character: MorseCodeCharacter) => void;
}) {
  const renderCharacters = (type: MorseCodeCharacter['type']) => (
    <div className="grid grid-cols-3 gap-x-3 gap-y-1 @md:grid-cols-4 @2xl:grid-cols-6">
      {morseCodeCharacters
        .filter(character => character.type === type)
        .map(character => (
          <button
            type="button"
            key={character.letter}
            onClick={() => onClick(character)}
            aria-label={`Play ${character.letter} locally: ${character.code
              .split('')
              .map(char => (char === '.' ? 'dot' : 'dash'))
              .join(' ')}`}
            className="flex min-h-8 min-w-0 items-center justify-between gap-1 rounded-lg px-1 py-1 font-mono text-sm transition-colors hover:bg-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none pointer-coarse:min-h-11"
          >
            <span>{character.letter}</span>
            <span
              aria-hidden="true"
              className="inline-flex shrink-0 items-center gap-0.5 text-accent"
            >
              {character.code.split('').map((char, index) => (
                <span
                  key={index}
                  className={`h-1 rounded-full bg-current ${char === '.' ? 'w-1' : 'w-2.5'}`}
                />
              ))}
            </span>
          </button>
        ))}
    </div>
  );

  return (
    <div className="@container space-y-4">
      {groups.map(group => (
        <div key={group.type}>
          <h3 className="mb-1 px-1 text-xs font-medium text-muted">
            {group.label}
          </h3>
          {renderCharacters(group.type)}
        </div>
      ))}
      <details className="group">
        <summary className="flex min-h-8 list-none items-center justify-between gap-2 rounded-lg px-1 text-xs font-medium text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent pointer-coarse:min-h-11 [&::-webkit-details-marker]:hidden">
          Punctuation
          <FaChevronDown
            aria-hidden="true"
            className="text-[10px] group-open:rotate-180"
          />
        </summary>
        <div className="mt-1">{renderCharacters('punctuation')}</div>
      </details>
    </div>
  );
}
