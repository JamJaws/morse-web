import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mocks, resetMocks, sentCommands } from './app-mocks';
import App from '../src/App';

beforeEach(resetMocks);
afterEach(() => vi.restoreAllMocks());

async function join() {
  const view = render(
    <MemoryRouter initialEntries={['/?tx=true']}>
      <App />
    </MemoryRouter>,
  );
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Join' }));
  });
  const button = screen.getByRole('button', { name: 'Morse key' });
  expect(document.activeElement).toBe(button);
  return { ...view, button, oscillator: mocks.oscillators[0] };
}

describe('transmission cancellation', () => {
  it('stops when Space is released after focus moves to the message input', async () => {
    const { button, oscillator } = await join();
    fireEvent.keyDown(button, { key: ' ' });
    expect(sentCommands()).toEqual(['START']);
    act(() => screen.getByLabelText('Message').focus());
    expect(sentCommands()).toEqual(['START', 'STOP']);
    fireEvent.keyUp(screen.getByLabelText('Message'), { key: ' ' });
    expect(sentCommands()).toEqual(['START', 'STOP']);
    expect(oscillator.stop).toHaveBeenCalledOnce();
  });

  it('handles Space release on a different target even without a blur event', async () => {
    const { button, oscillator } = await join();
    fireEvent.keyDown(button, { key: ' ' });
    fireEvent.keyUp(screen.getByLabelText('Message'), { key: ' ' });
    expect(sentCommands()).toEqual(['START', 'STOP']);
    expect(oscillator.stop).toHaveBeenCalledOnce();
  });

  it('stops on window blur without waiting for keyup', async () => {
    const { button, oscillator } = await join();
    fireEvent.keyDown(button, { key: ' ' });
    fireEvent.blur(window);
    expect(sentCommands()).toEqual(['START', 'STOP']);
    expect(oscillator.stop).toHaveBeenCalledOnce();
  });

  it('stops when the document becomes hidden', async () => {
    const { button, oscillator } = await join();
    fireEvent.keyDown(button, { key: ' ' });
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    fireEvent(document, new Event('visibilitychange'));
    expect(sentCommands()).toEqual(['START', 'STOP']);
    expect(oscillator.stop).toHaveBeenCalledOnce();
  });

  it('stops when a mouse press is released outside the button', async () => {
    const { button, oscillator } = await join();
    fireEvent.pointerDown(button, { pointerId: 1, isPrimary: true });
    fireEvent.pointerUp(document.body, { pointerId: 1 });
    expect(sentCommands()).toEqual(['START', 'STOP']);
    expect(oscillator.stop).toHaveBeenCalledOnce();
  });

  it('stops a cancelled touch once, even if a release follows', async () => {
    const { button, oscillator } = await join();
    fireEvent.pointerDown(button, {
      pointerId: 1,
      pointerType: 'touch',
      isPrimary: true,
    });
    fireEvent.pointerCancel(button, { pointerId: 1, pointerType: 'touch' });
    expect(sentCommands()).toEqual(['START', 'STOP']);
    fireEvent.pointerUp(button, { pointerId: 1, pointerType: 'touch' });
    expect(sentCommands()).toEqual(['START', 'STOP']);
    expect(oscillator.stop).toHaveBeenCalledOnce();
  });

  it('stops a cancelled pointer without waiting for mouseup', async () => {
    const { button, oscillator } = await join();
    fireEvent.pointerDown(button, { pointerId: 1, isPrimary: true });
    fireEvent.pointerCancel(button, { pointerId: 1 });
    expect(sentCommands()).toEqual(['START', 'STOP']);
    expect(oscillator.stop).toHaveBeenCalledOnce();
  });

  it('does not transmit while idle or when typing a space in the message input', async () => {
    const { button, oscillator } = await join();
    const message = screen.getByLabelText('Message');
    act(() => message.focus());
    fireEvent.keyDown(message, { key: ' ' });
    fireEvent.keyUp(message, { key: ' ' });
    fireEvent.mouseLeave(button);
    fireEvent.keyUp(document.body, { key: ' ' });
    fireEvent.blur(window);
    expect(sentCommands()).toEqual([]);
    expect(oscillator.start).not.toHaveBeenCalled();
    expect(oscillator.stop).not.toHaveBeenCalled();
  });

  it('does not duplicate START or STOP and allows another transmission', async () => {
    const { button } = await join();
    fireEvent.keyDown(button, { key: ' ' });
    fireEvent.keyDown(button, { key: ' ', repeat: true });
    fireEvent.keyDown(button, { key: ' ' });
    fireEvent.keyUp(button, { key: ' ' });
    fireEvent.keyUp(button, { key: ' ' });
    fireEvent.keyDown(button, { key: ' ' });
    fireEvent.keyUp(button, { key: ' ' });
    expect(sentCommands()).toEqual(['START', 'STOP', 'START', 'STOP']);
  });

  it('stops on unmount and removes the global listeners', async () => {
    const { button, unmount, oscillator } = await join();
    fireEvent.keyDown(button, { key: ' ' });
    unmount();
    expect(sentCommands()).toEqual(['START', 'STOP']);
    expect(
      oscillator.stop.mock.calls.length + oscillator.dispose.mock.calls.length,
    ).toBeGreaterThan(0);
    fireEvent.keyUp(window, { key: ' ' });
    fireEvent.blur(window);
    expect(sentCommands()).toEqual(['START', 'STOP']);
  });
});

describe('accessible Morse key', () => {
  it.each(['pointer', 'keyboard'])(
    'silently focuses the key with the %s focus action before transmitting',
    async activation => {
      const { button, oscillator } = await join();
      const focusButton = screen.getByRole('button', {
        name: 'Focus Morse key',
      });
      act(() => focusButton.focus());
      if (activation === 'keyboard') {
        fireEvent.keyDown(focusButton, { key: 'Enter' });
      } else {
        fireEvent.pointerDown(focusButton, {
          pointerId: 1,
          isPrimary: true,
        });
        fireEvent.pointerUp(focusButton, { pointerId: 1 });
      }
      fireEvent.click(focusButton, {
        detail: activation === 'keyboard' ? 0 : 1,
      });
      expect(document.activeElement).toBe(button);
      if (activation === 'keyboard') {
        fireEvent.keyDown(button, { key: 'Enter', repeat: true });
        fireEvent.keyUp(button, { key: 'Enter' });
      }
      expect(sentCommands()).toEqual([]);
      expect(oscillator.start).not.toHaveBeenCalled();
      fireEvent.keyDown(button, { key: 'Enter' });
      fireEvent.keyUp(button, { key: 'Enter' });
      expect(sentCommands()).toEqual(['START', 'STOP']);
    },
  );

  it('silently returns from the message input with Escape and preserves the draft', async () => {
    const { button, oscillator } = await join();
    const message = screen.getByLabelText('Message') as HTMLInputElement;
    fireEvent.change(message, { target: { value: 'CQ TEST' } });
    act(() => message.focus());
    fireEvent.keyDown(message, { key: 'Escape' });
    expect(document.activeElement).toBe(button);
    expect(message.value).toBe('CQ TEST');
    expect(sentCommands()).toEqual([]);
    expect(oscillator.start).not.toHaveBeenCalled();
    fireEvent.keyDown(button, { key: 'Enter' });
    fireEvent.keyUp(button, { key: 'Enter' });
    expect(sentCommands()).toEqual(['START', 'STOP']);
  });

  it('ignores Space and Enter away from the key until Escape silently restores focus', async () => {
    const { button, oscillator } = await join();
    act(() => button.blur());
    expect(document.activeElement).toBe(document.body);
    for (const target of [document.body, screen.getByRole('main'), button]) {
      for (const key of [' ', 'Enter']) {
        fireEvent.keyDown(target, { key });
        fireEvent.keyUp(target, { key });
      }
    }
    expect(sentCommands()).toEqual([]);
    for (const target of [
      screen.getByLabelText('Message'),
      screen.getByRole('button', { name: 'Settings' }),
      screen.getByRole('button', { name: 'Morse reference' }),
    ]) {
      act(() => target.focus());
      for (const key of [' ', 'Enter']) {
        fireEvent.keyDown(target, { key });
        fireEvent.keyUp(target, { key });
      }
    }
    expect(sentCommands()).toEqual([]);
    act(() => (document.activeElement as HTMLElement).blur());
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(document.activeElement).toBe(button);
    expect(sentCommands()).toEqual([]);
    expect(oscillator.start).not.toHaveBeenCalled();
    for (const key of [' ', 'Enter']) {
      fireEvent.keyDown(button, { key });
      fireEvent.keyUp(button, { key });
    }
    expect(sentCommands()).toEqual(['START', 'STOP', 'START', 'STOP']);
  });

  it('lets the menu handle Escape before returning to the key', async () => {
    const { button } = await join();
    const trigger = screen.getByRole('button', { name: 'More actions' });
    act(() => trigger.focus());
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    const action = screen.getByRole('menuitem', { name: 'Transmit text' });
    expect(document.activeElement).toBe(action);
    fireEvent.keyDown(action, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    fireEvent.keyDown(trigger, { key: 'Escape' });
    expect(document.activeElement).toBe(button);
    expect(sentCommands()).toEqual([]);
  });

  it('lets connection details dismiss on Escape before returning to the key', async () => {
    const { button } = await join();
    const trigger = screen.getByRole('button', {
      name: 'Connection details: Connected',
    });
    act(() => trigger.focus());
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    fireEvent.keyDown(trigger, { key: 'Escape' });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger);
    fireEvent.keyDown(trigger, { key: 'Escape' });
    expect(document.activeElement).toBe(button);
    expect(sentCommands()).toEqual([]);
  });

  it('does not move focus out of settings with Escape', async () => {
    await join();
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    const volume = screen.getByLabelText('Volume');
    act(() => volume.focus());
    fireEvent.keyDown(volume, { key: 'Escape' });
    expect(document.activeElement).toBe(volume);
    expect(screen.queryByRole('button', { name: 'Morse key' })).toBeNull();
    expect(sentCommands()).toEqual([]);
  });

  it('ignores modified, composing, repeated, and already handled Escape presses', async () => {
    await join();
    const message = screen.getByLabelText('Message');
    act(() => message.focus());
    for (const options of [
      { altKey: true },
      { ctrlKey: true },
      { metaKey: true },
      { repeat: true },
      { isComposing: true },
    ]) {
      fireEvent.keyDown(message, { key: 'Escape', ...options });
      expect(document.activeElement).toBe(message);
    }
    const handled = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    });
    handled.preventDefault();
    fireEvent(message, handled);
    expect(document.activeElement).toBe(message);
    expect(sentCommands()).toEqual([]);
  });

  it('cancels a held tone on Escape and permits a fresh Enter press', async () => {
    const { button } = await join();
    act(() => button.focus());
    fireEvent.keyDown(button, { key: ' ' });
    expect(sentCommands()).toEqual(['START']);
    fireEvent.keyDown(button, { key: 'Escape' });
    fireEvent.keyUp(button, { key: ' ' });
    expect(document.activeElement).toBe(button);
    expect(sentCommands()).toEqual(['START', 'STOP']);
    fireEvent.keyDown(button, { key: 'Enter' });
    fireEvent.keyUp(button, { key: 'Enter' });
    expect(sentCommands()).toEqual(['START', 'STOP', 'START', 'STOP']);
  });

  it.each([' ', 'Enter'])(
    'transmits while %j is held on the focused key',
    async key => {
      const { button } = await join();
      act(() => button.focus());
      fireEvent.keyDown(button, { key });
      expect(sentCommands()).toEqual(['START']);
      expect(button.dataset.transmitting).toBe('true');
      fireEvent.keyDown(button, { key, repeat: true });
      fireEvent.keyUp(document.body, { key });
      expect(sentCommands()).toEqual(['START', 'STOP']);
      expect(button.dataset.transmitting).toBe('false');
    },
  );

  it('captures the primary pointer and ignores a second finger releasing', async () => {
    const { button } = await join();
    const capture = vi.spyOn(button, 'setPointerCapture');
    fireEvent.pointerDown(button, {
      pointerId: 7,
      pointerType: 'touch',
      isPrimary: true,
    });
    expect(capture).toHaveBeenCalledWith(7);
    fireEvent.pointerDown(button, {
      pointerId: 8,
      pointerType: 'touch',
      isPrimary: false,
    });
    fireEvent.pointerUp(document.body, { pointerId: 8, pointerType: 'touch' });
    expect(sentCommands()).toEqual(['START']);
    fireEvent.pointerUp(document.body, { pointerId: 7, pointerType: 'touch' });
    expect(sentCommands()).toEqual(['START', 'STOP']);
  });

  it('stops when pointer capture is lost', async () => {
    const { button } = await join();
    fireEvent.pointerDown(button, { pointerId: 7, isPrimary: true });
    fireEvent.lostPointerCapture(button, { pointerId: 7 });
    expect(sentCommands()).toEqual(['START', 'STOP']);
  });

  it('ignores secondary buttons, shortcuts, and unrelated input releases', async () => {
    const { button } = await join();
    fireEvent.pointerDown(button, {
      pointerId: 1,
      button: 2,
      isPrimary: true,
    });
    fireEvent.keyDown(button, { key: ' ', ctrlKey: true });
    expect(sentCommands()).toEqual([]);
    fireEvent.keyDown(button, { key: ' ' });
    fireEvent.pointerUp(document.body, { pointerId: 1 });
    fireEvent.keyUp(button, { key: 'Enter' });
    expect(sentCommands()).toEqual(['START']);
    fireEvent.keyUp(button, { key: ' ' });
    expect(sentCommands()).toEqual(['START', 'STOP']);
  });

  it('stops before opening settings and never treats other controls as the key', async () => {
    const { button } = await join();
    fireEvent.keyDown(button, { key: ' ' });
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(sentCommands()).toEqual(['START', 'STOP']);
    fireEvent.keyDown(screen.getByRole('button', { name: 'Settings' }), {
      key: ' ',
    });
    fireEvent.keyDown(screen.getByLabelText('Volume'), { key: ' ' });
    expect(sentCommands()).toEqual(['START', 'STOP']);
  });
});
