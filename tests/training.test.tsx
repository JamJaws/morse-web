import { StrictMode } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useRoutes } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { mocks, resetMocks, sentCommands } from './app-mocks';
import { routes } from '../src/routes';
import { PREFERENCES_KEY } from '../src/settings/preferences';

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
  vi.spyOn(Math, 'random').mockReturnValue(0); // K, including natural repeats.
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
});
function TestRoutes() {
  return useRoutes(routes);
}
function open(path = '/training?lesson=1') {
  return render(
    <StrictMode>
      <MemoryRouter initialEntries={[path]}>
        <TestRoutes />
      </MemoryRouter>
    </StrictMode>,
  );
}
async function click(name: string) {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name, exact: true }));
  });
}
async function finishSound() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(2_000);
  });
}

it('shows all lessons and honours bookmarked, invalid and final lesson URLs without connecting', async () => {
  open('/training?lesson=invalid');
  const list = screen.getByRole('list', { name: 'Listening lessons' });
  expect(screen.queryByText('Every lesson is open')).toBeNull();
  expect(within(list).getAllByRole('link')).toHaveLength(39);
  fireEvent.click(screen.getByRole('link', { name: 'Lesson 39: X' }));
  expect(screen.getByRole('heading', { name: 'Lesson 39' })).toBeDefined();
  expect(screen.queryByRole('link', { name: 'Next lesson' })).toBeNull();
  await click('Start lesson');
  expect(screen.getAllByRole('button', { name: /^Answer / })).toHaveLength(40);
  expect(mocks.socketUrl).toBeNull();
  expect(mocks.sendMessage).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('link', { name: 'All lessons' }));
  expect(screen.getByRole('list', { name: 'Listening lessons' })).toBeDefined();
  expect(
    mocks.oscillators.every(voice => voice.dispose.mock.calls.length === 1),
  ).toBe(true);
});

it('practises a custom set including ÅÄÖ, with keyboard answers and no saved selection', async () => {
  const write = vi.spyOn(Storage.prototype, 'setItem');
  const view = open('/training');
  fireEvent.click(screen.getByRole('link', { name: /^Custom practice/ }));
  expect(
    (
      screen.getByRole('button', {
        name: 'Start practice',
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  await click('ÅÄÖ');
  expect(screen.getByText('3 characters selected')).toBeDefined();
  await click('Start practice');
  expect(
    screen
      .getAllByRole('button', { name: /^Answer / })
      .map(button => button.textContent),
  ).toEqual(['Å', 'Ä', 'Ö']);
  expect(mocks.oscillators).toHaveLength(5); // Å is .--.-
  await finishSound();
  fireEvent.keyDown(screen.getByLabelText('Listening exercise'), { key: 'å' });
  expect(screen.getByText('Correct!')).toBeDefined();
  await click('Change characters');
  expect(screen.getByText('3 characters selected')).toBeDefined();
  await click('Practise K');
  await click('Practise Ä');
  await click('Start practice');
  expect(
    screen
      .getAllByRole('button', { name: /^Answer / })
      .map(button => button.textContent),
  ).toEqual(['K', 'Å', 'Ö']);
  expect(screen.getByText('Sound 1 of 20')).toBeDefined();
  expect(write).not.toHaveBeenCalled();
  expect(mocks.sendMessage).not.toHaveBeenCalled();
  view.unmount();
  open('/training?practice=custom');
  expect(screen.getByText('Choose at least one character.')).toBeDefined();
});

it('supports a single selected character and clears quick sets without duplicates', async () => {
  open('/training?practice=custom');
  await click('A–Z');
  await click('0–9');
  expect(screen.getByText('10 characters selected')).toBeDefined();
  await click('Clear');
  await click('Practise Ö');
  await click('Start practice');
  expect(screen.getAllByRole('button', { name: /^Answer / })).toHaveLength(1);
  await finishSound();
  await click('Answer Ö');
  expect(screen.getByText('Correct!')).toBeDefined();
});

it('scores first answers once, separates assisted success and finishes a 20-sound round', async () => {
  open();
  await click('Start lesson');
  // Neither button nor keyboard answers may bypass the whole sound.
  await click('Answer K');
  fireEvent.keyDown(screen.getByLabelText('Listening exercise'), { key: 'k' });
  expect(screen.getByText('Wait for the whole sound.')).toBeDefined();
  await finishSound();
  await act(async () => {
    const exercise = screen.getByLabelText('Listening exercise');
    fireEvent.keyDown(exercise, { key: 'm' });
    fireEvent.keyDown(exercise, { key: 'k' });
  });
  expect(screen.getByText('It was K.')).toBeDefined();
  expect(document.activeElement).toBe(
    screen.getByRole('button', { name: 'Next sound' }),
  );
  await click('Hear answer');
  await finishSound();
  expect(screen.getByText('0 correct without help')).toBeDefined();
  await click('Next sound');
  await finishSound();
  await click('Replay');
  await finishSound();
  await click('Answer K');
  expect(screen.getByText('Correct, with help.')).toBeDefined();
  await click('Next sound');
  await finishSound();
  await click('Show hint');
  await click('Answer K');
  expect(screen.getByText('Correct, with help.')).toBeDefined();
  for (let prompt = 4; prompt <= 20; prompt++) {
    await click('Next sound');
    await finishSound();
    fireEvent.keyDown(screen.getByLabelText('Listening exercise'), {
      key: 'k',
    });
    expect(screen.getByText('Correct!')).toBeDefined();
  }
  await click('See results');
  expect(screen.getByText('85%')).toBeDefined();
  expect(screen.getByText('17 of 20 correct without help')).toBeDefined();
  expect(screen.getByText('2 correct with help · 1 incorrect')).toBeDefined();
  expect(screen.getByRole('link', { name: 'Next lesson' })).toBeDefined();
  await click('Repeat lesson');
  expect(screen.getByText('Sound 1 of 20')).toBeDefined();
  expect(screen.getByText('0 correct without help')).toBeDefined();
});

it('pauses hidden or suspended audio and resumes only by choice without penalising interruption', async () => {
  open();
  await click('Start lesson');
  const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
  fireEvent(document, new Event('visibilitychange'));
  expect(screen.getByText('Paused')).toBeDefined();
  expect(
    mocks.oscillators.every(voice => voice.dispose.mock.calls.length === 1),
  ).toBe(true);
  hidden.mockReturnValue(false);
  fireEvent(document, new Event('visibilitychange'));
  await finishSound();
  expect(screen.getByText('Paused')).toBeDefined();
  await click('Resume');
  await finishSound();
  await click('Answer K');
  expect(screen.getByText('1 correct without help')).toBeDefined();
  await click('Next sound');
  await finishSound();
  act(() => {
    mocks.context.state = 'suspended';
    mocks.context.on.mock.calls.at(-1)![1]();
  });
  expect(screen.getByText('Paused')).toBeDefined();
  act(() => {
    mocks.context.state = 'running';
    mocks.context.on.mock.calls.at(-1)![1]();
  });
  expect(screen.getByText('Paused')).toBeDefined();
  await click('Resume');
  await finishSound();
  await click('Answer K');
  // Re-hearing a fully heard prompt is assistance, even through Pause.
  expect(screen.getByText('Correct, with help.')).toBeDefined();
  expect(screen.getByText('1 correct without help')).toBeDefined();
});

it('handles unavailable audio, rapid Start clicks and a pending audio start after navigation', async () => {
  open();
  mocks.startAudio.mockRejectedValueOnce(new Error('Not allowed'));
  await click('Start lesson');
  expect(screen.getByRole('alert').textContent).toContain(
    'Could not play audio',
  );
  expect(mocks.oscillators).toHaveLength(0);
  await click('Resume');
  await finishSound();
  await click('Answer K');
  expect(screen.getByText('1 correct without help')).toBeDefined();
  fireEvent.click(screen.getByRole('link', { name: 'Next lesson' }));
  let enableAudio!: () => void;
  mocks.startAudio.mockReturnValueOnce(
    new Promise<void>(resolve => {
      enableAudio = resolve;
    }),
  );
  await act(async () => {
    const start = screen.getByRole('button', { name: 'Start lesson' });
    fireEvent.click(start);
    fireEvent.click(start);
  });
  const voiceCount = mocks.oscillators.length;
  fireEvent.click(screen.getByRole('link', { name: 'All lessons' }));
  await act(async () => {
    enableAudio();
  });
  expect(mocks.oscillators).toHaveLength(voiceCount);
  expect(screen.getByRole('list', { name: 'Listening lessons' })).toBeDefined();
});

it('keeps settings and scores out of storage, supports blocked storage, and ignores shortcuts in settings', async () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('Blocked');
  });
  const write = vi.spyOn(Storage.prototype, 'setItem');
  open('/training?lesson=33');
  await click('Start lesson');
  await finishSound();
  const slider = screen.getByLabelText('Character speed');
  fireEvent.keyDown(slider, { key: 'k' });
  fireEvent.keyDown(screen.getByLabelText('Listening exercise'), {
    key: 'k',
    repeat: true,
  });
  expect(screen.getByText('What did you hear?')).toBeDefined();
  fireEvent.change(slider, { target: { value: 25 } });
  expect(screen.getByText('Paused')).toBeDefined();
  await click('Resume');
  await finishSound();
  fireEvent.keyDown(screen.getByLabelText('Listening exercise'), {
    key: '?',
    shiftKey: true,
  });
  expect(screen.getByText('It was K.')).toBeDefined();
  expect(write).not.toHaveBeenCalled();
  expect(mocks.sendMessage).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('link', { name: 'Next lesson' }));
  expect(
    (screen.getByLabelText('Character speed') as HTMLInputElement).value,
  ).toBe('20');
  expect(screen.getByRole('button', { name: 'Start lesson' })).toBeDefined();
});

it('reads only saved volume, guards muted practice and leaves live preferences unchanged', async () => {
  const saved = JSON.stringify({
    volume: 0,
    wpm: 35,
    frequency: 900,
    name: 'TEST',
  });
  localStorage.setItem(PREFERENCES_KEY, saved);
  const write = vi.spyOn(Storage.prototype, 'setItem');
  open();
  expect(
    (screen.getByLabelText('Character speed') as HTMLInputElement).value,
  ).toBe('20');
  await click('Start lesson');
  expect(screen.getByRole('alert').textContent).toContain('Turn up the volume');
  expect(mocks.oscillators).toHaveLength(0);
  fireEvent.change(screen.getByLabelText('Volume'), { target: { value: 50 } });
  await click('Hear K');
  expect(mocks.oscillators[0].volume).toBeCloseTo(20 * Math.log10(0.5));
  await click('Start lesson');
  expect(
    mocks.oscillators
      .slice(0, 3)
      .every(voice => voice.dispose.mock.calls.length === 1),
  ).toBe(true);
  expect(write).not.toHaveBeenCalled();
  expect(localStorage.getItem(PREFERENCES_KEY)).toBe(saved);
});

it('cleans up live keys and remote/queued audio on Training, and requires Connect on return', async () => {
  open('/?tx=true');
  await click('Connect');
  act(() => {
    mocks.onMessage?.({
      data: JSON.stringify({
        type: 'OPERATORS',
        operators: [{ id: 'peer', name: 'Peer', frequency: 600 }],
      }),
    });
    mocks.onMessage?.({
      data: JSON.stringify({
        type: 'CODE',
        operatorId: 'peer',
        timestamp: 0,
        sequence: 1,
        code: '... --- ...',
        wpm: 20,
      }),
    });
  });
  fireEvent.change(screen.getByLabelText('Message'), {
    target: { value: 'SOS' },
  });
  await click('Send');
  const key = screen.getByRole('button', { name: 'Morse key' });
  act(() => key.focus());
  fireEvent.keyDown(key, { key: ' ' });
  const liveVoices = [...mocks.oscillators];
  fireEvent.click(screen.getByRole('link', { name: 'Training', exact: true }));
  expect(mocks.socket.close).toHaveBeenCalled();
  expect(liveVoices.every(voice => voice.dispose.mock.calls.length > 0)).toBe(
    true,
  );
  expect(mocks.gains.every(gain => gain.dispose.mock.calls.length > 0)).toBe(
    true,
  );
  const commandCount = sentCommands().length;
  fireEvent.keyUp(document, { key: ' ' });
  await finishSound();
  expect(sentCommands()).toHaveLength(commandCount);
  fireEvent.click(screen.getByRole('link', { name: 'Lesson 1: K and M' }));
  await click('Start lesson');
  expect(sentCommands()).toHaveLength(commandCount);
  const trainingVoices = mocks.oscillators.slice(liveVoices.length);
  fireEvent.click(screen.getByRole('link', { name: 'Live', exact: true }));
  expect(
    trainingVoices.every(voice => voice.dispose.mock.calls.length === 1),
  ).toBe(true);
  expect(screen.getByRole('button', { name: 'Connect' })).toBeDefined();
  expect(mocks.socketUrl).toBeNull();
  expect(screen.queryByRole('button', { name: 'Morse key' })).toBeNull();
});
