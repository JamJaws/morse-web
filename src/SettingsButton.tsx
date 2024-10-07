import React from "react";
import { FaCog } from "react-icons/fa";

interface SettingsButtonProps {
  onClick: () => void;
}

const SettingsButton: React.FC<SettingsButtonProps> = ({ onClick }) => {
  return (
    <button
      className="flex items-center p-2 rounded hover:bg-gray-600"
      onClick={onClick}
    >
      <FaCog className="text-gray-400 spin-45" />
      <span className="ml-2">Settings</span>
    </button>
  );
};

export default SettingsButton;
