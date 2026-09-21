import type { PlaybackSettings } from '../src/beep/PlaybackSettings';

// Fixed test policy: production tuning must not change these timing scenarios.
export const PLAYBACK_TEST_SETTINGS: PlaybackSettings = {
  initialBufferMs: 300,
  minBufferMs: 100,
  maxBufferMs: 750,
  sampleWindowMs: 30_000,
  maxSamples: 512,
  minSamplesToShrink: 40,
  shrinkCooldownMs: 30_000,
  baselinePercentile: 0.05,
  jitterPercentile: 0.99,
  safetyMarginMs: 50,
  shrinkRateMsPerSecond: 10,
  maxShrinkPerUpdateMs: 10,
  phraseGapMs: 2_500,
  staleAfterMs: 1_000,
  scheduleMarginMs: 20,
  keyLeaseMs: 1_000,
};
