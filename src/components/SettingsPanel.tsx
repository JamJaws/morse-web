import { FaTimes } from 'react-icons/fa';
import type { MorseSession } from '../hooks/useMorseSession';
import { preferenceRanges } from '../settings/preferences';
import { IconButton } from './ui/Button';
import { RangeControl } from './ui/RangeControl';

export function SettingsPanel({
  session,
  onClose,
}: {
  session: MorseSession;
  onClose: () => void;
}) {
  return (
    <section
      id="settings"
      aria-labelledby="settings-heading"
      className="mx-auto w-full max-w-xl rounded-3xl border border-stroke bg-surface p-6 sm:p-8"
    >
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h2
            id="settings-heading"
            className="text-2xl font-semibold tracking-tight"
          >
            Make it sound like you
          </h2>
          <p className="mt-2 text-sm text-muted">
            Preferences are saved on this device when browser storage is
            available.
          </p>
        </div>
        <IconButton label="Close settings" variant="ghost" onClick={onClose}>
          <FaTimes aria-hidden="true" />
        </IconButton>
      </div>
      <div className="space-y-8">
        <RangeControl
          id="volume"
          label="Volume"
          description={
            session.muted
              ? 'Sound is muted. Unmute from the header to hear tones.'
              : 'Controls your own tone and incoming operators.'
          }
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
          description="The pitch of your transmitted tone. Other operators keep their own pitch."
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
          description="Words per minute for typed messages and reference playback. Manual keying follows your timing."
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
