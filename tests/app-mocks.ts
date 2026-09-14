import { vi } from 'vitest';

export const mocks = (() => {
  class Oscillator {
    frequency: number;
    volume: number;

    constructor(options: { frequency?: number; volume?: number } = {}) {
      this.frequency = options.frequency ?? 440;
      this.volume = options.volume ?? 0;
    }

    toDestination = vi.fn().mockReturnThis();
    start = vi.fn().mockReturnThis();
    stop = vi.fn().mockReturnThis();
    dispose = vi.fn().mockReturnThis();
    set = vi.fn((options: { frequency?: number; volume?: number }) => {
      Object.assign(this, options);
      return this;
    });
  }

  return {
    oscillators: [] as Oscillator[],
    Oscillator,
    sendMessage: vi.fn(),
    onMessage: undefined as
      | ((event: { data: string }) => void | Promise<void>)
      | undefined,
  };
})();

vi.mock('tone', () => ({
  Oscillator: class extends mocks.Oscillator {
    constructor(options?: { frequency?: number; volume?: number }) {
      super(options);
      mocks.oscillators.push(this);
    }
  },
  now: () => 100,
  start: vi.fn().mockResolvedValue(undefined),
  gainToDb: (gain: number) => 20 * Math.log10(gain),
}));

vi.mock('react-use-websocket', () => ({
  ReadyState: {
    CONNECTING: 0,
    OPEN: 1,
    CLOSING: 2,
    CLOSED: 3,
    UNINSTANTIATED: -1,
  },
  default: (_url: string, options: { onMessage: typeof mocks.onMessage }) => {
    mocks.onMessage = options.onMessage;
    return {
      sendMessage: mocks.sendMessage,
      lastMessage: null,
      readyState: 1,
    };
  },
}));

export function resetMocks() {
  vi.clearAllMocks();
  mocks.oscillators.length = 0;
  mocks.onMessage = undefined;
}

export function sentCommands(): string[] {
  return mocks.sendMessage.mock.calls.map(
    ([message]) => JSON.parse(message).type,
  );
}
