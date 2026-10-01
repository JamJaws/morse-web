import { expect, it } from 'vitest';
import { parseMessage } from '../src/network/protocol';

it('accepts whole-millisecond timestamps and rejects fractions for KEY and CODE', () => {
  for (const payload of [
    { type: 'KEY', down: true },
    { type: 'CODE', code: '.', wpm: 20 },
  ]) {
    const message = {
      ...payload,
      operatorId: 'peer',
      sequence: 1,
      timestamp: 125,
    };
    expect(parseMessage(JSON.stringify(message))).toEqual(message);
    expect(
      parseMessage(JSON.stringify({ ...message, timestamp: 125.5 })),
    ).toBeUndefined();
  }
});

it('requires valid display names on every operator in a roster', () => {
  const operator = { id: 'peer', frequency: 700, name: 'Åsa / SM0ABC' };
  const roster = { type: 'OPERATORS', operators: [operator] };
  expect(parseMessage(JSON.stringify(roster))).toEqual(roster);
  expect(parseMessage('{"type":"OPERATORS","operators":[]}')).toEqual({
    type: 'OPERATORS',
    operators: [],
  });

  for (const name of [
    undefined,
    null,
    123,
    '',
    ' ',
    ' Padded ',
    'A'.repeat(33),
    'A\nB',
    'A\u202eB',
    'A\u030a',
  ]) {
    expect(
      parseMessage(
        JSON.stringify({
          ...roster,
          operators: [operator, { ...operator, id: 'invalid', name }],
        }),
      ),
    ).toBeUndefined();
  }
});

it('keeps duplicate display names attached to distinct operator IDs', () => {
  const roster = {
    type: 'OPERATORS',
    operators: [
      { id: 'first', frequency: 700, name: 'Alex' },
      { id: 'second', frequency: 800, name: 'Alex' },
    ],
  };
  expect(parseMessage(JSON.stringify(roster))).toEqual(roster);
});
