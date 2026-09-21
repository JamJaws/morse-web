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
    connect = vi.fn().mockReturnThis();
    start = vi.fn().mockReturnThis();
    stop = vi.fn().mockReturnThis();
    dispose = vi.fn().mockReturnThis();
    set = vi.fn((options: { frequency?: number; volume?: number }) => {
      Object.assign(this, options);
      return this;
    });
  }
  class Gain {
    gain = { setValueAtTime: vi.fn(), cancelScheduledValues: vi.fn() };
    dispose = vi.fn();
    toDestination() {
      return this;
    }
  }
  return {
    oscillators: [] as Oscillator[],
    Oscillator,
    gains: [] as Gain[],
    Gain,
    socket: { readyState: 1, bufferedAmount: 0, close: vi.fn() },
    context: { state: 'running', on: vi.fn(), off: vi.fn() },
    sendMessage: vi.fn(),
    startAudio: vi.fn().mockResolvedValue(undefined),
    onOpen: undefined as (() => void) | undefined,
    onClose: undefined as (() => void) | undefined,
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
  Gain: class extends mocks.Gain {
    constructor() {
      super();
      mocks.gains.push(this);
    }
  },
  now: () => 100 + performance.now() / 1_000,
  immediate: () => 99.9 + performance.now() / 1_000,
  getContext: () => mocks.context,
  start: mocks.startAudio,
  gainToDb: (gain: number) => 20 * Math.log10(gain),
}));

vi.mock('react-use-websocket', () => {
  const getWebSocket = () => mocks.socket;
  return {
    ReadyState: {
      CONNECTING: 0,
      OPEN: 1,
      CLOSING: 2,
      CLOSED: 3,
      UNINSTANTIATED: -1,
    },
    default: (
      _url: string,
      options: {
        onMessage: typeof mocks.onMessage;
        onOpen: typeof mocks.onOpen;
        onClose: typeof mocks.onClose;
      },
    ) => {
      mocks.onMessage = options.onMessage;
      mocks.onOpen = options.onOpen;
      mocks.onClose = options.onClose;
      return {
        sendMessage: mocks.sendMessage,
        getWebSocket,
        lastMessage: null,
        readyState: mocks.socket.readyState,
      };
    },
  };
});
export function resetMocks() {
  vi.clearAllMocks();
  localStorage.clear();
  mocks.oscillators.length = 0;
  mocks.gains.length = 0;
  mocks.onMessage = undefined;
  mocks.onOpen = undefined;
  mocks.onClose = undefined;
  mocks.socket.readyState = 1;
  mocks.socket.bufferedAmount = 0;
  mocks.context.state = 'running';
}
export function sentCommands(): string[] {
  return mocks.sendMessage.mock.calls.map(([message]) => {
    const m = JSON.parse(message);
    return m.type === 'KEY' ? (m.down ? 'START' : 'STOP') : m.type;
  });
}
