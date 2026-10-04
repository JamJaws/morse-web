import { useCallback, useEffect, useRef, useState } from 'react';
import * as Tone from 'tone';
import type { MorseCodeCharacter } from '../beep/MorseCodeCharacter';
import { readPreferences } from '../settings/preferences';
import { chooseCharacter, ROUND_LENGTH } from './curriculum';
import { LocalMorsePlayer, type ListeningSettings } from './LocalMorsePlayer';

interface Prompt {
  character: MorseCodeCharacter;
  assisted: boolean;
  hint: boolean;
  heard: boolean;
}

interface Score {
  answered: number;
  unaided: number;
  assisted: number;
}

type Round =
  | { phase: 'intro' }
  | { phase: 'playing' | 'answering' | 'paused'; prompt: Prompt; score: Score }
  | { phase: 'feedback'; prompt: Prompt; score: Score; correct: boolean }
  | { phase: 'complete'; score: Score };

export function useListeningRound(characters: readonly MorseCodeCharacter[]) {
  const [round, setRound] = useState<Round>({ phase: 'intro' });
  const current = useRef(round);
  const [settings, setSettings] = useState<ListeningSettings>(() => ({
    wpm: 20,
    volume: readPreferences().volume,
  }));
  const [player] = useState(() => new LocalMorsePlayer());
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);

  // Keep event guards synchronous, including multiple inputs in one render.
  const commit = useCallback((next: Round) => {
    current.current = next;
    setRound(next);
  }, []);

  const cancelAudio = useCallback(() => {
    request.current += 1;
    player.cancel();
  }, [player]);

  const pause = useCallback(() => {
    cancelAudio();
    setPreviewing(null);
    const state = current.current;
    if (state.phase === 'playing' || state.phase === 'answering') {
      commit({ ...state, phase: 'paused' });
    }
  }, [cancelAudio, commit]);

  useEffect(() => {
    const context = Tone.getContext();
    const onVisibility = () => {
      if (document.hidden) pause();
    };
    const onAudioState = () => {
      if (context.state !== 'running') pause();
    };
    document.addEventListener('visibilitychange', onVisibility);
    context.on('statechange', onAudioState);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      context.off('statechange', onAudioState);
      cancelAudio();
    };
  }, [cancelAudio, pause]);

  function canPlay() {
    if (settings.volume === 0) {
      setError('Turn up the volume in Sound settings to listen.');
      return false;
    }
    if (document.hidden) return false;
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
        prompt: { ...prompt, heard: prompt.heard || result === 'complete' },
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
        character: chooseCharacter(characters),
        assisted: false,
        hint: false,
        heard: false,
      },
      score,
    );
  }

  function start() {
    if (characters.length === 0) return;
    const state = current.current;
    if ((state.phase !== 'intro' && state.phase !== 'complete') || !canPlay())
      return;
    nextPrompt({ answered: 0, unaided: 0, assisted: 0 });
  }

  function next() {
    const state = current.current;
    if (state.phase !== 'feedback') return;
    if (state.score.answered === ROUND_LENGTH) {
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
    void playPrompt(
      {
        ...state.prompt,
        assisted: state.prompt.assisted || state.prompt.heard,
      },
      state.score,
    );
  }

  function hint() {
    const state = current.current;
    if (state.phase !== 'answering') return;
    commit({
      ...state,
      prompt: { ...state.prompt, hint: true, assisted: true },
    });
  }

  function answer(letter: string) {
    const state = current.current;
    if (
      state.phase !== 'answering' ||
      !characters.some(c => c.letter === letter)
    )
      return;
    const correct = letter === state.prompt.character.letter;
    commit({
      ...state,
      phase: 'feedback',
      correct,
      score: {
        answered: state.score.answered + 1,
        unaided:
          state.score.unaided + Number(correct && !state.prompt.assisted),
        assisted:
          state.score.assisted + Number(correct && state.prompt.assisted),
      },
    });
  }

  async function preview(character: MorseCodeCharacter) {
    const state = current.current;
    if ((state.phase !== 'intro' && state.phase !== 'feedback') || !canPlay())
      return;
    cancelAudio();
    const id = request.current;
    setPreviewing(character.letter);
    try {
      await player.play(character.code, settings);
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
    setPreviewing(null);
    setError(null);
    commit({ phase: 'intro' });
  }

  return {
    round,
    settings,
    previewing,
    error,
    start,
    next,
    pause,
    replay,
    hint,
    answer,
    preview,
    changeSetting,
    reset,
  };
}
