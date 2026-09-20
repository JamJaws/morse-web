import { describe, expect, it } from 'vitest';
import { RemotePlayback } from '../src/beep/RemotePlayback';
import { parseMorseCode } from '../src/beep/MorseCodeParser';
import type { PlaybackSettings } from '../src/beep/PlaybackSettings';
import { PLAYBACK_TEST_SETTINGS } from './playback-fixture';

function receiver(settings: Partial<PlaybackSettings> = {}) {
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
    { ...PLAYBACK_TEST_SETTINGS, ...settings },
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
  it.each(['key', 'code'] as const)(
    'preserves custom initial timing and mark lengths for %s across reset',
    mode => {
      const r = receiver({ initialBufferMs: 200 });
      const sendDot = (timestamp: number) => {
        if (mode === 'code') r.code(timestamp);
        else {
          r.key(timestamp, true);
          r.key(timestamp + 60, false);
        }
      };
      sendDot(0);
      expect(r.edges.map(e => Math.round(e.at))).toEqual([240, 300]);
      r.playback.reset();
      expect(r.edges).toEqual([]);
      expect(r.playback.stats.targetMs).toBe(200);
      r.at(4_040);
      sendDot(4_000);
      expect(r.edges.map(e => Math.round(e.at))).toEqual([4_240, 4_300]);
    },
  );

  it.each(['key', 'code'] as const)(
    'recovers %s at the configured maximum independently of the stale threshold',
    mode => {
      const r = receiver({
        initialBufferMs: 200,
        maxBufferMs: 900,
        staleAfterMs: 100,
        phraseGapMs: 1_000,
      });
      if (mode === 'key') {
        r.key(0, true);
        r.at(100);
        r.key(60, false);
        r.at(2_000);
        r.key(1_000, true);
        r.key(1_060, false);
        expect(r.edges).toEqual([]);
        r.at(3_200);
        r.key(2_200, true);
        r.at(3_260);
        r.key(2_260, false);
      } else {
        r.code(0);
        r.at(3_200);
        r.code(2_200);
      }
      expect(r.playback.stats.targetMs).toBe(900);
      expect(r.edges.map(e => Math.round(e.at))).toEqual([4_100, 4_160]);
    },
  );

  it('uses the configured initial reserve and audio-clock lease', () => {
    const r = receiver({ initialBufferMs: 200, keyLeaseMs: 600 });
    r.key(0, true);
    expect(r.edges.map(e => Math.round(e.at))).toEqual([240, 840]);
  });

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
