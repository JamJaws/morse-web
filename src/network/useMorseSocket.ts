import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import useWebSocketExport, { ReadyState } from 'react-use-websocket';
import { parseMessage, type ServerMessage } from './protocol';

// The package ships CommonJS; Vite exposes its exports object for ESM imports.
type UseWebSocket = typeof useWebSocketExport;
const useWebSocket: UseWebSocket =
  typeof useWebSocketExport === 'function'
    ? useWebSocketExport
    : (useWebSocketExport as { default: UseWebSocket }).default;

const PING_INTERVAL_MS = 5_000;
const PONG_TIMEOUT_MS = 15_000;
const HELLO_TIMEOUT_MS = 15_000;

type Registration = { name: string; frequency: number };

export function useMorseSocket(
  onMessage: (message: ServerMessage) => void,
  onReset: () => void,
  registration: Registration | null,
) {
  const enabled = registration !== null;
  const handlers = useRef({ onMessage, onReset });
  const registrationRef = useRef(registration);
  const sentRegistration = useRef<Registration | null>(null);
  const joined = useRef(false);
  const [confirmation, setConfirmation] = useState({ enabled, joined: false });
  if (confirmation.enabled !== enabled)
    setConfirmation({ enabled, joined: false });
  const confirmed = enabled && confirmation.enabled && confirmation.joined;
  const outbound = useRef<{
    sendMessage: (message: string, keep: boolean) => void;
    sendName: (name: string) => boolean;
    sendFrequency: (frequency: number) => boolean;
  }>({
    sendMessage: () => {},
    sendName: () => false,
    sendFrequency: () => false,
  });
  useLayoutEffect(() => {
    handlers.current = { onMessage, onReset };
    registrationRef.current = registration;
    if (!registration) {
      joined.current = false;
    }
  }, [onMessage, onReset, registration]);
  const sequence = useRef(0);
  const resetting = useRef(false);
  const pingId = useRef(0);
  const pendingPing = useRef<{ id: number; sent: number } | undefined>(
    undefined,
  );
  const backlogSince = useRef<number | undefined>(undefined);
  const nextPingAt = useRef(0);
  const [latency, setLatency] = useState<number | null>(null);
  const {
    sendMessage,
    getWebSocket,
    lastMessage,
    readyState: socketReadyState,
  } = useWebSocket(
    enabled
      ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/beep`
      : null,
    {
      onOpen: () => {
        if (!registrationRef.current) return;
        resetting.current = false;
        joined.current = false;
        setConfirmation({ enabled: true, joined: false });
        sequence.current = 0;
        pendingPing.current = undefined;
        backlogSince.current = undefined;
        nextPingAt.current = performance.now() + PING_INTERVAL_MS;
        setLatency(null);
        handlers.current.onReset();
        sentRegistration.current = { ...registrationRef.current };
        outbound.current.sendMessage(
          JSON.stringify({ type: 'JOIN', ...sentRegistration.current }),
          false,
        );
      },
      onClose: () => {
        resetting.current = true;
        joined.current = false;
        setConfirmation({
          enabled: registrationRef.current !== null,
          joined: false,
        });
        pendingPing.current = undefined;
        backlogSince.current = undefined;
        setLatency(null);
        handlers.current.onReset();
      },
      onMessage: event => {
        if (resetting.current || !registrationRef.current) return;
        const message = parseMessage(event.data);
        if (!message) return;
        if (message.type === 'HELLO') {
          if (joined.current) return;
          joined.current = true;
          setConfirmation({ enabled: true, joined: true });
          nextPingAt.current = performance.now() + PING_INTERVAL_MS;
          const latest = registrationRef.current;
          if (latest.name !== sentRegistration.current?.name)
            outbound.current.sendName(latest.name);
          if (latest.frequency !== sentRegistration.current?.frequency)
            outbound.current.sendFrequency(latest.frequency);
        } else if (!joined.current) return;
        if (message.type === 'PONG' && message.id === pendingPing.current?.id) {
          setLatency(Math.round(performance.now() - pendingPing.current.sent));
          pendingPing.current = undefined;
        }
        handlers.current.onMessage(message);
      },
      shouldReconnect: () => registrationRef.current !== null,
      reconnectAttempts: Infinity,
      reconnectInterval: attempt =>
        Math.min(1_000 * 2 ** Math.min(attempt, 5), 10_000) *
        (0.8 + Math.random() * 0.4),
    },
  );
  const reconnect = useCallback(() => {
    if (!registrationRef.current || resetting.current) return;
    resetting.current = true;
    joined.current = false;
    setConfirmation({ enabled: true, joined: false });
    pendingPing.current = undefined;
    handlers.current.onReset();
    getWebSocket()?.close();
  }, [getWebSocket]);
  const checkSocket = useCallback(() => {
    if (!registrationRef.current || resetting.current || !joined.current)
      return false;
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
    (message: object, timed = false) => {
      if (!checkSocket()) return false;
      // Transient transmissions expire with their connection.
      sendMessage(
        JSON.stringify(
          timed
            ? {
                ...message,
                timestamp: Math.round(performance.now()),
                sequence: ++sequence.current,
              }
            : message,
        ),
        false,
      );
      return true;
    },
    [checkSocket, sendMessage],
  );
  const sendKey = useCallback(
    (down: boolean) => send({ type: 'KEY', down }, true),
    [send],
  );
  const sendCode = useCallback(
    (code: string, wpm: number) => send({ type: 'CODE', code, wpm }, true),
    [send],
  );
  const sendFrequency = useCallback(
    (frequency: number) => send({ type: 'FREQUENCY', frequency }),
    [send],
  );
  const sendName = useCallback(
    (name: string) => send({ type: 'NAME', name }),
    [send],
  );
  useLayoutEffect(() => {
    outbound.current = { sendMessage, sendName, sendFrequency };
  }, [sendMessage, sendName, sendFrequency]);
  const readyState = !enabled
    ? ReadyState.UNINSTANTIATED
    : socketReadyState === ReadyState.OPEN && !confirmed
      ? ReadyState.CONNECTING
      : socketReadyState;
  useEffect(() => {
    if (!enabled || socketReadyState !== ReadyState.OPEN || confirmed) return;
    const timeout = setTimeout(reconnect, HELLO_TIMEOUT_MS);
    return () => clearTimeout(timeout);
  }, [enabled, socketReadyState, confirmed, reconnect]);
  useEffect(() => {
    if (readyState !== ReadyState.OPEN) return;
    const interval = setInterval(() => {
      if (!checkSocket()) return;
      const now = performance.now();
      if (pendingPing.current) {
        if (now - pendingPing.current.sent >= PONG_TIMEOUT_MS) reconnect();
      } else if (now >= nextPingAt.current) {
        const ping = { id: ++pingId.current, sent: now };
        if (send({ type: 'PING', id: ping.id })) {
          pendingPing.current = ping;
          nextPingAt.current = now + PING_INTERVAL_MS;
        }
      }
    }, 250);
    return () => clearInterval(interval);
  }, [readyState, checkSocket, reconnect, send]);
  return {
    sendKey,
    sendCode,
    sendFrequency,
    sendName,
    reconnect,
    readyState,
    lastMessage,
    latency,
  };
}
