import { useState } from 'react';
import { ReadyState } from 'react-use-websocket';
import { useSearchParams } from 'react-router-dom';
import { FaBroadcastTower, FaKeyboard } from 'react-icons/fa';
import SettingsButton from './SettingsButton';
import MorseCodeTable from './beep/MorseCodeTable';
import MorseCodeInput from './beep/MorseCodeInput';
import Warning from './components/Warning';
import { MorseKey } from './components/MorseKey';
import { DebugPanel } from './components/DebugPanel';
import { useMorseSession } from './hooks/useMorseSession';
import { useMorseKey } from './hooks/useMorseKey';

function App() {
  const [searchParams] = useSearchParams();
  const debug =
    searchParams.get('debug') === '' || searchParams.get('debug') === 'true';
  const tx = searchParams.get('tx') === '' || searchParams.get('tx') === 'true';
  const session = useMorseSession(debug);
  const [showSettings, setShowSettings] = useState(false);
  const [showKeys, setShowKeys] = useState(false);
  const input = useMorseKey(
    session.started && !showSettings,
    session.start,
    session.stop,
  );
  const connectionColor = {
    [ReadyState.CONNECTING]: 'yellow',
    [ReadyState.OPEN]: 'green',
    [ReadyState.CLOSING]: 'red',
    [ReadyState.CLOSED]: 'black',
    [ReadyState.UNINSTANTIATED]: 'gray',
  }[session.readyState];

  return (
    <main
      className="bg-slate-800 text-white focus-visible:outline-2 focus-visible:outline-blue-400"
      onKeyDown={input.onKeyDown}
      onBlur={input.cancel}
      tabIndex={0}
    >
      <div className="min-h-screen flex flex-col">
        <div className="w-full flex justify-between items-center py-2 px-4">
          <div className="flex items-center justify-center gap-4">
            <div className="relative flex items-center group">
              <span
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: connectionColor }}
              />
              {session.readyState === ReadyState.OPEN && (
                <div
                  role="tooltip"
                  className="absolute z-10 invisible inline-block px-3 py-1.5 text-sm font-medium text-white transition-opacity duration-300 bg-gray-900 rounded-lg shadow-sm opacity-0 group-hover:visible group-hover:opacity-100 top-full mt-2 whitespace-nowrap"
                >
                  {session.latency} ms
                </div>
              )}
            </div>
            <p className="text-gray-300">
              {(session.readyState === ReadyState.OPEN &&
                session.operators.length) ||
                '~'}
            </p>
          </div>
          <div className="flex items-stretch gap-2">
            {session.started && (
              <button
                type="button"
                aria-label="Morse reference"
                aria-expanded={showKeys}
                aria-controls="morse-reference"
                onClick={() => setShowKeys(!showKeys)}
                className="flex aspect-square min-w-10 items-center justify-center text-gray-400 p-2 gap-2 rounded hover:bg-gray-600 focus-visible:outline-2 focus-visible:outline-blue-400"
              >
                <FaKeyboard aria-hidden="true" />
              </button>
            )}
            <SettingsButton
              expanded={showSettings}
              onClick={() => setShowSettings(!showSettings)}
            />
          </div>
        </div>
        <div className="flex flex-col items-center justify-center grow my-4">
          {!session.started && !showSettings && (
            <div className="flex flex-col items-center justify-center gap-2">
              <button
                type="button"
                className="bg-gray-300 text-gray-800 text-lg rounded-full px-4 py-2 hover:bg-gray-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 flex items-center gap-2"
                onClick={session.startAudio}
              >
                <FaBroadcastTower aria-hidden="true" />
                <span>Join</span>
              </button>
              <Warning text="You may hear tones when pressing the button" />
            </div>
          )}
          {session.started && !showSettings && (
            <>
              <MorseKey transmitting={session.transmitting} input={input} />
              <p id="morse-key-help" className="text-hint">
                Hold to transmit · Space or Enter on the key
              </p>
              {showKeys && (
                <section id="morse-reference" className="mt-16">
                  <MorseCodeTable
                    onClick={character =>
                      session.playMyMorseCode(character.code)
                    }
                  />
                </section>
              )}
              {tx && (
                <div className="mt-16 w-full flex justify-center">
                  <MorseCodeInput onSend={session.sendText} />
                </div>
              )}
            </>
          )}
          {showSettings && (
            <section
              id="settings"
              aria-label="Settings"
              className="w-2/3 sm:w-1/2 md:w-1/3 flex flex-col gap-2"
            >
              <div className="flex flex-col">
                <label htmlFor="volume">Volume</label>
                <input
                  id="volume"
                  type="range"
                  min="0"
                  max="100"
                  value={session.volume}
                  onChange={event =>
                    session.setVolume(Number(event.target.value))
                  }
                  onPointerUp={session.previewTone}
                />
                <span className="self-center">{session.volume}</span>
              </div>
              <div className="flex flex-col">
                <label htmlFor="frequency">Frequency</label>
                <input
                  id="frequency"
                  type="range"
                  min="400"
                  max="1000"
                  value={session.myFrequency}
                  onChange={event =>
                    session.changeFrequency(Number(event.target.value))
                  }
                  onPointerUp={session.previewTone}
                />
                <span className="self-center">{session.myFrequency}</span>
              </div>
              <div className="flex flex-col">
                <label htmlFor="wpm">WPM</label>
                <input
                  id="wpm"
                  type="range"
                  min="4"
                  max="40"
                  value={session.wpm}
                  onChange={event => session.setWpm(Number(event.target.value))}
                />
                <span className="self-center">{session.wpm}</span>
              </div>
            </section>
          )}
        </div>
        {session.notice && (
          <p role="status" className="text-center p-2">
            {session.notice}
          </p>
        )}
        {debug && <DebugPanel session={session} />}
      </div>
    </main>
  );
}

export default App;
