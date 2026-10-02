import { useState } from 'react';
import { FaTimes } from 'react-icons/fa';
import type { MorseSession } from '../hooks/useMorseSession';
import { MAX_NAME_LENGTH } from '../settings/operatorName';
import { preferenceRanges } from '../settings/preferences';
import { Button, IconButton } from './ui/Button';
import { RangeControl } from './ui/RangeControl';

export function SettingsPanel({
  session,
  onClose,
}: {
  session: MorseSession;
  onClose: () => void;
}) {
  const [nameDraft, setNameDraft] = useState<string>();
  const name = nameDraft ?? session.name;

  return (
    <section
      id="settings"
      aria-labelledby="settings-heading"
      className="mx-auto w-full max-w-xl rounded-3xl border border-stroke bg-surface p-6 sm:p-8"
    >
      <div className="mb-8 flex items-center justify-between gap-4">
        <h2
          id="settings-heading"
          className="text-2xl font-semibold tracking-tight"
        >
          Settings
        </h2>
        <IconButton label="Close settings" variant="ghost" onClick={onClose}>
          <FaTimes aria-hidden="true" />
        </IconButton>
      </div>
      <div className="space-y-8">
        <form
          onSubmit={event => {
            event.preventDefault();
            if (session.changeName(name)) setNameDraft(undefined);
          }}
          className="space-y-3"
        >
          <label htmlFor="settings-name" className="block text-sm font-medium">
            Callsign or name
          </label>
          <div className="flex flex-wrap gap-3">
            <input
              id="settings-name"
              type="text"
              autoComplete="nickname"
              autoCapitalize="off"
              spellCheck={false}
              maxLength={MAX_NAME_LENGTH}
              placeholder="Random guest name"
              value={name}
              onChange={event => setNameDraft(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter' && event.nativeEvent.isComposing)
                  event.preventDefault();
              }}
              className="min-h-11 min-w-0 flex-1 rounded-xl border border-stroke bg-canvas px-4 py-2 text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            />
            <Button type="submit" disabled={name === session.name}>
              Save name
            </Button>
          </div>
        </form>
        <RangeControl
          id="volume"
          label="Volume"
          description={session.muted ? 'Sound is muted.' : undefined}
          value={session.volume}
          {...preferenceRanges.volume}
          unit="%"
          spokenUnit="percent"
          onChange={session.setVolume}
          onPreview={session.previewTone}
        />
        <RangeControl
          id="frequency"
          label="Frequency"
          value={session.myFrequency}
          {...preferenceRanges.frequency}
          unit="Hz"
          spokenUnit="hertz"
          onChange={session.changeFrequency}
          onPreview={session.previewTone}
        />
        <RangeControl
          id="wpm"
          label="WPM"
          description="Typed messages and reference playback."
          value={session.wpm}
          {...preferenceRanges.wpm}
          unit="WPM"
          spokenUnit="words per minute"
          onChange={session.setWpm}
        />
      </div>
    </section>
  );
}
