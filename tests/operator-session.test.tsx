import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { mocks, resetMocks } from './app-mocks';
import App from '../src/App';
import { useMorseSession } from '../src/hooks/useMorseSession';
import { PREFERENCES_KEY } from '../src/settings/preferences';

beforeEach(() => {
  resetMocks();
  vi.useFakeTimers({
    toFake: [
      'setTimeout',
      'clearTimeout',
      'setInterval',
      'clearInterval',
      'performance',
    ],
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function receive(message: object) {
  mocks.onMessage?.({ data: JSON.stringify(message) });
}
function sent(type: string) {
  return mocks.sendMessage.mock.calls
    .map(([message]) => JSON.parse(message))
    .filter(message => message.type === type);
}
function openApp() {
  return render(
    <MemoryRouter>
      <App />
    </MemoryRouter>,
  );
}
function advance(ms: number) {
  act(() => vi.advanceTimersByTime(ms));
}

it('stays disconnected while entering a name and registers it only after audio is enabled', async () => {
  let enableAudio: () => void = () => {};
  mocks.startAudio.mockReturnValueOnce(
    new Promise<void>(resolve => {
      enableAudio = resolve;
    }),
  );
  openApp();
  fireEvent.change(screen.getByLabelText('Callsign or name'), {
    target: { value: '  SM0ABC  ' },
  });
  advance(30_000);
  expect(mocks.socketUrl).toBeNull();
  expect(mocks.sendMessage).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Join' }));
  expect(mocks.socketUrl).toBeNull();
  expect(
    screen.getByRole('button', { name: 'Joining…' }).hasAttribute('disabled'),
  ).toBe(true);
  await act(async () => enableAudio());
  expect(mocks.socketUrl).toMatch(/\/beep$/);
  expect(sent('JOIN')).toEqual([
    { type: 'JOIN', name: 'SM0ABC', frequency: expect.any(Number) },
  ]);
  expect(JSON.parse(localStorage.getItem(PREFERENCES_KEY)!).name).toBe(
    'SM0ABC',
  );
});

it('starts blank and requests a server guest after restoring an old client generated name', async () => {
  localStorage.setItem(
    'morse.preferences.v1',
    JSON.stringify({ name: 'Guest-A1B2C3', frequency: 825 }),
  );
  const view = openApp();
  expect(
    (screen.getByLabelText('Callsign or name') as HTMLInputElement).value,
  ).toBe('');
  await act(async () =>
    fireEvent.click(screen.getByRole('button', { name: 'Join' })),
  );
  expect(sent('JOIN')).toEqual([{ type: 'JOIN', name: '', frequency: 825 }]);
  act(() =>
    receive({
      type: 'OPERATORS',
      operators: [{ id: 'me', name: 'Spock', frequency: 825 }],
    }),
  );
  fireEvent.click(
    screen.getByRole('button', { name: /Operators, 1 connected/ }),
  );
  expect(screen.getByText('Spock')).toBeDefined();
  expect(JSON.parse(localStorage.getItem(PREFERENCES_KEY)!).name).toBe('');
  view.unmount();
  openApp();
  expect(
    (screen.getByLabelText('Callsign or name') as HTMLInputElement).value,
  ).toBe('');
});

it('requests a server guest name and persists only explicitly chosen names across reloads', async () => {
  const view = openApp();
  await act(async () =>
    fireEvent.click(screen.getByRole('button', { name: 'Join' })),
  );
  expect(sent('JOIN')[0].name).toBe('');
  act(() =>
    receive({
      type: 'OPERATORS',
      operators: [{ id: 'me', name: 'Spock', frequency: 700 }],
    }),
  );
  fireEvent.click(
    screen.getByRole('button', { name: /Operators, 1 connected/ }),
  );
  expect(screen.getByText('Spock')).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
  fireEvent.change(screen.getByLabelText('Callsign or name'), {
    target: { value: '  Åsa / SM0ABC  ' },
  });
  expect(sent('NAME')).toEqual([]);
  expect(JSON.parse(localStorage.getItem(PREFERENCES_KEY)!).name).toBe('');
  fireEvent.click(screen.getByRole('button', { name: 'Save name' }));
  expect(sent('NAME')).toEqual([{ type: 'NAME', name: 'Åsa / SM0ABC' }]);
  act(() =>
    receive({
      type: 'OPERATORS',
      operators: [{ id: 'me', name: 'Åsa / SM0ABC', frequency: 700 }],
    }),
  );
  expect(screen.getByText('Åsa / SM0ABC')).toBeDefined();
  view.unmount();
  const before = mocks.sendMessage.mock.calls.length;
  openApp();
  expect(
    (screen.getByLabelText('Callsign or name') as HTMLInputElement).value,
  ).toBe('Åsa / SM0ABC');
  expect(mocks.socketUrl).toBeNull();
  advance(30_000);
  expect(mocks.sendMessage.mock.calls).toHaveLength(before);
});

it('clears a custom name and requests a new guest on reconnect and reload', async () => {
  const first = renderHook(() => useMorseSession());
  await act(() => first.result.current.startAudio('Alex'));
  act(() => {
    expect(first.result.current.changeName('   ')).toBe(true);
  });
  expect(sent('NAME')).toEqual([{ type: 'NAME', name: '' }]);
  act(() =>
    receive({
      type: 'OPERATORS',
      operators: [{ id: 'me', name: 'Data', frequency: 700 }],
    }),
  );
  expect(first.result.current.operators[0].name).toBe('Data');
  expect(first.result.current.name).toBe('');
  expect(JSON.parse(localStorage.getItem(PREFERENCES_KEY)!).name).toBe('');

  act(() => {
    mocks.socket.readyState = 3;
    mocks.onClose?.();
  });
  act(() => {
    mocks.socket.readyState = 1;
    mocks.onOpen?.();
    receive({
      type: 'OPERATORS',
      operators: [{ id: 'me', name: 'Worf', frequency: 700 }],
    });
  });
  expect(sent('JOIN').at(-1).name).toBe('');
  expect(first.result.current.operators[0].name).toBe('Worf');
  expect(first.result.current.name).toBe('');
  first.unmount();

  const next = renderHook(() => useMorseSession());
  await act(() => next.result.current.startAudio());
  expect(sent('JOIN').at(-1).name).toBe('');
});

it('does not connect on failed audio or invalid identity and keeps saved settings usable offline', async () => {
  const { result } = renderHook(() => useMorseSession());
  await act(() => result.current.startAudio('a'.repeat(33)));
  await act(() => result.current.startAudio('A\u200bB'));
  expect(mocks.startAudio).not.toHaveBeenCalled();
  expect(mocks.socketUrl).toBeNull();
  mocks.startAudio.mockRejectedValueOnce(new Error('Audio unavailable'));
  await act(() => result.current.startAudio('Alex'));
  expect(result.current.started).toBe(false);
  expect(mocks.socketUrl).toBeNull();
  act(() => {
    result.current.changeName('Alex');
    result.current.changeFrequency(825);
  });
  advance(1_000);
  expect(mocks.sendMessage).not.toHaveBeenCalled();
  await act(() => result.current.startAudio());
  expect(sent('JOIN')[0]).toMatchObject({
    name: 'Alex',
    frequency: 825,
  });
});

it('retains the join name draft while changing pre-join audio settings', async () => {
  openApp();
  fireEvent.change(screen.getByLabelText('Callsign or name'), {
    target: { value: 'SM0ABC' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
  fireEvent.change(screen.getByLabelText('Frequency'), {
    target: { value: '800' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Close settings' }));
  expect(
    (screen.getByLabelText('Callsign or name') as HTMLInputElement).value,
  ).toBe('SM0ABC');
  expect(mocks.socketUrl).toBeNull();
  await act(async () =>
    fireEvent.click(screen.getByRole('button', { name: 'Join' })),
  );
  expect(sent('JOIN')[0]).toMatchObject({
    name: 'SM0ABC',
    frequency: 800,
  });
});

it('uses a name saved in pre-join settings when no welcome draft has been entered', () => {
  openApp();
  fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Callsign or name' }), {
    target: { value: 'Sam' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save name' }));
  fireEvent.click(screen.getByRole('button', { name: 'Close settings' }));
  expect(
    (
      screen.getByRole('textbox', {
        name: 'Callsign or name',
      }) as HTMLInputElement
    ).value,
  ).toBe('Sam');
  expect(mocks.sendMessage).not.toHaveBeenCalled();
});

it('lights only sent text intervals within a mixed queue of private and transmitted playback', async () => {
  const { result } = renderHook(() => useMorseSession());
  await act(() => result.current.startAudio('Alex'));
  act(() => {
    result.current.playMyMorseCode('.');
    result.current.sendText('E');
    result.current.playMyMorseCode('.');
    result.current.sendText('E');
    result.current.toggleMute();
  });
  expect(sent('CODE')).toHaveLength(2);
  expect(result.current.activeOperatorIds.has('me')).toBe(false);
  advance(200); // Private E (100–340 ms).
  expect(result.current.activeOperatorIds.has('me')).toBe(false);
  advance(200); // Sent E (340–580 ms).
  expect(result.current.activeOperatorIds.has('me')).toBe(true);
  advance(200); // Private E (580–820 ms).
  expect(result.current.activeOperatorIds.has('me')).toBe(false);
  advance(300); // Sent E (820–1060 ms).
  expect(result.current.activeOperatorIds.has('me')).toBe(true);
  advance(200);
  expect(result.current.activeOperatorIds.size).toBe(0);
});

it('follows local key audio timing, bridges a release, and cancels queued text on interruption', async () => {
  const { result } = renderHook(() => useMorseSession());
  await act(() => result.current.startAudio('Alex'));
  act(() => {
    result.current.sendText('SOS SOS');
    result.current.start();
  });
  expect(result.current.activeOperatorIds.has('me')).toBe(false);
  advance(200);
  expect(result.current.activeOperatorIds.has('me')).toBe(true);
  act(() => result.current.stop());
  advance(400);
  expect(result.current.activeOperatorIds.has('me')).toBe(true);
  advance(100);
  expect(result.current.activeOperatorIds.has('me')).toBe(false);
  advance(10_000);
  expect(result.current.activeOperatorIds.size).toBe(0);
});

it('never promotes a key pressed before HELLO into a transmitted hold', async () => {
  mocks.autoHello = false;
  const { result } = renderHook(() => useMorseSession());
  await act(() => result.current.startAudio('Alex'));
  act(() => result.current.start());
  advance(300);
  act(() => receive({ type: 'HELLO', operatorId: 'me', frequency: 700 }));
  advance(1_000);
  expect(sent('KEY')).toEqual([]);
  expect(result.current.activeOperatorIds.size).toBe(0);
  act(() => {
    result.current.stop();
    result.current.start();
  });
  advance(200);
  expect(sent('KEY').some(message => message.down)).toBe(true);
  expect(result.current.activeOperatorIds.has('me')).toBe(true);
});

it('disconnects a released local tone still scheduled inside the audio lookahead', async () => {
  const { result } = renderHook(() => useMorseSession());
  await act(() => result.current.startAudio('Alex'));
  const voice = mocks.oscillators[0];
  act(() => {
    result.current.start();
    result.current.stop();
  });
  expect(voice.dispose).not.toHaveBeenCalled();
  act(() => {
    mocks.socket.readyState = 3;
    mocks.onClose?.();
  });
  expect(voice.dispose).toHaveBeenCalledOnce();
  advance(1_000);
  expect(result.current.activeOperatorIds.size).toBe(0);
});

it('clears local and remote activity on disconnect, reconnect, departure and audio suspension', async () => {
  const { result } = renderHook(() => useMorseSession());
  await act(() => result.current.startAudio('Alex'));
  act(() => {
    receive({
      type: 'OPERATORS',
      operators: [{ id: 'peer', name: 'Sam', frequency: 600 }],
    });
    receive({
      type: 'CODE',
      operatorId: 'peer',
      timestamp: 0,
      sequence: 1,
      code: '... --- ...',
      wpm: 20,
    });
    result.current.sendText('SOS');
  });
  advance(500);
  expect(result.current.activeOperatorIds).toEqual(new Set(['me', 'peer']));
  act(() => receive({ type: 'OPERATORS', operators: [] }));
  expect(result.current.activeOperatorIds).toEqual(new Set(['me']));
  act(() => {
    mocks.socket.readyState = 3;
    mocks.onClose?.();
  });
  expect(result.current.activeOperatorIds.size).toBe(0);
  expect(result.current.operators).toEqual([]);
  act(() => {
    mocks.socket.readyState = 1;
    mocks.onOpen?.();
  });
  advance(4_000);
  expect(result.current.activeOperatorIds.size).toBe(0);
  act(() => result.current.start());
  advance(200);
  expect(result.current.activeOperatorIds.has('me')).toBe(true);
  act(() => {
    mocks.context.state = 'suspended';
    mocks.context.on.mock.calls[0][1]();
  });
  expect(result.current.activeOperatorIds.size).toBe(0);
  expect(mocks.socketUrl).toBeNull();
  expect(result.current.started).toBe(false);
});
