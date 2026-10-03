import { useEffect, useId, useState } from 'react';
import { FaChevronDown } from 'react-icons/fa';
import { NOTES_KEY, readNotes } from '../settings/notes';

export function ListeningNotes() {
  const [notes, setNotes] = useState(readNotes);
  const headingId = useId();
  const contentId = useId();

  useEffect(() => {
    try {
      localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
    } catch {
      // Blocked or full storage must not interrupt listening or note taking.
    }
  }, [notes]);

  return (
    <section
      aria-labelledby={headingId}
      className="rounded-2xl border border-stroke bg-surface"
    >
      <h2 id={headingId}>
        <button
          type="button"
          aria-expanded={notes.expanded}
          aria-controls={contentId}
          onClick={() =>
            setNotes(current => ({ ...current, expanded: !current.expanded }))
          }
          className="flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
        >
          Notes
          <FaChevronDown
            aria-hidden="true"
            className={`shrink-0 text-xs text-muted ${notes.expanded ? 'rotate-180' : ''}`}
          />
        </button>
      </h2>
      <div id={contentId} hidden={!notes.expanded} className="px-3 pb-3">
        <textarea
          aria-label="Listening notes"
          rows={4}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          placeholder="Write what you hear…"
          value={notes.text}
          onChange={event =>
            setNotes(current => ({ ...current, text: event.target.value }))
          }
          className="block min-h-28 w-full resize-y rounded-xl border border-stroke bg-canvas px-3 py-2 font-mono text-base leading-relaxed text-ink placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        />
      </div>
    </section>
  );
}
