import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { mocks, resetMocks, sentCommands } from './app-mocks';
import App from '../src/App';
import { NOTES_KEY } from '../src/settings/notes';

beforeEach(resetMocks);
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

async function openApp() {
  const view = render(
    <MemoryRouter>
      <App />
    </MemoryRouter>,
  );
  await act(async () =>
    fireEvent.click(
      screen.getByRole('button', { name: 'Connect', exact: true }),
    ),
  );
  return view;
}

function toggleNotes() {
  fireEvent.click(screen.getByRole('button', { name: 'Notes', exact: true }));
}

it('copies the exact notes with brief feedback and never transmits them', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal('navigator', { clipboard: { writeText } });
  await openApp();
  expect(screen.queryByRole('button', { name: 'Copy notes' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Clear notes' })).toBeNull();
  toggleNotes();
  const copy = screen.getByRole('button', {
    name: 'Copy notes',
  }) as HTMLButtonElement;
  expect(copy.disabled).toBe(true);
  const notes = screen.getByRole('textbox', {
    name: 'Listening notes',
  }) as HTMLTextAreaElement;
  fireEvent.change(notes, { target: { value: ' CQ CQ\nDE SA7AON ' } });
  expect(copy.disabled).toBe(false);
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  await act(async () => fireEvent.click(copy));
  expect(writeText).toHaveBeenCalledExactlyOnceWith(' CQ CQ\nDE SA7AON ');
  expect(notes.value).toBe(' CQ CQ\nDE SA7AON ');
  expect(copy.textContent).toBe('Copied');
  expect(screen.getByText('Notes copied.')).toBeDefined();
  act(() => vi.advanceTimersByTime(2_000));
  expect(copy.textContent).toBe('Copy');
  expect(screen.queryByText('Notes copied.')).toBeNull();
  expect(sentCommands()).toEqual([]);
});

it('clears and saves notes, restores editing focus, and ignores a pending copy result', async () => {
  let finishCopy!: () => void;
  const writeText = vi.fn(
    () =>
      new Promise<void>(resolve => {
        finishCopy = resolve;
      }),
  );
  vi.stubGlobal('navigator', { clipboard: { writeText } });
  const view = await openApp();
  toggleNotes();
  const notes = screen.getByRole('textbox', {
    name: 'Listening notes',
  }) as HTMLTextAreaElement;
  const clear = screen.getByRole('button', {
    name: 'Clear notes',
  }) as HTMLButtonElement;
  expect(clear.disabled).toBe(true);
  fireEvent.change(notes, { target: { value: 'CQ TEST' } });
  fireEvent.click(screen.getByRole('button', { name: 'Copy notes' }));
  act(() => clear.focus());
  fireEvent.click(clear);
  expect(notes.value).toBe('');
  expect(clear.disabled).toBe(true);
  expect(document.activeElement).toBe(notes);
  expect(JSON.parse(localStorage.getItem(NOTES_KEY)!)).toEqual({
    text: '',
    expanded: true,
  });
  await act(async () => finishCopy());
  expect(screen.queryByText('Notes copied.')).toBeNull();
  expect(sentCommands()).toEqual([]);
  view.unmount();
  await openApp();
  expect(
    (
      screen.getByRole('textbox', {
        name: 'Listening notes',
      }) as HTMLTextAreaElement
    ).value,
  ).toBe('');
});

it.each(['denied', 'unavailable'])(
  'keeps notes intact and explains how to copy when clipboard access is %s',
  async access => {
    const writeText = vi
      .fn()
      .mockRejectedValue(new DOMException('Blocked', 'NotAllowedError'));
    vi.stubGlobal('navigator', {
      clipboard: access === 'denied' ? { writeText } : undefined,
    });
    await openApp();
    toggleNotes();
    const notes = screen.getByRole('textbox', {
      name: 'Listening notes',
    }) as HTMLTextAreaElement;
    fireEvent.change(notes, { target: { value: 'Keep these notes' } });
    await act(async () =>
      fireEvent.click(screen.getByRole('button', { name: 'Copy notes' })),
    );
    const error = 'Could not copy. Select the text and copy it manually.';
    expect(screen.getByText(error)).toBeDefined();
    expect(notes.value).toBe('Keep these notes');
    expect(screen.queryByText('Notes copied.')).toBeNull();
    expect(sentCommands()).toEqual([]);
    fireEvent.change(notes, { target: { value: 'Still listening' } });
    expect(screen.queryByText(error)).toBeNull();
  },
);

it('keeps notes and their visibility across panels, reconnects, and app reloads', async () => {
  const view = await openApp();
  expect(screen.queryByRole('textbox', { name: 'Listening notes' })).toBeNull();
  toggleNotes();
  const notes = screen.getByRole('textbox', {
    name: 'Listening notes',
  }) as HTMLTextAreaElement;
  fireEvent.change(notes, { target: { value: 'CQ CQ\nDE SA7AON' } });
  fireEvent.click(screen.getByRole('button', { name: 'Morse reference' }));
  expect(
    screen.getByRole('button', { name: 'Play E locally: dot' }),
  ).toBeDefined();
  expect(notes.value).toBe('CQ CQ\nDE SA7AON');
  toggleNotes();
  expect(screen.queryByRole('textbox', { name: 'Listening notes' })).toBeNull();
  expect(JSON.parse(localStorage.getItem(NOTES_KEY)!)).toEqual({
    text: 'CQ CQ\nDE SA7AON',
    expanded: false,
  });
  toggleNotes();
  fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
  expect(screen.queryByRole('textbox', { name: 'Listening notes' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
  act(() => {
    mocks.socket.readyState = 3;
    mocks.onClose?.();
  });
  expect(notes.value).toBe('CQ CQ\nDE SA7AON');
  act(() => {
    mocks.socket.readyState = 1;
    mocks.onOpen?.();
  });
  view.unmount();
  await openApp();
  expect(
    (
      screen.getByRole('textbox', {
        name: 'Listening notes',
      }) as HTMLTextAreaElement
    ).value,
  ).toBe('CQ CQ\nDE SA7AON');
  expect(
    screen.getByRole('button', { name: 'Notes' }).getAttribute('aria-expanded'),
  ).toBe('true');
  toggleNotes();
  expect(JSON.parse(localStorage.getItem(NOTES_KEY)!).expanded).toBe(false);
});

it('stops a held key when editing notes, keeps Space and Enter local, and returns with Escape', async () => {
  await openApp();
  toggleNotes();
  const key = screen.getByRole('button', { name: 'Morse key', exact: true });
  const notes = screen.getByRole('textbox', { name: 'Listening notes' });
  act(() => key.focus());
  fireEvent.keyDown(key, { key: ' ' });
  expect(sentCommands()).toEqual(['START']);
  act(() => notes.focus());
  expect(sentCommands()).toEqual(['START', 'STOP']);
  fireEvent.keyUp(notes, { key: ' ' });
  for (const character of [' ', 'Enter']) {
    expect(fireEvent.keyDown(notes, { key: character })).toBe(true);
    fireEvent.keyUp(notes, { key: character });
  }
  fireEvent.change(notes, { target: { value: 'CQ\nTEST' } });
  expect(sentCommands()).toEqual(['START', 'STOP']);
  fireEvent.keyDown(notes, { key: 'Escape' });
  expect(document.activeElement).toBe(key);
  expect((notes as HTMLTextAreaElement).value).toBe('CQ\nTEST');
  fireEvent.keyDown(key, { key: 'Enter' });
  fireEvent.keyUp(key, { key: 'Enter' });
  expect(sentCommands()).toEqual(['START', 'STOP', 'START', 'STOP']);
});

it('keeps notes editable during a session when browser storage is blocked or full', async () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new DOMException('Blocked', 'SecurityError');
  });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('Full', 'QuotaExceededError');
  });
  await openApp();
  toggleNotes();
  const notes = screen.getByRole('textbox', { name: 'Listening notes' });
  fireEvent.change(notes, { target: { value: 'Still listening' } });
  toggleNotes();
  toggleNotes();
  fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
  fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
  expect((notes as HTMLTextAreaElement).value).toBe('Still listening');
  expect(sentCommands()).toEqual([]);
});

it.each([
  { storage: 'blocked', expanded: true },
  { storage: 'blocked', expanded: false },
  { storage: 'full', expanded: true },
  { storage: 'full', expanded: false },
])(
  'preserves notes through audio suspension with $storage storage and expanded=$expanded',
  async ({ storage, expanded }) => {
    localStorage.setItem(
      NOTES_KEY,
      JSON.stringify({ text: 'Old saved notes', expanded: false }),
    );
    if (storage === 'blocked') {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new DOMException('Blocked', 'SecurityError');
      });
    }
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Full', 'QuotaExceededError');
    });
    await openApp();
    toggleNotes();
    fireEvent.change(screen.getByRole('textbox', { name: 'Listening notes' }), {
      target: { value: 'Current notes\nCQ TEST' },
    });
    if (!expanded) toggleNotes();

    act(() => {
      mocks.context.state = 'suspended';
      mocks.context.on.mock.calls[0][1]();
    });
    expect(screen.queryByRole('button', { name: 'Notes' })).toBeNull();
    expect(
      screen.queryByRole('textbox', { name: 'Listening notes' }),
    ).toBeNull();
    expect(mocks.socketUrl).toBeNull();

    mocks.context.state = 'running';
    await act(async () =>
      fireEvent.click(screen.getByRole('button', { name: 'Connect' })),
    );
    expect(
      screen
        .getByRole('button', { name: 'Notes' })
        .getAttribute('aria-expanded'),
    ).toBe(String(expanded));
    if (!expanded) toggleNotes();
    expect(
      (
        screen.getByRole('textbox', {
          name: 'Listening notes',
        }) as HTMLTextAreaElement
      ).value,
    ).toBe('Current notes\nCQ TEST');
    expect(sentCommands()).toEqual([]);
  },
);

it.each(['invalid JSON', 'null', '[]', '{"text":42,"expanded":"yes"}'])(
  'recovers safely from malformed saved notes: %s',
  async stored => {
    localStorage.setItem(NOTES_KEY, stored);
    await openApp();
    expect(
      screen.queryByRole('textbox', { name: 'Listening notes' }),
    ).toBeNull();
    toggleNotes();
    expect(
      (
        screen.getByRole('textbox', {
          name: 'Listening notes',
        }) as HTMLTextAreaElement
      ).value,
    ).toBe('');
  },
);
