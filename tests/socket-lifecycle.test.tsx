import { act, renderHook } from '@testing-library/react';
import { ReadyState } from 'react-use-websocket';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useMorseSocket } from '../src/network/useMorseSocket';

// Keep the real react-use-websocket lifecycle; control only the browser transport.
class ControlledWebSocket extends EventTarget {
  static instances: ControlledWebSocket[] = [];
  readyState = ReadyState.CONNECTING;
  bufferedAmount = 0;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  sent: { type: string; sequence?: number }[] = [];

  constructor() {
    super();
    ControlledWebSocket.instances.push(this);
    this.addEventListener('open', event => this.onopen?.(event));
    this.addEventListener('message', event =>
      this.onmessage?.(event as MessageEvent),
    );
    this.addEventListener('close', event =>
      this.onclose?.(event as CloseEvent),
    );
  }

  send(message: string) {
    this.sent.push(JSON.parse(message));
  }

  close() {
    this.readyState = ReadyState.CLOSING;
  }

  open() {
    this.readyState = ReadyState.OPEN;
    this.dispatchEvent(new Event('open'));
  }

  receive(message: object) {
    this.dispatchEvent(
      new MessageEvent('message', { data: JSON.stringify(message) }),
    );
  }

  finishClose() {
    this.readyState = ReadyState.CLOSED;
    this.dispatchEvent(new CloseEvent('close'));
  }
}

const registration = { name: 'Alex', frequency: 700 };
const hello = (operatorId: string) => ({
  type: 'HELLO',
  operatorId,
  frequency: 700,
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('WebSocket', ControlledWebSocket);
  ControlledWebSocket.instances = [];
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it.each(['before HELLO', 'after HELLO'])(
  'ignores a retired socket closing %s on a replacement connection',
  async phase => {
    const onMessage = vi.fn();
    const onReset = vi.fn();
    const { result, rerender, unmount } = renderHook(
      ({ identity }: { identity: typeof registration | null }) =>
        useMorseSocket(onMessage, onReset, identity),
      { initialProps: { identity: registration } },
    );
    await act(async () => {});
    const first = ControlledWebSocket.instances[0];
    act(() => {
      first.open();
      first.receive(hello('first'));
    });
    expect(result.current.sendKey(true)).toBe(true);

    // Audio suspension disables the hook; Join can run before close completes.
    rerender({ identity: null });
    expect(first.readyState).toBe(ReadyState.CLOSING);
    rerender({ identity: registration });
    await act(async () => {});
    const second = ControlledWebSocket.instances[1];
    act(() => second.open());
    expect(second.sent).toEqual([{ type: 'JOIN', ...registration }]);
    onMessage.mockClear();
    const resetsBeforeOldClose = onReset.mock.calls.length;
    act(() => {
      if (phase === 'after HELLO') second.receive(hello('second'));
      first.receive(hello('stale'));
      first.receive({ type: 'OPERATORS', operators: [] });
      first.finishClose();
      if (phase === 'before HELLO') second.receive(hello('second'));
    });
    expect(onMessage.mock.calls).toEqual([[hello('second')]]);
    expect(onReset).toHaveBeenCalledTimes(resetsBeforeOldClose);
    expect(result.current.readyState).toBe(ReadyState.OPEN);
    expect(result.current.sendKey(true)).toBe(true);
    expect(second.sent.at(-1)).toMatchObject({ type: 'KEY', sequence: 1 });
    act(() => vi.advanceTimersByTime(10_000));
    expect(ControlledWebSocket.instances).toHaveLength(2);
    expect(result.current.sendKey(false)).toBe(true);
    unmount();
  },
);

it('still reconnects when the current socket closes', async () => {
  const onReset = vi.fn();
  const { result, unmount } = renderHook(() =>
    useMorseSocket(vi.fn(), onReset, registration),
  );
  await act(async () => {});
  const first = ControlledWebSocket.instances[0];
  act(() => {
    first.open();
    first.receive(hello('first'));
    first.finishClose();
  });
  expect(result.current.sendKey(true)).toBe(false);
  expect(onReset).toHaveBeenCalledTimes(2);
  await act(async () => vi.advanceTimersByTime(1_500));
  const second = ControlledWebSocket.instances[1];
  act(() => {
    second.open();
    second.receive(hello('second'));
  });
  expect(result.current.sendKey(true)).toBe(true);
  unmount();
});

it('ignores delayed events after unmount without scheduling a reconnect', async () => {
  const onMessage = vi.fn();
  const onReset = vi.fn();
  const { unmount } = renderHook(() =>
    useMorseSocket(onMessage, onReset, registration),
  );
  await act(async () => {});
  const socket = ControlledWebSocket.instances[0];
  act(() => {
    socket.open();
    socket.receive(hello('first'));
  });
  unmount();
  onMessage.mockClear();
  onReset.mockClear();
  act(() => {
    socket.receive({ type: 'OPERATORS', operators: [] });
    socket.finishClose();
  });
  expect(onMessage).not.toHaveBeenCalled();
  expect(onReset).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});
