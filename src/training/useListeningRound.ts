import { useCallback, useEffect, useRef, useState } from 'react';
import * as Tone from 'tone';
import type { MorseCodeCharacter } from '../beep/MorseCodeCharacter';
import { readPreferences } from '../settings/preferences';
import { createRound, getRoundLength } from './round';
import { LocalMorsePlayer, type ListeningSettings } from './LocalMorsePlayer';

interface Prompt {
  character: MorseCodeCharacter;
  hint: boolean;
  missed: boolean;
}

interface Score {
  answered: number;
  correct: number;
  hinted: number;
}

type Round =
  | { phase: 'intro' }
  | {
      phase: 'playing' | 'answering' | 'retry' | 'paused';
      prompt: Prompt;
      score: Score;
    }
  | { phase: 'feedback'; prompt: Prompt; score: Score; paused: boolean }
  | { phase: 'complete'; score: Score };

export function useListeningRound(
  characters: readonly MorseCodeCharacter[],
  focusLetter?: string,
) {
  const [round, setRound] = useState<Round>({ phase: 'intro' });
  const current = useRef(round);
  const prompts = useRef<MorseCodeCharacter[]>([]);
  const roundLength = getRoundLength(characters.length);
  const [settings, setSettings] = useState<ListeningSettings>(() => ({
    wpm: 20,
    volume: readPreferences().volume,
  }));
  const [player] = useState(() => new LocalMorsePlayer());
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [autoPlay, setAutoPlay] = useState(true);
  const autoPlayEnabled = useRef(true);
  const transition = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const request = useRef(0);

  // Keep event guards synchronous, including multiple inputs in one render.
  const commit = useCallback((next: Round) => {
    current.current = next;
    setRound(next);
  }, []);

  const cancelAudio = useCallback(() => {
    clearTimeout(transition.current);
    transition.current = undefined;
    request.current += 1;
    player.cancel();
  }, [player]);

  const pause = useCallback(() => {
    cancelAudio();
    setPreviewing(null);
    const state = current.current;
    if (
      state.phase === 'playing' ||
      state.phase === 'answering' ||
      state.phase === 'retry'
    ) {
      commit({ ...state, phase: 'paused' });
    } else if (state.phase === 'feedback') {
      commit({ ...state, paused: true });
    }
  }, [cancelAudio, commit]);

  useEffect(() => {
    const context = Tone.getContext();
    const onAudioState = () => {
      // A completed sound remains answerable even if the browser suspends audio.
      if (context.state !== 'running' && current.current.phase !== 'answering')
        pause();
    };
    context.on('statechange', onAudioState);
    return () => {
      context.off('statechange', onAudioState);
      cancelAudio();
    };
  }, [cancelAudio, pause]);

  function canPlay() {
    if (settings.volume === 0) {
      setError('Turn up the volume in Sound settings to listen.');
      return false;
    }
    setError(null);
    return true;
  }

  async function playPrompt(prompt: Prompt, score: Score) {
    cancelAudio();
    setPreviewing(null);
    const id = request.current;
    commit({ phase: 'playing', prompt, score });
    try {
      const result = await player.play(prompt.character.code, settings);
      if (id !== request.current) return;
      commit({
        phase: result === 'complete' ? 'answering' : 'paused',
        prompt,
        score,
      });
    } catch {
      if (id !== request.current) return;
      commit({ phase: 'paused', prompt, score });
      setError(
        'Could not play audio. Check your sound settings and try Resume.',
      );
    }
  }

  function nextPrompt(score: Score) {
    void playPrompt(
      {
        character: prompts.current[score.answered],
        hint: false,
        missed: false,
      },
      score,
    );
  }

  function start() {
    if (characters.length === 0) return;
    const state = current.current;
    if ((state.phase !== 'intro' && state.phase !== 'complete') || !canPlay())
      return;
    prompts.current = createRound(characters, focusLetter);
    nextPrompt({ answered: 0, correct: 0, hinted: 0 });
  }

  function next() {
    const state = current.current;
    if (state.phase !== 'feedback') return;
    if (state.score.answered === roundLength) {
      cancelAudio();
      setPreviewing(null);
      commit({ phase: 'complete', score: state.score });
    } else if (canPlay()) {
      nextPrompt(state.score);
    }
  }

  function replay() {
    const state = current.current;
    if ((state.phase !== 'answering' && state.phase !== 'paused') || !canPlay())
      return;
    void playPrompt(state.prompt, state.score);
  }

  function hint() {
    const state = current.current;
    if (state.phase !== 'answering') return;
    commit({
      ...state,
      prompt: { ...state.prompt, hint: true },
    });
  }

  function advanceAfterFeedback() {
    clearTimeout(transition.current);
    transition.current = undefined;
    if (!autoPlayEnabled.current || current.current.phase !== 'feedback')
      return;
    transition.current = setTimeout(() => {
      transition.current = undefined;
      const state = current.current;
      if (state.phase !== 'feedback' || state.paused) return;
      if (Tone.getContext().state === 'running') next();
      else pause();
    }, 750);
  }

  function changeAutoPlay(value: boolean) {
    autoPlayEnabled.current = value;
    setAutoPlay(value);
    const state = current.current;
    if (state.phase === 'feedback') {
      clearTimeout(transition.current);
      transition.current = undefined;
      // Enabling this control is an explicit choice to continue.
      if (value) {
        commit({ ...state, paused: false });
        if (!previewing) advanceAfterFeedback();
      }
    }
  }

  function answer(letter: string) {
    const state = current.current;
    if (
      state.phase !== 'answering' ||
      !characters.some(c => c.letter === letter)
    )
      return;
    if (letter !== state.prompt.character.letter) {
      const prompt = { ...state.prompt, missed: true };
      commit({ ...state, phase: 'retry', prompt });
      // Brief error feedback, then repeat the same sound without revealing it.
      transition.current = setTimeout(() => {
        transition.current = undefined;
        if (current.current.phase !== 'retry') return;
        if (canPlay() && Tone.getContext().state === 'running')
          void playPrompt(prompt, state.score);
        else pause();
      }, 400);
      return;
    }
    commit({
      ...state,
      phase: 'feedback',
      paused: false,
      score: {
        answered: state.score.answered + 1,
        correct:
          state.score.correct +
          Number(!state.prompt.missed && !state.prompt.hint),
        hinted:
          state.score.hinted +
          Number(!state.prompt.missed && state.prompt.hint),
      },
    });
    advanceAfterFeedback();
  }

  async function preview(character: MorseCodeCharacter) {
    const state = current.current;
    if ((state.phase !== 'intro' && state.phase !== 'feedback') || !canPlay())
      return;
    cancelAudio();
    const id = request.current;
    if (state.phase === 'feedback') commit({ ...state, paused: false });
    setPreviewing(character.letter);
    try {
      const result = await player.play(character.code, settings);
      if (id === request.current && result === 'complete')
        advanceAfterFeedback();
    } catch {
      if (id === request.current)
        setError('Could not play audio. Please try again.');
    } finally {
      if (id === request.current) setPreviewing(null);
    }
  }

  function changeSetting(key: keyof ListeningSettings, value: number) {
    pause();
    setError(null);
    setSettings(previous => ({ ...previous, [key]: value }));
  }

  function reset() {
    cancelAudio();
    prompts.current = [];
    setPreviewing(null);
    setError(null);
    commit({ phase: 'intro' });
  }

  return {
    round,
    roundLength,
    settings,
    previewing,
    autoPlay,
    error,
    start,
    next,
    replay,
    hint,
    answer,
    preview,
    changeSetting,
    changeAutoPlay,
    reset,
  };
}
