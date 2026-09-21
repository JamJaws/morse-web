# Playback and connection recovery

Deploy this client together with the ordered KEY protocol in `JamJaws/morse-server`.
START/STOP and unsequenced CODE frames are removed. There is no compatibility mode.
For rollout, stop the old relay, deploy the new relay and client, then reload open
browser tabs. A reconnect clears playback and gives the sender a new operator ID.

## Timing

Remote playback starts with 300 ms of scheduling reserve. This replaces the old
200 ms offset plus Tone's 100 ms lookahead; remote scheduling now uses the audio
clock directly. Local keying retains immediate feedback without network buffering.

Each operator has one synchronous scheduler and a rolling estimator of
`arrival time - sender timestamp`. Clocks need not share an epoch. The 5th
percentile estimates the clock/transit baseline; the 99th percentile minus that
baseline plus 50 ms determines the target reserve, clamped to 100–750 ms. The
window is 30 seconds and holds at most 512 events. These are starting heuristics,
not a guarantee that 99% of future traffic will arrive on time.

The target grows on jitter or a late transition. It shrinks by at most 10 ms per
second (and 10 ms per update), only with at least 40 recent samples and a 30 second
cooldown since the first sample or latest late event. The measurement window and
cooldown are independent settings. The cooldown includes silence, but silence
alone cannot shrink the target: after five idle minutes the old samples expire
on the next arrival, the target is retained, and 40 fresh samples are needed
before shrinking. Another 30 seconds of active sending is not required. KEY
refreshes and CODE frames both contribute samples; heartbeat RTT does not set
the audio buffer.

An offset stays fixed within a phrase, preserving mark lengths and short gaps.
Changes apply after a sender pause of at least 2.5 seconds; reducing the offset
preserves at least 2.5 seconds of receiver silence. Pending and applied reserves
can therefore differ. Typed messages use the same ordered queue, retain their
internal timing, and can retune when idle. Morse element/letter/word gaps use
1/3/7 dot units.

Late transitions execute immediately. Events more than 1 second overdue are
silenced and discarded. A fresh release allows manual keying to resume. If the
route stays slower, a release followed by a 2.5 second pause on both sender and
receiver clocks permits a new baseline. A burst containing old sender pauses
cannot trigger that recovery. Events mapped implausibly far into the future are
also discarded. Already missed marks cannot be reconstructed by increasing a
buffer. Recovery explicitly starts at the maximum reserve and restarts the
shrink cooldown; changing the stale-event threshold does not set that reserve.

## Tuning

Edit `DEFAULT_PLAYBACK_SETTINGS` in `src/beep/PlaybackSettings.ts`, then rebuild
and reload the client. Buffer tuning does not require relay changes. Current
defaults are preserved; all estimator and playback timing values live together:

| Settings                                        | Defaults           | Purpose                                                                   |
| ----------------------------------------------- | ------------------ | ------------------------------------------------------------------------- |
| `initialBufferMs`, `minBufferMs`, `maxBufferMs` | 300 / 100 / 750 ms | Initial reserve and target bounds                                         |
| `sampleWindowMs`, `maxSamples`                  | 30,000 ms / 512    | Age and count limits for measurements                                     |
| `minSamplesToShrink`, `shrinkCooldownMs`        | 40 / 30,000 ms     | Fresh evidence and elapsed cooldown required before shrinking             |
| `baselinePercentile`, `jitterPercentile`        | 0.05 / 0.99        | Faster-arrival baseline and slower-arrival estimate                       |
| `safetyMarginMs`                                | 50 ms              | Spare reserve for jitter and missed deadlines                             |
| `shrinkRateMsPerSecond`, `maxShrinkPerUpdateMs` | 10 / 10 ms         | Independent reduction rate and per-arrival cap                            |
| `phraseGapMs`                                   | 2,500 ms           | Safe pause for changing the playback offset                               |
| `staleAfterMs`                                  | 1,000 ms           | Discard threshold relative to scheduled playback                          |
| `scheduleMarginMs`                              | 20 ms              | Minimum lead time when scheduling a new phrase/message                    |
| `keyLeaseMs`                                    | 1,000 ms           | Held-key audio cutoff; keep comfortably above the 250 ms refresh interval |

Settings are validated when constructing the scheduler: values must be finite,
buffer bounds must contain the initial value, sample limits must be positive
integers with `minSamplesToShrink <= maxSamples`, and percentiles must be ordered.
Shorter measurement windows can make the minimum sample count harder to reach.

`AdaptiveDelay` accepts optional settings as its first constructor argument;
`RemotePlayback` accepts them as its third. Partial overrides are merged with
the defaults and copied into a read-only snapshot. Reset clears learned timing
and returns to the configured initial reserve, preserving the chosen settings.
Behavior tests use a complete fixed policy so tuning production defaults does
not rewrite the timing scenarios. Additional tests exercise different windows,
cooldowns, sample limits, recovery thresholds, and buffer bounds.

## Fail-silent behavior

The sender repeats held KEY state every 250 ms. Each down state schedules a
key-up on the audio clock 1 second after its mapped playback time. Refreshes
extend that cutoff without retriggering the tone. If refreshes stop, the audio
thread silences the oscillator even if the main JavaScript thread stalls. After a
cutoff, further down refreshes are ignored until release/recovery. A long network
stall can therefore interrupt a held key; release and press again to resume.

Disconnects clear remote queues and all queued local marks. Manual keying
interrupts typed playback. Suspending the AudioContext disconnects playback and
requires Join again. Typed queues are bounded to 120 seconds, messages to 2048
Morse characters at 4–40 WPM, and manual queues to 2048 pending edges. Complete
typed messages already received can play through a short JavaScript stall because
their end times are known.

## WebSocket behavior

- KEY and CODE share a monotonic sequence per connection and use
  whole-millisecond timestamps from `Math.round(performance.now())`. The relay
  supplies the operator ID. Timestamps remain monotonic without decimal payloads;
  rounding introduces at most 0.5 ms of error per event. Internal audio scheduling
  retains fractional precision.
- Every recipient has one FIFO relay writer with 128 pending frames and a
  1 second enqueue-to-send deadline. A slow recipient is disconnected without
  blocking or disconnecting the sender. HELLO, roster updates and transmissions
  use that same writer.
- The browser never queues disconnected transmissions for replay. It reconnects
  if native `bufferedAmount` exceeds 64 KiB or stays nonzero for 1 second.
- Correlated PING/PONG runs without hovering the connection indicator. A new ping
  is sent every 5 seconds when none is outstanding, with a 15 second timeout.
  Reconnects use exponential backoff with jitter, capped around 10 seconds.
- The selected frequency is restored after HELLO. Failed typed sends retain the
  input. Old tabs must reload for this breaking protocol change.

Application queue limits cannot remove data already accepted by TCP, an OS send
buffer or a proxy. The receiver's late-event policy, cutoff and heartbeat are
still needed. Browser timers may be throttled in the background, so return to
Join if the audio context was suspended. This is an ephemeral relay, not a
store-and-forward message service.

## Verification before merge

Run `npm ci`, `npm test`, `npm run typecheck`, `npm run lint` and `npm run build`.
In the matching server branch, run `./gradlew build` with JDK 25. Unit tests cover
ordered jitter traces, batched arrivals, stale bursts, persistent delay changes,
lease expiry, buffer decay and queue limits. App tests cover refreshes,
reconnects, heartbeats, backpressure, audio cleanup and frequency restoration.
Relay tests cover real Ktor WebSocket ordering/validation and isolated outboxes.

For a paired manual check, run the relay on port 8080 and `npm start` here; Vite
proxies `/beep` to the relay. Open two tabs at `http://localhost:5173/?tx&debug`,
click Join in each, and use headphones or low volume.

1. Send dots/dashes and type two messages quickly. Listen for preserved spacing
   and sequential typed playback. The debug view exposes target/applied reserve,
   late/discard counts, cutoff count and queued edges per peer.
2. Hold a key and interrupt the sending tab's connection before release. The
   receiving tone must end after its last scheduled lease, with no stuck tone or
   replay on reconnect. Release before transmitting again.
3. In the receiving tab's console, while a remote key is held, run
   `const end = performance.now() + 2000; while (performance.now() < end) {}`.
   The scheduled cutoff should silence the tone while JavaScript is blocked.
   Release and press again after the stall.
4. Introduce delay/jitter using an OS network shaper or WebSocket-aware proxy.
   Check that the target grows, applies at a phrase pause, and only shrinks after
   sustained healthy traffic. Ordinary DevTools HTTP throttling may not shape
   established WebSocket frames; confirm delivery timing actually changes.
5. Change frequency, disconnect/reconnect, and check that it is retained. Suspend
   the audio context or background the tab until it suspends: Join should return.

Automated browser tests mock Tone and the socket hook; they verify scheduling and
lifecycle logic, not actual device audio or browser background policy. The paired
listening and audio-thread stall checks remain useful before merge.
