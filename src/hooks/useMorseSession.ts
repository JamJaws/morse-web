import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Tone from 'tone';
import debounce from 'debounce';
import { ReadyState } from 'react-use-websocket';
import { convertToCode } from '../beep/MorseCodeConverter';
import { parseMorseCode } from '../beep/MorseCodeParser';
import { RemoteVoice } from '../beep/RemoteVoice';
import { MAX_CODE_QUEUE_MS } from '../beep/RemotePlayback';
import { useMorseSocket } from '../network/useMorseSocket';
import type { Operator, ServerMessage } from '../network/protocol';
import { usePreferences } from './usePreferences';

/** Owns audio and network lifecycles independently of the page layout. */
export function useMorseSession(debug = false) {
  const [started, setStarted] = useState(false);
  const startedRef = useRef(false);
  const { preferences, update } = usePreferences();
  const { volume, wpm } = preferences;
  const setVolume = (value: number) => update('volume', value);
  const setWpm = (value: number) => update('wpm', value);
  const [muted, setMuted] = useState(false);
  const effectiveVolume = muted ? 0 : volume;
  const volumeRef = useRef(volume);
  volumeRef.current = effectiveVolume;
  const [notice, setNotice] = useState('');
  const transmittingRef = useRef(false);
  const [transmitting, setTransmitting] = useState(false);
  const [operators, setOperators] = useState<Operator[]>([]);
  const operatorsRef = useRef<Operator[]>([]);
  const voicesRef = useRef(new Map<string, RemoteVoice>());
  const [remoteOscillatorIds, setRemoteOscillatorIds] = useState<string[]>([]);
  const [playbackStats, setPlaybackStats] = useState('');
  const timeRef = useRef(0);
  const [myOperatorId, setMyOperatorId] = useState<string>();
  const myIdRef = useRef<string | undefined>(undefined);
  const [myFrequency, setMyFrequency] = useState(preferences.frequency ?? 800);
  const frequencyRef = useRef(myFrequency);
  frequencyRef.current = myFrequency;
  const preferredFrequency = useRef<number | undefined>(
    preferences.frequency ?? undefined,
  );
  const myOscillator = useRef<Tone.Oscillator | undefined>(undefined);

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
  }, []);
  useEffect(() => {
    syncVoices();
  }, [started, effectiveVolume, syncVoices]);
  useEffect(() => {
    const voices = voicesRef.current;
    const ticker = setInterval(() => {
      voices.forEach(voice => voice.playback.tick());
    }, 100);
    return () => {
      clearInterval(ticker);
      voices.forEach(voice => voice.dispose());
      voices.clear();
    };
  }, []);
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
    transmittingRef.current = false;
    setTransmitting(false);
    if (myOscillator.current) resetLocalAudio();
    voicesRef.current.forEach(voice => voice.dispose());
    voicesRef.current.clear();
    operatorsRef.current = [];
    setOperators([]);
    setRemoteOscillatorIds([]);
    myIdRef.current = undefined;
    setMyOperatorId(undefined);
  }, [resetLocalAudio]);
  const messageHandler = useRef<(message: ServerMessage) => void>(() => {});
  const {
    sendKey,
    sendCode,
    sendFrequency,
    reconnect,
    readyState,
    lastMessage,
    latency,
  } = useMorseSocket(
    message => messageHandler.current(message),
    resetConnection,
  );
  messageHandler.current = message => {
    switch (message.type) {
      case 'HELLO':
        myIdRef.current = message.operatorId;
        setMyOperatorId(message.operatorId);
        preferredFrequency.current ??= message.frequency;
        setMyFrequency(preferredFrequency.current);
        sendFrequency(preferredFrequency.current);
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
  useEffect(() => {
    const context = Tone.getContext();
    const onStateChange = () => {
      if (context.state !== 'running' && startedRef.current) {
        startedRef.current = false;
        setStarted(false);
        setNotice('Audio paused by your browser. Join again to resume.');
        reconnect();
      }
    };
    context.on('statechange', onStateChange);
    return () => {
      context.off('statechange', onStateChange);
    };
  }, [reconnect]);
  const playMyMorseCode = useCallback(
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
      for (const beep of parsed.beeps)
        myOscillator.current?.start(beep.start)?.stop(beep.stop);
      timeRef.current = startTime + parsed.duration;
      setNotice('');
      return true;
    },
    [wpm],
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
  const startAudio = useCallback(async () => {
    if (startingRef.current || startedRef.current) return;
    startingRef.current = true;
    setStarting(true);
    try {
      await Tone.start();
      if (mounted.current) {
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
  }, []);

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
      preferredFrequency.current = frequency;
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
    myOscillator.current?.start();
    if (!sendKey(true))
      setNotice('Connection unavailable. Your tone is local only.');
    else setNotice('');
    return true;
  }, [sendKey, resetLocalAudio]);

  const stop = useCallback(() => {
    if (!transmittingRef.current) return;
    transmittingRef.current = false;
    setTransmitting(false);
    myOscillator.current?.stop();
    sendKey(false);
  }, [sendKey]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (transmittingRef.current) sendKey(true);
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
    if (!playMyMorseCode(code)) return false;
    if (!sendCode(code, wpm)) {
      setNotice('Connection unavailable. Your message played locally only.');
      return false;
    }
    return true;
  };

  const previewTone = () => {
    if (!transmittingRef.current && timeRef.current <= Tone.now())
      myOscillator.current?.start().stop('+0.2');
  };

  return {
    started,
    starting,
    startAudio,
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
