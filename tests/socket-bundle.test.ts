import { resolve } from 'node:path';
import { build } from 'vite';
import { expect, it } from 'vitest';

it('renders the socket hook with the real browser-bundled WebSocket package', async () => {
  // Unit tests mock the package, which hides differences in CommonJS interop.
  // Rendering without effects exercises the real hook without opening a socket.
  const result = await build({
    configFile: false,
    logLevel: 'silent',
    build: {
      write: false,
      lib: {
        entry: resolve('tests/fixtures/socket-render.ts'),
        formats: ['iife'],
        name: 'SocketSmoke',
      },
    },
  });
  const outputs = (Array.isArray(result) ? result : [result]).flatMap(
    output => output.output,
  );
  const chunk = outputs.find(output => output.type === 'chunk');
  if (!chunk) throw new Error('Vite produced no browser bundle');
  const bundle = new Function(`${chunk.code}; return SocketSmoke;`)() as {
    renderSocket: () => string;
  };

  expect(bundle.renderSocket()).toBe('<output>-1</output>');
});
