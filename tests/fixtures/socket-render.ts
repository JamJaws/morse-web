import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { useMorseSocket } from '../../src/network/useMorseSocket';

function SocketProbe() {
  const socket = useMorseSocket(
    () => {},
    () => {},
  );
  return createElement('output', null, socket.readyState);
}

export function renderSocket(): string {
  return renderToString(createElement(SocketProbe));
}
