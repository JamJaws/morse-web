import { useMemo, useState } from 'react';
import { FaPaperPlane } from 'react-icons/fa';
import { Button } from '../components/ui/Button';
import { morseCodeCharacters } from './MorseCodeCharacters';

const supportedCharacters = new Set(
  morseCodeCharacters.map(character => character.letter),
);

export default function MorseCodeInput({
  onSend,
  connected,
  wpm,
}: {
  onSend: (message: string) => boolean;
  connected: boolean;
  wpm: number;
}) {
  const [message, setMessage] = useState('');
  const unknownCharacters = useMemo(
    () =>
      [
        ...new Set(
          [...message].filter(
            char =>
              char !== ' ' && !supportedCharacters.has(char.toUpperCase()),
          ),
        ),
      ].join(''),
    [message],
  );
  return (
    <form
      onSubmit={event => {
        event.preventDefault();
        if (message.trim() && onSend(message.trim())) setMessage('');
      }}
      className="space-y-3"
    >
      <label htmlFor="morse-code-input" className="block text-sm font-medium">
        Message
      </label>
      <div className="flex flex-wrap gap-3">
        <input
          id="morse-code-input"
          type="text"
          autoComplete="off"
          placeholder="CQ…"
          maxLength={2048}
          value={message}
          aria-describedby={`message-help${unknownCharacters ? ' message-warning' : ''}`}
          onChange={event => setMessage(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter' && event.nativeEvent.isComposing)
              event.preventDefault();
          }}
          className="min-h-11 min-w-0 flex-1 rounded-xl border border-stroke bg-canvas px-4 py-2 text-ink placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        />
        <Button
          type="submit"
          variant="primary"
          disabled={!connected || !message.trim()}
        >
          <FaPaperPlane aria-hidden="true" />
          <span>Send</span>
        </Button>
      </div>
      <p id="message-help" className="text-sm leading-relaxed text-muted">
        {connected
          ? `Broadcast at ${wpm} WPM · Enter to send`
          : 'Reconnecting…'}
      </p>
      {unknownCharacters && (
        <p id="message-warning" className="text-sm text-warning">
          Unsupported characters will be skipped: {unknownCharacters}
        </p>
      )}
    </form>
  );
}
