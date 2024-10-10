import React from "react";
import { MorseCodeCharacter } from "./MorseCodeCharacter";
import { morseCodeCharacters } from "./MorseCodeCharacters";

type MorseCodeTablePros = {
  onClick?: (code: MorseCodeCharacter) => void;
};

const MorseCodeTable: React.FC<MorseCodeTablePros> = ({
  onClick = () => {},
}) => {
  return (
    <div className="container bg-gray-900 text-white p-1 rounded">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-0.5">
        {morseCodeCharacters.map((character: MorseCodeCharacter) => (
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
  );
};

export default MorseCodeTable;
