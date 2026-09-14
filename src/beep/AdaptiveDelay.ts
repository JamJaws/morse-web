export const INITIAL_BUFFER_MS = 300;
export const MIN_BUFFER_MS = 100;
export const MAX_BUFFER_MS = 750;
const WINDOW_MS = 30_000;
const MARGIN_MS = 50;
const percentile = (sorted: number[], p: number) =>
  sorted[Math.max(0, Math.ceil(sorted.length * p) - 1)];

/** Estimates transit variation, including receiver event-loop delays. */
export class AdaptiveDelay {
  private samples: { arrival: number; transit: number }[] = [];
  private lastLate = 0;
  private lastUpdate = 0;
  private firstArrival = 0;
  baseline = 0;
  targetMs = INITIAL_BUFFER_MS;

  observe(sender: number, arrival: number) {
    if (!this.samples.length) {
      this.firstArrival = arrival;
      this.lastUpdate = arrival;
      this.baseline = arrival - sender;
    }
    this.samples.push({ arrival, transit: arrival - sender });
    this.samples = this.samples
      .filter(s => arrival - s.arrival <= WINDOW_MS)
      .slice(-512);
    const transits = this.samples.map(s => s.transit).sort((a, b) => a - b);
    this.baseline = percentile(transits, 0.05);
    const desired = Math.max(
      MIN_BUFFER_MS,
      Math.min(
        MAX_BUFFER_MS,
        percentile(transits, 0.99) - this.baseline + MARGIN_MS,
      ),
    );
    if (desired > this.targetMs) this.targetMs = desired;
    else if (
      this.samples.length >= 40 &&
      arrival - Math.max(this.firstArrival, this.lastLate) >= WINDOW_MS
    ) {
      // Silence does not count as evidence of a stable connection.
      const step = Math.min(10, ((arrival - this.lastUpdate) / 1_000) * 10);
      this.targetMs = Math.max(desired, this.targetMs - step);
    }
    this.lastUpdate = arrival;
  }

  missed(lateness: number, arrival: number) {
    this.lastLate = arrival;
    this.targetMs = Math.min(
      MAX_BUFFER_MS,
      this.targetMs + lateness + MARGIN_MS,
    );
  }
}
