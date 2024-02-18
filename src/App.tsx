import React, { useCallback, useEffect, useMemo, useState } from "react";
import * as Tone from "tone";
import "./App.css";
import useWebSocket, { ReadyState } from "react-use-websocket";

enum MessageType {
  HELLO = "HELLO",
  START = "START",
  STOP = "STOP",
  OPERATORS = "OPERATORS",
}

const getOscillator = () =>
  new Tone.Oscillator({
    frequency: "1000",
    type: "sine",
  }).toDestination();

function App() {
  const [oscillators, setOscillators] = useState(
    new Map<string, Tone.Oscillator>(),
  );

  const myOscillator = useMemo(
    () =>
      new Tone.Oscillator({
        frequency: "800",
        type: "sine",
        volume: -10,
      }).toDestination(),
    [],
  );
  const { sendMessage, lastMessage, readyState } = useWebSocket(
    `wss://${window.location.hostname}/beep`,
  );

  const [unhandledMessage, setUnhandledMessage] = useState<any>(null);

  useEffect(() => {
    if (lastMessage !== null) {
      setUnhandledMessage(JSON.parse(lastMessage.data));
    }
  }, [lastMessage]);

  const [myOperatorId, setMyOperatorId] = useState<string>();

  useEffect(() => {
    if (unhandledMessage !== null) {
      if (unhandledMessage.type === MessageType.START) {
        oscillators.get(unhandledMessage.operatorId)?.start();
      } else if (unhandledMessage.type === MessageType.STOP) {
        oscillators.get(unhandledMessage.operatorId)?.stop();
      } else if (unhandledMessage.type === MessageType.HELLO) {
        setMyOperatorId(unhandledMessage.operatorId);
      } else if (unhandledMessage.type === MessageType.OPERATORS) {
        oscillators.forEach((oscillator) => oscillator.stop());

        const operatorIds: [string] = unhandledMessage.operators.map(
          (operator: { id: string }) => operator.id,
        );

        setOscillators((prevState) => {
          const newState = new Map(prevState);

          operatorIds
            .filter((id) => !newState.has(id))
            .filter((id) => id !== myOperatorId)
            .forEach((id) => newState.set(id, getOscillator()));

          Array.from(newState.keys())
            .filter((key) => !operatorIds.includes(key))
            .forEach((key) => newState.delete(key));
          return newState;
        });
      }
      setUnhandledMessage(null);
    }
  }, [unhandledMessage, oscillators, myOperatorId]);

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

  const connectionColor = {
    [ReadyState.CONNECTING]: "yellow",
    [ReadyState.OPEN]: "green",
    [ReadyState.CLOSING]: "red",
    [ReadyState.CLOSED]: "black",
    [ReadyState.UNINSTANTIATED]: "gray",
  }[readyState];

  return (
    <div className="app">
      {!started && <button onClick={startingAudio}>Join</button>}
      <div className="app-container">
        <div>
          <span
            className="dot"
            style={{ backgroundColor: connectionColor }}
          ></span>
          <p>{connectionStatus}</p>
          <p>my operator id: {myOperatorId}</p>
          <p>lastMessage: {lastMessage?.data}</p>
          <p>
            remote oscillators: {Array.from(oscillators.keys())?.join(", ")}
          </p>
        </div>
        <div className="beep-container">
          <div
            className="beep"
            onMouseDown={onMouseDown}
            onMouseUp={onMouseUp}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            <p>beep beep beep</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
