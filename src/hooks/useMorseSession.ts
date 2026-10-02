import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import * as Tone from 'tone';
import debounce from 'debounce';
import { ReadyState } from 'react-use-websocket';
import { convertToCode } from '../beep/MorseCodeConverter';
import { parseMorseCode } from '../beep/MorseCodeParser';
import { RemoteVoice } from '../beep/RemoteVoice';
import { ACTIVITY_HANG_MS, MAX_CODE_QUEUE_MS } from '../beep/RemotePlayback';
import { useMorseSocket } from '../network/useMorseSocket';
import type { Operator, ServerMessage } from '../network/protocol';
import { usePreferences } from './usePreferences';
import {
  isValidNamePreference,
  MAX_NAME_LENGTH,
  normalizeName,
} from '../settings/operatorName';

/** Owns audio and network lifecycles independently of the page layout. */
export function useMorseSession(debug = false) {
  const [started, setStarted] = useState(false);
  const startedRef = useRef(false);
  const { preferences, update, updateName } = usePreferences();
  const { volume, wpm, name } = preferences;
  const setVolume = (value: number) => update('volume', value);
  const setWpm = (value: number) => update('wpm', value);
  const [muted, setMuted] = useState(false);
  const effectiveVolume = muted ? 0 : volume;
  const volumeRef = useRef(volume);
  const [notice, setNotice] = useState('');
  const transmittingRef = useRef(false);
  const [transmitting, setTransmitting] = useState(false);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [activeOperatorIds, setActiveOperatorIds] = useState<
    ReadonlySet<string>
  >(() => new Set());
  const operatorsRef = useRef<Operator[]>([]);
  const voicesRef = useRef(new Map<string, RemoteVoice>());
  const [remoteOscillatorIds, setRemoteOscillatorIds] = useState<string[]>([]);
  const [playbackStats, setPlaybackStats] = useState('');
  const timeRef = useRef(0);
  const [myOperatorId, setMyOperatorId] = useState<string>();
  const myIdRef = useRef<string | undefined>(undefined);
  const [myFrequency, setMyFrequency] = useState(preferences.frequency);
  const frequencyRef = useRef(myFrequency);
  const myOscillator = useRef<Tone.Oscillator | undefined>(undefined);
  const localAudioUsed = useRef(false);
  const localTransmissions = useRef<{ start: number; end: number }[]>([]);
  const localKeyActivity = useRef<{ start: number; end: number } | null>(null);

  const syncActivity = useCallback(() => {
    const now = Tone.immediate();
    localTransmissions.current = localTransmissions.current.filter(
      transmission => transmission.end > now,
    );
    const active = new Set<string>();
    for (const [id, voice] of voicesRef.current) {
      if (voice.playback.isActive) active.add(id);
    }
    if (
      myIdRef.current &&
      ((localKeyActivity.current &&
        localKeyActivity.current.start <= now &&
        localKeyActivity.current.end > now) ||
        localTransmissions.current.some(
          transmission => transmission.start <= now,
        ))
    )
      active.add(myIdRef.current);
    setActiveOperatorIds(current =>
      current.size === active.size && [...active].every(id => current.has(id))
        ? current
        : active,
    );
  }, []);

  useLayoutEffect(() => {
    // Audio callbacks must see committed settings before passive effects run.
    volumeRef.current = effectiveVolume;
    frequencyRef.current = myFrequency;
  }, [effectiveVolume, myFrequency]);

  const resetLocalAudio = useCallback(() => {
    // Tone creates a native node for every queued mark. Replacing the voice
    // disconnects all of them; stop() alone only stops the latest node.
    myOscillator.current?.dispose();
    myOscillator.current = startedRef.current
      ? new Tone.Oscillator({
          type: 'sine',
          frequency: frequencyRef.current,
          volume: Tone.gainToDb(volumeRef.current / 100),
        }).toDestination()
      : undefined;
    timeRef.current = 0;
    localAudioUsed.current = false;
    localTransmissions.current = [];
    localKeyActivity.current = null;
  }, []);
  useEffect(() => {
    if (!started) return;
    resetLocalAudio();
    return () => {
      myOscillator.current?.dispose();
      myOscillator.current = undefined;
    };
  }, [started, resetLocalAudio]);
  useEffect(() => {
    myOscillator.current?.set({
      frequency: myFrequency,
      volume: Tone.gainToDb(effectiveVolume / 100),
    });
  }, [started, myFrequency, effectiveVolume]);

  const syncVoices = useCallback(() => {
    const voices = voicesRef.current;
    const peers = startedRef.current
      ? operatorsRef.current.filter(operator => operator.id !== myIdRef.current)
      : [];
    for (const operator of peers) {
      const existing = voices.get(operator.id);
      if (existing) existing.set(operator.frequency, volumeRef.current);
      else
        voices.set(
          operator.id,
          new RemoteVoice(operator.frequency, volumeRef.current),
        );
    }
    for (const [id, voice] of voices) {
      if (!peers.some(operator => operator.id === id)) {
        voice.dispose();
        voices.delete(id);
      }
    }
    setRemoteOscillatorIds([...voices.keys()]);
    syncActivity();
  }, [syncActivity]);
  useEffect(() => {
    syncVoices();
  }, [started, effectiveVolume, syncVoices]);
  useEffect(() => {
    const voices = voicesRef.current;
    const ticker = setInterval(() => {
      voices.forEach(voice => voice.playback.tick());
      syncActivity();
    }, 100);
    return () => {
      clearInterval(ticker);
      voices.forEach(voice => voice.dispose());
      voices.clear();
    };
  }, [syncActivity]);
  useEffect(() => {
    if (!debug) return;
    const voices = voicesRef.current;
    const stats = setInterval(() => {
      setPlaybackStats(
        JSON.stringify(
          [...voices].map(([operator, voice]) => ({
            operator,
            ...voice.playback.stats,
          })),
        ),
      );
    }, 1_000);
    return () => clearInterval(stats);
  }, [debug]);
  const resetConnection = useCallback(() => {
    // Keep an unused startup voice, but disconnect every previously scheduled
    // mark on reset, including a release still inside the audio lookahead.
    if (myOscillator.current && localAudioUsed.current) resetLocalAudio();
    transmittingRef.current = false;
    setTransmitting(false);
    voicesRef.current.forEach(voice => voice.dispose());
    voicesRef.current.clear();
    operatorsRef.current = [];
    setOperators([]);
    setRemoteOscillatorIds([]);
    myIdRef.current = undefined;
    setMyOperatorId(undefined);
    localKeyActivity.current = null;
    localTransmissions.current = [];
    setActiveOperatorIds(new Set());
  }, [resetLocalAudio]);
  const messageHandler = useRef<(message: ServerMessage) => void>(() => {});
  const {
    sendKey,
    sendCode,
    sendFrequency,
    sendName,
    readyState,
    lastMessage,
    latency,
  } = useMorseSocket(
    message => messageHandler.current(message),
    resetConnection,
    started ? { name, frequency: myFrequency } : null,
  );
  useLayoutEffect(() => {
    messageHandler.current = message => {
      switch (message.type) {
        case 'HELLO':
          myIdRef.current = message.operatorId;
          setMyOperatorId(message.operatorId);
          break;
        case 'OPERATORS':
          operatorsRef.current = message.operators;
          setOperators(message.operators);
          syncVoices();
          break;
        case 'KEY':
          voicesRef.current.get(message.operatorId)?.playback.key(message);
          break;
        case 'CODE':
          voicesRef.current.get(message.operatorId)?.playback.code(message);
          break;
      }
    };
  }, [syncVoices]);
  useEffect(() => {
    const context = Tone.getContext();
    const onStateChange = () => {
      if (context.state !== 'running' && startedRef.current) {
        startedRef.current = false;
        setStarted(false);
        setNotice('Audio paused by your browser. Join again to resume.');
        resetConnection();
      }
    };
    context.on('statechange', onStateChange);
    return () => {
      context.off('statechange', onStateChange);
    };
  }, [resetConnection]);
  const scheduleMorseCode = useCallback(
    (code: string) => {
      if (!startedRef.current) return false;
      if (transmittingRef.current) {
        setNotice('Release the key before sending a message.');
        return false;
      }
      if (!code || !/[.-]/.test(code)) {
        setNotice('Enter a message with supported characters.');
        return false;
      }
      const startTime = Math.max(Tone.now(), timeRef.current);
      const parsed = parseMorseCode(startTime, code, wpm);
      if (
        code.length > 2_048 ||
        (startTime + parsed.duration - Tone.now()) * 1_000 > MAX_CODE_QUEUE_MS
      ) {
        setNotice(
          'Message queue full. Wait for playback or send a shorter message.',
        );
        return false;
      }
      localAudioUsed.current = true;
      for (const beep of parsed.beeps)
        myOscillator.current?.start(beep.start)?.stop(beep.stop);
      timeRef.current = startTime + parsed.duration;
      setNotice('');
      return { start: parsed.beeps[0].start, end: timeRef.current };
    },
    [wpm],
  );
  const playMyMorseCode = useCallback(
    (code: string) => Boolean(scheduleMorseCode(code)),
    [scheduleMorseCode],
  );
  const [starting, setStarting] = useState(false);
  const startingRef = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const resolveName = useCallback((value: string) => {
    // An empty preference asks the server for a guest name on each JOIN/NAME.
    const name = normalizeName(value);
    if (!isValidNamePreference(name)) {
      setNotice(
        `Use a name of up to ${MAX_NAME_LENGTH} characters without control characters.`,
      );
      return undefined;
    }
    return name;
  }, []);

  const changeName = useCallback(
    (value: string) => {
      const name = resolveName(value);
      if (name === undefined) return false;
      updateName(name);
      // If disconnected, the next JOIN sends the saved name.
      if (readyState === ReadyState.OPEN) sendName(name);
      setNotice('');
      return true;
    },
    [readyState, resolveName, sendName, updateName],
  );

  const startAudio = useCallback(
    async (value = name) => {
      if (startingRef.current || startedRef.current) return;
      const name = resolveName(value);
      if (name === undefined) return;
      startingRef.current = true;
      setStarting(true);
      try {
        await Tone.start();
        if (mounted.current) {
          updateName(name);
          startedRef.current = true;
          setStarted(true);
          setNotice('');
        }
      } catch {
        if (mounted.current)
          setNotice('Could not enable audio. Please try joining again.');
      } finally {
        startingRef.current = false;
        if (mounted.current) setStarting(false);
      }
    },
    [name, resolveName, updateName],
  );

  const debouncedSendFrequency = useMemo(
    () =>
      debounce((frequency: number) => {
        sendFrequency(frequency);
      }, 300),
    [sendFrequency],
  );

  const changeFrequency = useCallback(
    (frequency: number) => {
      update('frequency', frequency);
      setMyFrequency(frequency);
      debouncedSendFrequency(frequency);
    },
    [debouncedSendFrequency, update],
  );

  const start = useCallback(() => {
    if (!startedRef.current || transmittingRef.current) return false;
    transmittingRef.current = true;
    setTransmitting(true);
    if (timeRef.current > Tone.immediate()) resetLocalAudio();
    const at = Tone.now();
    localAudioUsed.current = true;
    myOscillator.current?.start(at);
    if (!sendKey(true))
      setNotice('Connection unavailable. Your tone is local only.');
    else {
      localKeyActivity.current = {
        start:
          localKeyActivity.current && localKeyActivity.current.end > at
            ? localKeyActivity.current.start
            : at,
        end: Infinity,
      };
      setNotice('');
    }
    syncActivity();
    return true;
  }, [sendKey, resetLocalAudio, syncActivity]);

  const stop = useCallback(() => {
    if (!transmittingRef.current) return;
    transmittingRef.current = false;
    setTransmitting(false);
    const at = Tone.now();
    myOscillator.current?.stop(at);
    if (localKeyActivity.current?.end === Infinity)
      localKeyActivity.current.end = at + ACTIVITY_HANG_MS / 1_000;
    sendKey(false);
    syncActivity();
  }, [sendKey, syncActivity]);

  useEffect(() => {
    const interval = setInterval(() => {
      // A key pressed before registration remains local until pressed again.
      if (transmittingRef.current && localKeyActivity.current?.end === Infinity)
        sendKey(true);
    }, 250);
    return () => clearInterval(interval);
  }, [sendKey]);
  useEffect(
    () => () => debouncedSendFrequency.clear(),
    [debouncedSendFrequency],
  );

  const sendText = (message: string) => {
    const code = convertToCode(message);
    if (readyState !== ReadyState.OPEN) {
      setNotice('Connection unavailable. Reconnect before sending a message.');
      return false;
    }
    const transmission = scheduleMorseCode(code);
    if (!transmission) return false;
    if (!sendCode(code, wpm)) {
      setNotice('Connection unavailable. Your message played locally only.');
      return false;
    }
    localTransmissions.current.push(transmission);
    syncActivity();
    return true;
  };

  const previewTone = () => {
    if (!transmittingRef.current && timeRef.current <= Tone.now()) {
      localAudioUsed.current = true;
      myOscillator.current?.start().stop('+0.2');
    }
  };

  return {
    started,
    starting,
    startAudio,
    name,
    changeName,
    muted,
    toggleMute: () => setMuted(current => !current),
    transmitting,
    start,
    stop,
    volume,
    setVolume,
    wpm,
    setWpm,
    myFrequency,
    changeFrequency,
    previewTone,
    operators,
    activeOperatorIds,
    readyState,
    latency,
    notice,
    playMyMorseCode,
    sendText,
    myOperatorId,
    remoteOscillatorIds,
    playbackStats,
    lastMessage,
  };
}

export type MorseSession = ReturnType<typeof useMorseSession>;
