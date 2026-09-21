import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { mocks, resetMocks } from './app-mocks';
import App from '../src/App';

beforeEach(() => {
  resetMocks();
  vi.useFakeTimers({
    toFake: [
      'setTimeout',
      'clearTimeout',
      'setInterval',
      'clearInterval',
      'Date',
      'performance',
    ],
  });
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});
async function join() {
  render(
    <MemoryRouter initialEntries={['/?tx=true']}>
      <App />
    </MemoryRouter>,
  );
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Join' }));
  });
  return screen
    .getByRole('button', { name: 'Morse key' })
    .closest('[tabindex]')!;
}
function receive(message: object) {
  mocks.onMessage?.({ data: JSON.stringify(message) });
}
function messages(type: string) {
  return mocks.sendMessage.mock.calls
    .map(([m]) => JSON.parse(m))
    .filter(m => m.type === type);
}
const roster = {
  type: 'OPERATORS',
  operators: [{ id: 'peer', frequency: 600 }],
};

it('schedules a same-batch roster, down and up without losing the first tone', async () => {
  await join();
  act(() => {
    receive(roster);
    receive({
      type: 'KEY',
      operatorId: 'peer',
      timestamp: 0,
      sequence: 1,
      down: true,
    });
    receive({
      type: 'KEY',
      operatorId: 'peer',
      timestamp: 60,
      sequence: 2,
      down: false,
    });
  });
  const plan = mocks.gains[0].gain.setValueAtTime.mock.calls.slice(-3);
  expect(plan.map(([v]) => v)).toEqual([0, 1, 0]);
  expect(plan.every(([, time]) => Number.isFinite(time))).toBe(true);
  expect(plan[2][1] - plan[1][1]).toBeCloseTo(0.06);
  expect(mocks.oscillators[1].volume).toBeLessThan(0);
});

it('queues two typed messages received in one React batch', async () => {
  await join();
  act(() => {
    receive(roster);
    for (const sequence of [1, 2])
      receive({
        type: 'CODE',
        operatorId: 'peer',
        timestamp: 0,
        sequence,
        code: '.',
        wpm: 20,
      });
  });
  const plan = mocks.gains[0].gain.setValueAtTime.mock.calls.slice(-5);
  expect(plan.map(([v]) => v)).toEqual([0, 1, 0, 1, 0]);
  expect(plan[3][1]).toBeGreaterThan(plan[2][1]);
});

it('refreshes held keys with monotonic sequence numbers and never enables offline replay', async () => {
  const main = await join();
  fireEvent.keyDown(main, { key: ' ' });
  act(() => {
    vi.advanceTimersByTime(500);
  });
  fireEvent.keyUp(main, { key: ' ' });
  const keys = messages('KEY');
  expect(keys.map(k => k.down)).toEqual([true, true, true, false]);
  expect(keys.map(k => k.sequence)).toEqual([1, 2, 3, 4]);
  expect(keys.map(k => k.timestamp)).toEqual([0, 250, 500, 500]);
  expect(mocks.sendMessage.mock.calls.every(([, keep]) => keep === false)).toBe(
    true,
  );
});

it('disposes remote audio, resets a held key and starts a fresh sequence on reconnect', async () => {
  const main = await join();
  act(() => {
    receive(roster);
    receive({
      type: 'KEY',
      operatorId: 'peer',
      timestamp: 0,
      sequence: 1,
      down: true,
    });
  });
  fireEvent.keyDown(main, { key: ' ' });
  act(() => {
    mocks.socket.readyState = 3;
    mocks.onClose?.();
  });
  expect(mocks.oscillators[1].dispose).toHaveBeenCalledOnce();
  expect(mocks.gains[0].dispose).toHaveBeenCalledOnce();
  const count = messages('KEY').length;
  fireEvent.keyUp(main, { key: ' ' });
  fireEvent.keyDown(main, { key: ' ' });
  fireEvent.keyUp(main, { key: ' ' });
  expect(messages('KEY')).toHaveLength(count);
  act(() => {
    mocks.socket.readyState = 1;
    mocks.onOpen?.();
  });
  expect(messages('KEY')).toHaveLength(count);
  fireEvent.keyDown(main, { key: ' ' });
  expect(messages('KEY').at(-1).sequence).toBe(1);
});

it('runs heartbeat without hover and ignores unrelated PONGs', async () => {
  await join();
  act(() => {
    mocks.onOpen?.();
    vi.advanceTimersByTime(4_750);
  });
  expect(messages('PING')).toHaveLength(0);
  act(() => {
    vi.advanceTimersByTime(250);
  });
  const ping = messages('PING')[0];
  expect(ping).toBeDefined();
  act(() => {
    receive({ type: 'PONG', id: ping.id + 1 });
    vi.advanceTimersByTime(14_750);
  });
  expect(messages('PING')).toHaveLength(1);
  expect(mocks.socket.close).not.toHaveBeenCalled();
  act(() => {
    vi.advanceTimersByTime(250);
  });
  expect(mocks.socket.close).toHaveBeenCalledOnce();
});

it('measures correlated RTT and closes a persistently backed-up native socket', async () => {
  await join();
  act(() => {
    mocks.onOpen?.();
    vi.advanceTimersByTime(5_000);
  });
  const ping = messages('PING')[0];
  act(() => {
    vi.advanceTimersByTime(125);
    receive({ type: 'PONG', id: ping.id });
  });
  expect(screen.getByText('125 ms round-trip latency')).toBeDefined();
  act(() => {
    mocks.socket.bufferedAmount = 10;
    vi.advanceTimersByTime(1_125);
  });
  expect(mocks.socket.close).toHaveBeenCalledOnce();
});

it('restores the chosen frequency on the next HELLO', async () => {
  await join();
  act(() => {
    receive({ type: 'HELLO', operatorId: 'me', frequency: 700 });
  });
  fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
  fireEvent.change(screen.getByLabelText('Frequency'), {
    target: { value: '950' },
  });
  act(() => {
    vi.advanceTimersByTime(300);
    mocks.onOpen?.();
    receive({ type: 'HELLO', operatorId: 'new-me', frequency: 600 });
  });
  expect(messages('FREQUENCY').at(-1).frequency).toBe(950);
});

it('ignores malformed frames and requires Join after audio suspension', async () => {
  await join();
  act(() => {
    mocks.onMessage?.({ data: '{broken' });
    receive({ type: 'OPERATORS', operators: [null] });
    receive({
      type: 'KEY',
      operatorId: 'peer',
      timestamp: null,
      sequence: 1,
      down: true,
    });
  });
  expect(mocks.gains).toHaveLength(0);
  act(() => {
    mocks.context.state = 'suspended';
    mocks.context.on.mock.calls[0][1]();
  });
  expect(screen.getByRole('button', { name: 'Join' })).toBeDefined();
  expect(mocks.socket.close).toHaveBeenCalledOnce();
});

it('disconnects all queued local marks when manual keying interrupts typed playback', async () => {
  const main = await join();
  fireEvent.change(screen.getByLabelText('Message'), {
    target: { value: 'SOS' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  const typedVoice = mocks.oscillators[0];
  expect(typedVoice.start).toHaveBeenCalledTimes(9);
  fireEvent.keyDown(main, { key: ' ' });
  expect(typedVoice.dispose).toHaveBeenCalledOnce();
  const manualVoice = mocks.oscillators[1];
  expect(manualVoice.start).toHaveBeenCalledOnce();
  fireEvent.keyUp(main, { key: ' ' });
  expect(manualVoice.stop).toHaveBeenCalledOnce();
  expect(messages('KEY').map(k => k.down)).toEqual([true, false]);
});

it('disposes queued local playback on disconnect and retains unsent input', async () => {
  await join();
  fireEvent.change(screen.getByLabelText('Message'), {
    target: { value: 'SOS' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  act(() => {
    mocks.socket.readyState = 3;
    mocks.onClose?.();
  });
  expect(mocks.oscillators[0].dispose).toHaveBeenCalledOnce();
  fireEvent.change(screen.getByLabelText('Message'), {
    target: { value: 'WAIT' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  expect((screen.getByLabelText('Message') as HTMLInputElement).value).toBe(
    'WAIT',
  );
  expect(messages('CODE')).toHaveLength(1);
});

it('ignores queued socket events while closing and does not repopulate audio', async () => {
  const main = await join();
  act(() => {
    mocks.onOpen?.();
    mocks.socket.bufferedAmount = 65_537;
    vi.advanceTimersByTime(250);
  });
  expect(mocks.socket.close).toHaveBeenCalledOnce();
  act(() => {
    receive(roster);
    receive({
      type: 'KEY',
      operatorId: 'peer',
      timestamp: 250,
      sequence: 1,
      down: true,
    });
    vi.advanceTimersByTime(1_000);
  });
  expect(mocks.gains).toHaveLength(0);
  expect(mocks.socket.close).toHaveBeenCalledOnce();
  fireEvent.keyDown(main, { key: ' ' });
  fireEvent.keyUp(main, { key: ' ' });
  expect(messages('KEY')).toHaveLength(0);
});

it('sends whole-millisecond KEY and CODE timestamps from the monotonic clock', async () => {
  const main = await join();
  const clock = vi.spyOn(performance, 'now').mockReturnValue(100.4);
  try {
    fireEvent.keyDown(main, { key: ' ' });
    clock.mockReturnValue(160.4);
    fireEvent.keyUp(main, { key: ' ' });
    clock.mockReturnValue(200.6);
    fireEvent.change(screen.getByLabelText('Message'), {
      target: { value: 'E' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(messages('KEY').map(m => m.timestamp)).toEqual([100, 160]);
    expect(messages('CODE')[0].timestamp).toBe(201);
  } finally {
    clock.mockRestore();
  }
});

it('waits five seconds between successful heartbeat exchanges', async () => {
  await join();
  act(() => {
    mocks.onOpen?.();
    vi.advanceTimersByTime(5_000);
  });
  const firstPing = messages('PING')[0];
  act(() => {
    receive({ type: 'PONG', id: firstPing.id });
    vi.advanceTimersByTime(4_750);
  });
  expect(messages('PING')).toHaveLength(1);
  act(() => {
    vi.advanceTimersByTime(250);
  });
  expect(messages('PING')).toHaveLength(2);
  expect(messages('PING')[1].id).toBeGreaterThan(firstPing.id);
});
