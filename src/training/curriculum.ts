import type { MorseCodeCharacter } from '../beep/MorseCodeCharacter';
import { morseCodeCharacters } from '../beep/MorseCodeCharacters';

// Traditional G4FON Koch order; see the sources in docs/training-plan.md.
export const kochSequence =
  'K M R S U A P T L O W I . N J E F 0 Y , V G 5 / Q 9 Z H 3 8 B ? 4 2 7 C 1 D 6 X'.split(
    ' ',
  );

export interface Lesson {
  id: number;
  introduced: readonly MorseCodeCharacter[];
  characters: readonly MorseCodeCharacter[];
}

const characters = kochSequence.map(letter => {
  const character = morseCodeCharacters.find(entry => entry.letter === letter);
  if (!character) throw new Error(`Missing Morse character: ${letter}`);
  return character;
});

export const lessons: readonly Lesson[] = characters
  .slice(1)
  .map((_, index) => ({
    id: index + 1,
    introduced: characters.slice(index === 0 ? 0 : index + 1, index + 2),
    characters: characters.slice(0, index + 2),
  }));

export function lessonFromParam(value: string | null): Lesson | undefined {
  return lessons.find(lesson => String(lesson.id) === value);
}

export const ROUND_LENGTH = 20;

export function chooseCharacter(
  characters: readonly MorseCodeCharacter[],
): MorseCodeCharacter {
  return characters[Math.floor(Math.random() * characters.length)];
}
