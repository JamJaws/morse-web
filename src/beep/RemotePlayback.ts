import {
  AdaptiveDelay,
  INITIAL_BUFFER_MS,
  MAX_BUFFER_MS,
} from './AdaptiveDelay';
import { parseMorseCode } from './MorseCodeParser';

export const KEY_LEASE_MS = 1_000;
export const PHRASE_GAP_MS = 2_500;
export const MAX_CODE_QUEUE_MS = 120_000;
const STALE_MS = 1_000;
const SCHEDULE_MARGIN_MS = 20;
type Edge = { at: number; down: boolean; guard?: boolean };
export interface PlaybackSink {
  replace(
    down: boolean,
    edges: { at: number; down: boolean }[],
    audioNow: number,
  ): void;
}
export interface PlaybackClock {
  now(): number;
  audioNow(): number;
}
export type TimedKey = { timestamp: number; sequence: number; down: boolean };
export type TimedCode = {
  timestamp: number;
  sequence: number;
  code: string;
  wpm: number;
};

/** One synchronous owner of all timing state for an operator's connection. */
export class RemotePlayback {
  private delay = new AdaptiveDelay();
  private offset: number | undefined;
  private audioOffset: number;
  private queue: Edge[] = [];
  private audibleDown = false;
  private keyDown = false;
  private awaitingUp = false;
  private lastSequence = 0;
  private lastTimestamp = -1;
  private lastStopSender = -Infinity;
  private lastStopPlayback = -Infinity;
  private lastReleaseArrival = -Infinity;
  private lastArrival = -Infinity;
  private codeUntil = 0;
  private lateEvents = 0;
  private discardedEvents = 0;
  private leaseExpirations = 0;

  constructor(
    private sink: PlaybackSink,
    private clock: PlaybackClock,
  ) {
    this.audioOffset = clock.audioNow() - clock.now() / 1_000;
  }
  private playhead() {
    return (this.clock.audioNow() - this.audioOffset) * 1_000;
  }
  private accept(timestamp: number, sequence: number) {
    if (
      !Number.isFinite(timestamp) ||
      timestamp < 0 ||
      timestamp > Number.MAX_SAFE_INTEGER ||
      timestamp < this.lastTimestamp ||
      !Number.isSafeInteger(sequence) ||
      sequence <= this.lastSequence
    )
      return false;
    this.lastArrival = this.clock.now();
    this.lastTimestamp = timestamp;
    this.lastSequence = sequence;
    this.delay.observe(timestamp, this.clock.now());
    return true;
  }
  private drain() {
    const now = this.playhead();
    while (this.queue.length && this.queue[0].at <= now) {
      const edge = this.queue.shift()!;
      this.audibleDown = edge.down;
      if (edge.guard && this.keyDown) {
        this.leaseExpirations++;
        this.awaitingUp = true;
      }
    }
  }
  private render() {
    this.drain();
    this.sink.replace(
      this.audibleDown,
      this.queue.map(e => ({
        at: this.audioOffset + e.at / 1_000,
        down: e.down,
      })),
      this.clock.audioNow(),
    );
  }
  tick() {
    this.drain();
  }
  private silence() {
    this.queue = [];
    this.audibleDown = false;
    this.codeUntil = 0;
  }
  reset() {
    this.silence();
    this.delay = new AdaptiveDelay();
    this.offset = undefined;
    this.audioOffset = this.clock.audioNow() - this.clock.now() / 1_000;
    this.keyDown = false;
    this.awaitingUp = false;
    this.lastSequence = 0;
    this.lastTimestamp = -1;
    this.lastStopSender = -Infinity;
    this.lastStopPlayback = -Infinity;
    this.lastReleaseArrival = -Infinity;
    this.lastArrival = -Infinity;
    this.render();
  }

  key(event: TimedKey) {
    const now = this.clock.now();
    this.drain();
    if (!this.accept(event.timestamp, event.sequence)) return;
    if (this.offset === undefined)
      this.offset = now - event.timestamp + INITIAL_BUFFER_MS;
    // After a persistent route change, recover at a real pause following a
    // release. Requiring a pause on both clocks prevents replaying a backlog.
    if (
      this.awaitingUp &&
      !this.keyDown &&
      event.down &&
      event.timestamp - this.lastStopSender >= PHRASE_GAP_MS &&
      now - this.lastReleaseArrival >= PHRASE_GAP_MS
    ) {
      this.reanchor(event.timestamp, now);
      this.awaitingUp = false;
    }
    let at = event.timestamp + this.offset!;
    if (
      now - at > STALE_MS ||
      at - now > MAX_BUFFER_MS + KEY_LEASE_MS ||
      this.queue.length >= 2_048
    ) {
      this.delay.missed(now - at, now);
      this.discardedEvents++;
      this.silence();
      this.awaitingUp = true;
      this.keyDown = event.down;
      if (!event.down) {
        this.lastStopSender = event.timestamp;
        this.lastReleaseArrival = now;
        this.lastStopPlayback = now;
      }
      this.render();
      return;
    }
    if (this.awaitingUp) {
      if (!event.down) {
        this.awaitingUp = false;
        this.keyDown = false;
        this.lastStopSender = event.timestamp;
        this.lastReleaseArrival = now;
        this.lastStopPlayback = now;
      }
      this.render();
      return;
    }
    if (event.down && !this.keyDown) {
      if (this.codeUntil > now) {
        this.silence();
        // An interrupted typed queue must not reserve silence until its old end.
        this.lastStopSender = -Infinity;
        this.lastStopPlayback = -Infinity;
      }
      // Only long sender-timed pauses permit changing the playout offset.
      // Keep both mark lengths and intra-phrase gaps intact.
      if (event.timestamp - this.lastStopSender >= PHRASE_GAP_MS) {
        at = Math.max(
          event.timestamp + this.delay.baseline + this.delay.targetMs,
          now + SCHEDULE_MARGIN_MS,
          this.lastStopPlayback + PHRASE_GAP_MS,
        );
        this.offset = at - event.timestamp;
        // Recalibrate audio/monotonic clocks only between phrases.
        if (!this.audibleDown && !this.queue.length)
          this.audioOffset = this.clock.audioNow() - now / 1_000;
      }
    }
    if (at < now && event.down !== this.keyDown) {
      this.lateEvents++;
      this.delay.missed(now - at, now);
      at = this.playhead();
    }
    // State refreshes renew an audio-thread cutoff without retriggering.
    this.queue = this.queue.filter(e => !e.guard);
    if (event.down !== this.keyDown) this.queue.push({ at, down: event.down });
    this.keyDown = event.down;
    if (event.down)
      this.queue.push({
        at: Math.max(at, now) + KEY_LEASE_MS,
        down: false,
        guard: true,
      });
    else {
      this.lastStopSender = event.timestamp;
      this.lastReleaseArrival = now;
      this.lastStopPlayback = at;
    }
    this.queue.sort((a, b) => a.at - b.at);
    this.render();
  }

  private reanchor(timestamp: number, now: number) {
    this.silence();
    this.delay = new AdaptiveDelay();
    this.delay.observe(timestamp, now);
    this.delay.missed(STALE_MS, now);
    this.offset = now - timestamp + this.delay.targetMs;
    this.audioOffset = this.clock.audioNow() - now / 1_000;
  }

  code(event: TimedCode) {
    const now = this.clock.now();
    this.drain();
    const idle =
      !this.keyDown &&
      this.codeUntil <= now &&
      event.timestamp - this.lastTimestamp >= PHRASE_GAP_MS &&
      now - this.lastArrival >= PHRASE_GAP_MS;
    if (!this.accept(event.timestamp, event.sequence)) return false;
    if (this.offset === undefined)
      this.offset = now - event.timestamp + INITIAL_BUFFER_MS;
    let due = event.timestamp + this.offset;
    if (idle && now - due > STALE_MS) {
      this.reanchor(event.timestamp, now);
      due = event.timestamp + this.offset!;
    } else if (idle) {
      due = Math.max(
        event.timestamp + this.delay.baseline + this.delay.targetMs,
        now + SCHEDULE_MARGIN_MS,
      );
      this.offset = due - event.timestamp;
      this.audioOffset = this.clock.audioNow() - now / 1_000;
    }
    if (now - due > STALE_MS) {
      this.delay.missed(now - due, now);
      this.discardedEvents++;
      return false;
    }
    const start = Math.max(now + SCHEDULE_MARGIN_MS, due, this.codeUntil);
    const parsed = parseMorseCode(start / 1_000, event.code, event.wpm);
    if (
      !parsed.beeps.length ||
      parsed.beeps.length > 2_048 ||
      start + parsed.duration * 1_000 - now > MAX_CODE_QUEUE_MS
    ) {
      this.discardedEvents++;
      return false;
    }
    if (this.keyDown) {
      this.silence();
      this.keyDown = false;
    }
    this.awaitingUp = false;
    this.queue = this.queue.filter(e => !e.guard);
    for (const beep of parsed.beeps)
      this.queue.push(
        { at: beep.start * 1_000, down: true },
        { at: beep.stop * 1_000, down: false },
      );
    this.codeUntil = start + parsed.duration * 1_000;
    this.lastStopSender = event.timestamp + parsed.duration * 1_000;
    this.lastStopPlayback = this.codeUntil;
    this.queue.sort((a, b) => a.at - b.at);
    this.render();
    return true;
  }
  get stats() {
    return {
      targetMs: Math.round(this.delay.targetMs),
      appliedMs: Math.round(
        Math.max(
          0,
          (this.offset ?? this.delay.baseline + INITIAL_BUFFER_MS) -
            this.delay.baseline,
        ),
      ),
      lateEvents: this.lateEvents,
      discardedEvents: this.discardedEvents,
      leaseExpirations: this.leaseExpirations,
      queuedEdges: this.queue.length,
    };
  }
}
