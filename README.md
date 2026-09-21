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
