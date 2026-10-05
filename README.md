# Morse code — Beep beep app

Live Morse code at [morse.jamjaws.com](https://morse.jamjaws.com).

The frontend uses React, TypeScript, Vite and Tailwind CSS v4. Audio is generated
with Tone.js; a WebSocket connection carries transmissions between operators.

## Development

Use Node.js 22.22.2+ or 24.15.0+ within those release lines, or Node.js 26+
(CI uses Node 22), and npm:

```sh
npm ci
npm start
```

Open the local URL printed by Vite, normally `http://localhost:5173`. The dev
server proxies `/beep` WebSocket connections to the backend at
`http://127.0.0.1:8080`. Without a backend, local tones still work after clicking
Connect; remote transmissions need a connected backend.

## Commands

| Command                | Purpose                                               |
| ---------------------- | ----------------------------------------------------- |
| `npm test`             | Run the Vitest suite once                             |
| `npm run test:watch`   | Re-run tests while developing                         |
| `npm run typecheck`    | Check TypeScript types                                |
| `npm run lint`         | Check ESLint rules                                    |
| `npm run format`       | Format source, tests, configuration and documentation |
| `npm run format:check` | Check formatting without changing files               |
| `npm run build`        | Generate the production site in `build/`              |
| `npm run serve`        | Preview the production build locally                  |

CI runs tests, type checking, formatting, linting and the production build.

## Styling

Tailwind runs through its Vite plugin. Shared theme values belong in the `@theme`
block in `src/index.css`; ordinary styles use utilities in React components.
There is no separate PostCSS or JavaScript Tailwind configuration.

## Playback and connection recovery

See [the timing, rollout and verification guide](docs/playback.md).

## Using the app

Click Connect to enable audio. Hold the Morse key with a mouse, touch or pen,
or hold Space/Enter when the key has focus. Releasing, losing focus, switching
tabs or losing pointer capture ends the tone. When disconnected, manual keying
still plays locally and the interface shows that it is local practice.

Leave the callsign or name blank for a server-assigned Star Trek character name.
When all character names are in use, the server falls back to hexadecimal labels
such as `Guest-A` and `Guest-10`. Only names you choose explicitly are saved on
this device; reconnecting as a guest requests a name again. Clear your name in
Settings to switch back to a guest. The Operators list shows the server's names.

Hover or focus the connection status to preview operator count and latency.
Click or tap to keep it open; click again, click outside, or press Escape to close.
Mute affects local and incoming sound without changing the saved volume.
Volume, a manually chosen frequency, and WPM are stored on the current device;
blocked browser storage falls back to session-only settings. WPM controls typed
messages and reference playback, not the timing of a manually held key.

The collapsible Morse reference sits to the right of the key on wide screens
and below it on smaller screens. Select its heading to show or hide it;
punctuation expands separately. Reference characters play locally.

**Notes** below the key opens a private notepad for writing down what you hear.
Its text and open/closed state are saved on this device, with a session-only
fallback if browser storage is blocked or full. Notes are never transmitted.
Space and Enter work normally while typing; Escape returns focus to the key.

The header's **More actions** (⋯) menu contains
**Transmit text**, which broadcasts supported characters and keeps drafts while
switching panels or reconnecting. The `?tx`
URL shortcut opens that panel initially. `?debug` enables playback diagnostics;
statistics are not sampled otherwise.

## Listening training

Open **Training** in the header, or visit `/training`. All 39 Koch lessons are
available, starting with K/M and adding characters in the traditional G4FON order. A lesson
can be bookmarked, for example `/training?lesson=3`.

**Custom practice** lets you choose any mapped letters, digits or punctuation,
including Å, Ä and Ö. Quick sets select A–Z, 0–9 or ÅÄÖ; individual characters
can be added or removed. The selection stays only for the current visit.

Hear the examples, then start a 20-sound round. Answer with a character button
or its keyboard key after the sound finishes. Answers are untimed; character
speed starts at 20 WPM. Replays are free; Show hint is scored separately.
An incorrect answer automatically replays the same sound for another try. The
first answer determines the score, so retries cannot turn a mistake into credit.

**Autoplay** is on by default: after 750 ms of correct-answer feedback, the
next sound plays automatically. Turn it off in the practice card to select
Next sound yourself. Autoplay stops at the round results.
Each sound waits for an answer indefinitely, so no Pause button is needed.
Leaving, switching tabs, audio suspension or changing sound settings cancels
pending playback and advancement until you choose to continue.

Training runs locally without Connect or a backend. Scores and sound-setting
changes are kept only in memory and cleared when leaving the lesson. The page
reads the saved live volume but does not change live preferences. Interrupted
audio requires Resume before it plays again.

Leaving Live for Training disconnects the live session and stops its tones.
Returning to Live requires Connect. Offline page reloads and sending practice
are not included yet. See [the training roadmap](docs/training-plan.md).
