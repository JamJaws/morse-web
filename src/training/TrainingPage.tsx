import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  FaArrowLeft,
  FaArrowRight,
  FaHeadphones,
  FaPause,
  FaPlay,
  FaVolumeUp,
} from 'react-icons/fa';
import { Footer } from '../components/Footer';
import { SiteHeader } from '../components/SiteHeader';
import { Button } from '../components/ui/Button';
import { RangeControl } from '../components/ui/RangeControl';
import type { MorseCodeCharacter } from '../beep/MorseCodeCharacter';
import { morseCodeCharacters } from '../beep/MorseCodeCharacters';
import {
  lessonFromParam,
  lessons,
  ROUND_LENGTH,
  type Lesson,
} from './curriculum';
import { useListeningRound } from './useListeningRound';
import { CharacterPicker } from './CharacterPicker';

const linkStyle =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-accent hover:bg-raised focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent';

function Pattern({ character }: { character: MorseCodeCharacter }) {
  return (
    <span
      className="inline-flex items-center gap-1.5"
      role="img"
      aria-label={character.code
        .split('')
        .map(mark => (mark === '.' ? 'dot' : 'dash'))
        .join(' ')}
    >
      {character.code.split('').map((mark, index) => (
        <span
          key={index}
          className={`h-1.5 rounded-full bg-accent ${mark === '.' ? 'w-1.5' : 'w-5'}`}
        />
      ))}
    </span>
  );
}

function LessonList() {
  return (
    <>
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">
        Listening practice
      </p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
        Learn the sound of Morse.
      </h2>
      <p className="mt-4 max-w-xl leading-relaxed text-muted">
        Start with K and M, then add one character at a time. Each lesson builds
        on the sounds before it.
      </p>
      <Link
        to="?practice=custom"
        className="my-6 flex items-center justify-between gap-4 rounded-2xl border border-stroke bg-surface p-5 hover:bg-raised focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
      >
        <div>
          <h3 className="font-semibold text-accent">Custom practice</h3>
          <p className="mt-1 text-sm text-muted">
            Choose any characters, including Å Ä Ö.
          </p>
        </div>
        <FaArrowRight aria-hidden="true" className="shrink-0 text-accent" />
      </Link>
      <ol
        aria-label="Listening lessons"
        className="divide-y divide-stroke/60 overflow-hidden rounded-2xl border border-stroke/60 bg-surface"
      >
        {lessons.map(lesson => (
          <li key={lesson.id}>
            <Link
              to={`?lesson=${lesson.id}`}
              aria-label={`Lesson ${lesson.id}: ${lesson.introduced.map(c => c.letter).join(' and ')}`}
              className="group flex items-center gap-4 px-4 py-4 hover:bg-raised focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent sm:gap-5 sm:px-5"
            >
              <span className="w-6 shrink-0 text-right font-mono text-sm text-muted tabular-nums">
                {lesson.id}
              </span>
              <div className="min-w-0 grow">
                <span className="font-mono text-xl font-semibold text-ink">
                  {lesson.introduced.map(c => c.letter).join('  ')}
                </span>
                <p className="mt-1.5 break-words font-mono text-xs leading-relaxed text-muted">
                  {lesson.characters.map(c => c.letter).join(' ')}
                </p>
              </div>
              <FaArrowRight
                aria-hidden="true"
                className="shrink-0 text-muted group-hover:text-accent"
              />
            </Link>
          </li>
        ))}
      </ol>
      <p className="mt-5 text-sm leading-relaxed text-muted">
        Koch progression, using the traditional G4FON order.
      </p>
    </>
  );
}

function ListeningPractice({
  lesson,
  characters,
  picker,
}: {
  lesson?: Lesson;
  characters: readonly MorseCodeCharacter[];
  picker?: ReactNode;
}) {
  const session = useListeningRound(characters);
  const { round } = session;
  const heading = useRef<HTMLHeadingElement>(null);
  const exercise = useRef<HTMLDivElement>(null);
  const nextButton = useRef<HTMLButtonElement>(null);
  const resumeButton = useRef<HTMLButtonElement>(null);
  const repeatButton = useRef<HTMLButtonElement>(null);
  const feedbackPaused = round.phase === 'feedback' && round.paused;

  useEffect(() => {
    if (round.phase === 'intro') heading.current?.focus();
    if (round.phase === 'playing') exercise.current?.focus();
    if (round.phase === 'feedback') nextButton.current?.focus();
    if (round.phase === 'paused') resumeButton.current?.focus();
    if (round.phase === 'complete') repeatButton.current?.focus();
  }, [round.phase, feedbackPaused]);

  function onAnswerKey(event: KeyboardEvent) {
    const target = event.target as HTMLElement;
    if (
      round.phase !== 'answering' ||
      event.repeat ||
      event.nativeEvent.isComposing ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      target.closest(
        'input, textarea, select, a, summary, [contenteditable="true"]',
      )
    )
      return;
    const letter = event.key.toUpperCase();
    if (characters.some(c => c.letter === letter)) {
      event.preventDefault();
      session.answer(letter);
    }
  }

  const question =
    'score' in round
      ? Math.min(
          ROUND_LENGTH,
          round.score.answered + (round.phase === 'feedback' ? 0 : 1),
        )
      : 1;

  return (
    <section aria-labelledby="lesson-heading" onKeyDown={onAnswerKey}>
      <Link to="/training" className={`${linkStyle} -ml-4`}>
        <FaArrowLeft aria-hidden="true" />
        All lessons
      </Link>
      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-3">
        <h2
          ref={heading}
          tabIndex={-1}
          id="lesson-heading"
          className="text-3xl font-semibold tracking-tight outline-none"
        >
          {lesson ? `Lesson ${lesson.id}` : 'Custom practice'}
        </h2>
        <p className="text-sm text-muted">
          {characters.length}{' '}
          {characters.length === 1 ? 'character' : 'characters'}
        </p>
      </div>
      <div className="mt-6 rounded-2xl border border-stroke/60 bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-x-4 border-b border-stroke/60 px-5 py-2 sm:px-8">
          <p className="text-sm text-muted tabular-nums">
            {round.phase === 'intro' || round.phase === 'complete'
              ? `${ROUND_LENGTH} sounds`
              : `Sound ${question} of ${ROUND_LENGTH}`}
          </p>
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium">
            Autoplay
            <input
              type="checkbox"
              role="switch"
              aria-label="Autoplay next sound"
              checked={session.autoPlay}
              onChange={event => session.changeAutoPlay(event.target.checked)}
              className="peer sr-only"
            />
            <span
              aria-hidden="true"
              className="inline-flex h-5 w-9 shrink-0 items-center rounded-full bg-stroke p-0.5 transition-colors peer-checked:bg-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-accent motion-reduce:transition-none"
            >
              <span
                className={`h-4 w-4 rounded-full transition-transform motion-reduce:transition-none ${session.autoPlay ? 'translate-x-4 bg-accent-ink' : 'bg-ink'}`}
              />
            </span>
          </label>
        </div>
        {round.phase === 'intro' ? (
          <div className="p-5 sm:p-8">
            {lesson ? (
              <>
                <div className="flex flex-wrap gap-3">
                  {lesson.introduced.map(character => (
                    <Button
                      key={character.letter}
                      className="min-w-28 flex-col gap-4 p-5"
                      aria-label={`Hear ${character.letter}`}
                      onClick={() => void session.preview(character)}
                    >
                      <span className="font-mono text-4xl">
                        {character.letter}
                      </span>
                      <Pattern character={character} />
                      <span className="flex items-center gap-2 text-xs text-muted">
                        <FaVolumeUp aria-hidden="true" />
                        {session.previewing === character.letter
                          ? 'Playing…'
                          : 'Hear sound'}
                      </span>
                    </Button>
                  ))}
                </div>
                <p className="mt-6 max-w-lg leading-relaxed text-muted">
                  Listen, then choose a character or type its key.
                </p>
                <p className="mt-4 text-sm leading-relaxed text-muted">
                  This lesson:{' '}
                  <span className="font-mono text-ink">
                    {characters.map(c => c.letter).join(' ')}
                  </span>
                </p>
              </>
            ) : (
              picker
            )}
            <Button
              variant="primary"
              className="mt-6"
              onClick={session.start}
              disabled={characters.length === 0}
            >
              <FaPlay aria-hidden="true" />
              {lesson ? 'Start lesson' : 'Start practice'}
            </Button>
          </div>
        ) : round.phase === 'complete' ? (
          <div className="p-5 sm:p-8">
            <h3 className="text-lg font-semibold">Round complete</h3>
            <p className="mt-6 text-5xl font-semibold text-accent tabular-nums">
              {Math.round((round.score.correct / ROUND_LENGTH) * 100)}%
            </p>
            <p className="mt-2 text-muted">
              {round.score.correct} of {ROUND_LENGTH} correct without hints
            </p>
            <p className="mt-4 text-sm text-muted">
              {round.score.hinted} correct with a hint ·{' '}
              {ROUND_LENGTH - round.score.correct - round.score.hinted}{' '}
              incorrect
            </p>
            <p className="mt-6 max-w-lg leading-relaxed text-muted">
              {lesson
                ? 'Aim for 90% without hints over a few rounds before adding another character.'
                : 'Repeat this set or choose other characters to practise.'}
            </p>
            <Button
              ref={repeatButton}
              variant="primary"
              className="mt-6"
              onClick={session.start}
            >
              {lesson ? 'Repeat lesson' : 'Repeat practice'}
            </Button>
          </div>
        ) : (
          <div
            ref={exercise}
            tabIndex={-1}
            aria-label="Listening exercise"
            className="p-5 outline-none sm:p-8"
          >
            <div
              className="flex min-h-48 flex-col items-center justify-center py-6 text-center"
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              {round.phase === 'feedback' ? (
                <>
                  <h3 className="text-xl font-semibold text-success">
                    {round.prompt.missed
                      ? 'Correct on retry.'
                      : round.prompt.hint
                        ? 'Correct, with a hint.'
                        : 'Correct!'}
                  </h3>
                  <span className="mb-3 mt-4 font-mono text-4xl">
                    {round.prompt.character.letter}
                  </span>
                  <Pattern character={round.prompt.character} />
                  {round.paused && (
                    <p className="mt-3 text-sm text-muted">Paused</p>
                  )}
                </>
              ) : (
                <>
                  <FaHeadphones
                    aria-hidden="true"
                    className="mb-4 text-3xl text-accent"
                  />
                  <h3
                    className={`text-xl font-semibold ${round.phase === 'retry' ? 'text-warning' : ''}`}
                  >
                    {round.phase === 'playing'
                      ? 'Listen…'
                      : round.phase === 'paused'
                        ? 'Paused'
                        : round.phase === 'retry'
                          ? 'Try again.'
                          : 'What did you hear?'}
                  </h3>
                  {round.prompt.hint && (
                    <div className="mt-4 flex items-center gap-4">
                      <span className="font-mono text-2xl">
                        {round.prompt.character.letter}
                      </span>
                      <Pattern character={round.prompt.character} />
                    </div>
                  )}
                </>
              )}
            </div>
            <div
              aria-label="Answer choices"
              role="group"
              className="grid grid-cols-[repeat(auto-fit,minmax(3rem,1fr))] gap-2"
            >
              {characters.map(character => (
                <Button
                  key={character.letter}
                  className="min-h-12 px-2 font-mono text-xl"
                  aria-label={`Answer ${character.letter}`}
                  disabled={round.phase !== 'answering'}
                  onClick={() => session.answer(character.letter)}
                >
                  {character.letter}
                </Button>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-stroke/60 pt-4">
              {round.phase === 'feedback' ? (
                <>
                  <Button
                    ref={nextButton}
                    variant="primary"
                    onClick={session.next}
                  >
                    {round.score.answered === ROUND_LENGTH
                      ? 'See results'
                      : 'Next sound'}
                    <FaArrowRight aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => void session.preview(round.prompt.character)}
                  >
                    <FaVolumeUp aria-hidden="true" />
                    {session.previewing ? 'Playing…' : 'Hear answer'}
                  </Button>
                  {(session.previewing ||
                    (session.autoPlay && !round.paused)) && (
                    <Button variant="ghost" onClick={session.pause}>
                      <FaPause aria-hidden="true" />
                      Pause
                    </Button>
                  )}
                </>
              ) : round.phase === 'paused' ? (
                <Button
                  ref={resumeButton}
                  variant="primary"
                  onClick={session.replay}
                >
                  <FaPlay aria-hidden="true" />
                  Resume
                </Button>
              ) : (
                <>
                  <Button
                    onClick={session.replay}
                    disabled={round.phase !== 'answering'}
                  >
                    <FaVolumeUp aria-hidden="true" />
                    Replay
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={session.hint}
                    disabled={round.phase !== 'answering' || round.prompt.hint}
                  >
                    Show hint
                  </Button>
                  <Button variant="ghost" onClick={session.pause}>
                    <FaPause aria-hidden="true" />
                    Pause
                  </Button>
                </>
              )}
            </div>
            <p className="mt-4 text-sm text-muted">
              {round.score.correct} correct without hints
            </p>
          </div>
        )}
        <details className="border-t border-stroke/60">
          <summary className="min-h-11 cursor-pointer rounded-b-2xl px-5 py-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent sm:px-8">
            Sound settings{' '}
            <span className="ml-2 font-normal text-muted">
              {session.settings.wpm} WPM
            </span>
          </summary>
          <div className="space-y-6 px-5 pb-5 sm:px-8 sm:pb-8">
            <RangeControl
              id="training-speed"
              label="Character speed"
              value={session.settings.wpm}
              min={10}
              max={40}
              unit="WPM"
              spokenUnit="words per minute"
              onChange={value => session.changeSetting('wpm', value)}
            />
            <RangeControl
              id="training-volume"
              label="Volume"
              value={session.settings.volume}
              min={0}
              max={100}
              unit="%"
              spokenUnit="percent"
              onChange={value => session.changeSetting('volume', value)}
            />
            <p className="text-xs text-muted">Changes pause playback.</p>
          </div>
        </details>
      </div>
      {session.error && (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-warning/40 bg-surface p-4 text-sm text-warning"
        >
          {session.error}
        </p>
      )}
      <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
        {lesson && lesson.id < lessons.length && (
          <Link className={linkStyle} to={`?lesson=${lesson.id + 1}`}>
            Next lesson
            <FaArrowRight aria-hidden="true" />
          </Link>
        )}
        {!lesson && round.phase !== 'intro' && (
          <Button variant="ghost" onClick={session.reset}>
            Change characters
          </Button>
        )}
      </div>
    </section>
  );
}

function CustomPractice() {
  const [selected, setSelected] = useState('');
  const characters = morseCodeCharacters.filter(character =>
    selected.includes(character.letter),
  );
  return (
    <ListeningPractice
      characters={characters}
      picker={<CharacterPicker value={selected} onChange={setSelected} />}
    />
  );
}

export default function TrainingPage() {
  const [params] = useSearchParams();
  const lesson = lessonFromParam(params.get('lesson'));
  return (
    <div className="flex min-h-dvh flex-col bg-canvas text-ink">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl grow px-4 py-8 sm:px-6 sm:py-12">
        {params.get('practice') === 'custom' ? (
          <CustomPractice />
        ) : lesson ? (
          <ListeningPractice
            key={lesson.id}
            lesson={lesson}
            characters={lesson.characters}
          />
        ) : (
          <LessonList />
        )}
      </main>
      <Footer />
    </div>
  );
}
