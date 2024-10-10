export type MorseCodeDuration = {
  dot: number;
  dash: number;
  space: number;
};

export const wpmToDuration: (wpm: number) => MorseCodeDuration = (
  wpm: number,
): MorseCodeDuration => {
  // One word in Morse code is typically considered to be 50 units long
  const unitsPerWord = 50;
  // Calculate the duration of one unit in seconds
  const unitDuration = 60 / (wpm * unitsPerWord);

  return {
    dot: unitDuration,
    dash: unitDuration * 3,
    space: unitDuration * 7,
  };
};
