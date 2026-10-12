import * as Tone from 'tone';
import { parseMorseCode } from '../beep/MorseCodeParser';

export interface ListeningSettings {
  wpm: number;
  volume: number;
}

type PlaybackResult = 'complete' | 'cancelled';

/** Local audio only. This player has no live-session or socket dependency. */
export class LocalMorsePlayer {
  private generation = 0;
  private voices: Tone.Oscillator[] = [];
  private timer: ReturnType<typeof setTimeout> | undefined;
  private finish: ((result: PlaybackResult) => void) | undefined;

  cancel() {
    this.generation += 1;
    clearTimeout(this.timer);
    this.timer = undefined;
    // Dispose every scheduled mark, including ones that have not started yet.
    for (const voice of this.voices) voice.dispose();
    this.voices = [];
    this.finish?.('cancelled');
    this.finish = undefined;
  }

  async play(
    code: string,
    settings: ListeningSettings,
  ): Promise<PlaybackResult> {
    this.cancel();
    const generation = this.generation;
    try {
      await Tone.start();
      if (generation !== this.generation) return 'cancelled';
      if (Tone.getContext().state !== 'running') {
        throw new Error('Audio is suspended');
      }

      const { beeps } = parseMorseCode(Tone.now(), code, settings.wpm);
      for (const beep of beeps) {
        const voice = new Tone.Oscillator({
          frequency: 600,
          type: 'sine',
          volume: Tone.gainToDb(settings.volume / 100),
        }).toDestination();
        this.voices.push(voice);
        voice.start(beep.start).stop(beep.stop);
      }

      const end = beeps[beeps.length - 1]?.stop ?? Tone.immediate();
      return await new Promise<PlaybackResult>(resolve => {
        this.finish = resolve;
        const checkFinished = () => {
          if (generation !== this.generation) return;
          if (Tone.getContext().state !== 'running') {
            this.cancel();
            return;
          }
          // A UI timer must never unlock answers ahead of the audio clock.
          const remaining = end - Tone.immediate();
          if (remaining > 0) {
            this.timer = setTimeout(
              checkFinished,
              Math.max(10, remaining * 1_000),
            );
          } else {
            this.finish = undefined;
            this.cancel();
            resolve('complete');
          }
        };
        checkFinished();
      });
    } catch (error) {
      if (generation !== this.generation) return 'cancelled';
      this.cancel();
      throw error;
    }
  }
}
