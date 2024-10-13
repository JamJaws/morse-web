import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as Tone from "tone";
import useWebSocket, { ReadyState } from "react-use-websocket";
import { useSearchParams } from "react-router-dom";
import styled from "@emotion/styled"; // TODO delete emotion
import SettingsButton from "./SettingsButton";
import debounce from "debounce";
import { FaBroadcastTower, FaKeyboard } from "react-icons/fa";
import MorseCodeTable from "./beep/MorseCodeTable";
import MorseCodeInput from "./beep/MorseCodeInput";
import { convertToCode } from "./beep/MorseCodeConverter";
import { parseMorseCode } from "./beep/MorseCodeParser";
import Warning from "./components/Warning";

const TARGET_DELAY = 200;

enum MessageType {
  HELLO = "HELLO",
  START = "START",
  STOP = "STOP",
  OPERATORS = "OPERATORS",
  FREQUENCY = "FREQUENCY",
  CODE = "CODE",
}

type Message = {
  type: MessageType;
  [key: string]: any;
};

interface Operator {
  id: string;
  frequency: number;
}

const Main = styled.div`
  :focus {
    outline: none;
  }
`;

const Hint = styled.p`
  color: #d7d3cb;
`;

const millisecondsToSeconds = (diff: number) => diff / 1_000;

function App() {
  const [searchParams] = useSearchParams();

  const [started, setStarted] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showKeys, setShowKeys] = useState(false);
  const [volume, setVolume] = useState(80);
  const [wpm, setWpm] = useState(20);

  const handleVolumeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setVolume(Number(event.target.value));
  };

  const inputReference = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (started) {
      inputReference?.current?.focus();
    }
  }, [started]);

  const [focused, setFocused] = useState(false);
  const onFocus = () => setFocused(true);
  const onBlur = () => setFocused(false);

  const [operators, setOperators] = useState<Operator[]>([]);

  const [oscillators, setOscillators] = useState<Map<string, Tone.Oscillator>>(
    new Map(),
  );
  const [operatorTimes, setOperatorTimes] = useState<{ [key: string]: number }>(
    {},
  );

  const [time, setTime] = useState(Tone.now());

  useEffect(() => {
    setOscillators((prevOscillators) => {
      const newOscillators = new Map(prevOscillators);
      if (started) {
        operators.forEach((operator) => {
          if (!newOscillators.has(operator.id)) {
            const oscillator = new Tone.Oscillator({
              frequency: operator.frequency,
              type: "sine",
              volume: Tone.gainToDb(volume / 100),
            }).toDestination();
            newOscillators.set(operator.id, oscillator);
          } else {
            newOscillators.get(operator.id)?.set({
              frequency: operator.frequency,
              volume: Tone.gainToDb(volume / 100),
            });
          }
        });

        Array.from(newOscillators.keys())
          .filter((key) => !operators.some((operator) => operator.id === key))
          .forEach((key) => {
            newOscillators.get(key)?.stop();
            newOscillators.delete(key);
            // TODO maybe delete diffs here
          });
      }
      return newOscillators;
    });
  }, [started, operators, volume]);

  const [myOperatorId, setMyOperatorId] = useState<string>();
  const [myFrequency, setMyFrequency] = useState<number>(800);

  const myOscillator = useMemo(() => {
    if (started) {
      return new Tone.Oscillator({
        frequency: myFrequency,
        type: "sine",
        volume: Tone.gainToDb(volume / 100),
      }).toDestination();
    }
  }, [started, myFrequency, volume]);

  const { sendMessage, lastMessage, readyState } = useWebSocket(
    `wss://${window.location.hostname}/beep`,
    {
      onMessage: async (event) => {
        handleMessage(JSON.parse(event.data));
      },
      onOpen: () => {
        // TODO send frequency
      },
      shouldReconnect: () => true,
      reconnectInterval: (attemptNumber) =>
        Math.min(Math.pow(2, attemptNumber) * 1000, 10000),
    },
  );

  const [diffs, setDiffs] = useState<Map<string, number>>(new Map());

  const getDelayOffsetDiff = useCallback(
    (operatorId: string, timestamp: number) => {
      const currentDiff = Date.now() - timestamp;
      const delay = TARGET_DELAY + (diffs.get(operatorId)! - currentDiff); // TODO operatorId might not exist
      return `+${millisecondsToSeconds(delay)}`;
    },
    [diffs],
  );

  const playMorseCode = useCallback(
    (operatorId: string, code: string, wpm: number) => {
      const startTime = Math.max(Tone.now(), operatorTimes[operatorId] ?? 0);
      const beeps = parseMorseCode(startTime, code, wpm);

      for (const beep of beeps.beeps) {
        oscillators?.get(operatorId)?.start(beep.start)?.stop(beep.stop);
      }

      setOperatorTimes((prevState) => ({
        ...prevState,
        [operatorId]: startTime + beeps.duration,
      }));
    },
    [oscillators, operatorTimes],
  );

  const playMyMorseCode = useCallback(
    (code: string) => {
      const startTime = Math.max(Tone.now(), time);
      const beeps = parseMorseCode(startTime, code, wpm);
      for (const beep of beeps.beeps) {
        myOscillator?.start(beep.start)?.stop(beep.stop);
      }
      setTime(startTime + beeps.duration);
    },
    [myOscillator, time, wpm],
  );

  const handleMessage = useCallback(
    (message: Message) => {
      if (message.type === MessageType.START) {
        const oscillator = oscillators.get(message.operatorId);

        if (diffs.has(message.operatorId)) {
          const time = getDelayOffsetDiff(
            message.operatorId,
            message.timestamp,
          );
          oscillator?.stop(time);
          oscillator?.start(time);
        } else {
          setDiffs((prevDiffs) => {
            return new Map(prevDiffs).set(
              message.operatorId,
              Date.now() - message.timestamp,
            );
          });
          oscillator?.stop();
          oscillator?.start(`+${millisecondsToSeconds(TARGET_DELAY)}`);
        }
      } else if (message.type === MessageType.STOP) {
        const oscillator = oscillators.get(message.operatorId);
        const time = getDelayOffsetDiff(message.operatorId, message.timestamp);
        oscillator?.stop(time);
      } else if (message.type === MessageType.HELLO) {
        setMyOperatorId(message.operatorId);
        setMyFrequency(message.frequency);
      } else if (message.type === MessageType.OPERATORS) {
        setOperators(message.operators);
      } else if (message.type === MessageType.CODE) {
        playMorseCode(message.operatorId, message.code, message.wpm);
      }
    },
    [oscillators, diffs, getDelayOffsetDiff, playMorseCode],
  );

  const startAudio = useCallback(async () => {
    await Tone.start();
    setStarted(true);
  }, []);

  const connectionStatus = {
    [ReadyState.CONNECTING]: "Connecting",
    [ReadyState.OPEN]: "Open",
    [ReadyState.CLOSING]: "Closing",
    [ReadyState.CLOSED]: "Closed",
    [ReadyState.UNINSTANTIATED]: "Uninstantiated",
  }[readyState];

  const send = useCallback(
    (
      command: MessageType,
      properties: { [key: string]: string | number } = {},
    ) => sendMessage(JSON.stringify({ type: command, ...properties })),
    [sendMessage],
  );

  const debouncedSendFrequency = useMemo(
    () =>
      debounce((frequency: number) => {
        send(MessageType.FREQUENCY, { frequency });
      }, 300),
    [send],
  );

  const handleFrequencyChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setMyFrequency(Number(event.target.value));
      debouncedSendFrequency(Number(event.target.value));
    },
    [debouncedSendFrequency],
  );

  const start = useCallback(
    (event: React.UIEvent<HTMLElement>) => {
      event.preventDefault();
      myOscillator?.start();
      send(MessageType.START, { timestamp: Date.now() });
    },
    [myOscillator, send],
  );

  const stop = useCallback(
    (event: React.UIEvent<HTMLElement>) => {
      event.preventDefault();
      myOscillator?.stop();
      send(MessageType.STOP, { timestamp: Date.now() });
    },
    [myOscillator, send],
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (
        event.key === " " &&
        !event.repeat &&
        event.target instanceof HTMLElement &&
        event.target.tagName !== "INPUT" &&
        event.target.tagName !== "BUTTON"
      ) {
        start(event);
      }
    },
    [start],
  );

  const onKeyUp = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (
        event.key === " " &&
        event.target instanceof HTMLElement &&
        event.target.tagName !== "INPUT" &&
        event.target.tagName !== "BUTTON"
      ) {
        stop(event);
      }
    },
    [stop],
  );

  const sendMorseCode = useCallback(
    (code: string, wpm: number) => {
      send(MessageType.CODE, { code, wpm });
    },
    [send],
  );

  const connectionColor = {
    [ReadyState.CONNECTING]: "yellow",
    [ReadyState.OPEN]: "green",
    [ReadyState.CLOSING]: "red",
    [ReadyState.CLOSED]: "black",
    [ReadyState.UNINSTANTIATED]: "gray",
  }[readyState];

  const debug =
    searchParams.get("debug") === "" || searchParams.get("debug") === "true";
  const tx = searchParams.get("tx") === "" || searchParams.get("tx") === "true";

  return (
    <Main
      className="bg-slate-800 text-white outline-none"
      ref={inputReference}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      tabIndex={0}
      onFocus={onFocus}
      onBlur={onBlur}
    >
      <div className="min-h-screen flex flex-col">
        <div className="top-bar w-full flex justify-between items-center py-2 px-4">
          <div className="flex items-center gap-4">
            <span
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: connectionColor }}
            ></span>
            <p className="text-gray-300">
              {(connectionStatus === "Open" && operators.length) || "~"}
            </p>
          </div>
          <div className="flex items-stretch gap-2">
            {started && (
              <button
                onClick={() => setShowKeys(!showKeys)}
                className="flex aspect-square min-w-[2.5rem] items-center justify-center text-gray-400 p-2 gap-2 rounded hover:bg-gray-600"
              >
                <FaKeyboard />
              </button>
            )}
            <SettingsButton onClick={() => setShowSettings(!showSettings)} />
          </div>
        </div>
        <div className="flex flex-col items-center justify-center flex-grow my-4">
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
              {!focused && <Hint>use mouse</Hint>}
              {focused && <Hint>use mouse or spacebar space</Hint>}

              {showKeys && (
                <>
                  <div className="h-16" />
                  <MorseCodeTable
                    onClick={(character) => playMyMorseCode(character.code)}
                  />
                </>
              )}
              {tx && (
                <>
                  <div className="h-16" />
                  <MorseCodeInput
                    onSend={(message: string) => {
                      const code = convertToCode(message);
                      playMyMorseCode(code);
                      sendMorseCode(code, wpm);
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
                  onMouseUp={() => myOscillator?.start().stop("+0.2")}
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
                  onMouseUp={() => myOscillator?.start().stop("+0.2")}
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
                  onChange={(e) => setWpm(Number(e.target.value))}
                />
                <span className="self-center">{wpm}</span>
              </div>
            </div>
          )}
        </div>
        {debug && (
          <div>
            {!started && <button onClick={startAudio}>Join</button>}
            <p>{connectionStatus}</p>
            <p>my operator id: {myOperatorId}</p>
            <p>lastMessage: {lastMessage?.data}</p>
            <p>
              remote oscillators: {Array.from(oscillators.keys())?.join(", ")}
            </p>
          </div>
        )}
      </div>
    </Main>
  );
}

export default App;
