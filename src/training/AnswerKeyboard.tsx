import type { MorseCodeCharacter } from '../beep/MorseCodeCharacter';

const punctuationRows = [',./?!', ';:\'"()', '-_=+&$@'];

interface AnswerKeyboardProps {
  characters: readonly MorseCodeCharacter[];
  disabled: boolean;
  onAnswer: (letter: string) => void;
}

export function AnswerKeyboard({
  characters,
  disabled,
  onAnswer,
}: AnswerKeyboardProps) {
  const available = new Set(characters.map(character => character.letter));
  const nordic = [...'ÅÄÖ'].some(letter => available.has(letter));
  const letters = nordic
    ? ['QWERTYUIOPÅ', 'ASDFGHJKLÖÄ', 'ZXCVBNM']
    : ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
  const columns = letters[0].length;
  const punctuation = punctuationRows.filter(row =>
    [...row].some(letter => available.has(letter)),
  );

  function row(keys: string) {
    return (
      <div
        key={keys}
        className="mx-auto grid gap-0.5 sm:gap-2"
        style={{
          gridTemplateColumns: `repeat(${keys.length}, minmax(0, 1fr))`,
          width: `${(keys.length / columns) * 100}%`,
        }}
      >
        {[...keys].map(letter => (
          <button
            key={letter}
            type="button"
            aria-label={`Answer ${letter}`}
            disabled={disabled || !available.has(letter)}
            onClick={() => onAnswer(letter)}
            className={`flex min-h-12 min-w-0 items-center justify-center rounded-md border font-mono text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none sm:rounded-xl sm:text-xl ${available.has(letter) ? 'border-stroke bg-raised text-ink enabled:hover:border-accent enabled:hover:text-accent disabled:opacity-50' : 'border-transparent bg-canvas/40 text-muted/40'}`}
          >
            {letter}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div
      role="group"
      aria-label="Answer choices"
      className="-mx-3 space-y-2 sm:mx-0 sm:space-y-3"
    >
      {characters.some(character => character.type === 'number') && (
        <div role="group" aria-label="Numbers">
          {row('1234567890')}
        </div>
      )}
      <div
        role="group"
        aria-label="Letters"
        className="space-y-1.5 sm:space-y-2"
      >
        {letters.map(row)}
      </div>
      {punctuation.length > 0 && (
        <div
          role="group"
          aria-label="Punctuation"
          className="space-y-1.5 sm:space-y-2"
        >
          {punctuation.map(row)}
        </div>
      )}
    </div>
  );
}
