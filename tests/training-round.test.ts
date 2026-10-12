import { afterEach, expect, it, vi } from 'vitest';
import type { MorseCodeCharacter } from '../src/beep/MorseCodeCharacter';
import { morseCodeCharacters } from '../src/beep/MorseCodeCharacters';
import { lessons } from '../src/training/curriculum';
import { createRound, getRoundLength } from '../src/training/round';

afterEach(() => vi.restoreAllMocks());

function counts(round: readonly MorseCodeCharacter[]) {
  const result: Record<string, number> = {};
  for (const character of round)
    result[character.letter] = (result[character.letter] ?? 0) + 1;
  return result;
}

it('grows rounds from 20 prompts to twice the size of the selected set', () => {
  for (const [size, length] of [
    [0, 0],
    [1, 20],
    [2, 20],
    [9, 20],
    [10, 20],
    [11, 22],
    [20, 40],
    [40, 80],
    [57, 114],
  ])
    expect(getRoundLength(size)).toBe(length);
  expect(createRound([])).toEqual([]);
});

it('always includes L four times and every older sound twice in lesson 8', () => {
  for (const random of [0, 0.37, 0.99999]) {
    vi.spyOn(Math, 'random').mockReturnValue(random);
    expect(counts(createRound(lessons[7].characters, 'L'))).toEqual({
      K: 2,
      M: 2,
      R: 2,
      S: 2,
      U: 2,
      A: 2,
      P: 2,
      T: 2,
      L: 4,
    });
  }
});

it('covers every intermediate lesson and never underrepresents its newest sound', () => {
  for (const lesson of lessons.slice(1, -1)) {
    const focus = lesson.introduced[0].letter;
    const round = createRound(lesson.characters, focus);
    const frequencies = counts(round);
    expect(round).toHaveLength(Math.max(20, 2 * lesson.characters.length));
    expect(new Set(Object.keys(frequencies))).toEqual(
      new Set(lesson.characters.map(character => character.letter)),
    );
    const review = Object.entries(frequencies)
      .filter(([letter]) => letter !== focus)
      .map(([, count]) => count);
    expect(Math.max(...review) - Math.min(...review)).toBeLessThanOrEqual(1);
    expect(frequencies[focus]).toBeGreaterThanOrEqual(Math.max(...review));
  }
  expect(counts(createRound(lessons[1].characters, 'R')).R).toBe(7);
  expect(counts(createRound(lessons[18].characters, ','))[',']).toBe(8);
});

it('balances first, final and custom sets, including a single character and ÅÄÖ', () => {
  const sets = [
    lessons[0].characters,
    lessons[38].characters,
    morseCodeCharacters.filter(character => 'ÅÄÖ'.includes(character.letter)),
    morseCodeCharacters.slice(0, 1),
    morseCodeCharacters,
  ];
  for (const characters of sets) {
    const round = createRound(characters);
    const frequencies = counts(round);
    expect(round).toHaveLength(Math.max(20, 2 * characters.length));
    expect(new Set(Object.keys(frequencies))).toEqual(
      new Set(characters.map(character => character.letter)),
    );
    const values = Object.values(frequencies);
    expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(1);
  }
  expect(counts(createRound(lessons[0].characters))).toEqual({ K: 10, M: 10 });
  expect(Object.values(counts(createRound(lessons[38].characters)))).toEqual(
    Array(40).fill(2),
  );
});

it('reshuffles the order and the extra turns without changing the input set', () => {
  const characters = Object.freeze(lessons[1].characters.slice());
  const original = [...characters];
  const random = vi.spyOn(Math, 'random').mockReturnValue(0.99999);
  const first = createRound(characters);
  random.mockReturnValue(0);
  const second = createRound(characters);
  expect(second).not.toEqual(first);
  expect(counts(second)).not.toEqual(counts(first));
  expect(characters).toEqual(original);
  // Shuffling permits consecutive repeats; it does not force K/M alternation.
  expect(first[0]).toBe(first[1]);
});
