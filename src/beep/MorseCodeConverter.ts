import { morseCodeCharacters } from "./MorseCodeCharacters";

export const convertToCode: (text: string) => string = (
  text: string,
): string => {
  return text
    .split("")
    .map((char) => char.toUpperCase())
    .map((char) => {
      if (char === " ") {
        return "/";
      }
      return morseCodeCharacters.find(
        (morseCodeCharacter) => morseCodeCharacter.letter === char,
      )?.code;
    })
    .filter((character) => character !== undefined)
    .join(" ");
};

export const convertSpaces: (code: string) => string = (code: string) =>
  code.replaceAll(" / ", "/");
