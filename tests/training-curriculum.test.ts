import { expect, it, vi } from 'vitest';
import {
  chooseCharacter,
  kochSequence,
  lessonFromParam,
  lessons,
} from '../src/training/curriculum';

it('keeps all 40 cumulative lessons mapped to the published LCWO order', () => {
  expect(kochSequence.join(' ')).toBe(
    'K M U R E S N A P T L W I . J Z = F O Y , V G 5 / Q 9 2 H 3 8 B ? 4 7 C 1 D 6 0 X',
  );
  expect(new Set(kochSequence).size).toBe(41);
  expect(lessons).toHaveLength(40);
  expect(lessons[0].introduced.map(c => c.letter)).toEqual(['K', 'M']);
  for (const lesson of lessons) {
    expect(lesson.characters.map(c => c.letter)).toEqual(
      kochSequence.slice(0, lesson.id + 1),
    );
    expect(lesson.characters.every(c => /^[.-]+$/.test(c.code))).toBe(true);
    if (lesson.id > 1)
      expect(lesson.introduced.map(c => c.letter)).toEqual([
        kochSequence[lesson.id],
      ]);
    expect(lessonFromParam(String(lesson.id))).toBe(lesson);
  }
  for (const value of [null, '', '0', '-1', '41', '01', '1.5', '1e1', 'abc']) {
    expect(lessonFromParam(value)).toBeUndefined();
  }
});

it('selects across the whole pool and permits natural repeats', () => {
  const random = vi.spyOn(Math, 'random').mockReturnValue(0);
  try {
    expect(chooseCharacter(lessons[0]).letter).toBe('K');
    expect(chooseCharacter(lessons[0]).letter).toBe('K');
    random.mockReturnValue(0.99999);
    expect(chooseCharacter(lessons[0]).letter).toBe('M');
    expect(chooseCharacter(lessons[39]).letter).toBe('X');
  } finally {
    random.mockRestore();
  }
});
