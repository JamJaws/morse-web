import { useEffect, useId, useRef, useState } from 'react';
import { FaCheck, FaChevronDown, FaCopy, FaEraser } from 'react-icons/fa';
import { NOTES_KEY, readNotes } from '../settings/notes';
import { Button } from './ui/Button';

export function ListeningNotes() {
  const [notes, setNotes] = useState(readNotes);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>(
    'idle',
  );
  const textarea = useRef<HTMLTextAreaElement>(null);
  const copyAttempt = useRef(0);
  const headingId = useId();
  const contentId = useId();

  useEffect(() => {
    try {
      localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
    } catch {
      // Blocked or full storage must not interrupt listening or note taking.
    }
  }, [notes]);

  useEffect(() => {
    if (copyStatus !== 'copied') return;
    const timeout = window.setTimeout(() => setCopyStatus('idle'), 2_000);
    return () => window.clearTimeout(timeout);
  }, [copyStatus]);

  function changeText(text: string) {
    copyAttempt.current += 1;
    setCopyStatus('idle');
    setNotes(current => ({ ...current, text }));
  }

  async function copyNotes() {
    const attempt = ++copyAttempt.current;
    setCopyStatus('idle');
    try {
      await navigator.clipboard.writeText(notes.text);
      if (attempt === copyAttempt.current) setCopyStatus('copied');
    } catch {
      if (attempt === copyAttempt.current) setCopyStatus('error');
    }
  }

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
          ref={textarea}
          aria-label="Listening notes"
          rows={4}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          placeholder="Write what you hear…"
          value={notes.text}
          onChange={event => changeText(event.target.value)}
          className="block min-h-28 w-full resize-y rounded-xl border border-stroke bg-canvas px-3 py-2 font-mono text-base leading-relaxed text-ink placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        />
        <div className="mt-2 flex justify-end gap-1">
          <Button
            variant="ghost"
            className="min-w-28"
            aria-label="Copy notes"
            disabled={!notes.text}
            onClick={() => void copyNotes()}
          >
            {copyStatus === 'copied' ? (
              <FaCheck aria-hidden="true" />
            ) : (
              <FaCopy aria-hidden="true" />
            )}
            {copyStatus === 'copied' ? 'Copied' : 'Copy'}
          </Button>
          <Button
            variant="ghost"
            aria-label="Clear notes"
            disabled={!notes.text}
            onClick={() => {
              changeText('');
              textarea.current?.focus();
            }}
          >
            <FaEraser aria-hidden="true" />
            Clear
          </Button>
        </div>
        <p
          role="status"
          className={
            copyStatus === 'error' ? 'mt-2 text-sm text-warning' : 'sr-only'
          }
        >
          {copyStatus === 'copied'
            ? 'Notes copied.'
            : copyStatus === 'error'
              ? 'Could not copy. Select the text and copy it manually.'
              : ''}
        </p>
      </div>
    </section>
  );
}
