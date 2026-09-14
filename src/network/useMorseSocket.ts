import { useCallback, useEffect, useRef, useState } from 'react';
import useWebSocket, { ReadyState } from 'react-use-websocket';
import { parseMessage, type ServerMessage } from './protocol';

export function useMorseSocket(
  onMessage: (message: ServerMessage) => void,
  onReset: () => void,
) {
  const handlers = useRef({ onMessage, onReset });
  handlers.current = { onMessage, onReset };
  const sequence = useRef(0);
  const resetting = useRef(false);
  const pingId = useRef(0);
  const pendingPing = useRef<{ id: number; sent: number } | undefined>(
    undefined,
  );
  const backlogSince = useRef<number | undefined>(undefined);
  const nextPingAt = useRef(0);
  const [latency, setLatency] = useState<number | null>(null);
  const { sendMessage, getWebSocket, lastMessage, readyState } = useWebSocket(
    `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/beep`,
    {
      onOpen: () => {
        resetting.current = false;
        sequence.current = 0;
        pendingPing.current = undefined;
        backlogSince.current = undefined;
        nextPingAt.current = performance.now() + 2_000;
        setLatency(null);
        handlers.current.onReset();
      },
      onClose: () => {
        resetting.current = true;
        pendingPing.current = undefined;
        backlogSince.current = undefined;
        handlers.current.onReset();
      },
      onMessage: event => {
        if (resetting.current) return;
        const message = parseMessage(event.data);
        if (!message) return;
        if (message.type === 'PONG' && message.id === pendingPing.current?.id) {
          setLatency(Math.round(performance.now() - pendingPing.current.sent));
          pendingPing.current = undefined;
        }
        handlers.current.onMessage(message);
      },
      shouldReconnect: () => true,
      reconnectAttempts: Infinity,
      reconnectInterval: attempt =>
        Math.min(1_000 * 2 ** Math.min(attempt, 5), 10_000) *
        (0.8 + Math.random() * 0.4),
    },
  );
  const reconnect = useCallback(() => {
    if (resetting.current) return;
    resetting.current = true;
    pendingPing.current = undefined;
    handlers.current.onReset();
    getWebSocket()?.close();
  }, [getWebSocket]);
  const checkSocket = useCallback(() => {
    if (resetting.current) return false;
    const socket = getWebSocket();
    if (!socket || socket.readyState !== ReadyState.OPEN) return false;
    const now = performance.now();
    if ('bufferedAmount' in socket && socket.bufferedAmount > 0) {
      backlogSince.current ??= now;
      if (
        socket.bufferedAmount > 65_536 ||
        now - backlogSince.current >= 1_000
      ) {
        reconnect();
        return false;
      }
    } else backlogSince.current = undefined;
    return true;
  }, [getWebSocket, reconnect]);
  const send = useCallback(
    (message: object) => {
      if (!checkSocket()) return false;
      // Transient transmissions expire with their connection.
      sendMessage(JSON.stringify(message), false);
      return true;
    },
    [checkSocket, sendMessage],
  );
  const sendKey = useCallback(
    (down: boolean) =>
      send({
        type: 'KEY',
        down,
        timestamp: performance.now(),
        sequence: ++sequence.current,
      }),
    [send],
  );
  const sendCode = useCallback(
    (code: string, wpm: number) =>
      send({
        type: 'CODE',
        code,
        wpm,
        timestamp: performance.now(),
        sequence: ++sequence.current,
      }),
    [send],
  );
  const sendFrequency = useCallback(
    (frequency: number) => send({ type: 'FREQUENCY', frequency }),
    [send],
  );
  useEffect(() => {
    if (readyState !== ReadyState.OPEN) return;
    const interval = setInterval(() => {
      if (!checkSocket()) return;
      const now = performance.now();
      if (pendingPing.current) {
        if (now - pendingPing.current.sent >= 6_000) reconnect();
      } else if (now >= nextPingAt.current) {
        const ping = { id: ++pingId.current, sent: now };
        if (send({ type: 'PING', id: ping.id })) {
          pendingPing.current = ping;
          nextPingAt.current = now + 2_000;
        }
      }
    }, 250);
    return () => clearInterval(interval);
  }, [readyState, checkSocket, reconnect, send]);
  return {
    sendKey,
    sendCode,
    sendFrequency,
    reconnect,
    readyState,
    lastMessage,
    latency,
  };
}
