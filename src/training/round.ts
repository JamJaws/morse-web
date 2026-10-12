import type { MorseCodeCharacter } from '../beep/MorseCodeCharacter';

export function getRoundLength(characterCount: number): number {
  return characterCount === 0 ? 0 : Math.max(20, 2 * characterCount);
}

function shuffle<T>(values: readonly T[]): T[] {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Guarantee coverage before shuffling; only the current round is retained. */
export function createRound(
  characters: readonly MorseCodeCharacter[],
  focusLetter?: string,
): MorseCodeCharacter[] {
  if (characters.length === 0) return [];
  const length = getRoundLength(characters.length);
  const focus =
    characters.length > 1
      ? characters.find(character => character.letter === focusLetter)
      : undefined;
  // In early lessons, 20% must not give the new sound fewer turns than an old one.
  const focusCount = focus
    ? Math.max(Math.ceil(length / characters.length), Math.round(length * 0.2))
    : 0;
  // Randomize which review characters receive an extra turn when division is uneven.
  const review = shuffle(characters.filter(character => character !== focus));
  const remaining = length - focusCount;
  const prompts = review.flatMap((character, index) =>
    Array.from(
      {
        length:
          Math.floor(remaining / review.length) +
          Number(index < remaining % review.length),
      },
      () => character,
    ),
  );
  if (focus) prompts.push(...Array.from({ length: focusCount }, () => focus));
  return shuffle(prompts);
}
