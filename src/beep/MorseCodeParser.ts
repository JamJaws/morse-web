import { wpmToDuration } from "./MorseCodeDuration";
import { convertSpaces } from "./MorseCodeConverter";

type Beep = {
  start: number;
  stop: number;
};

type Beeps = {
  beeps: Beep[];
  duration: number;
};

export const parseMorseCode = (
  startTime: number,
  morseCode: string,
  wpm: number,
): Beeps => {
  const { dot, dash, space } = wpmToDuration(wpm);
  let time = startTime;
  let lastChar: string = "";

  const beeps = convertSpaces(morseCode)
    .split("")
    .reduce<Beep[]>((beeps, symbol) => {
      if (lastChar === "." || lastChar === "-") {
        time += dot; // Space between parts of the same letter
      }
      switch (symbol) {
        case ".":
          beeps.push({ start: time, stop: (time += dot) });
          break;
        case "-":
          beeps.push({ start: time, stop: (time += dash) });
          break;
        case " ":
          time += dash;
          break;
        case "/":
          time += space;
          break;
      }
      lastChar = symbol;
      return beeps;
    }, []);

  return {
    beeps,
    duration: time - startTime + (morseCode.includes("/") ? space : dash),
  };
};
