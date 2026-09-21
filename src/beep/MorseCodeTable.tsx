import type { MorseCodeCharacter } from './MorseCodeCharacter';
import { morseCodeCharacters } from './MorseCodeCharacters';
import { Button } from '../components/ui/Button';

const groups = [
  { type: 'letter', label: 'Letters' },
  { type: 'number', label: 'Numbers' },
  { type: 'punctuation', label: 'Punctuation' },
] as const;

export default function MorseCodeTable({
  onClick,
}: {
  onClick: (character: MorseCodeCharacter) => void;
}) {
  return (
    <div className="space-y-6">
      {groups.map(group => (
        <div key={group.type}>
          <h3 className="mb-3 text-sm font-medium text-muted">{group.label}</h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {morseCodeCharacters
              .filter(character => character.type === group.type)
              .map(character => (
                <Button
                  key={character.letter}
                  onClick={() => onClick(character)}
                  aria-label={`Play ${character.letter} locally: ${character.code
                    .split('')
                    .map(char => (char === '.' ? 'dot' : 'dash'))
                    .join(' ')}`}
                >
                  <span className="flex w-full items-center justify-between gap-2 font-mono">
                    <span>{character.letter}</span>
                    <span aria-hidden="true" className="text-accent">
                      {character.code
                        .split('')
                        .map(char => (char === '.' ? '•' : '—'))
                        .join(' ')}
                    </span>
                  </span>
                </Button>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}
