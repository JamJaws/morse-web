import React from "react";
import { MorseCodeCharacter } from "./MorseCodeCharacter";
import { morseCodeCharacters } from "./MorseCodeCharacters";

type MorseCodeTablePros = {
  onClick?: (code: MorseCodeCharacter) => void;
};

type GroupedMorseCodeCharacters = Record<
  "letter" | "number" | "punctuation",
  MorseCodeCharacter[]
>;

const capitalizeFirstLetter = (str: string): string => {
  if (!str) {
    return "";
  }
  return str.charAt(0).toUpperCase() + str.slice(1);
};

const MorseCodeTable: React.FC<MorseCodeTablePros> = ({
  onClick = () => {},
}) => {
  const groupedCharacters =
    morseCodeCharacters.reduce<GroupedMorseCodeCharacters>(
      (acc, character) => {
        if (!acc[character.type]) {
          acc[character.type] = [];
        }
        acc[character.type].push(character);
        return acc;
      },
      { letter: [], number: [], punctuation: [] },
    );
  return (
    <div className="flex flex-col gap-2 container bg-gray-900 p-1 rounded">
      {Object.entries(groupedCharacters).map(([group, characters]) => (
        <div key={group}>
          <h2 className="text-lg font-bold">{capitalizeFirstLetter(group)}</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-0.5">
            {characters.map((character: MorseCodeCharacter) => (
              <button
                key={character.letter}
                onClick={() => onClick(character)}
                className="flex bg-slate-700 p-4 rounded gap-3 transition duration-300 ease-in-out hover:bg-slate-600 hover:shadow-lg"
              >
                <span>{character.letter}</span>
                <span>
                  {character.code
                    .split("")
                    .map((char) => (char === "." ? "•" : "—"))
                    .join(" ")}
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default MorseCodeTable;
