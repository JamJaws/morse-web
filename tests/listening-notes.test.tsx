import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { mocks, resetMocks, sentCommands } from './app-mocks';
import App from '../src/App';
import { NOTES_KEY } from '../src/settings/notes';

beforeEach(resetMocks);
afterEach(() => vi.restoreAllMocks());

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
