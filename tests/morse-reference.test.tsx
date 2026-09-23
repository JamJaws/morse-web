import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { mocks, resetMocks } from './app-mocks';
import App from '../src/App';
import { morseCodeCharacters } from '../src/beep/MorseCodeCharacters';

beforeEach(resetMocks);
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function openReference() {
  render(
    <MemoryRouter>
      <App />
    </MemoryRouter>,
  );
  await act(async () =>
    fireEvent.click(screen.getByRole('button', { name: 'Join' })),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Morse reference' }));
}

function viewButton(name: 'Table' | 'Tree') {
  return within(
    screen.getByRole('group', { name: 'Reference view' }),
  ).getByRole('button', { name, exact: true });
}

it('defaults to the table and exposes every letter and number in the tree', async () => {
  await openReference();
  expect(viewButton('Table').getAttribute('aria-pressed')).toBe('true');
  expect(viewButton('Tree').getAttribute('aria-pressed')).toBe('false');
  expect(screen.queryByRole('group', { name: 'Morse code tree' })).toBeNull();
  expect(
    screen.getByRole('button', {
      name: 'Play ? locally: dot dot dash dash dot dot',
      exact: true,
    }),
  ).toBeDefined();

  fireEvent.click(viewButton('Tree'));
  expect(viewButton('Table').getAttribute('aria-pressed')).toBe('false');
  expect(viewButton('Tree').getAttribute('aria-pressed')).toBe('true');
  const tree = within(screen.getByRole('group', { name: 'Morse code tree' }));
  const characters = morseCodeCharacters.filter(
    character => character.type !== 'punctuation',
  );
  expect(tree.getAllByRole('button')).toHaveLength(39);
  for (const character of characters) {
    const code = character.code
      .split('')
      .map(mark => (mark === '.' ? 'dot' : 'dash'))
      .join(' ');
    expect(
      tree.getByRole('button', {
        name: `Play ${character.letter} locally: ${code}`,
        exact: true,
      }),
    ).toBeDefined();
  }
});

it('retains the chosen view on reopen and returns to the complete table', async () => {
  await openReference();
  fireEvent.click(viewButton('Tree'));
  fireEvent.click(screen.getByRole('button', { name: 'Morse reference' }));
  expect(screen.queryByRole('group', { name: 'Morse code tree' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Morse reference' }));
  expect(viewButton('Tree').getAttribute('aria-pressed')).toBe('true');
  expect(screen.getByRole('group', { name: 'Morse code tree' })).toBeDefined();

  fireEvent.click(viewButton('Table'));
  expect(viewButton('Table').getAttribute('aria-pressed')).toBe('true');
  expect(screen.queryByRole('group', { name: 'Morse code tree' })).toBeNull();
  expect(screen.getByRole('heading', { name: 'Punctuation' })).toBeDefined();
  expect(
    screen.getByRole('button', {
      name: 'Play ? locally: dot dot dash dash dot dot',
      exact: true,
    }),
  ).toBeDefined();
});

it('previews silently and keeps a locally played character selected after leaving it', async () => {
  await openReference();
  fireEvent.click(viewButton('Tree'));
  const tree = within(screen.getByRole('group', { name: 'Morse code tree' }));
  const e = tree.getByRole('button', {
    name: 'Play E locally: dot',
    exact: true,
  });
  mocks.sendMessage.mockClear();
  fireEvent.mouseEnter(e);
  fireEvent.focus(e);
  expect(mocks.oscillators[0].start).not.toHaveBeenCalled();
  expect(mocks.sendMessage).not.toHaveBeenCalled();

  fireEvent.click(e);
  expect(mocks.oscillators[0].start).toHaveBeenCalledOnce();
  expect(e.getAttribute('aria-pressed')).toBe('true');
  fireEvent.mouseLeave(e);
  fireEvent.blur(e);
  expect(e.getAttribute('aria-pressed')).toBe('true');
  expect(tree.getAllByRole('button', { pressed: true })).toEqual([e]);
  expect(mocks.oscillators[0].start).toHaveBeenCalledOnce();
  expect(mocks.sendMessage).not.toHaveBeenCalled();
});

it('leaves Space and Enter on reference buttons to their native behavior without transmitting', async () => {
  await openReference();
  mocks.sendMessage.mockClear();
  for (const button of [viewButton('Table'), viewButton('Tree')]) {
    for (const key of [' ', 'Enter']) {
      expect(fireEvent.keyDown(button, { key })).toBe(true);
      fireEvent.keyUp(button, { key });
    }
  }
  expect(mocks.oscillators[0].start).not.toHaveBeenCalled();
  expect(mocks.sendMessage).not.toHaveBeenCalled();

  fireEvent.click(viewButton('Tree'));
  const e = within(
    screen.getByRole('group', { name: 'Morse code tree' }),
  ).getByRole('button', { name: 'Play E locally: dot', exact: true });
  for (const key of [' ', 'Enter']) {
    expect(fireEvent.keyDown(e, { key })).toBe(true);
    fireEvent.keyUp(e, { key });
  }
  // jsdom does not synthesize the native click from keyboard events.
  expect(mocks.oscillators[0].start).not.toHaveBeenCalled();
  expect(mocks.sendMessage).not.toHaveBeenCalled();
});

it('reflows into phone branches and preserves local selection when the screen widens', async () => {
  let resize: (width: number) => void = () => {};
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(
        callback: (entries: { contentRect: { width: number } }[]) => void,
      ) {
        resize = width => act(() => callback([{ contentRect: { width } }]));
      }
      observe() {}
      disconnect() {}
    },
  );
  await openReference();
  fireEvent.click(viewButton('Tree'));
  resize(280);
  const tree = within(screen.getByRole('group', { name: 'Morse code tree' }));
  expect(tree.getAllByRole('button')).toHaveLength(39);
  for (const code of ['dot dot', 'dot dash', 'dash dot', 'dash dash']) {
    expect(tree.getByRole('region', { name: `${code} branch` })).toBeDefined();
  }
  const branch = within(tree.getByRole('region', { name: 'dot dash branch' }));
  mocks.sendMessage.mockClear();
  fireEvent.click(
    branch.getByRole('button', {
      name: 'Play Å locally: dot dash dash dot dash',
      exact: true,
    }),
  );
  expect(mocks.oscillators[0].start).toHaveBeenCalledTimes(5);
  expect(mocks.sendMessage).not.toHaveBeenCalled();
  resize(0);
  expect(tree.getAllByRole('region')).toHaveLength(4);
  resize(700);
  expect(tree.queryByRole('region')).toBeNull();
  expect(tree.getAllByRole('button')).toHaveLength(39);
  expect(
    tree.getByRole('button', { pressed: true }).getAttribute('aria-label'),
  ).toBe('Play Å locally: dot dash dash dot dash');
  expect(mocks.oscillators[0].start).toHaveBeenCalledTimes(5);
  expect(mocks.sendMessage).not.toHaveBeenCalled();
});
