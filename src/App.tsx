import React, { useCallback, useEffect, useMemo } from "react";
import * as Tone from "tone";
import "./App.css";
import useWebSocket, { ReadyState } from "react-use-websocket";
import { WebSocketHook } from "react-use-websocket/dist/lib/types";

enum Command {
  START = "START",
  STOP = "STOP",
}

function App() {
  const remoteOscillator = useMemo(
    () =>
      new Tone.Oscillator({
        frequency: "1000",
        type: "sine",
      }).toDestination(),
    [],
  );

  const myOscillator = useMemo(
    () =>
      new Tone.Oscillator({
        frequency: "800",
        type: "sine",
      }).toDestination(),
    [],
  );

  const {
    sendMessage,
    lastMessage,
    readyState,
  }: WebSocketHook<string, MessageEvent<string> | null> = useWebSocket(
    "ws://192.168.50.21:8080/beep",
  );

  useEffect(() => {
    if (lastMessage !== null) {
      const message = JSON.parse(lastMessage.data);
      if (message.type === Command.START) {
        remoteOscillator.start();
      } else if (message.type === Command.STOP) {
        remoteOscillator.stop();
      }
    }
  }, [lastMessage, remoteOscillator]);

  // const [started, setStarted] = useState(false);
  //
  // const startingAudio = useCallback(async () => {
  //   await Tone.start();
  //   setStarted(true);
  // }, []);

  const connectionStatus = {
    [ReadyState.CONNECTING]: "Connecting",
    [ReadyState.OPEN]: "Open",
    [ReadyState.CLOSING]: "Closing",
    [ReadyState.CLOSED]: "Closed",
    [ReadyState.UNINSTANTIATED]: "Uninstantiated",
  }[readyState];

  const send = useCallback(
    (command: Command) => sendMessage(JSON.stringify({ type: command })),
    [sendMessage],
  );

  const onMouseDown = (event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault();
    myOscillator.start();
    send(Command.START);
  };

  const onTouchStart = (event: React.TouchEvent<HTMLElement>) => {
    event.preventDefault();
    myOscillator.start();
    send(Command.START);
  };

  const onMouseUp = (event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault();
    myOscillator.stop();
    send(Command.STOP);
  };

  const onTouchEnd = (event: React.TouchEvent<HTMLElement>) => {
    event.preventDefault();
    myOscillator.stop();
    send(Command.STOP);
  };

  return (
    <div className="app">
      {/*{!started && <button onClick={startingAudio}>Join</button>}*/}
      <div className="app-container">
        <div>
          <p>{connectionStatus}</p>
          <p>{lastMessage?.data}</p>
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
