import type { MorseSession } from '../hooks/useMorseSession';

export function DebugPanel({ session }: { session: MorseSession }) {
  return (
    <details className="p-4 text-xs break-all">
      <summary>Diagnostics</summary>
      <p>Connection state: {session.readyState}</p>
      <p>My operator ID: {session.myOperatorId}</p>
      <p>Last message: {session.lastMessage?.data}</p>
      <p>Remote oscillators: {session.remoteOscillatorIds.join(', ')}</p>
      <pre className="whitespace-pre-wrap">{session.playbackStats}</pre>
    </details>
  );
}
