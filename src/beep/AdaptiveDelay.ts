import {
  createPlaybackSettings,
  type PlaybackSettings,
} from './PlaybackSettings';

const percentile = (sorted: number[], p: number) =>
  sorted[Math.max(0, Math.ceil(sorted.length * p) - 1)];

/** Estimates transit variation, including receiver event-loop delays. */
export class AdaptiveDelay {
  private samples: { arrival: number; transit: number }[] = [];
  private lastLate = 0;
  private lastUpdate = 0;
  private firstArrival = 0;
  baseline = 0;
  targetMs: number;
  readonly settings: PlaybackSettings;

  constructor(settings: Partial<PlaybackSettings> = {}) {
    this.settings = createPlaybackSettings(settings);
    this.targetMs = this.settings.initialBufferMs;
  }

  observe(sender: number, arrival: number) {
    const settings = this.settings;
    if (!this.samples.length) {
      this.firstArrival = arrival;
      this.lastUpdate = arrival;
      this.baseline = arrival - sender;
    }
    this.samples.push({ arrival, transit: arrival - sender });
    this.samples = this.samples
      .filter(s => arrival - s.arrival <= settings.sampleWindowMs)
      .slice(-settings.maxSamples);
    const transits = this.samples.map(s => s.transit).sort((a, b) => a - b);
    this.baseline = percentile(transits, settings.baselinePercentile);
    const desired = Math.max(
      settings.minBufferMs,
      Math.min(
        settings.maxBufferMs,
        percentile(transits, settings.jitterPercentile) -
          this.baseline +
          settings.safetyMarginMs,
      ),
    );
    if (desired > this.targetMs) this.targetMs = desired;
    else if (
      this.samples.length >= settings.minSamplesToShrink &&
      arrival - Math.max(this.firstArrival, this.lastLate) >=
        settings.shrinkCooldownMs
    ) {
      // The cooldown includes silence, but shrinking still needs recent samples.
      const step = Math.min(
        settings.maxShrinkPerUpdateMs,
        ((arrival - this.lastUpdate) / 1_000) * settings.shrinkRateMsPerSecond,
      );
      this.targetMs = Math.max(desired, this.targetMs - step);
    }
    this.lastUpdate = arrival;
  }

  missed(lateness: number, arrival: number) {
    this.lastLate = arrival;
    this.targetMs = Math.min(
      this.settings.maxBufferMs,
      this.targetMs + Math.max(0, lateness) + this.settings.safetyMarginMs,
    );
  }

  /** A new route starts conservatively, independently of the stale threshold. */
  startRecovery(sender: number, arrival: number) {
    this.samples = [];
    this.observe(sender, arrival);
    this.targetMs = this.settings.maxBufferMs;
    this.lastLate = arrival;
  }
}
