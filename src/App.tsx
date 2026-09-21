import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import * as Tone from 'tone';
import { ReadyState } from 'react-use-websocket';
import { useSearchParams } from 'react-router-dom';
import SettingsButton from './SettingsButton';
import debounce from 'debounce';
import { FaBroadcastTower, FaKeyboard } from 'react-icons/fa';
import MorseCodeTable from './beep/MorseCodeTable';
import MorseCodeInput from './beep/MorseCodeInput';
import { convertToCode } from './beep/MorseCodeConverter';
import { parseMorseCode } from './beep/MorseCodeParser';
import { RemoteVoice } from './beep/RemoteVoice';
import { MAX_CODE_QUEUE_MS } from './beep/RemotePlayback';
import { useMorseSocket } from './network/useMorseSocket';
import type { Operator, ServerMessage } from './network/protocol';
import Warning from './components/Warning';

function App() {
  const [searchParams] = useSearchParams();
  const [started, setStarted] = useState(false);
  const startedRef = useRef(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showKeys, setShowKeys] = useState(false);
  const [volume, setVolume] = useState(80);
  const volumeRef = useRef(volume);
  volumeRef.current = volume;
  const [wpm, setWpm] = useState(20);
  const [notice, setNotice] = useState('');
  const handleVolumeChange = (event: React.ChangeEvent<HTMLInputElement>) =>
    setVolume(Number(event.target.value));
  const inputReference = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (started) inputReference.current?.focus();
  }, [started]);
  const [focused, setFocused] = useState(false);
  const onFocus = () => setFocused(true);
  const onBlur = () => {
    setFocused(false);
    stop();
  };
  const transmittingRef = useRef(false);
  const [operators, setOperators] = useState<Operator[]>([]);
  const operatorsRef = useRef<Operator[]>([]);
  const voicesRef = useRef(new Map<string, RemoteVoice>());
  const [remoteOscillatorIds, setRemoteOscillatorIds] = useState<string[]>([]);
  const [playbackStats, setPlaybackStats] = useState('');
  const timeRef = useRef(0);
  const [myOperatorId, setMyOperatorId] = useState<string>();
  const myIdRef = useRef<string | undefined>(undefined);
  const [myFrequency, setMyFrequency] = useState(800);
  const frequencyRef = useRef(myFrequency);
  frequencyRef.current = myFrequency;
  const preferredFrequency = useRef<number | undefined>(undefined);
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
      volume: Tone.gainToDb(volume / 100),
    });
  }, [started, myFrequency, volume]);

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
  }, [started, volume, syncVoices]);
  useEffect(() => {
    const voices = voicesRef.current;
    const ticker = setInterval(() => {
      voices.forEach(voice => voice.playback.tick());
    }, 100);
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
    return () => {
      clearInterval(ticker);
      clearInterval(stats);
      voices.forEach(voice => voice.dispose());
      voices.clear();
    };
  }, []);
  const resetConnection = useCallback(() => {
    transmittingRef.current = false;
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
  const startAudio = useCallback(async () => {
    await Tone.start();
    startedRef.current = true;
    setStarted(true);
  }, []);

  const connectionStatus = {
    [ReadyState.CONNECTING]: 'Connecting',
    [ReadyState.OPEN]: 'Open',
    [ReadyState.CLOSING]: 'Closing',
    [ReadyState.CLOSED]: 'Closed',
    [ReadyState.UNINSTANTIATED]: 'Uninstantiated',
  }[readyState];

  const debouncedSendFrequency = useMemo(
    () =>
      debounce((frequency: number) => {
        sendFrequency(frequency);
      }, 300),
    [sendFrequency],
  );

  const handleFrequencyChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      preferredFrequency.current = Number(event.target.value);
      setMyFrequency(Number(event.target.value));
      debouncedSendFrequency(Number(event.target.value));
    },
    [debouncedSendFrequency],
  );

  const start = useCallback(
    (event: React.UIEvent<HTMLElement>) => {
      if (!started || transmittingRef.current) {
        return;
      }
      transmittingRef.current = true;
      event.preventDefault();
      if (timeRef.current > Tone.immediate()) resetLocalAudio();
      myOscillator.current?.start();
      if (!sendKey(true))
        setNotice('Connection unavailable. Your tone is local only.');
    },
    [sendKey, started, resetLocalAudio],
  );

  const stop = useCallback(
    (event?: React.UIEvent<HTMLElement>) => {
      if (!transmittingRef.current) {
        return;
      }
      transmittingRef.current = false;
      event?.preventDefault();
      myOscillator.current?.stop();
      sendKey(false);
    },
    [sendKey],
  );

  useEffect(() => {
    const stopTransmission = () => stop();
    const releaseSpace = (event: KeyboardEvent) => {
      if (event.key === ' ') {
        stop();
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        stop();
      }
    };

    // Capture releases even if focus moved or another control handles the event.
    window.addEventListener('keyup', releaseSpace, true);
    window.addEventListener('blur', stopTransmission);
    window.addEventListener('mouseup', stopTransmission, true);
    window.addEventListener('touchend', stopTransmission, true);
    window.addEventListener('touchcancel', stopTransmission, true);
    window.addEventListener('pointercancel', stopTransmission, true);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.removeEventListener('keyup', releaseSpace, true);
      window.removeEventListener('blur', stopTransmission);
      window.removeEventListener('mouseup', stopTransmission, true);
      window.removeEventListener('touchend', stopTransmission, true);
      window.removeEventListener('touchcancel', stopTransmission, true);
      window.removeEventListener('pointercancel', stopTransmission, true);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      stop();
    };
  }, [stop]);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (
        event.key === ' ' &&
        !event.repeat &&
        event.target instanceof HTMLElement &&
        event.target.tagName !== 'INPUT' &&
        event.target.tagName !== 'BUTTON'
      ) {
        start(event);
      }
    },
    [start],
  );

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

  const connectionColor = {
    [ReadyState.CONNECTING]: 'yellow',
    [ReadyState.OPEN]: 'green',
    [ReadyState.CLOSING]: 'red',
    [ReadyState.CLOSED]: 'black',
    [ReadyState.UNINSTANTIATED]: 'gray',
  }[readyState];

  const debug =
    searchParams.get('debug') === '' || searchParams.get('debug') === 'true';
  const tx = searchParams.get('tx') === '' || searchParams.get('tx') === 'true';

  return (
    <div
      className="bg-slate-800 text-white outline-none"
      ref={inputReference}
      onKeyDown={onKeyDown}
      tabIndex={0}
      onFocus={onFocus}
      onBlur={onBlur}
    >
      <div className="min-h-screen flex flex-col">
        <div className="top-bar w-full flex justify-between items-center py-2 px-4">
          <div className="flex items-center justify-center gap-4">
            <div className="relative flex items-center group">
              <span
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: connectionColor }}
              />
              {readyState === ReadyState.OPEN && (
                <div
                  role="tooltip"
                  className="absolute z-10 invisible inline-block px-3 py-1.5 text-sm font-medium text-white transition-opacity duration-300 bg-gray-900 rounded-lg shadow-sm opacity-0 group-hover:visible group-hover:opacity-100 dark:bg-gray-700 transform top-full mt-2 whitespace-nowrap"
                >
                  {latency} ms
                </div>
              )}
            </div>
            <p className="text-gray-300">
              {(connectionStatus === 'Open' && operators.length) || '~'}
            </p>
          </div>
          <div className="flex items-stretch gap-2">
            {started && (
              <button
                onClick={() => setShowKeys(!showKeys)}
                className="flex aspect-square min-w-10 items-center justify-center text-gray-400 p-2 gap-2 rounded hover:bg-gray-600"
              >
                <FaKeyboard />
              </button>
            )}
            <SettingsButton onClick={() => setShowSettings(!showSettings)} />
          </div>
        </div>
        <div className="flex flex-col items-center justify-center grow my-4">
          {!started && !showSettings && (
            <div className="flex flex-col items-center justify-center gap-2">
              <button
                className="bg-gray-300 text-gray-800 text-lg rounded-full px-4 py-2 hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center gap-2"
                onClick={startAudio}
              >
                <FaBroadcastTower />
                <span>Join</span>
              </button>
              <Warning text="You may hear tones when pressing the button" />
            </div>
          )}
          {started && !showSettings && (
            <>
              <button
                className="text-[calc(12px+2vmin)] bg-slate-700 aspect-square min-w-[80vmin] sm:min-w-[65vmin] md:min-w-[50vmin] rounded-3xl gap-3 transition duration-300 ease-in-out hover:bg-slate-600 hover:shadow-lg"
                onMouseDown={start}
                onMouseUp={stop}
                onMouseLeave={stop}
                onTouchStart={start}
                onTouchEnd={stop}
              >
                <p>beep beep beep</p>
              </button>
              {!focused && <p className="text-hint">use mouse</p>}
              {focused && (
                <p className="text-hint">use mouse or spacebar space</p>
              )}

              {showKeys && (
                <>
                  <div className="h-16" />
                  <MorseCodeTable
                    onClick={character => playMyMorseCode(character.code)}
                  />
                </>
              )}
              {tx && (
                <>
                  <div className="h-16" />
                  <MorseCodeInput
                    onSend={(message: string) => {
                      const code = convertToCode(message);
                      if (readyState !== ReadyState.OPEN) {
                        setNotice(
                          'Connection unavailable. Reconnect before sending a message.',
                        );
                        return false;
                      }
                      if (!playMyMorseCode(code)) return false;
                      if (!sendCode(code, wpm)) {
                        setNotice(
                          'Connection unavailable. Your message played locally only.',
                        );
                        return false;
                      }
                      return true;
                    }}
                  ></MorseCodeInput>
                </>
              )}
            </>
          )}
          {showSettings && (
            <div className="w-2/3 sm:w-1/2 md:w-1/3 flex flex-col gap-2">
              <div className="flex flex-col">
                <label htmlFor="volume">Volume</label>
                <input
                  id="volume"
                  type="range"
                  min="0"
                  max="100"
                  value={volume}
                  onChange={handleVolumeChange}
                  onMouseUp={() => myOscillator.current?.start().stop('+0.2')}
                />
                <span className="self-center">{volume}</span>
              </div>
              <div className="flex flex-col">
                <label htmlFor="frequency">Frequency</label>
                <input
                  id="frequency"
                  type="range"
                  min="400"
                  max="1000"
                  value={myFrequency}
                  onChange={handleFrequencyChange}
                  onMouseUp={() => myOscillator.current?.start().stop('+0.2')}
                />
                <span className="self-center">{myFrequency}</span>
              </div>
              <div className="flex flex-col">
                <label htmlFor="wpm">WPM</label>
                <input
                  id="wpm"
                  type="range"
                  min="4"
                  max="40"
                  value={wpm}
                  onChange={e => setWpm(Number(e.target.value))}
                />
                <span className="self-center">{wpm}</span>
              </div>
            </div>
          )}
        </div>
        {notice && (
          <p role="status" className="text-center p-2">
            {notice}
          </p>
        )}
        {debug && (
          <div>
            {!started && <button onClick={startAudio}>Join</button>}
            <p>{connectionStatus}</p>
            <p>my operator id: {myOperatorId}</p>
            <p>lastMessage: {lastMessage?.data}</p>
            <p>remote oscillators: {remoteOscillatorIds.join(', ')}</p>
            <p>playback: {playbackStats}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
