import React from "react";
import { FaCog } from "react-icons/fa";

interface SettingsButtonProps {
  onClick: () => void;
}

const SettingsButton: React.FC<SettingsButtonProps> = ({ onClick }) => {
  return (
    <button
      className="flex items-center text-gray-400 p-2 gap-2 rounded hover:bg-gray-600"
      onClick={onClick}
    >
      <FaCog />
      <span>Settings</span>
    </button>
  );
};

export default SettingsButton;
