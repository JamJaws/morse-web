import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { mocks, resetMocks } from './app-mocks';
import { RemotePlayback } from '../src/beep/RemotePlayback';
import { useMorseSession } from '../src/hooks/useMorseSession';

beforeEach(() => {
  resetMocks();
  vi.useFakeTimers();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

it('samples diagnostics only when enabled without resetting live playback', async () => {
  const stats = vi.spyOn(RemotePlayback.prototype, 'stats', 'get');
  const { result, rerender } = renderHook(
    ({ debug }) => useMorseSession(debug),
    {
      initialProps: { debug: false },
    },
  );
  await act(() => result.current.startAudio());
  act(() => {
    mocks.onMessage?.({
      data: JSON.stringify({
        type: 'OPERATORS',
        operators: [{ id: 'peer', frequency: 650 }],
      }),
    });
    vi.advanceTimersByTime(1_000);
  });
  expect(stats).not.toHaveBeenCalled();
  rerender({ debug: true });
  act(() => vi.advanceTimersByTime(1_000));
  expect(stats).toHaveBeenCalledOnce();
  expect(result.current.playbackStats).toContain('peer');
  rerender({ debug: false });
  stats.mockClear();
  act(() => vi.advanceTimersByTime(1_000));
  expect(stats).not.toHaveBeenCalled();
  expect(mocks.oscillators[1].dispose).not.toHaveBeenCalled();
});
