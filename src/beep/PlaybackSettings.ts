export type PlaybackSettings = Readonly<{
  initialBufferMs: number;
  minBufferMs: number;
  maxBufferMs: number;
  sampleWindowMs: number;
  maxSamples: number;
  minSamplesToShrink: number;
  shrinkCooldownMs: number;
  baselinePercentile: number;
  jitterPercentile: number;
  safetyMarginMs: number;
  shrinkRateMsPerSecond: number;
  maxShrinkPerUpdateMs: number;
  phraseGapMs: number;
  staleAfterMs: number;
  scheduleMarginMs: number;
  keyLeaseMs: number;
}>;

/** Client playback tuning. Changes take effect after rebuilding and reloading. */
export const DEFAULT_PLAYBACK_SETTINGS: PlaybackSettings = Object.freeze({
  initialBufferMs: 300,
  minBufferMs: 100,
  maxBufferMs: 750,
  // History uses elapsed receiver time; samples also have a count limit.
  sampleWindowMs: 30_000,
  maxSamples: 512,
  minSamplesToShrink: 40,
  // Elapsed time since the first sample or latest miss, including silence.
  shrinkCooldownMs: 30_000,
  baselinePercentile: 0.05,
  jitterPercentile: 0.99,
  // Spare reserve for both observed jitter and missed deadlines.
  safetyMarginMs: 50,
  shrinkRateMsPerSecond: 10,
  // Prevent one arrival after a pause from spending all the idle time shrinking.
  maxShrinkPerUpdateMs: 10,
  phraseGapMs: 2_500,
  staleAfterMs: 1_000,
  scheduleMarginMs: 20,
  // Keep comfortably above the sender's 250 ms held-key refresh interval.
  keyLeaseMs: 1_000,
});

export function createPlaybackSettings(
  overrides: Partial<PlaybackSettings> = {},
): PlaybackSettings {
  const settings = { ...DEFAULT_PLAYBACK_SETTINGS, ...overrides };
  for (const [name, value] of Object.entries(settings)) {
    const allowsZero =
      name === 'shrinkCooldownMs' ||
      name === 'safetyMarginMs' ||
      name === 'scheduleMarginMs';
    if (!Number.isFinite(value) || (allowsZero ? value < 0 : value <= 0))
      throw new RangeError(
        `${name} must be finite and ${allowsZero ? 'nonnegative' : 'positive'}`,
      );
  }
  if (
    settings.minBufferMs > settings.initialBufferMs ||
    settings.initialBufferMs > settings.maxBufferMs
  )
    throw new RangeError('Buffer settings must satisfy min <= initial <= max');
  if (
    !Number.isSafeInteger(settings.minSamplesToShrink) ||
    !Number.isSafeInteger(settings.maxSamples) ||
    settings.minSamplesToShrink > settings.maxSamples
  )
    throw new RangeError(
      'Sample limits must be integers with minSamplesToShrink <= maxSamples',
    );
  if (
    settings.baselinePercentile >= settings.jitterPercentile ||
    settings.jitterPercentile > 1
  )
    throw new RangeError('Percentiles must satisfy 0 < baseline < jitter <= 1');
  return Object.freeze(settings);
}
