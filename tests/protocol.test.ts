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
