import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { mocks, resetMocks } from './app-mocks';
import { LocalMorsePlayer } from '../src/training/LocalMorsePlayer';

beforeEach(() => {
  resetMocks();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
});
const settings = { wpm: 20, volume: 80 };

it('schedules the complete rhythm on the audio clock before allowing an answer', async () => {
  const player = new LocalMorsePlayer();
  const completed = vi.fn();
  const playback = player.play('-.-', settings).then(completed);
  await Promise.resolve();
  expect(mocks.oscillators).toHaveLength(3);
  const times = mocks.oscillators.map(voice => [
    voice.start.mock.calls[0][0],
    voice.stop.mock.calls[0][0],
  ]);
  for (const [index, [start, stop]] of times.entries()) {
    expect(start).toBeCloseTo([100, 100.24, 100.36][index]);
    expect(stop).toBeCloseTo([100.18, 100.3, 100.54][index]);
  }
  await vi.advanceTimersByTimeAsync(600);
  expect(completed).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(100);
  await playback;
  expect(completed).toHaveBeenCalledWith('complete');
  expect(
    mocks.oscillators.every(voice => voice.dispose.mock.calls.length === 1),
  ).toBe(true);
});

it('disconnects every scheduled mark on cancellation and settles the playback', async () => {
  const player = new LocalMorsePlayer();
  const playback = player.play('......', settings);
  await Promise.resolve();
  player.cancel();
  expect(await playback).toBe('cancelled');
  expect(mocks.oscillators).toHaveLength(6);
  expect(
    mocks.oscillators.every(voice => voice.dispose.mock.calls.length === 1),
  ).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
});

it('cannot create audio after a cancelled, delayed audio-start request resolves', async () => {
  let enableAudio!: () => void;
  mocks.startAudio.mockReturnValueOnce(
    new Promise<void>(resolve => {
      enableAudio = resolve;
    }),
  );
  const player = new LocalMorsePlayer();
  const playback = player.play('--', settings);
  player.cancel();
  enableAudio();
  expect(await playback).toBe('cancelled');
  expect(mocks.oscillators).toHaveLength(0);
});

it('cancels when the audio context stops instead of treating a timer as a heard sound', async () => {
  const player = new LocalMorsePlayer();
  const playback = player.play('--', settings);
  await Promise.resolve();
  mocks.context.state = 'suspended';
  await vi.advanceTimersByTimeAsync(1_000);
  expect(await playback).toBe('cancelled');
  expect(
    mocks.oscillators.every(voice => voice.dispose.mock.calls.length === 1),
  ).toBe(true);
});
