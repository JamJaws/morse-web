import { morseCodeCharacters } from '../beep/MorseCodeCharacters';
import { Button } from '../components/ui/Button';

interface CharacterPickerProps {
  value: string;
  onChange: (value: string) => void;
}

export function CharacterPicker({ value, onChange }: CharacterPickerProps) {
  function group(type: 'letter' | 'number' | 'punctuation') {
    return (
      <div className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(3rem,1fr))] gap-2">
        {morseCodeCharacters
          .filter(character => character.type === type)
          .map(({ letter }) => (
            <Button
              key={letter}
              aria-label={`Practise ${letter}`}
              aria-pressed={value.includes(letter)}
              variant={value.includes(letter) ? 'primary' : 'secondary'}
              className="min-h-12 px-2 font-mono text-xl"
              onClick={() =>
                onChange(
                  value.includes(letter)
                    ? value.replace(letter, '')
                    : value + letter,
                )
              }
            >
              {letter}
            </Button>
          ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Choose your characters</h3>
        <p className="mt-2 text-sm text-muted">
          Pick a set, then add or remove any characters.
        </p>
        <div
          role="group"
          aria-label="Quick sets"
          className="mt-4 flex flex-wrap gap-2"
        >
          <Button onClick={() => onChange('ABCDEFGHIJKLMNOPQRSTUVWXYZ')}>
            A–Z
          </Button>
          <Button onClick={() => onChange('0123456789')}>0–9</Button>
          <Button onClick={() => onChange('ÅÄÖ')}>ÅÄÖ</Button>
          <Button variant="ghost" onClick={() => onChange('')}>
            Clear
          </Button>
        </div>
      </div>
      <fieldset>
        <legend className="text-sm font-medium text-muted">Letters</legend>
        {group('letter')}
      </fieldset>
      <fieldset>
        <legend className="text-sm font-medium text-muted">Numbers</legend>
        {group('number')}
      </fieldset>
      <details>
        <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium text-muted focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
          Punctuation
        </summary>
        {group('punctuation')}
      </details>
      <p className="text-sm text-muted" role="status">
        {value.length === 0
          ? 'Choose at least one character.'
          : `${value.length} characters selected`}
      </p>
    </div>
  );
}
