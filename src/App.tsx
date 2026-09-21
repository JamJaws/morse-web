import { useState } from 'react';
import { ReadyState } from 'react-use-websocket';
import { useSearchParams } from 'react-router-dom';
import {
  FaBroadcastTower,
  FaKeyboard,
  FaSlidersH,
  FaVolumeMute,
  FaVolumeUp,
} from 'react-icons/fa';
import MorseCodeTable from './beep/MorseCodeTable';
import MorseCodeInput from './beep/MorseCodeInput';
import { MorseKey } from './components/MorseKey';
import { DebugPanel } from './components/DebugPanel';
import { ConnectionStatus } from './components/ConnectionStatus';
import { SettingsPanel } from './components/SettingsPanel';
import { Button } from './components/ui/Button';
import { useMorseSession } from './hooks/useMorseSession';
import { useMorseKey } from './hooks/useMorseKey';

function App() {
  const [searchParams] = useSearchParams();
  const debug =
    searchParams.get('debug') === '' || searchParams.get('debug') === 'true';
  const session = useMorseSession(debug);
  const [showSettings, setShowSettings] = useState(false);
  const [panel, setPanel] = useState<'reference' | 'message' | null>(() =>
    searchParams.get('tx') === '' || searchParams.get('tx') === 'true'
      ? 'message'
      : null,
  );
  const input = useMorseKey(
    session.started && !showSettings,
    session.start,
    session.stop,
  );
  const connected = session.readyState === ReadyState.OPEN;

  return (
    <div
      className="flex min-h-dvh flex-col bg-canvas text-ink focus-visible:outline-2 focus-visible:outline-accent"
      onKeyDown={input.onKeyDown}
      onBlur={input.cancel}
      tabIndex={-1}
    >
      <header className="relative z-10 border-b border-stroke/60">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <FaBroadcastTower
              aria-hidden="true"
              className="text-xl text-accent"
            />
            <h1 className="text-xl font-semibold tracking-tight">
              Morse<span className="text-accent">.</span>
            </h1>
          </div>
          <div
            role="group"
            aria-label="Session controls"
            className="flex flex-wrap items-center gap-1 sm:gap-2"
          >
            <ConnectionStatus
              readyState={session.readyState}
              operators={session.operators.length}
              latency={session.latency}
            />
            {session.started && (
              <Button
                variant="ghost"
                aria-label={session.muted ? 'Unmute sound' : 'Mute sound'}
                onClick={session.toggleMute}
              >
                {session.muted ? (
                  <FaVolumeMute aria-hidden="true" />
                ) : (
                  <FaVolumeUp aria-hidden="true" />
                )}
                <span>{session.muted ? 'Unmute' : 'Mute'}</span>
              </Button>
            )}
            <Button
              variant={showSettings ? 'secondary' : 'ghost'}
              aria-expanded={showSettings}
              aria-controls="settings"
              onClick={() => setShowSettings(current => !current)}
            >
              <FaSlidersH aria-hidden="true" />
              <span>Settings</span>
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-5xl grow flex-col justify-center px-4 py-8 sm:px-6 sm:py-12">
        {showSettings ? (
          <SettingsPanel
            session={session}
            onClose={() => setShowSettings(false)}
          />
        ) : (
          <>
            {!session.started ? (
              <section
                className="mx-auto flex max-w-lg flex-col items-center py-12 text-center sm:py-16"
                aria-labelledby="welcome-heading"
              >
                <p className="mb-5 font-mono text-xs uppercase tracking-[0.2em] text-accent">
                  Live Morse channel
                </p>
                <h2
                  id="welcome-heading"
                  className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl"
                >
                  A conversation in
                  <br />
                  dots and dashes.
                </h2>
                <p className="mt-6 max-w-sm text-base leading-relaxed text-muted">
                  Hear other operators and send your own signal. All you need is
                  a key and a little curiosity.
                </p>
                <Button
                  variant="primary"
                  className="mt-8"
                  onClick={session.startAudio}
                  disabled={session.starting}
                >
                  <FaBroadcastTower aria-hidden="true" />
                  {session.starting ? 'Enabling sound…' : 'Join'}
                </Button>
                <p className="mt-4 text-sm text-muted">
                  Joining enables sound. You can adjust the volume in Settings.
                </p>
              </section>
            ) : (
              <section
                className="flex flex-col items-center text-center"
                aria-label="Morse transmitter"
              >
                <p className="mb-6 font-mono text-xs uppercase tracking-[0.18em] text-muted">
                  {session.myFrequency} Hz <span aria-hidden="true">/</span>{' '}
                  {session.muted || session.volume === 0
                    ? 'Sound off'
                    : 'Sound on'}
                </p>
                <MorseKey
                  transmitting={session.transmitting}
                  connected={connected}
                  input={input}
                />
                <p
                  id="morse-key-help"
                  className="mt-6 text-sm leading-relaxed text-muted"
                >
                  Hold the key with your mouse or touch.
                  <br />
                  Use <kbd className="font-mono text-ink">Space</kbd> or{' '}
                  <kbd className="font-mono text-ink">Enter</kbd> when the key
                  is focused.
                </p>
                {!connected && (
                  <p className="mt-3 text-sm text-warning">
                    Local practice only while reconnecting.
                  </p>
                )}
                <div className="mt-8 flex flex-wrap justify-center gap-3">
                  <Button
                    aria-expanded={panel === 'reference'}
                    aria-controls="morse-reference"
                    onClick={() =>
                      setPanel(current =>
                        current === 'reference' ? null : 'reference',
                      )
                    }
                  >
                    Morse reference
                  </Button>
                  <Button
                    aria-expanded={panel === 'message'}
                    aria-controls="morse-message"
                    onClick={() =>
                      setPanel(current =>
                        current === 'message' ? null : 'message',
                      )
                    }
                  >
                    <FaKeyboard aria-hidden="true" />
                    Type a message
                  </Button>
                </div>
              </section>
            )}
          </>
        )}
        {session.started && (
          <div className="w-full">
            <section
              id="morse-reference"
              hidden={showSettings || panel !== 'reference'}
              aria-labelledby="reference-heading"
              className="mt-8 rounded-3xl border border-stroke bg-surface p-4 sm:p-6"
            >
              <h2
                id="reference-heading"
                className="text-xl font-semibold tracking-tight"
              >
                Morse reference
              </h2>
              <p className="mt-2 mb-6 text-sm leading-relaxed text-muted">
                Tap a character to hear it locally at {session.wpm} WPM.
                Reference tones are not broadcast.
              </p>
              <MorseCodeTable
                onClick={character => session.playMyMorseCode(character.code)}
              />
            </section>
            <section
              id="morse-message"
              hidden={showSettings || panel !== 'message'}
              aria-labelledby="message-heading"
              className="mx-auto mt-8 max-w-2xl rounded-3xl border border-stroke bg-surface p-4 sm:p-6"
            >
              <h2
                id="message-heading"
                className="mb-4 text-xl font-semibold tracking-tight"
              >
                Send a message
              </h2>
              <MorseCodeInput
                onSend={session.sendText}
                connected={connected}
                wpm={session.wpm}
              />
            </section>
          </div>
        )}
        <p
          role="status"
          className="mx-auto mt-6 max-w-xl text-center text-sm leading-relaxed text-warning"
        >
          {session.notice}
        </p>
      </main>
      <footer className="px-4 pb-6 text-center text-xs text-muted">
        One channel. Many voices. Keep it friendly.
      </footer>
      {debug && <DebugPanel session={session} />}
    </div>
  );
}

export default App;
