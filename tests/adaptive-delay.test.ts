import { describe, expect, it } from 'vitest';
import { AdaptiveDelay } from '../src/beep/AdaptiveDelay';
import { PLAYBACK_TEST_SETTINGS } from './playback-fixture';
import {
  createPlaybackSettings,
  type PlaybackSettings,
} from '../src/beep/PlaybackSettings';

// Deliberately different from both production defaults and the playback traces.
const settings: PlaybackSettings = {
  ...PLAYBACK_TEST_SETTINGS,
  initialBufferMs: 200,
  minBufferMs: 80,
  maxBufferMs: 600,
  minSamplesToShrink: 3,
  maxSamples: 8,
  sampleWindowMs: 1_000,
  shrinkCooldownMs: 3_000,
  shrinkRateMsPerSecond: 20,
  maxShrinkPerUpdateMs: 5,
};

describe('playback tuning', () => {
  it('keeps the shrink cooldown independent of the measurement window', () => {
    const delay = new AdaptiveDelay(settings);
    for (let time = 0; time < 3_000; time += 250) {
      delay.observe(time, time + 40);
      expect(delay.targetMs).toBe(200);
    }
    delay.observe(3_000, 3_040);
    expect(delay.targetMs).toBe(195);
  });

  it('expires samples by elapsed time while retaining the selected reserve', () => {
    const delay = new AdaptiveDelay(settings);
    delay.observe(0, 0);
    for (const arrival of [250, 500, 750])
      delay.observe(arrival - 100, arrival);
    expect(delay.baseline).toBe(0);
    delay.observe(901, 1_001);
    expect(delay.baseline).toBe(100);
    expect(delay.targetMs).toBe(200);

    // Five minutes idle removes history, but neither resets nor shrinks reserve.
    delay.observe(300_000, 300_100);
    expect(delay.targetMs).toBe(200);
    delay.observe(300_100, 300_200);
    expect(delay.targetMs).toBe(200);
    // The configured three fresh samples suffice; idle time counted for cooldown.
    delay.observe(300_200, 300_300);
    expect(delay.targetMs).toBe(198);
  });

  it('caps sample count even when all samples fit in the time window', () => {
    const delay = new AdaptiveDelay({ ...settings, maxSamples: 3 });
    delay.observe(0, 0);
    delay.observe(100, 200);
    delay.observe(300, 400);
    expect(delay.baseline).toBe(0);
    delay.observe(500, 600);
    expect(delay.baseline).toBe(100);
  });

  it('uses the configured percentiles and spare margin', () => {
    const delay = new AdaptiveDelay({
      ...settings,
      initialBufferMs: 40,
      minBufferMs: 20,
      baselinePercentile: 0.5,
      jitterPercentile: 0.75,
      safetyMarginMs: 15,
    });
    for (const [sender, arrival] of [
      [0, 10],
      [100, 120],
      [200, 280],
      [300, 500],
    ])
      delay.observe(sender, arrival);
    expect(delay.baseline).toBe(20);
    expect(delay.targetMs).toBe(75);
  });

  it('limits shrinking by both elapsed time and the per-update cap', () => {
    const delay = new AdaptiveDelay({
      ...settings,
      sampleWindowMs: 10_000,
      minSamplesToShrink: 2,
      shrinkCooldownMs: 0,
      maxShrinkPerUpdateMs: 7,
    });
    delay.observe(0, 40);
    delay.observe(100, 140);
    expect(delay.targetMs).toBe(198);
    delay.observe(1_100, 1_140);
    expect(delay.targetMs).toBe(191);
  });

  it('restarts the cooldown at the maximum reserve during recovery', () => {
    const delay = new AdaptiveDelay({ ...settings, shrinkCooldownMs: 1_000 });
    delay.observe(0, 40);
    delay.startRecovery(10_000, 10_040);
    for (const time of [10_250, 10_500, 10_750]) {
      delay.observe(time, time + 40);
      expect(delay.targetMs).toBe(600);
    }
    delay.observe(11_000, 11_040);
    expect(delay.targetMs).toBe(595);
  });

  it.each([
    { initialBufferMs: 50 },
    { initialBufferMs: 800 },
    { minSamplesToShrink: 513 },
    { minSamplesToShrink: 2.5 },
    { sampleWindowMs: 0 },
    { maxBufferMs: NaN },
    { baselinePercentile: 0.99, jitterPercentile: 0.05 },
    { jitterPercentile: 1.1 },
  ])('rejects invalid tuning: %j', overrides => {
    expect(() =>
      createPlaybackSettings({ ...PLAYBACK_TEST_SETTINGS, ...overrides }),
    ).toThrow(RangeError);
  });
});

describe('adaptive delay', () => {
  it('replaces a biased first arrival and shrinks slowly, with bounded growth after a miss', () => {
    const delay = new AdaptiveDelay(PLAYBACK_TEST_SETTINGS);
    delay.observe(0, 400);
    for (let i = 1; i <= 400; i++)
      delay.observe(i * 200, Math.max(400, i * 200 + 40));
    expect(delay.baseline).toBe(40);
    expect(delay.targetMs).toBe(100);
    delay.missed(1_000, 80_040);
    expect(delay.targetMs).toBe(750);
    delay.observe(81_000, 81_040);
    expect(delay.targetMs).toBe(750);
  });
  it('does not treat silence or sparse arrivals as evidence to shrink', () => {
    const delay = new AdaptiveDelay(PLAYBACK_TEST_SETTINGS);
    for (let i = 0; i < 50; i++) delay.observe(i * 100, i * 100 + 40);
    delay.observe(100_000, 100_040);
    expect(delay.targetMs).toBe(300);
  });
});
