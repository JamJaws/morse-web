import { StrictMode } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useRoutes } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { mocks, resetMocks, sentCommands } from './app-mocks';
import { routes } from '../src/routes';
import { PREFERENCES_KEY } from '../src/settings/preferences';
import { LocalMorsePlayer } from '../src/training/LocalMorsePlayer';
import { morseCodeCharacters } from '../src/beep/MorseCodeCharacters';

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
  vi.spyOn(Math, 'random').mockReturnValue(0.99999); // Stable shuffle for interaction tests.
  vi.spyOn(LocalMorsePlayer.prototype, 'play');
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
  await advance(2_000);
}
async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}
function toggleAutoplay() {
  fireEvent.click(screen.getByRole('switch', { name: 'Autoplay next sound' }));
}
function enabledAnswers() {
  return screen
    .getAllByRole('button', { name: /^Answer / })
    .filter(button => !(button as HTMLButtonElement).disabled)
    .map(button => button.textContent);
}

function playedCharacter() {
  const code = vi.mocked(LocalMorsePlayer.prototype.play).mock.lastCall?.[0];
  const character = morseCodeCharacters.find(
    character => character.code === code,
  );
  if (!character) throw new Error(`Unknown played sound: ${code}`);
  return character.letter;
}

it('shows all lessons and honours bookmarked, invalid and final lesson URLs without connecting', async () => {
  open('/training?lesson=invalid');
  const list = screen.getByRole('list', { name: 'Listening lessons' });
  expect(screen.queryByText('Every lesson is open')).toBeNull();
  expect(within(list).getAllByRole('link')).toHaveLength(39);
  fireEvent.click(screen.getByRole('link', { name: 'Lesson 39: X' }));
  expect(screen.getByRole('heading', { name: 'Lesson 39' })).toBeDefined();
  expect(screen.getByText('80 sounds')).toBeDefined();
  expect(screen.queryByRole('link', { name: 'Next lesson' })).toBeNull();
  await click('Start lesson');
  await finishSound();
  expect(enabledAnswers()).toHaveLength(40);
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
  expect(
    (
      screen.getByRole('switch', {
        name: 'Autoplay next sound',
      }) as HTMLInputElement
    ).checked,
  ).toBe(true);
  expect(screen.getByText('3 characters selected')).toBeDefined();
  await click('Start practice');
  expect(mocks.oscillators).toHaveLength(5); // Å is .--.-
  await finishSound();
  expect(new Set(enabledAnswers())).toEqual(new Set(['Å', 'Ä', 'Ö']));
  fireEvent.keyDown(screen.getByLabelText('Listening exercise'), { key: 'å' });
  expect(screen.getByText('Correct!')).toBeDefined();
  await click('Change characters');
  expect(document.activeElement).toBe(
    screen.getByRole('heading', { name: 'Custom practice' }),
  );
  await finishSound();
  expect(screen.getByText('3 characters selected')).toBeDefined();
  await click('Practise K');
  await click('Practise Ä');
  await click('Start practice');
  await finishSound();
  expect(new Set(enabledAnswers())).toEqual(new Set(['K', 'Å', 'Ö']));
  expect(screen.getByText('Sound 1 of 20')).toBeDefined();
  expect(write).not.toHaveBeenCalled();
  expect(mocks.sendMessage).not.toHaveBeenCalled();
  view.unmount();
  open('/training?practice=custom');
  expect(screen.getByText('Choose at least one character.')).toBeDefined();
});

it('enables autoplay by default, replays incorrect sounds and advances after a correct retry', async () => {
  open();
  expect(
    (
      screen.getByRole('switch', {
        name: 'Autoplay next sound',
      }) as HTMLInputElement
    ).checked,
  ).toBe(true);
  await click('Start lesson');
  await finishSound();
  const idleVoices = mocks.oscillators.length;
  await advance(60_000);
  expect(screen.getByText('What did you hear?')).toBeDefined();
  expect(screen.getByText('Sound 1 of 20')).toBeDefined();
  expect(mocks.oscillators).toHaveLength(idleVoices);
  expect(screen.queryByRole('button', { name: 'Pause' })).toBeNull();
  await click('Answer M');
  expect(screen.getByText('Try again.')).toBeDefined();
  const voices = mocks.oscillators.length;
  await advance(399);
  expect(mocks.oscillators).toHaveLength(voices);
  await advance(1);
  expect(mocks.oscillators).toHaveLength(voices + 3); // Replays K, not M.
  expect(screen.getByText('Sound 1 of 20')).toBeDefined();
  await finishSound();
  await click('Answer K');
  expect(screen.getByText('Correct on retry.')).toBeDefined();
  await advance(749);
  expect(screen.getByText('Sound 1 of 20')).toBeDefined();
  await advance(1);
  expect(screen.getByText('Sound 2 of 20')).toBeDefined();
  for (let question = 2; question <= 20; question++) {
    await finishSound();
    await click(`Answer ${playedCharacter()}`);
    await advance(750);
  }
  expect(screen.getByText('Round complete')).toBeDefined();
  expect(screen.getByText('19 of 20 correct without hints')).toBeDefined();
  expect(screen.getByText('0 correct with a hint · 1 incorrect')).toBeDefined();
  const completedVoices = mocks.oscillators.length;
  await finishSound();
  expect(mocks.oscillators).toHaveLength(completedVoices);
});

it.each([
  { lesson: 8, length: 20 },
  { lesson: 39, length: 80 },
])(
  'completes and reshuffles lesson $lesson with guaranteed coverage',
  async ({ lesson, length }) => {
    open(`/training?lesson=${lesson}`);
    expect(screen.getByText(`${length} sounds`)).toBeDefined();
    await click('Start lesson');
    const heard: string[] = [];
    const exercise = screen.getByLabelText('Listening exercise');
    for (let prompt = 0; prompt < length; prompt++) {
      await finishSound();
      const letter = playedCharacter();
      heard.push(letter);
      fireEvent.keyDown(exercise, { key: letter });
      await advance(750);
    }
    expect(screen.getByText('Round complete')).toBeDefined();
    expect(screen.getByText('100%')).toBeDefined();
    expect(
      screen.getByText(`${length} of ${length} correct without hints`),
    ).toBeDefined();
    expect(
      screen.getByText('0 correct with a hint · 0 incorrect'),
    ).toBeDefined();
    const frequencies = new Map<string, number>();
    for (const letter of heard)
      frequencies.set(letter, (frequencies.get(letter) ?? 0) + 1);
    expect(frequencies.size).toBe(lesson + 1);
    expect(frequencies.get(lesson === 8 ? 'L' : 'X')).toBe(
      lesson === 8 ? 4 : 2,
    );
    for (const [letter, count] of frequencies)
      if (lesson !== 8 || letter !== 'L') expect(count).toBe(2);

    vi.mocked(Math.random).mockReturnValue(0);
    await click('Repeat lesson');
    expect(screen.getByText(`Sound 1 of ${length}`)).toBeDefined();
    expect(screen.getByText('0 correct without hints')).toBeDefined();
    expect(playedCharacter()).not.toBe(heard[0]);
  },
);

it('uses the selected custom set for the round length, score and repeat', async () => {
  open('/training?practice=custom');
  await click('A–Z');
  expect(screen.getByText('52 sounds')).toBeDefined();
  await click('Start practice');
  await finishSound();
  await click('Change characters');
  await click('Clear');
  for (const letter of 'ABCDEFGHIJK') await click(`Practise ${letter}`);
  expect(screen.getByText('22 sounds')).toBeDefined();
  await click('Start practice');
  const heard: string[] = [];
  const exercise = screen.getByLabelText('Listening exercise');
  for (let prompt = 0; prompt < 22; prompt++) {
    await finishSound();
    const letter = playedCharacter();
    heard.push(letter);
    if (prompt === 0) {
      await click('Replay');
      await finishSound();
      expect(playedCharacter()).toBe(letter);
      fireEvent.keyDown(exercise, { key: letter === 'A' ? 'B' : 'A' });
      await finishSound();
      expect(playedCharacter()).toBe(letter);
      expect(screen.getByText('Sound 1 of 22')).toBeDefined();
    }
    if (prompt === 1) await click('Show hint');
    fireEvent.keyDown(exercise, { key: letter });
    await advance(750);
  }
  for (const letter of 'ABCDEFGHIJK')
    expect(heard.filter(played => played === letter)).toHaveLength(2);
  expect(screen.getByText('91%')).toBeDefined();
  expect(screen.getByText('20 of 22 correct without hints')).toBeDefined();
  expect(screen.getByText('1 correct with a hint · 1 incorrect')).toBeDefined();
  await click('Repeat practice');
  expect(screen.getByText('Sound 1 of 22')).toBeDefined();
  expect(screen.getByText('0 correct without hints')).toBeDefined();
});

it('continues across tab switches but cancels retries and advancement on settings changes', async () => {
  open();
  await click('Start lesson');
  await finishSound();
  await click('Answer K');
  const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
  fireEvent(document, new Event('visibilitychange'));
  await finishSound();
  expect(screen.getByText('Sound 2 of 20')).toBeDefined();
  expect(screen.getByText('What did you hear?')).toBeDefined();
  hidden.mockReturnValue(false);
  fireEvent(document, new Event('visibilitychange'));
  expect(screen.queryByRole('button', { name: 'Resume' })).toBeNull();
  await click('Answer K');
  fireEvent.change(screen.getByLabelText('Volume'), {
    target: { value: 70 },
  });
  await finishSound();
  expect(screen.getByText('Sound 2 of 20')).toBeDefined();
  expect(document.activeElement).toBe(
    screen.getByRole('button', { name: 'Next sound' }),
  );
  expect(screen.getByText('Paused')).toBeDefined();
  await click('Next sound');
  await finishSound();
  await click('Answer M');
  fireEvent.change(screen.getByLabelText('Character speed'), {
    target: { value: 25 },
  });
  const voices = mocks.oscillators.length;
  await finishSound();
  expect(mocks.oscillators).toHaveLength(voices);
  await click('Resume');
  await finishSound();
  await click('Answer K');
  expect(screen.getByText('Correct on retry.')).toBeDefined();
  expect(screen.getByText('2 correct without hints')).toBeDefined();
});

it('lets autoplay be disabled and manual Next or navigation cancel pending callbacks', async () => {
  open();
  await click('Start lesson');
  await finishSound();
  await click('Answer K');
  toggleAutoplay();
  await finishSound();
  expect(screen.getByText('Sound 1 of 20')).toBeDefined();
  toggleAutoplay();
  await click('Next sound');
  await finishSound();
  expect(screen.getByText('Sound 2 of 20')).toBeDefined();
  await click('Answer K');
  const voices = mocks.oscillators.length;
  fireEvent.click(screen.getByRole('link', { name: 'All lessons' }));
  await finishSound();
  expect(mocks.oscillators).toHaveLength(voices);
  expect(screen.getByRole('list', { name: 'Listening lessons' })).toBeDefined();
  fireEvent.click(screen.getByRole('link', { name: 'Lesson 1: K and M' }));
  toggleAutoplay();
  fireEvent.click(screen.getByRole('link', { name: 'Next lesson' }));
  expect(
    (
      screen.getByRole('switch', {
        name: 'Autoplay next sound',
      }) as HTMLInputElement
    ).checked,
  ).toBe(true);
});

it('waits for a feedback example to finish before autoplaying the next sound', async () => {
  open();
  fireEvent.change(screen.getByLabelText('Character speed'), {
    target: { value: 10 },
  });
  await click('Start lesson');
  await finishSound();
  await click('Answer K');
  await click('Hear answer');
  await advance(900); // Longer than the usual feedback delay, but K is still playing.
  expect(screen.getByText('Sound 1 of 20')).toBeDefined();
  expect(
    screen
      .getByRole('button', { name: 'Hear answer' })
      .getAttribute('aria-busy'),
  ).toBe('true');
  await advance(400);
  expect(
    screen
      .getByRole('button', { name: 'Hear answer' })
      .getAttribute('aria-busy'),
  ).toBe('false');
  expect(screen.getByText('Sound 1 of 20')).toBeDefined();
  await advance(750);
  expect(screen.getByText('Sound 2 of 20')).toBeDefined();
});

it('cancels automatic retry and advance when the audio context is suspended', async () => {
  open();
  await click('Start lesson');
  await finishSound();
  await click('Answer M');
  act(() => {
    mocks.context.state = 'suspended';
    mocks.context.on.mock.calls.at(-1)![1]();
  });
  const voices = mocks.oscillators.length;
  await finishSound();
  expect(mocks.oscillators).toHaveLength(voices);
  expect(screen.getByText('Paused')).toBeDefined();
  mocks.context.state = 'running';
  await click('Resume');
  await finishSound();
  await click('Answer K');
  act(() => {
    mocks.context.state = 'suspended';
    mocks.context.on.mock.calls.at(-1)![1]();
  });
  await finishSound();
  expect(screen.getByText('Sound 1 of 20')).toBeDefined();
  expect(screen.getByText('Paused')).toBeDefined();
});

it('supports a single selected character and clears quick sets without duplicates', async () => {
  open('/training?practice=custom');
  await click('A–Z');
  await click('0–9');
  expect(screen.getByText('10 characters selected')).toBeDefined();
  await click('Clear');
  await click('Practise Ö');
  await click('Start practice');
  await finishSound();
  expect(enabledAnswers()).toEqual(['Ö']);
  await click('Answer Ö');
  expect(screen.getByText('Correct!')).toBeDefined();
});

it('keeps QWERTY positions and ignores unavailable keys while revealing only needed rows', async () => {
  open();
  await click('Start lesson');
  await finishSound();
  expect(
    within(screen.getByRole('group', { name: 'Letters' }))
      .getAllByRole('button')
      .map(button => button.textContent)
      .join(''),
  ).toBe('QWERTYUIOPASDFGHJKLZXCVBNM');
  expect(screen.queryByRole('group', { name: 'Numbers' })).toBeNull();
  expect(screen.queryByRole('group', { name: 'Punctuation' })).toBeNull();
  expect(enabledAnswers()).toEqual(['K', 'M']);
  await click('Answer Q');
  fireEvent.keyDown(screen.getByLabelText('Listening exercise'), { key: 'q' });
  expect(screen.getByText('What did you hear?')).toBeDefined();
  expect(screen.getByText('0 correct without hints')).toBeDefined();

  fireEvent.click(screen.getByRole('link', { name: 'All lessons' }));
  fireEvent.click(screen.getByRole('link', { name: 'Lesson 12: .' }));
  await click('Start lesson');
  await finishSound();
  expect(screen.queryByRole('group', { name: 'Numbers' })).toBeNull();
  expect(screen.getByRole('group', { name: 'Punctuation' })).toBeDefined();
  expect(enabledAnswers()).toContain('.');
  expect(enabledAnswers()).not.toContain(',');

  fireEvent.click(screen.getByRole('link', { name: 'All lessons' }));
  fireEvent.click(screen.getByRole('link', { name: 'Lesson 17: 0' }));
  await click('Start lesson');
  await finishSound();
  expect(
    within(screen.getByRole('group', { name: 'Numbers' }))
      .getAllByRole('button')
      .map(button => button.textContent)
      .join(''),
  ).toBe('1234567890');
  expect(enabledAnswers()).toContain('0');
  expect(enabledAnswers()).not.toContain('1');
});

it('supports every mapped custom character in the answer keyboard', async () => {
  open('/training?practice=custom');
  fireEvent.click(screen.getByText('Punctuation', { selector: 'summary' }));
  const choices = screen.getAllByRole('button', { name: /^Practise / });
  for (const choice of choices) fireEvent.click(choice);
  const selected = new Set(choices.map(button => button.textContent));
  expect(screen.getByText('114 sounds')).toBeDefined();
  await click('Start practice');
  await finishSound();
  expect(new Set(enabledAnswers())).toEqual(selected);
  expect(
    within(screen.getByRole('group', { name: 'Letters' }))
      .getAllByRole('button')
      .map(button => button.textContent)
      .join(''),
  ).toBe('QWERTYUIOPÅASDFGHJKLÖÄZXCVBNM');
});

it('scores first answers once, allows free replays and separates visual hints', async () => {
  open();
  toggleAutoplay();
  await click('Start lesson');
  // Neither button nor keyboard answers may bypass the whole sound.
  await click('Answer K');
  fireEvent.keyDown(screen.getByLabelText('Listening exercise'), { key: 'k' });
  expect(screen.getByRole('heading', { name: 'Listen…' })).toBeDefined();
  await finishSound();
  await act(async () => {
    const exercise = screen.getByLabelText('Listening exercise');
    fireEvent.keyDown(exercise, { key: 'm' });
    fireEvent.keyDown(exercise, { key: 'k' });
  });
  expect(screen.getByText('Try again.')).toBeDefined();
  expect(screen.queryByRole('img')).toBeNull();
  await finishSound();
  await click('Answer M');
  await finishSound();
  await click('Answer K');
  expect(screen.getByText('Correct on retry.')).toBeDefined();
  expect(document.activeElement).toBe(
    screen.getByRole('button', { name: 'Next sound' }),
  );
  await click('Hear answer');
  await finishSound();
  expect(screen.getByText('0 correct without hints')).toBeDefined();
  await click('Next sound');
  await finishSound();
  await click('Replay');
  await finishSound();
  await click('Answer K');
  expect(screen.getByText('Correct!')).toBeDefined();
  await click('Next sound');
  await finishSound();
  await click('Show hint');
  await click('Answer K');
  expect(screen.getByText('Correct, with a hint.')).toBeDefined();
  for (let prompt = 4; prompt <= 20; prompt++) {
    await click('Next sound');
    await finishSound();
    fireEvent.keyDown(screen.getByLabelText('Listening exercise'), {
      key: playedCharacter(),
    });
    expect(screen.getByText('Correct!')).toBeDefined();
  }
  await click('See results');
  expect(screen.getByText('90%')).toBeDefined();
  expect(screen.getByText('18 of 20 correct without hints')).toBeDefined();
  expect(screen.getByText('1 correct with a hint · 1 incorrect')).toBeDefined();
  expect(screen.getByRole('link', { name: 'Next lesson' })).toBeDefined();
  await click('Repeat lesson');
  expect(screen.getByText('Sound 1 of 20')).toBeDefined();
  expect(screen.getByText('0 correct without hints')).toBeDefined();
});

it('keeps completed questions answerable and only pauses audio that was interrupted', async () => {
  open();
  await click('Start lesson');
  const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
  fireEvent(document, new Event('visibilitychange'));
  await finishSound();
  expect(screen.getByText('What did you hear?')).toBeDefined();
  expect(
    mocks.oscillators.every(voice => voice.dispose.mock.calls.length === 1),
  ).toBe(true);
  act(() => {
    mocks.context.state = 'interrupted';
    mocks.context.on.mock.calls.at(-1)![1]();
  });
  hidden.mockReturnValue(false);
  fireEvent(document, new Event('visibilitychange'));
  expect(screen.getByText('What did you hear?')).toBeDefined();
  expect(screen.queryByRole('button', { name: 'Resume' })).toBeNull();
  await click('Answer K');
  expect(screen.getByText('1 correct without hints')).toBeDefined();
  await advance(750);
  expect(screen.getByText('Paused')).toBeDefined();
  // Sound needs a working audio context, but the completed answer was accepted.
  mocks.context.state = 'running';
  await click('Next sound');
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
  // Listening again after an interruption is also a free replay.
  expect(screen.getByText('Correct!')).toBeDefined();
  expect(screen.getByText('2 correct without hints')).toBeDefined();
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
  expect(screen.getByText('1 correct without hints')).toBeDefined();
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
  expect(screen.getByText('Try again.')).toBeDefined();
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
