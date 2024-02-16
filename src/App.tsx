import React from "react";
import * as Tone from "tone";
import "./App.css";

function App() {
  const oscillator = new Tone.Oscillator({
    frequency: "1000",
    type: "sine",
  }).toDestination();

  const onMouseDown = () => {
    oscillator.start();
  };
  const onMouseUp = () => {
    oscillator.stop();
  };

  return (
    <div className="app">
      <div className="beep-container">
        <div className="beep" onMouseDown={onMouseDown} onMouseUp={onMouseUp}>
          <p>beep beep beep</p>
        </div>
      </div>
    </div>
  );
}

export default App;
