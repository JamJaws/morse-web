# Client-only Morse training

Status: listening release implemented (milestones 1 and 2). Sending remains the
next feature.

Created: 2026-10-04. Updated: 2026-10-05. Repository baseline: main at 17b5347,
including the reference sidebar and listening notes from PR #167.

Keep this document current as implementation progresses. The decisions below
supersede the original proposal for an E/T course with saved adaptive progress.

## Goal and decisions

Add a separate Training page. First teach listening recognition, then add
sending/keying practice as a second feature.

- **A plain list of lessons.** Every lesson is available immediately. The user
  chooses which lesson to practise and when to move on.
- **Minimal client state.** Keep only the active exercise and its round score
  in memory. Training adds no saved progress, completion flags, unlocks,
  resume feature, per-character history or adaptive learning engine.
- **Koch-based curriculum.** The user delegated the method choice, prioritising
  established teaching practice and evidence. Use the traditional G4FON sequence,
  starting with K/M and adding one character per lesson.
- **Learn sounds at 20 WPM character speed.** Keep answers untimed initially;
  add Farnsworth spacing when exercises contain groups or words.
- **Entirely local.** Generate tones and assess answers in the browser, without
  a callsign, account, WebSocket, backend grading or uploaded results.
- **Delivery scope.** The first release implements listening recognition. The
  lesson-list/state choices are settled and need no reconfirmation.

Client-only execution does not guarantee an offline page reload. The first
version works without the backend after the required page assets have loaded.
Offline reload/install support is a separate, deferred feature.

## Why this teaching approach

Sources were checked on 2026-10-04.

ARRL lists Koch-based trainers and describes learning at the target character
speed, starting with a small set and expanding it after approximately 90%
accuracy. The original implementation used LCWO's established sequence. At the
user's request, the receiving course now uses the traditional G4FON order,
matching the linked Morsy guide and Morse Code World's Koch option. [1][8][9]

There is experimental support for learning complete sound patterns: Allan's
1958 study compared pattern recognition training at 20 WPM with an analytic
approach and reported better alphabet knowledge and earlier attainment of high
speeds. This is older evidence, and the publisher abstract does not establish
that LCWO's exact letter order beats other modern sound-based courses. [3]

CW Academy also teaches fast character recognition with extra spacing, but
starts with T/E/A/N. Morse Mania starts with E/T and recommends 20 WPM character
sounds. Both reinforce the sound-pattern principle; they do not establish that
E/T or K/M is a universally superior starting pair. [4][5][6]

Our choice is therefore **Koch progression using the traditional G4FON sequence**, with
Morse Mania's approachable listen/answer/replay interaction as UI inspiration.
This first single-character, answer-paced exercise is a Koch-based recognition
trainer, not a complete timed-copy Koch course. Group copying is a later step.

This is a widely used modern Koch ordering, not a claim of one official
historical order or experimentally proven superiority over LCWO. G4FON says its
ordering came from Dave Finley's suggested sequence. LICW's comparison lists
G4FON and LCWO separately and distinguishes both from Koch's 1936 order. [10][11]

## Curriculum

Use one static sequence as data, independently of the existing Morse map:

K M R S U A P T L O W I . N J E F 0 Y , V G 5 / Q 9 Z H 3 8 B ? 4 2 7 C 1 D 6 X

This is the traditional G4FON sequence, verified against LICW's comparison.
It contains **40 characters and produces 39 lessons**, because the first lesson
has two characters. Digits and four punctuation symbols appear at their
sequence positions. All 40 already exist in our Morse map. [11]

| Lesson | New character(s)              | Practice pool                             |
| ------ | ----------------------------- | ----------------------------------------- |
| 1      | K and M                       | K M                                       |
| 2      | R                             | K M R                                     |
| 3      | S                             | K M R S                                   |
| 4      | U                             | K M R S U                                 |
| 5      | A                             | K M R S U A                               |
| 6-39   | One additional character each | Everything introduced through that lesson |

Derive each lesson's pool from the sequence. This user-requested change replaces
the LCWO ordering in the draft PR; existing draft lesson numbers now refer to
G4FON and lesson 40 falls back to the list. Keep this order fixed going forward.
Do not add a curriculum selector.

### Custom practice

The lesson list also links to `/training?practice=custom`. Select any supported
letters, digits and punctuation, including **Å Ä Ö**. Quick sets replace the
selection with A–Z, 0–9 or ÅÄÖ; individual character buttons toggle membership.
One character is allowed; an empty set cannot start a round. Nordic characters
remain an optional custom set rather than altering the traditional Koch order.

Custom practice uses the same round and audio player. Repeat keeps the current
selection; Change characters returns to the picker and clears the round.
Selection is held only in memory and clears on navigation/reload. No saved
custom-set library, extra curriculum or progress state is introduced.

## Lesson list and receiving flow

Use visible **Live / Training** navigation. Live remains at / and Training uses
/training. Show a simple numbered lesson list, each row identifying the new
character and the characters practised. Use the existing theme and footer.

The selected lesson can live in the URL, for example /training?lesson=3, so it
can be bookmarked without stored progress. Validate the parameter against the
static lessons; an invalid value falls back to the lesson list. Returning to
/training always shows the list.

1. Select a lesson. Show its new character(s), local sound examples and a
   **Start** button. Start enables audio without joining the live channel.
2. Play one random character from that lesson's cumulative pool.
3. Answer using labelled character buttons or the corresponding keyboard key.
   Accept scored input only after the complete character has played.
4. Give brief feedback. On an error, show "Try again", wait 400 ms and replay
   the same sound without revealing the answer. Keep that prompt until a
   correct response; its first wrong answer remains a mistake in the score.
   Put the pattern in introductions, explicit hints and successful feedback.
5. End the round with a simple score and **Repeat**, **Next lesson** and
   **All lessons** actions. Next lesson is available regardless of score and
   is omitted at the end of the course.

Defaults and scoring:

- Use **20 WPM character speed** and no answer deadline. This is not a claim
  of 20 effective WPM: the pauses depend on how long the user takes to answer.
- Use **20 prompts per round**. Offer replay, hint and exit. A separate Pause
  button is unnecessary: each sound waits indefinitely for an answer. Keep
  answer buttons stable while practising and support physical keyboard input.
- Choose uniformly from the lesson pool. Natural repeats are allowed, including
  in the two-character first lesson. No adaptive weighting or remembered
  weaknesses; a short round need not cover every character in later lessons.
- Count each prompt once. A wrong first answer stays wrong even after several
  retries. Replays (including Resume) are free. Only an explicit Show hint
  changes a first correct answer into the separate hinted category.
  Interrupted playback and cancelled prompts do not count as mistakes.
- Keep a few current-round counters and the current prompt, not a saved history
  of attempts. At the end, show first-answer accuracy without hints, hinted
  answers and mistakes.
- Give lightweight guidance to repeat until the user regularly reaches about
  **90% accuracy**. This is guidance, not a gate, saved mastery score or claim
  that success in a multiple-choice round proves fluent Morse reception.
- Allow ordinary playback controls such as volume and speed, using in-memory
  values for the current visit. No new persisted training preferences.
- **Autoplay** is on by default, with a switch in the practice card to turn it
  off for manual advancement. After a correct response, show feedback for
  750 ms before the next prompt (or round results).
  An answer example must finish before that delay starts. Wrong-answer replay
  works with either setting. The choice stays in memory for the current lesson
  or custom practice visit.
- Leaving the training page or refreshing discards the round. Interruptions
  may retain the current round while the page is mounted, but never resume
  sound automatically. Cancel both feedback/retry timers and audio on hidden
  tabs, audio suspension, leaving, settings changes or changing the custom set.
  Next sound, Resume or explicitly enabling autoplay may continue the round.

Farnsworth spacing preserves normal element timing and stretches the spaces
between characters/words. A second speed slider adds little to an answer-paced
single-character exercise. Add it with group/word practice; retain the existing
parser's default behaviour for live playback.

## Sending, the second feature

Start with prompted **straight-key practice**, using the same lesson list and
cumulative character pools. Show a character, let the learner hold/release the
familiar key, then compare their attempt with the target.

Touch, mouse and focused Space/Enter produce local sidetone. Capture input
timings directly; no microphone or audio recognition is needed. Offer
**Hear example**, **Show pattern** and **Try again**. Keep results within the
current round, with the same absence of persisted training state.

| Option                   | What it teaches                                 | Scope                         |
| ------------------------ | ----------------------------------------------- | ----------------------------- |
| One held key             | Pattern recall and manual duration/spacing      | First sending implementation  |
| Separate dit/dah buttons | Recall with automatic mark lengths              | Possible assisted input later |
| Iambic paddles           | Electronic-keyer operation                      | Later specialist feature      |
| Free-keying sandbox      | Exploration and playback of any entered pattern | Optional follow-up            |

Sending rules:

- Start with a provisional **10 WPM sending target**, independent of receiving
  speed. Trial it on touch devices before finalising the default.
- At the chosen speed, a dit is one unit, a dah three and an intra-character gap
  one. Do not infer speed from a lone press: a long E and a short T are ambiguous.
- Capture monotonic input timestamps and decode independently of the expected
  answer. Never repair the pattern to make it match the prompt.
- Separate **pattern correctness** from **timing feedback**. Start with broad,
  bounded recognition tolerance and one useful correction, such as
  "Correct A. Make the dash a little longer."
- Auto-check after a generous speed-aware finishing pause, with an explicit
  **Check** fallback. Trial the timeout; an exact three-unit pause can split a
  beginner's intended character. Matching a target prefix must not submit early.
- The finishing pause submits a single-character exercise; it is not graded as
  standard inter-letter spacing. Assess spacing when words/groups are added.
- Show the actual pattern for invalid/ambiguous attempts. Bound the attempt's
  length/duration and distinguish normal release from cancellation.
- Blur, tab switching or pointer cancellation must stop the sound and discard
  the interrupted attempt without awarding credit or a misleading failure.
- Grade input intervals, not delayed speaker output. Keep sidetone responsive
  and trial Bluetooth/touch latency before introducing strict timing challenges.

## Implementation boundaries

No new backend, state-management library or persistence layer is needed.

| Existing code                                                 | Planned use                                                                                                                                 |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| src/index.tsx                                                 | Add a sibling Training route; do not mount the live session as its parent.                                                                  |
| src/App.tsx                                                   | Share lightweight navigation/presentation where useful.                                                                                     |
| src/beep/MorseCodeCharacters.ts                               | Reuse character mappings; keep lesson order separate.                                                                                       |
| src/beep/MorseCodeDuration.ts and src/beep/MorseCodeParser.ts | Reuse tone timing; add Farnsworth only with multi-character exercises.                                                                      |
| src/hooks/useMorseSession.ts                                  | Audio and networking are currently coupled. Training must not instantiate this hook to obtain local playback.                               |
| src/hooks/useMorseKey.ts                                      | Reuse input ownership/focus handling. Sending needs normal release and cancellation distinguished.                                          |
| src/components/MorseKey.tsx                                   | Reuse the control with training labels/help text.                                                                                           |
| src/settings/preferences.ts                                   | Existing audio preferences may be read through guarded helpers; Training must not write live settings or introduce saved training settings. |
| tests/                                                        | Use existing Vitest/Testing Library infrastructure.                                                                                         |

Put static curriculum, prompt selection and assessment in small pure TypeScript
modules under a proposed src/training/ directory, with the page/session hook
alongside them. Keep round state local to the page. Derive lesson data from the
URL; no application-wide training store, migrations or localStorage/IndexedDB
training record is required.

Provide a cancellable local tone player independent of the socket. Extract only
the shared audio primitive that is needed; keep the existing remote playback
system intact. Schedule tone durations against the audio clock.

Only one prompt/example/manual tone can play at a time. Cancel scheduled sound
and callbacks on pause, hidden tabs, route changes and audio suspension. Guard
delayed audio-start promises and repeated clicks; resume only by user action.

Leaving Live for Training must close the live connection, release any held key
and cancel queued/remote playback. Returning to Live requires Connect. A shared
shell must not preserve an active live session behind Training.

## Delivery milestones

Use one logical change per Conventional Commit and keep this plan current.

- [x] **0. Research and decisions.** Record the simple lesson-list requirement,
      minimal-state constraint and selected Koch curriculum.
- [x] **1. Local listening slice.** Add the route, lesson-list structure and K/M
      lesson with local audio, answers, replay and a current-round score.
- [x] **2. Complete the fixed course.** Populate all 39 lessons from the G4FON
      sequence, handle lesson URLs and repeat/next/list navigation, and check
      mobile/keyboard behaviour. Milestones 1 and 2 form the receiving release.
- [ ] **3. Single-character sending.** Add key-event capture, independent
      decoding, cancellation handling and pattern/timing feedback. Trial touch
      ergonomics and tolerance; keep state limited to the active exercise.
- [ ] **4. Broader practice, selected later.** Free recall, groups/words/callsigns
      and Farnsworth spacing; optional paddles or
      sandbox. Saved progress and adaptive training are outside the current
      plan and require a future product decision.

Possible commit subjects:

- feat(training): add local listening practice
- feat(training): add the fixed Koch lesson list
- feat(training): add straight-key sending practice
- feat(training): add word practice with Farnsworth spacing

## Verification when implementing

- Open Training directly and from a connected live session. No /beep WebSocket
  or training-data API request should remain/open on Training.
- Check that the sequence has 40 distinct mapped characters, yields 39 lessons
  and adds one character per lesson after K/M. Exercise valid/invalid lesson
  URLs and browser navigation.
- Verify complete-character playback, correct timing, replay cancellation,
  audio-start failures and interrupted rounds. No stale tones or auto-resume.
- Test scoring with wrong answers, hints, free replays, repeats and cancelled
  prompts. Every lesson is accessible independently of prior scores.
- Check autoplay timing, repeated wrong answers, toggling autoplay, manual Next
  during a scheduled advance, final-round completion and cancellation while
  feedback or a retry is pending.
- Verify that training makes no persistence writes, that leaving/reloading
  discards the round, and that blocked storage does not prevent practice.
- For sending, use timing fixtures for valid/invalid/ambiguous patterns, extra
  elements, key repeats, overlapping inputs, cancellation and submission.
  Expected answers must not affect the decoder's output.
- Check narrow mobile layouts, touch targets, focus, keyboard input,
  screen-reader labels/status and reduced motion. Do not expose the hidden
  answer through an accessible label before feedback.
- Recheck live keying, reference preview, notes and connection cleanup after
  shared-code changes. Use existing tests, type checking, formatting, lint and
  build for implementation PRs.

## Listening release implementation

- `src/training/curriculum.ts` derives 39 cumulative lessons from the fixed
  sequence and validates bookmarked lesson numbers.
- `src/training/LocalMorsePlayer.ts` schedules local 600 Hz tones using the
  existing parser and Tone audio clock. Each scheduled mark is disposable;
  cancellation also guards delayed audio activation and completion callbacks.
- `src/training/useListeningRound.ts` holds only the current prompt, round
  counters and temporary sound controls. There is no attempt history or
  persistence. Replays are free; only hints affect the first-answer score.
  Wrong answers automatically replay the same prompt, with one mistake recorded
  when the prompt is eventually answered correctly. Autoplay starts enabled
  and uses one cancellable timer shared by retry and feedback transitions.
- `src/training/TrainingPage.tsx` provides the lesson list, custom practice, examples, character
  buttons/keyboard input, feedback and round results. The practice card groups
  an accessible autoplay switch, answers, secondary playback controls and sound
  settings. Lesson rows show the introduced characters and cumulative set;
  repeated hints and instructional labels have been removed. Sound settings
  apply to the current lesson and reset when it is left. Only the existing
  saved volume is read; the receiving speed always starts at 20 WPM.
- `src/routes.tsx` keeps Training and Live as sibling routes. The shared header
  is presentation only, so live connections and tones are cleaned up on exit.

Verification on 2026-10-05:

- All **213 Vitest tests** pass, including 20 training tests for curriculum,
  scheduling/cancellation, scoring, navigation, blocked storage, keyboard
  input and live-session cleanup.
- Type checking, ESLint, Prettier and the production build pass. Vite retains
  its bundle-size warning; no runtime dependencies were added.
- A Chromium smoke check against the production build passed desktop and
  320/375 px layouts, native Web Audio completion, keyboard input/focus,
  replay scoring, all 40 course answer choices, custom ÅÄÖ practice, default
  autoplay, keyboard/touch operation of the switch,
  reload reset and return to Live.
  Training produced no storage writes, API requests or WebSocket connections.
- Physical-device audio, iOS/Safari and screen-reader listening still need
  practical trials. Headless playback checks validate scheduling and browser
  behaviour, not perceived sound quality or learning effectiveness.

## Decision log and handoff

| Decision                                              | Status                                                                            |
| ----------------------------------------------------- | --------------------------------------------------------------------------------- |
| Simple list with all lessons available                | Chosen by user on 2026-10-04                                                      |
| Minimal client state; no new training persistence     | Chosen by user; implemented here as current-round-only state                      |
| Koch progression with G4FON's sequence                | Updated at user's request after checking the Morsy guide and established trainers |
| Local receiving first, sending second                 | Original requested order                                                          |
| 20 WPM receiving, 20-prompt rounds, optional autoplay | Autoplay on by default at user's request; 750 ms successful feedback              |
| Custom sets including ÅÄÖ and free replays            | Requested by user on 2026-10-04; implemented without persistence                  |
| Saved/adaptive progress                               | Removed from current scope                                                        |

The next implementation task is milestone 3: straight-key sending. Use the
same fixed lesson list and keep all exercise state in memory. Before that
slice, distinguish normal release from cancellation in `useMorseKey` and
trial the proposed timing tolerance on touch input. Compare the branch with
current main and check for new repository instructions. Preserve linear history
and do not treat deferred ideas as approved work.

## Sources

1. [ARRL: Learning Morse Code](https://www.arrl.org/learning-morse-code)
2. [LCWO source: default Koch character sequence](https://github.com/dj1yfk/lcwo/blob/master/inc/functions.php) and [course lessons](https://github.com/dj1yfk/lcwo/blob/master/inc/courselesson.php)
3. [Allan (1958): A Pattern Recognition Method of Learning Morse Code](https://bpspsychub.onlinelibrary.wiley.com/doi/10.1111/j.2044-8295.1958.tb00639.x) — publisher abstract consulted
4. [CW Academy: beginner curriculum](https://cwops.org/wp-content/uploads/2025/02/Beginner-curriculum.htm)
5. [Morse Mania developer: overview](https://www.dong.world/2020/05/morse-mania/)
6. [Morse Mania developer: speed and learning features](https://www.dong.world/2020/05/morse-mania-is-powerful/)
7. [Morse Mania developer: sending training](https://www.dong.world/2021/08/morse-mania-6/)
8. [Morsy: Koch method guide](https://learnmorsy.com/learn/koch-method/)
9. [Morse Code World: character recognition trainer](https://morsecode.world/international/trainer/character.html)
10. [G4FON: Koch trainer and ordering origin](https://www.g4fon.net/CW%20Trainer.php)
11. [LICW: comparison of character sequences](https://longislandcwclub.org/wp-content/uploads/2022/11/ANALYSES-OF-OTHER-CHARACTER-SEQUENCES.pdf)
