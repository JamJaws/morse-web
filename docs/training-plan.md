# Client-only Morse training

Status: discussion draft; implementation has not started.

Created: 2026-10-04. Repository baseline: `main` at `17b5347`, including
the reference sidebar and listening notes from PR #167.

This document is the continuing plan for the feature. Update the decisions,
milestone checkboxes and handoff notes as work progresses. Recommendations below
are proposals, not decisions already approved by the user.

## Goal and agreed scope

Add a separate Training page to Morse. Start with listening: hear a character,
identify it, practise it, and gradually learn more characters. Add sending/keying
practice as a second feature after the receiving experience works well.

- Training runs entirely in the browser. No account, callsign, server session,
  WebSocket, backend grading or uploaded progress is needed.
- Generate sounds locally and save settings/progress on the current device.
- Preserve the site's clean visual design and its focus on manually keyed live
  Morse. Training should be discoverable before connecting to the live channel.
- This change is a plan only. Discuss the choices before implementing the UI.

Client-only execution does not by itself guarantee an offline page reload.
The first version should work without the backend and keep working after the
page's assets have loaded. Installable/offline-reload support would require a
separate caching/service-worker feature and is deferred.

## Research and what to borrow

Sources were checked on 2026-10-04. Developer articles describe earlier versions;
the current store listing is the source for the app's present advertised scope.

- Morse Mania starts receiving and sending with **E and T**, then introduces
  more complex letters, followed by numbers and other symbols. Its current
  listing also includes words, callsigns and phrases, separate receiving and
  sending lessons, custom practice and offline operation. [1][2]
- Its developer recommends a default **20 WPM character speed**, learning the
  overall sound of a character. Farnsworth timing slows the spaces between
  characters/words while preserving the sounds within each character. [3]
- Morse Mania's sending mode presents a target and measures presses on a key.
  It offers pattern/audio hints, compares the expected and entered patterns,
  and has adjustable timing tolerance. The 2021 article describes a slower
  sending default than receiving. [4]
- ARRL recommends learning characters by sound and describes both progressive
  Koch training and Farnsworth timing. G4FON's trainer distinguishes character
  speed from effective speed. These are compatible ideas: character order,
  progression and spacing are separate design choices. [5][6]

Borrow the short feedback loop, gradual introduction, replay/hints and focused
review. Design our own presentation and lesson rules. The sources verify E/T as
Morse Mania's starting pair; they do not establish its complete current lesson
order. The curriculum proposed below is ours, not a claimed copy of that order.

## Learning options

| Option            | Starting experience                                                                                     | Tradeoff                                                                           | Recommendation                             |
| ----------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------ |
| Beginner course   | E/T, then introduce short patterns gradually                                                            | Easy first success; must still teach complete sounds rather than counting marks    | Default for the first release              |
| Koch-style course | Two contrasting characters, for example K/M, played at target character speed; gradually expand the set | Introduces more substantial rhythms immediately, but has a less obvious first step | Keep possible as a later curriculum preset |
| Custom practice   | Choose any supported characters                                                                         | Useful for experienced users and trouble spots, but provides little guidance       | Follow the guided course                   |

There is no claim here that one character order is universally best. Keep the
curriculum as data so we can revise it without rewriting playback or scoring.
Avoid presenting newcomers with several competing learning methods on day one.

### Proposed beginner order

Introduce E/T together; thereafter introduce one new character per lesson.
The rows below group related stages, not simultaneous unlocks.

| Stage                           | New characters                                       | Purpose                                   |
| ------------------------------- | ---------------------------------------------------- | ----------------------------------------- |
| First lesson                    | E `.` and T `-`                                      | Hear and distinguish a dit and a dah      |
| Next                            | A `.-`, then N `-.`                                  | Recognise the order of two sounds         |
| Next                            | I `..`, then M `--`                                  | Add the remaining two-element letters     |
| Next                            | S `...`, then O `---`                                | Add longer rhythms                        |
| Remaining alphabet, provisional | R, K, D, U, G, W, H, B, V, F, L, P, J, C, Y, Q, X, Z | Complete A-Z with cumulative review       |
| Later                           | Digits, selected punctuation, Å/Ä/Ö                  | Expand beyond the initial alphabet course |

The full proposed alphabet order is
`E T A N I M S O R K D U G W H B V F L P J C Y Q X Z`.
Validate that every curriculum item has an entry in the existing Morse map.
Revisit the later order after trying the first few lessons; do not derive lessons
from the alphabetically sorted reference table.

## Receiving experience

Use a visible **Live / Training** navigation choice. Live remains at `/`;
Training uses `/training`. Within Training, start with **Listen** and introduce
**Send** when it is implemented. Use the existing colours, controls and footer,
with a centred practice area and a compact progress/lesson picker.

1. Open Training and choose **Start lesson** or **Continue**. This user action
   enables audio; it never connects to the live channel.
2. Introduce a new character with its letter, a local audio example and an
   optional dot/dash explanation. Keep this teaching step separate from scoring.
3. Play one random character. Answer by tapping a labelled character tile or
   pressing the corresponding physical keyboard key. Initially the available
   choices are E and T; the answer set grows with the learned characters.
4. Give brief, quiet feedback. On an error, show the correct letter and offer
   replay. Keep dot/dash patterns behind a hint or in the correction view so
   normal practice depends on hearing the character.
5. Finish a short round, show first-attempt accuracy and characters to review,
   and offer **Practise again** or **Learn next character**.

Proposed defaults and behaviour:

- **20 WPM character speed**, adjustable, with no answer deadline. Play the
  complete character before accepting a scored answer so users do not learn to
  guess from a prefix. Do not advertise a quiz round as 20 effective WPM: the
  response pauses are deliberately variable.
- Use a stable, labelled answer grid and physical keyboard support. Optional
  position shuffling can come later; do not move buttons underneath a finger or
  change the focused control after every answer.
- **20 prompts per round**, with replay, hint, pause and exit always available.
  No lives, countdown or streak penalties in the initial course.
- Record a prompt once. Retry success must not overwrite a wrong first answer.
  A hint/replay-assisted answer is useful practice but not an unaided success.
  Interrupted audio and cancelled prompts do not count as mistakes.
- Give the new character enough exposure while continuing to practise older
  ones. Allow random repetitions, including with only two characters; never
  force alternation that makes the answer predictable.
- Proposed progression rule: suggest the next character after at least **90%
  unaided first-attempt accuracy over the last 40 prompts at the current stage**,
  including at least **10 exposures to the newest character at 90% accuracy**.
  Keep this a tunable product rule, not a claim about Morse Mania or a validated
  measure of fluency. Users can repeat or manually choose lessons regardless.
- Keep practice results and mastery separate. Recognising one of two visible
  choices is an early learning step, not proof of fluent reception. Later add
  recall without answer choices, short groups and actual words.
- Save after each completed prompt/setting change, but resume on a paused lesson
  screen after a reload. Never resume a tone or submit an answer automatically.

Farnsworth/effective speed becomes a meaningful setting for multi-character
groups and words. It is unnecessary as a second speed slider in the initial
single-character, answer-paced quiz. When introduced, stretch inter-character
and word gaps, not the elements or spaces inside a character.

## Sending experience, second feature

Start with **prompted straight-key practice**. Show a letter such as A, then
let the learner hold/release the familiar key using touch, mouse or focused
Space/Enter. Play local sidetone and capture the press/release durations.
No microphone, audio recognition or physical radio hardware is needed.

After a finishing pause, show what was entered, the expected pattern and one
useful correction. For example: "Correct A. Make the dash a little longer."
Provide **Hear example**, **Show pattern** and **Try again**. Hint-assisted
attempts remain practice and are tracked separately from unaided recall.

| Sending option           | What it teaches                                          | Scope                                                                       |
| ------------------------ | -------------------------------------------------------- | --------------------------------------------------------------------------- |
| One held key             | Pattern recall and the duration/spacing of manual keying | Recommended first implementation                                            |
| Separate dit/dah buttons | Pattern recall with automatic mark lengths               | Possible accessible/assisted alternative; does not grade manual mark timing |
| Iambic paddles           | Electronic-keyer operation and rhythm                    | Later specialist feature                                                    |
| Free keying sandbox      | Exploration and playback of anything entered             | Useful follow-up, after decoding works reliably                             |

### Recognition and feedback rules

- Receiving and sending keep separate settings and progress. A provisional
  **10 WPM sending target** makes physical input gentler while receiving stays
  at 20 WPM. This needs touch-device trials before it becomes the default.
- Use the selected sending speed as the initial reference: a dit is one unit,
  a dah three, and an intra-character gap one. Do not infer speed from a lone
  press: without a reference, a long E and a short T are ambiguous.
- Capture monotonic input timestamps and classify the entered pattern
  independently of the expected answer. Never silently repair an attempt to
  match the target.
- Separate **pattern correctness** from **timing quality**. Begin with broad,
  bounded recognition tolerance and descriptive timing feedback. Offer tighter
  rhythm challenges later; avoid a single opaque percentage that mixes both.
- Auto-check after a generous, speed-aware finishing pause, with an explicit
  **Check** fallback. Prototype the pause before finalising it: an exact
  three-unit timeout can split a beginner's intended character too early.
  Do not finish immediately when the entered prefix happens to match the target.
- In single-character practice, the finishing pause is an exercise submission
  gesture; do not score it as standard inter-letter spacing. Assess real
  letter/word spacing when multi-character practice is added.
- Preserve the actual pattern for feedback, even if it is invalid or ambiguous.
  Limit attempt duration and element count; distinguish cancellation from a
  completed attempt so blur, tab switching or pointer cancellation cannot earn
  credit or produce a misleading failure.
- Keep sidetone responsive. Grade input intervals, not delayed audio output;
  test touch devices and Bluetooth latency before choosing strict tolerances.

The first sending milestone stops at individual letters. Words, callsigns,
spacing coaching, echo practice and paddles can follow independently.

## Fit with the current code

The repository already has React Router, Tone.js, a shared Morse alphabet,
local reference playback and a keyboard/pointer input hook. No new backend or
major application framework is needed.

| Existing code                                                   | Planned use or constraint                                                                                                                                                                             |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/index.tsx`                                                 | Add a sibling `/training` route. Do not mount the live session as a parent of Training. Verify direct navigation and refresh on the host.                                                             |
| `src/App.tsx`                                                   | Keep the live page; share lightweight navigation/footer presentation where useful.                                                                                                                    |
| `src/beep/MorseCodeCharacters.ts`                               | Single source of character-to-pattern mappings; curriculum order lives separately.                                                                                                                    |
| `src/beep/MorseCodeDuration.ts` and `MorseCodeParser.ts`        | Reuse standard mark timing. The parser currently has one WPM parameter; Farnsworth needs an explicit later extension with unchanged defaults for live playback.                                       |
| `src/hooks/useMorseSession.ts`                                  | Currently combines local audio, settings and WebSocket lifecycle. Training must not instantiate it just to get a local playback function.                                                             |
| `src/hooks/useMorseKey.ts`                                      | Reuse focus, repeat and input-ownership handling. Its current stop callback conflates normal release and cancellation; sending assessment needs that distinction without changing live key behaviour. |
| `src/components/MorseKey.tsx`                                   | Reuse the visual control with training-appropriate labels and help text; avoid broadcast/connection wording in Training.                                                                              |
| `src/settings/preferences.ts` and `src/hooks/usePreferences.ts` | Follow guarded storage/validation patterns, but keep training speed, curriculum and progress separate from live settings.                                                                             |
| `tests/`                                                        | Existing Vitest/Testing Library infrastructure can cover pure lesson rules, input lifecycle and route isolation.                                                                                      |

### Boundaries

- Put curriculum, prompt selection, grading and progress validation in small,
  pure TypeScript modules under a proposed `src/training/` directory. Keep the
  training page and session hook there as well; exact filenames can follow the
  first implementation.
- Provide a cancellable local tone player independent of the socket. Extract
  only the shared audio primitive needed by training; avoid a broad rewrite of
  the live remote-playback system. Reuse the existing audio library.
- Schedule marks against the audio clock. UI timers may drive feedback but
  must not determine tone durations. Only one training prompt/example/manual
  tone can own playback at a time.
- Stop and dispose training-owned voices and cancel pending callbacks on pause,
  route changes, hidden tabs and audio suspension. Guard delayed audio-start
  promises and repeat clicks. Resume only from a deliberate user action.
- Navigating from Live to Training must close the live connection, end any held
  key and cancel queued/remote playback. Returning to Live must require an
  explicit Connect action. A shared shell must not keep the live hook mounted.
- Keep training settings/progress in a versioned record, proposed key
  `morse.training.v1`: curriculum ID/version, lesson position, separate receiving
  and sending settings/results, and bounded per-character/recent statistics.
  Validate parsed data and numeric ranges; handle unavailable/full storage with
  in-memory state that survives audio interruptions and in-app navigation.
- Persist compact results, not an unlimited history of key events. A changed
  curriculum must reconcile known character IDs rather than reinterpreting an
  old numeric level. Reset affects training data only.
- Client-only progress means no cross-device sync. Do not introduce analytics
  or API requests for attempts, answers or progress. Future export/import, if
  useful, can remain local too.

## Delivery milestones

Each implementation change should have its own reviewable Conventional Commit.
Keep this plan current in the same branch or carry it forward when splitting PRs.

- [x] **0. Research and discussion draft.** Document confirmed scope, sources,
      proposals and open decisions. No production code changes.
- [ ] **1. Local listening slice.** Add `/training` and navigation, audio
      isolation, E/T introduction and a complete untimed round with replay and
      feedback. Verify it works with the backend unavailable.
- [ ] **2. Usable alphabet course.** Add the data-driven curriculum, progression,
      per-character review, saved progress, lesson selection and round summary.
      This is the intended first receiving release; milestones 1 and 2 may be
      separate commits in the same PR.
- [ ] **3. Sending prototype and first release.** Reuse safe key input, capture
      intervals, decode single letters independently of the target, then add
      useful timing feedback and separate progress. Trial touch ergonomics and
      tolerances before finalising the progression rule for sending.
- [ ] **4. Broader practice, selected later.** Custom character sets, digits and
      punctuation, free recall, groups/words/callsigns and Farnsworth spacing.
      Optional Koch preset, Nordic letters, paddles, free-keying playground,
      local export/import and offline reload support remain independent choices.

Possible commit subjects:

- `feat(training): add local listening practice`
- `feat(training): add progressive alphabet lessons and saved progress`
- `feat(training): add straight-key sending practice`
- `feat(training): add word practice with Farnsworth spacing`

## Verification when implementing

- Training can be opened directly, started and used without a backend. Observe
  that no `/beep` WebSocket is constructed and no attempts/progress leave the
  browser, including when arriving from a connected live session.
- Verify correct timings, complete-character playback, replay cancellation and
  audio-start failure/recovery. Hidden tabs, route changes and rapid actions
  must leave no stale tones, callbacks or accidental answers.
- Exercise progression with wrong answers, retries, hints, repeats and a weak
  newest character. Every active character remains eligible; displayed accuracy
  and advancement use the documented scoring rules.
- Test saved-state validation, curriculum version changes and blocked/full
  storage. Audio suspension or route navigation must not discard in-memory
  progress. Reloading with storage unavailable necessarily loses that progress.
- For sending, test known timing fixtures, invalid/ambiguous patterns, extra
  elements, slow spacing, key repeats, overlapping inputs, normal release versus
  cancellation, and explicit/automatic submission. Expected answers must not
  influence the decoder's result.
- Check desktop and narrow mobile layouts, touch targets, focus, keyboard
  entry, screen-reader labels/status and reduced motion. Do not put the hidden
  answer into an accessible label before feedback. Treat any future visual
  signalling mode as a distinct exercise rather than claiming auditory mastery.
- Recheck the live key, reference preview, notes and connection cleanup after
  shared-code changes. Run the repository's existing tests, type checking,
  formatting, lint and build for implementation PRs. A documentation-only plan
  needs document/diff checks, not new application tests.

## Decisions to discuss

| Topic          | Current proposal                                                                      | Status                                       |
| -------------- | ------------------------------------------------------------------------------------- | -------------------------------------------- |
| Entry point    | Visible Live / Training navigation; separate `/training` page                         | Proposed                                     |
| Curriculum     | Beginner E/T course, then one new letter at a time                                    | Proposed; alternative is a Koch-style course |
| First release  | Listen only, untimed character answers, saved alphabet progress                       | Proposed                                     |
| Progression    | Short rounds, suggested advancement based on accuracy, manual lesson choice available | Thresholds need trial                        |
| Second feature | Prompted single-letter straight-key sending; pattern and rhythm feedback separated    | Proposed                                     |
| Later scope    | Words/custom sets before specialist modes or offline installation                     | Open                                         |

## Handoff

The next action is to discuss the curriculum and first-release scope with the
user, then record the chosen defaults here. Start implementation with milestone
1 only after that discussion. Do not treat every later idea as approved scope.
Before coding in a later session, compare the branch with current `main` and
check for new repository instructions. Keep one logical change per commit and
preserve linear history.

## Sources

1. [Morse Mania App Store listing](https://apps.apple.com/us/app/morse-mania-learn-morse-code/id1511042196)
2. [Developer: Morse Mania overview](https://www.dong.world/2020/05/morse-mania/)
3. [Developer: speed, Farnsworth timing and learning features](https://www.dong.world/2020/05/morse-mania-is-powerful/)
4. [Developer: sending training](https://www.dong.world/2021/08/morse-mania-6/)
5. [ARRL: Learning Morse Code](https://www.arrl.org/learning-morse-code)
6. [G4FON: Morse trainer and timing approaches](https://www.g4fon.net/CW%20Trainer2.php)
