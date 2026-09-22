import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { mocks, resetMocks, sentCommands } from './app-mocks';
import App from '../src/App';
import { PREFERENCES_KEY } from '../src/settings/preferences';

beforeEach(resetMocks);
afterEach(() => vi.restoreAllMocks());

function openApp() {
  return render(
    <MemoryRouter>
      <App />
    </MemoryRouter>,
  );
}
async function join() {
  await act(async () =>
    fireEvent.click(screen.getByRole('button', { name: 'Join' })),
  );
}
function roster(operators: { id: string; frequency: number }[]) {
  act(() =>
    mocks.onMessage?.({
      data: JSON.stringify({ type: 'OPERATORS', operators }),
    }),
  );
}

it('makes typed sending discoverable and retains drafts across panels and disconnects', async () => {
  openApp();
  await join();
  fireEvent.click(screen.getByRole('button', { name: 'Type a message' }));
  fireEvent.change(screen.getByLabelText('Message'), {
    target: { value: 'CQ TEST' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Morse reference' }));
  fireEvent.click(screen.getByRole('button', { name: 'Type a message' }));
  expect((screen.getByLabelText('Message') as HTMLInputElement).value).toBe(
    'CQ TEST',
  );
  act(() => {
    mocks.socket.readyState = 3;
    mocks.onClose?.();
  });
  expect(
    (screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  expect((screen.getByLabelText('Message') as HTMLInputElement).value).toBe(
    'CQ TEST',
  );
  act(() => {
    mocks.socket.readyState = 1;
    mocks.onOpen?.();
  });
  fireEvent.submit(screen.getByLabelText('Message').closest('form')!);
  expect(sentCommands()).toContain('CODE');
  expect((screen.getByLabelText('Message') as HTMLInputElement).value).toBe('');
});

it('mutes local and current/new remote voices without losing the volume setting', async () => {
  openApp();
  await join();
  roster([{ id: 'a', frequency: 600 }]);
  fireEvent.click(screen.getByRole('button', { name: 'Mute sound' }));
  expect(
    mocks.oscillators.every(oscillator => oscillator.volume === -Infinity),
  ).toBe(true);
  roster([
    { id: 'a', frequency: 600 },
    { id: 'b', frequency: 700 },
  ]);
  expect(mocks.oscillators[2].volume).toBe(-Infinity);
  fireEvent.click(screen.getByRole('button', { name: 'Unmute sound' }));
  expect(
    mocks.oscillators.every(
      oscillator => Math.abs(oscillator.volume - 20 * Math.log10(0.8)) < 0.0001,
    ),
  ).toBe(true);
  expect(JSON.parse(localStorage.getItem(PREFERENCES_KEY)!).volume).toBe(80);
});

it('loads a saved frequency before the server hello and restores saved settings on screen', async () => {
  localStorage.setItem(
    PREFERENCES_KEY,
    JSON.stringify({ volume: 35, frequency: 900, wpm: 25 }),
  );
  openApp();
  await join();
  act(() =>
    mocks.onMessage?.({
      data: JSON.stringify({ type: 'HELLO', operatorId: 'me', frequency: 650 }),
    }),
  );
  expect(mocks.sendMessage).toHaveBeenCalledWith(
    JSON.stringify({ type: 'FREQUENCY', frequency: 900 }),
    false,
  );
  expect(mocks.oscillators[0].frequency).toBe(900);
  fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
  expect((screen.getByLabelText('Volume') as HTMLInputElement).value).toBe(
    '35',
  );
  expect((screen.getByLabelText('WPM') as HTMLInputElement).value).toBe('25');
  expect(screen.getByText('900 Hz')).toBeDefined();
});

it('plays reference characters locally without broadcasting them', async () => {
  openApp();
  await join();
  fireEvent.click(screen.getByRole('button', { name: 'Morse reference' }));
  fireEvent.click(
    screen.getByRole('button', { name: 'Play E locally: dot', exact: true }),
  );
  expect(mocks.oscillators[0].start).toHaveBeenCalledOnce();
  expect(sentCommands()).not.toContain('CODE');
});

it('exposes connection details to keyboard users without keying the transmitter', async () => {
  openApp();
  await join();
  const trigger = screen.getByRole('button', {
    name: 'Connection details: Connected',
  });
  fireEvent.focus(trigger);
  fireEvent.keyDown(trigger, { key: ' ' });
  fireEvent.keyUp(trigger, { key: ' ' });
  expect(sentCommands()).toEqual([]);
  const panel = screen.getByRole('group', { name: 'Connection details' });
  expect(within(panel).getByText('Measuring…')).toBeDefined();
  expect(panel.textContent).not.toContain('null ms');
});

it('allows retry after audio activation fails', async () => {
  mocks.startAudio.mockRejectedValueOnce(new Error('Audio unavailable'));
  openApp();
  await join();
  expect(
    screen.getByText('Could not enable audio. Please try joining again.'),
  ).toBeDefined();
  expect(mocks.oscillators).toHaveLength(0);
  await join();
  expect(screen.getByRole('button', { name: 'Morse key' })).toBeDefined();
});
