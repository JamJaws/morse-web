import { StrictMode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mocks, resetMocks } from './app-mocks';
import App from '../src/App';

beforeEach(() => {
  resetMocks();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

async function join() {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Join' }));
  });
}

async function setOperators(operators: { id: string; frequency: number }[]) {
  await act(async () => {
    await mocks.onMessage?.({
      data: JSON.stringify({ type: 'OPERATORS', operators }),
    });
  });
}

describe('oscillator lifecycle', () => {
  it('updates the active local oscillator and stops that same instance', async () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );
    expect(mocks.oscillators).toHaveLength(0);
    await join();
    const oscillator = mocks.oscillators[0];
    const main = screen
      .getByRole('button', { name: 'Morse key' })
      .closest('[tabindex]')!;
    fireEvent.keyDown(main, { key: ' ' });
    expect(oscillator.start).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    fireEvent.change(screen.getByLabelText('Frequency'), {
      target: { value: '950' },
    });
    fireEvent.change(screen.getByLabelText('Volume'), {
      target: { value: '0' },
    });

    expect(mocks.oscillators).toHaveLength(1);
    expect(oscillator.frequency).toBe(950);
    expect(oscillator.volume).toBe(-Infinity);
    expect(oscillator.dispose).not.toHaveBeenCalled();
    fireEvent.keyUp(main, { key: ' ' });
    expect(oscillator.stop).toHaveBeenCalledOnce();
  });

  it('mutes already scheduled Morse playback without replacing its oscillator', async () => {
    render(
      <MemoryRouter initialEntries={['/?tx=true']}>
        <App />
      </MemoryRouter>,
    );
    await join();
    const oscillator = mocks.oscillators[0];
    fireEvent.change(screen.getByLabelText('Message'), {
      target: { value: 'SOS' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    const scheduledStarts = [...oscillator.start.mock.calls];
    expect(scheduledStarts).toHaveLength(9);

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    fireEvent.change(screen.getByLabelText('Volume'), {
      target: { value: '0' },
    });

    expect(mocks.oscillators).toHaveLength(1);
    expect(oscillator.volume).toBe(-Infinity);
    expect(oscillator.start.mock.calls).toEqual(scheduledStarts);
    expect(oscillator.dispose).not.toHaveBeenCalled();
  });

  it('reuses remote oscillators and disposes departures and remaining nodes on unmount', async () => {
    const { unmount } = render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );
    await join();
    await setOperators([
      { id: 'a', frequency: 600 },
      { id: 'b', frequency: 700 },
    ]);
    const [local, a, b] = mocks.oscillators;

    await setOperators([
      { id: 'a', frequency: 650 },
      { id: 'b', frequency: 700 },
    ]);
    expect(mocks.oscillators).toHaveLength(3);
    expect(a.frequency).toBe(650);
    await setOperators([{ id: 'b', frequency: 700 }]);
    expect(a.dispose).toHaveBeenCalledOnce();
    expect(b.dispose).not.toHaveBeenCalled();

    unmount();
    expect(local.dispose).toHaveBeenCalledOnce();
    expect(a.dispose).toHaveBeenCalledOnce();
    expect(b.dispose).toHaveBeenCalledOnce();
  });

  it('leaves no undisposed oscillator after a StrictMode mount and unmount', async () => {
    const { unmount } = render(
      <StrictMode>
        <MemoryRouter>
          <App />
        </MemoryRouter>
      </StrictMode>,
    );
    await join();
    await setOperators([{ id: 'a', frequency: 600 }]);
    unmount();
    expect(mocks.oscillators.length).toBeGreaterThan(0);
    for (const oscillator of mocks.oscillators) {
      expect(oscillator.dispose).toHaveBeenCalledOnce();
    }
  });
});
