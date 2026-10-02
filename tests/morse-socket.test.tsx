import { act, renderHook } from '@testing-library/react';
import type { Options } from 'react-use-websocket';
import { ReadyState } from 'react-use-websocket';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useMorseSocket } from '../src/network/useMorseSocket';

const socket = vi.hoisted(() => ({
  url: null as string | null,
  options: {} as Options,
  readyState: 3,
  connection: { readyState: 3, bufferedAmount: 0, close: vi.fn() },
  sendMessage: vi.fn(),
  getWebSocket: vi.fn(),
}));

vi.mock('react-use-websocket', () => ({
  ReadyState: {
    UNINSTANTIATED: -1,
    CONNECTING: 0,
    OPEN: 1,
    CLOSING: 2,
    CLOSED: 3,
  },
  default: (url: string | null, options: Options) => {
    socket.url = url;
    socket.options = options;
    return {
      sendMessage: socket.sendMessage,
      getWebSocket: socket.getWebSocket,
      lastMessage: null,
      readyState: socket.readyState,
    };
  },
}));

const registration = { name: 'Guest-AB12', frequency: 700 };
const hello = { type: 'HELLO', operatorId: 'self', frequency: 700 };

function socketEvent<T extends Event>(event: T): T {
  Object.defineProperty(event, 'target', { value: socket.connection });
  return event;
}

function receive(message: object) {
  socket.options.onMessage?.(
    socketEvent(new MessageEvent('message', { data: JSON.stringify(message) })),
  );
}

function open(rerender: () => void) {
  act(() => {
    socket.readyState = ReadyState.OPEN;
    socket.connection.readyState = ReadyState.OPEN;
    socket.options.onOpen?.(socketEvent(new Event('open')));
    rerender();
  });
}

function sent() {
  return socket.sendMessage.mock.calls.map(([message]) => JSON.parse(message));
}

beforeEach(() => {
  vi.useFakeTimers();
  socket.url = null;
  socket.options = {};
  socket.readyState = ReadyState.CLOSED;
  socket.connection.readyState = ReadyState.CLOSED;
  socket.connection.bufferedAmount = 0;
  socket.connection.close.mockClear();
  socket.sendMessage.mockClear();
  socket.getWebSocket.mockReturnValue(socket.connection);
});

afterEach(() => vi.useRealTimers());

it('does not connect, reconnect, send or heartbeat before joining', () => {
  const { result } = renderHook(() => useMorseSocket(vi.fn(), vi.fn(), null));

  expect(socket.url).toBeNull();
  expect(result.current.readyState).toBe(ReadyState.UNINSTANTIATED);
  expect(result.current.sendKey(true)).toBe(false);
  expect(result.current.sendCode('.', 20)).toBe(false);
  expect(result.current.sendFrequency(800)).toBe(false);
  expect(result.current.sendName('Alex')).toBe(false);
  act(() => {
    result.current.reconnect();
    vi.advanceTimersByTime(30_000);
  });

  expect(socket.options.shouldReconnect?.(new CloseEvent('close'))).toBe(false);
  expect(socket.connection.close).not.toHaveBeenCalled();
  expect(socket.sendMessage).not.toHaveBeenCalled();
});

it('sends JOIN first and waits for HELLO before accepting or sending session frames', () => {
  const onMessage = vi.fn();
  const { result, rerender } = renderHook(() =>
    useMorseSocket(onMessage, vi.fn(), registration),
  );
  expect(socket.url).toMatch(/^ws:\/\/.*\/beep$/);
  open(rerender);

  expect(sent()).toEqual([{ type: 'JOIN', ...registration }]);
  expect(result.current.readyState).toBe(ReadyState.CONNECTING);
  expect(result.current.sendKey(true)).toBe(false);
  expect(result.current.sendCode('.', 20)).toBe(false);
  expect(result.current.sendFrequency(800)).toBe(false);
  expect(result.current.sendName('Alex')).toBe(false);
  act(() => {
    receive({ type: 'OPERATORS', operators: [] });
    vi.advanceTimersByTime(5_000);
  });
  expect(onMessage).not.toHaveBeenCalled();
  expect(sent()).toHaveLength(1);

  act(() => receive(hello));
  expect(result.current.readyState).toBe(ReadyState.OPEN);
  expect(onMessage).toHaveBeenCalledWith(hello);
  expect(result.current.sendName('Alex')).toBe(true);
  expect(result.current.sendFrequency(800)).toBe(true);
  expect(result.current.sendKey(true)).toBe(true);
  expect(result.current.sendCode('.', 20)).toBe(true);
  expect(sent().slice(1)).toEqual([
    { type: 'NAME', name: 'Alex' },
    { type: 'FREQUENCY', frequency: 800 },
    { type: 'KEY', down: true, timestamp: expect.any(Number), sequence: 1 },
    {
      type: 'CODE',
      code: '.',
      wpm: 20,
      timestamp: expect.any(Number),
      sequence: 2,
    },
  ]);
  expect(
    socket.sendMessage.mock.calls.every(([, keep]) => keep === false),
  ).toBe(true);
});

it('registers the latest identity and frequency on every reconnect', () => {
  const { result, rerender } = renderHook(
    ({ identity }) => useMorseSocket(vi.fn(), vi.fn(), identity),
    { initialProps: { identity: registration } },
  );
  open(() => rerender({ identity: registration }));
  act(() => receive(hello));
  expect(result.current.sendKey(true)).toBe(true);

  const latest = { name: 'SM0ABC', frequency: 825 };
  rerender({ identity: latest });
  act(() => {
    socket.readyState = ReadyState.CLOSED;
    socket.connection.readyState = ReadyState.CLOSED;
    socket.options.onClose?.(socketEvent(new CloseEvent('close')));
    rerender({ identity: latest });
  });
  expect(result.current.sendKey(false)).toBe(false);
  expect(
    socket.options.shouldReconnect?.(socketEvent(new CloseEvent('close'))),
  ).toBe(true);

  open(() => rerender({ identity: latest }));
  expect(sent().at(-1)).toEqual({ type: 'JOIN', ...latest });
  expect(result.current.readyState).toBe(ReadyState.CONNECTING);
  act(() => receive({ ...hello, operatorId: 'new-self', frequency: 825 }));
  expect(result.current.sendKey(true)).toBe(true);
  expect(sent().at(-1)).toMatchObject({ type: 'KEY', sequence: 1 });
});

it.each(['SM0ABC', ''])(
  'synchronizes a name set to %j while waiting for registration confirmation',
  name => {
    const { result, rerender } = renderHook(
      ({ identity }) => useMorseSocket(vi.fn(), vi.fn(), identity),
      { initialProps: { identity: registration } },
    );
    open(() => rerender({ identity: registration }));
    const latest = { name, frequency: 825 };
    rerender({ identity: latest });
    expect(result.current.sendName(latest.name)).toBe(false);
    expect(result.current.sendFrequency(latest.frequency)).toBe(false);

    act(() => receive(hello));
    expect(sent()).toEqual([
      { type: 'JOIN', ...registration },
      { type: 'NAME', name: latest.name },
      { type: 'FREQUENCY', frequency: latest.frequency },
    ]);
    expect(result.current.sendKey(true)).toBe(true);
    expect(sent().at(-1)).toMatchObject({ type: 'KEY', sequence: 1 });
  },
);

it('stops session traffic and reconnection when registration is cleared', () => {
  const { result, rerender } = renderHook(
    ({ identity }) => useMorseSocket(vi.fn(), vi.fn(), identity),
    {
      initialProps: {
        identity: registration as typeof registration | null,
      },
    },
  );
  open(() => rerender({ identity: registration }));
  act(() => receive(hello));
  rerender({ identity: null });

  expect(socket.url).toBeNull();
  expect(result.current.readyState).toBe(ReadyState.UNINSTANTIATED);
  expect(result.current.sendKey(true)).toBe(false);
  expect(socket.options.shouldReconnect?.(new CloseEvent('close'))).toBe(false);
  const before = sent().length;
  act(() => vi.advanceTimersByTime(30_000));
  expect(sent()).toHaveLength(before);
  expect(socket.connection.close).not.toHaveBeenCalled();

  rerender({ identity: registration });
  expect(result.current.readyState).toBe(ReadyState.CONNECTING);
  expect(result.current.sendKey(true)).toBe(false);
  open(() => rerender({ identity: registration }));
  expect(sent().at(-1)).toEqual({ type: 'JOIN', ...registration });
  expect(result.current.readyState).toBe(ReadyState.CONNECTING);
  act(() => receive({ ...hello, operatorId: 'new-self' }));
  expect(result.current.sendKey(true)).toBe(true);
  expect(sent().at(-1)).toMatchObject({ type: 'KEY', sequence: 1 });
});

it('reconnects if the relay never confirms registration', () => {
  const { rerender } = renderHook(() =>
    useMorseSocket(vi.fn(), vi.fn(), registration),
  );
  open(rerender);
  act(() => vi.advanceTimersByTime(10_000));
  rerender();
  act(() => vi.advanceTimersByTime(5_000));
  expect(socket.connection.close).toHaveBeenCalledOnce();
  expect(sent()).toEqual([{ type: 'JOIN', ...registration }]);
});
