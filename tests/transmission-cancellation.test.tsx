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
  const main = button.closest('[tabindex]') as HTMLElement;
  return { ...view, main, button, oscillator: mocks.oscillators[0] };
}

describe('transmission cancellation', () => {
  it('stops when Space is released after focus moves to the message input', async () => {
    const { main, oscillator } = await join();
    fireEvent.keyDown(main, { key: ' ' });
    expect(sentCommands()).toEqual(['START']);
    act(() => screen.getByLabelText('Message').focus());
    expect(sentCommands()).toEqual(['START', 'STOP']);
    fireEvent.keyUp(screen.getByLabelText('Message'), { key: ' ' });
    expect(sentCommands()).toEqual(['START', 'STOP']);
    expect(oscillator.stop).toHaveBeenCalledOnce();
  });

  it('handles Space release on a different target even without a blur event', async () => {
    const { main, oscillator } = await join();
    fireEvent.keyDown(main, { key: ' ' });
    fireEvent.keyUp(screen.getByLabelText('Message'), { key: ' ' });
    expect(sentCommands()).toEqual(['START', 'STOP']);
    expect(oscillator.stop).toHaveBeenCalledOnce();
  });

  it('stops on window blur without waiting for keyup', async () => {
    const { main, oscillator } = await join();
    fireEvent.keyDown(main, { key: ' ' });
    fireEvent.blur(window);
    expect(sentCommands()).toEqual(['START', 'STOP']);
    expect(oscillator.stop).toHaveBeenCalledOnce();
  });

  it('stops when the document becomes hidden', async () => {
    const { main, oscillator } = await join();
    fireEvent.keyDown(main, { key: ' ' });
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    fireEvent(document, new Event('visibilitychange'));
    expect(sentCommands()).toEqual(['START', 'STOP']);
    expect(oscillator.stop).toHaveBeenCalledOnce();
  });

  it('stops when a mouse press is released outside the button', async () => {
    const { button, oscillator } = await join();
    fireEvent.pointerDown(button, { pointerId: 1 });
    fireEvent.pointerUp(document.body, { pointerId: 1 });
    expect(sentCommands()).toEqual(['START', 'STOP']);
    expect(oscillator.stop).toHaveBeenCalledOnce();
  });

  it('stops a cancelled touch once, even if a release follows', async () => {
    const { button, oscillator } = await join();
    fireEvent.pointerDown(button, { pointerId: 1, pointerType: 'touch' });
    fireEvent.pointerCancel(button, { pointerId: 1, pointerType: 'touch' });
    expect(sentCommands()).toEqual(['START', 'STOP']);
    fireEvent.pointerUp(button, { pointerId: 1, pointerType: 'touch' });
    expect(sentCommands()).toEqual(['START', 'STOP']);
    expect(oscillator.stop).toHaveBeenCalledOnce();
  });

  it('stops a cancelled pointer without waiting for mouseup', async () => {
    const { button, oscillator } = await join();
    fireEvent.pointerDown(button, { pointerId: 1 });
    fireEvent.pointerCancel(button, { pointerId: 1 });
    expect(sentCommands()).toEqual(['START', 'STOP']);
    expect(oscillator.stop).toHaveBeenCalledOnce();
  });

  it('does not transmit while idle or when typing a space in the message input', async () => {
    const { main, button, oscillator } = await join();
    fireEvent.keyDown(screen.getByLabelText('Message'), { key: ' ' });
    fireEvent.keyUp(screen.getByLabelText('Message'), { key: ' ' });
    fireEvent.mouseLeave(button);
    fireEvent.keyUp(main, { key: ' ' });
    fireEvent.blur(window);
    expect(sentCommands()).toEqual([]);
    expect(oscillator.start).not.toHaveBeenCalled();
    expect(oscillator.stop).not.toHaveBeenCalled();
  });

  it('does not duplicate START or STOP and allows another transmission', async () => {
    const { main } = await join();
    fireEvent.keyDown(main, { key: ' ' });
    fireEvent.keyDown(main, { key: ' ', repeat: true });
    fireEvent.keyDown(main, { key: ' ' });
    fireEvent.keyUp(main, { key: ' ' });
    fireEvent.keyUp(main, { key: ' ' });
    fireEvent.keyDown(main, { key: ' ' });
    fireEvent.keyUp(main, { key: ' ' });
    expect(sentCommands()).toEqual(['START', 'STOP', 'START', 'STOP']);
  });

  it('stops on unmount and removes the global listeners', async () => {
    const { main, unmount, oscillator } = await join();
    fireEvent.keyDown(main, { key: ' ' });
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
    fireEvent.pointerDown(button, { pointerId: 7, pointerType: 'touch' });
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
    fireEvent.pointerDown(button, { pointerId: 7 });
    fireEvent.lostPointerCapture(button, { pointerId: 7 });
    expect(sentCommands()).toEqual(['START', 'STOP']);
  });

  it('ignores secondary buttons, shortcuts, and unrelated input releases', async () => {
    const { button } = await join();
    fireEvent.pointerDown(button, { pointerId: 1, button: 2 });
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
