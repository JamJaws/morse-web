import * as Tone from 'tone';
import { RemotePlayback } from './RemotePlayback';

/** Gates a continuous oscillator on the audio clock, including the fail-silent cutoff. */
export class RemoteVoice {
  private gain = new Tone.Gain(0).toDestination();
  private oscillator: Tone.Oscillator;
  readonly playback: RemotePlayback;
  constructor(frequency: number, volume: number) {
    this.oscillator = new Tone.Oscillator({
      frequency,
      volume: Tone.gainToDb(volume / 100),
      type: 'sine',
    })
      .connect(this.gain)
      .start(Tone.immediate());
    this.playback = new RemotePlayback(
      {
        replace: (down, edges, now) => {
          this.gain.gain.cancelScheduledValues(now);
          this.gain.gain.setValueAtTime(down ? 1 : 0, now);
          for (const edge of edges)
            this.gain.gain.setValueAtTime(edge.down ? 1 : 0, edge.at);
        },
      },
      { now: () => performance.now(), audioNow: () => Tone.immediate() },
    );
  }
  set(frequency: number, volume: number) {
    this.oscillator.set({ frequency, volume: Tone.gainToDb(volume / 100) });
  }
  dispose() {
    this.oscillator.dispose();
    this.gain.dispose();
  }
}
