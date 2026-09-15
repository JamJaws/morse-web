import { describe, expect, it } from 'vitest';
import { AdaptiveDelay } from '../src/beep/AdaptiveDelay';
import { RemotePlayback } from '../src/beep/RemotePlayback';
import { parseMorseCode } from '../src/beep/MorseCodeParser';

function receiver() {
  let now = 40;
  let sequence = 0;
  let down = false;
  let edges: { at: number; down: boolean }[] = [];
  const playback = new RemotePlayback(
    {
      replace: (state, plan) => {
        down = state;
        edges = plan.map(e => ({ ...e, at: (e.at - 10) * 1_000 }));
      },
    },
    { now: () => now, audioNow: () => 10 + now / 1_000 },
  );
  return {
    playback,
    at(time: number) {
      now = time;
    },
    key(timestamp: number, down: boolean) {
      playback.key({ timestamp, sequence: ++sequence, down });
    },
    code(timestamp: number, code = '.', wpm = 20) {
      return playback.code({ timestamp, sequence: ++sequence, code, wpm });
    },
    get edges() {
      return edges;
    },
    get down() {
      return down;
    },
  };
}

describe('remote playback', () => {
  it('preserves a 60 ms dot despite different arrival delays', () => {
    const r = receiver();
    r.key(0, true);
    r.at(250);
    r.key(60, false);
    expect(r.edges.map(e => Math.round(e.at))).toEqual([340, 400]);
    expect(r.playback.stats.lateEvents).toBe(0);
  });
  it('handles a first down and up delivered in one batch', () => {
    const r = receiver();
    r.at(100);
    r.key(0, true);
    r.key(60, false);
    expect(r.edges.map(e => Math.round(e.at))).toEqual([400, 460]);
  });
  it('accepts an initial release without inventing a down edge', () => {
    const r = receiver();
    r.at(100);
    r.key(60, false);
    expect(r.edges).toEqual([]);
    r.at(160);
    r.key(120, true);
    r.at(220);
    r.key(180, false);
    expect(r.edges[1].at - r.edges[0].at).toBeCloseTo(60);
  });
  it('preserves every edge across an ordered jitter trace', () => {
    const r = receiver();
    let arrival = 0;
    for (let i = 0; i < 80; i++) {
      const timestamp = i * 60;
      arrival = Math.max(arrival, timestamp + ((i * 73) % 220));
      r.at(arrival);
      r.key(timestamp, i % 2 === 0);
      const edge = r.edges.find(
        e =>
          e.down === (i % 2 === 0) && Math.abs(e.at - timestamp - 300) < 0.01,
      );
      expect(edge).toBeDefined();
    }
    expect(r.playback.stats.lateEvents).toBe(0);
  });
  it('ends a late tone immediately and applies the larger buffer at a pause', () => {
    const r = receiver();
    r.key(0, true);
    r.at(600);
    r.key(60, false);
    expect(r.down).toBe(false);
    expect(r.playback.stats.lateEvents).toBe(1);
    expect(r.playback.stats.appliedMs).toBe(300);
    expect(r.playback.stats.targetMs).toBeGreaterThan(300);
    r.at(4_040);
    r.key(4_000, true);
    expect(r.playback.stats.appliedMs).toBe(r.playback.stats.targetMs);
    expect(r.edges[0].at - 600).toBeGreaterThanOrEqual(2_500);
  });
  it('does not stretch intra-phrase gaps when the target grows', () => {
    const r = receiver();
    r.key(0, true);
    r.at(380);
    r.key(60, false);
    expect(r.playback.stats.targetMs).toBeGreaterThan(300);
    r.at(400);
    r.key(120, true);
    expect(r.edges[0].at).toBeCloseTo(460);
  });
  it('renews a scheduled cutoff and requires release after it expires', () => {
    const r = receiver();
    r.key(0, true);
    expect(r.edges.at(-1)?.at).toBeCloseTo(1_340);
    r.at(290);
    r.key(250, true);
    expect(r.edges.filter(e => e.down)).toHaveLength(1);
    expect(r.edges.at(-1)?.at).toBeCloseTo(1_590);
    r.at(1_700);
    r.playback.tick();
    expect(r.playback.stats.leaseExpirations).toBe(1);
    r.key(1_660, true);
    expect(r.down).toBe(false);
    expect(r.edges).toEqual([]);
    r.at(1_800);
    r.key(1_760, false);
    r.at(1_900);
    r.key(1_860, true);
    expect(r.edges.some(e => e.down)).toBe(true);
  });
  it('drops stale bursts, then recovers on a fresh release', () => {
    const r = receiver();
    r.key(0, true);
    r.at(100);
    r.key(60, false);
    r.at(3_000);
    r.key(120, true);
    r.key(180, false);
    expect(r.edges).toEqual([]);
    expect(r.down).toBe(false);
    expect(r.playback.stats.discardedEvents).toBe(2);
    r.at(3_040);
    r.key(3_000, false);
    r.at(6_040);
    r.key(6_000, true);
    expect(r.edges.some(e => e.down)).toBe(true);
  });
  it('recovers from a permanent route delay at a real pause after release', () => {
    const r = receiver();
    r.key(0, true);
    r.at(100);
    r.key(60, false);
    r.at(8_000);
    r.key(2_000, true);
    r.key(2_060, false);
    // Sender gaps inside a coalesced backlog cannot trigger recovery.
    r.key(5_000, true);
    r.key(5_060, false);
    expect(r.edges).toEqual([]);
    r.at(11_000);
    r.key(9_000, true);
    expect(r.edges[0].at).toBeCloseTo(11_750);
    r.at(11_060);
    r.key(9_060, false);
    expect(r.edges[1].at - r.edges[0].at).toBeCloseTo(60);
  });
  it('rejects duplicate, backward and non-finite timing', () => {
    const r = receiver();
    r.key(60, true);
    const before = r.edges;
    for (const event of [
      { timestamp: 60, sequence: 1 },
      { timestamp: 60, sequence: 0 },
      { timestamp: NaN, sequence: 2 },
      { timestamp: 60.5, sequence: 2 },
      { timestamp: 50, sequence: 2 },
      { timestamp: 80, sequence: 1.5 },
    ])
      r.playback.key({ ...event, down: false });
    expect(r.edges).toEqual(before);
  });
  it('drops implausible future times instead of scheduling an unbounded tone', () => {
    const r = receiver();
    r.key(0, true);
    r.key(1_000_000, false);
    expect(r.edges).toEqual([]);
    expect(r.down).toBe(false);
    expect(r.playback.stats.discardedEvents).toBe(1);
    expect(r.playback.stats.targetMs).toBeGreaterThanOrEqual(100);
    expect(r.playback.stats.targetMs).toBeLessThanOrEqual(750);
  });
  it('queues typed messages synchronously and preserves mark lengths', () => {
    const r = receiver();
    expect(r.code(0)).toBe(true);
    expect(r.code(0)).toBe(true);
    expect(r.edges).toHaveLength(4);
    expect(r.edges[2].at).toBeGreaterThan(r.edges[1].at);
    expect(r.edges[1].at - r.edges[0].at).toBeCloseTo(60);
  });
  it('starts manual keying promptly when it interrupts a long typed queue', () => {
    const r = receiver();
    expect(r.code(0, '-'.repeat(80), 4)).toBe(true);
    expect(r.code(10, '.', 20)).toBe(true);
    r.at(3_040);
    r.key(3_000, true);
    expect(r.edges.filter(e => e.down)).toHaveLength(1);
    expect(r.edges[0].at).toBeLessThanOrEqual(3_790);
    r.at(3_100);
    r.key(3_060, false);
    expect(r.edges[1].at - r.edges[0].at).toBeCloseTo(60);
  });
  it('bounds typed backlog and clears all scheduled work on reset', () => {
    const r = receiver();
    expect(r.code(0, '-'.repeat(2_048), 4)).toBe(false);
    r.key(0, true);
    r.playback.reset();
    expect(r.edges).toEqual([]);
    expect(r.down).toBe(false);
    r.playback.key({ timestamp: 0, sequence: 1, down: true });
    expect(r.edges.some(e => e.down)).toBe(true);
  });
  it('adapts typed playback on an idle boundary after a route change', () => {
    const r = receiver();
    r.code(0);
    r.at(5_000);
    expect(r.code(3_000)).toBe(true);
    expect(r.edges[0].at).toBeCloseTo(5_750);
  });
});

describe('adaptive delay', () => {
  it('replaces a biased first arrival and shrinks slowly, with bounded growth after a miss', () => {
    const delay = new AdaptiveDelay();
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
    const delay = new AdaptiveDelay();
    for (let i = 0; i < 50; i++) delay.observe(i * 100, i * 100 + 40);
    delay.observe(100_000, 100_040);
    expect(delay.targetMs).toBe(300);
  });
});

it('uses 1, 3 and 7 dot units between elements, letters and words', () => {
  for (const [code, gap] of [
    ['..', 0.06],
    ['. .', 0.18],
    ['./.', 0.42],
  ] as const) {
    const { beeps } = parseMorseCode(0, code, 20);
    expect(beeps[1].start - beeps[0].stop).toBeCloseTo(gap);
  }
});
