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

enum MessageType {
  HELLO = "HELLO",
  START = "START",
  STOP = "STOP",
  OPERATORS = "OPERATORS",
  FREQUENCY = "FREQUENCY",
}

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

function App() {
  const [showSettings, setShowSettings] = useState(false);
  const [volume, setVolume] = useState(80);

  const handleVolumeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setVolume(Number(event.target.value));
  };

  const debouncedSendFrequency = useRef(
    debounce((frequency: number) => {
      sendMessage(JSON.stringify({ type: "FREQUENCY", frequency: frequency }));
    }, 300),
  ).current;

  const handleFrequencyChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    setMyFrequency(Number(event.target.value));
    debouncedSendFrequency(Number(event.target.value));
  };

  let [searchParams] = useSearchParams();

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
        });

      return newOscillators;
    });
  }, [operators, volume]);

  const [myOperatorId, setMyOperatorId] = useState<string>();
  const [myFrequency, setMyFrequency] = useState<number>(800);

  const myOscillator = useMemo(
    () =>
      new Tone.Oscillator({
        frequency: myFrequency,
        type: "sine",
        volume: Tone.gainToDb(volume / 100),
      }).toDestination(),
    [myFrequency, volume],
  );
  const { sendMessage, lastMessage, readyState } = useWebSocket(
    `wss://${window.location.hostname}/beep`,
    {
      shouldReconnect: () => true,
      reconnectInterval: (attemptNumber) =>
        Math.min(Math.pow(2, attemptNumber) * 1000, 10000),
    },
  );

  const [unhandledMessage, setUnhandledMessage] = useState<any>(null);

  useEffect(() => {
    if (lastMessage !== null) {
      setUnhandledMessage(JSON.parse(lastMessage.data));
    }
  }, [lastMessage]);

  useEffect(() => {
    if (unhandledMessage !== null) {
      if (unhandledMessage.type === MessageType.START) {
        let oscillator = oscillators.get(unhandledMessage.operatorId);
        oscillator?.stop();
        oscillator?.start();
      } else if (unhandledMessage.type === MessageType.STOP) {
        oscillators.get(unhandledMessage.operatorId)?.stop();
      } else if (unhandledMessage.type === MessageType.HELLO) {
        setMyOperatorId(unhandledMessage.operatorId);
        setMyFrequency(unhandledMessage.frequency);
      } else if (unhandledMessage.type === MessageType.OPERATORS) {
        setOperators(unhandledMessage.operators);
      }
      setUnhandledMessage(null);
    }
  }, [unhandledMessage, myOperatorId, oscillators]);

  const [started, setStarted] = useState(false);

  const startingAudio = useCallback(async () => {
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
    (command: MessageType) => sendMessage(JSON.stringify({ type: command })),
    [sendMessage],
  );

  const onMouseDown = (event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault();
    myOscillator.start();
    send(MessageType.START);
  };

  const onTouchStart = (event: React.TouchEvent<HTMLElement>) => {
    event.preventDefault();
    myOscillator.start();
    send(MessageType.START);
  };

  const onMouseUp = (event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault();
    myOscillator.stop();
    send(MessageType.STOP);
  };

  const onTouchEnd = (event: React.TouchEvent<HTMLElement>) => {
    event.preventDefault();
    myOscillator.stop();
    send(MessageType.STOP);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === " " && !event.repeat) {
      event.preventDefault();
      myOscillator.start();
      send(MessageType.START);
    }
  };

  const onKeyUp = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === " ") {
      event.preventDefault();
      myOscillator.stop();
      send(MessageType.STOP);
    }
  };

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
          <span
            className="dot w-4 h-4 rounded-full"
            style={{ backgroundColor: connectionColor }}
          ></span>
          <SettingsButton onClick={() => setShowSettings(!showSettings)} />
        </div>
        <div className="flex flex-col items-center justify-center flex-grow my-4">
          {!showSettings && (
            <>
              <div
                className="beep"
                onMouseDown={onMouseDown}
                onMouseUp={onMouseUp}
                onTouchStart={onTouchStart}
                onTouchEnd={onTouchEnd}
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
                onMouseUp={() => myOscillator.start().stop("+0.2")}
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
                onMouseUp={() => myOscillator.start().stop("+0.2")}
              />
            </div>
          )}
        </div>
        {debug && (
          <div>
            {!started && <button onClick={startingAudio}>Join</button>}
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
