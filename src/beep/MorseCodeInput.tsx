import React, { useState, useCallback } from "react";
import { FaPaperPlane } from "react-icons/fa";

const MorseCodeInput: React.FC<{ onSend: (message: string) => void }> = ({
  onSend,
}) => {
  const [message, setMessage] = useState("");

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setMessage(event.target.value);
  };

  const handleSend = useCallback(() => {
    if (message.trim()) {
      onSend(message.trim());
      setMessage("");
    }
  }, [message, onSend]);

  const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col gap-2 w-full sm:w-3/4 md:w-2/3 lg:w-1/2">
      <label htmlFor="morse-code-input">Message</label>
      <div className="flex items-center bg-white p-1 border rounded-lg">
        <input
          id="morse-code-input"
          type="text"
          className="flex-grow p-2 outline-none text-black"
          autoComplete="off"
          placeholder="Type your message..."
          value={message}
          onChange={handleChange}
          onKeyUp={handleKeyPress}
        />
        <button
          className="flex items-center gap-2 p-2 bg-blue-500 transition duration-300 ease-in-out hover:bg-blue-700 text-white rounded-lg"
          onClick={handleSend}
        >
          <span>TX</span>
          <FaPaperPlane />
        </button>
      </div>
    </div>
  );
};

export default MorseCodeInput;
