# Morse code — Beep beep app

Live Morse code at [morse.jamjaws.com](https://morse.jamjaws.com).

The frontend uses React, TypeScript, Vite and Tailwind CSS v4. Audio is generated
with Tone.js; a WebSocket connection carries transmissions between operators.

## Development

Use Node.js 22.12+ (CI uses Node 22) and npm:

```sh
npm ci
npm start
```

Open the local URL printed by Vite, normally `http://localhost:5173`. The dev
server proxies `/beep` WebSocket connections to the backend at
`http://127.0.0.1:8080`. Without a backend, local tones still work after joining;
remote transmissions need a connected backend.

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

Joining enables audio. Hold the Morse key with a mouse, touch or pen, or hold
Space/Enter when the key has focus. Releasing, losing focus, switching tabs or
losing pointer capture ends the tone. When disconnected, manual keying still
plays locally and the interface shows that it is local practice.

Hover or focus the connection status to preview operator count and latency.
Click or tap to keep it open; click again, click outside, or press Escape to close.
Mute affects local and incoming sound without changing the saved volume.
Volume, a manually chosen frequency, and WPM are stored on the current device;
blocked browser storage falls back to session-only settings. WPM controls typed
messages and reference playback, not the timing of a manually held key.

The Morse reference plays locally. **Type a message** broadcasts supported
characters and keeps drafts while switching panels or reconnecting. The `?tx`
URL shortcut opens that panel initially. `?debug` enables playback diagnostics;
statistics are not sampled otherwise.
