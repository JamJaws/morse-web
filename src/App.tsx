import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as Tone from "tone";
import "./App.css";
import useWebSocket, { ReadyState } from "react-use-websocket";
import { useSearchParams } from "react-router-dom";
import styled from "@emotion/styled"; // TODO delete emotion
import SettingsButton from "./SettingsButton";
import debounce from "debounce";
import { FaBroadcastTower, FaExclamationTriangle } from "react-icons/fa";

const TARGET_DELAY = 200;

enum MessageType {
  HELLO = "HELLO",
  START = "START",
  STOP = "STOP",
  OPERATORS = "OPERATORS",
  FREQUENCY = "FREQUENCY",
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
  const [volume, setVolume] = useState(80);

  const handleVolumeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setVolume(Number(event.target.value));
  };

  const inputReference = useRef<any>(null);

  useEffect(() => {
    inputReference?.current?.focus();
  }, []);

  const [focused, setFocused] = useState(false);
  const onFocus = () => setFocused(true);
  const onBlur = () => setFocused(false);

  const [operators, setOperators] = useState<Operator[]>([]);

  const [oscillators, setOscillators] = useState<Map<string, Tone.Oscillator>>(
    new Map(),
  );

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
      }
    },
    [diffs, oscillators, getDelayOffsetDiff],
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
      if (event.key === " " && !event.repeat) {
        start(event);
      }
    },
    [start],
  );

  const onKeyUp = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === " ") {
        stop(event);
      }
    },
    [stop],
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

  return (
    <Main
      className="app"
      ref={inputReference}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      tabIndex={0}
      onFocus={onFocus}
      onBlur={onBlur}
    >
      <div className="h-screen flex flex-col">
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
          <SettingsButton onClick={() => setShowSettings(!showSettings)} />
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
              <div className="flex items-center text-yellow-400 text-sm">
                <FaExclamationTriangle className="mr-1" />
                <span>You may hear tones when pressing the button</span>
              </div>
            </div>
          )}
          {started && !showSettings && (
            <>
              <div
                className="beep"
                onMouseDown={start}
                onMouseUp={stop}
                onTouchStart={start}
                onTouchEnd={stop}
              >
                <p>beep beep beep</p>
              </div>
              {!focused && <Hint>use mouse</Hint>}
              {focused && <Hint>use mouse or spacebar space</Hint>}
            </>
          )}
          {showSettings && (
            <div className="flex flex-col items-center justify-center">
              <p>Settings</p>
              <label htmlFor="volume" className="text-white">
                Volume: {volume}
              </label>
              <input
                id="volume"
                type="range"
                min="0"
                max="100"
                value={volume}
                onChange={handleVolumeChange}
                onMouseUp={() => myOscillator?.start().stop("+0.2")}
              />
              <label htmlFor="frequency" className="text-white">
                Frequency: {myFrequency}
              </label>
              <input
                id="frequency"
                type="range"
                min="600"
                max="1000"
                value={myFrequency}
                onChange={handleFrequencyChange}
                onMouseUp={() => myOscillator?.start().stop("+0.2")}
              />
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
