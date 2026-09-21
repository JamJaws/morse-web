import React from 'react';
import { FaCog } from 'react-icons/fa';

interface SettingsButtonProps {
  onClick: () => void;
  expanded: boolean;
}

const SettingsButton: React.FC<SettingsButtonProps> = ({
  onClick,
  expanded,
}) => {
  return (
    <button
      type="button"
      aria-expanded={expanded}
      aria-controls="settings"
      className="flex items-center text-gray-400 p-2 gap-2 rounded hover:bg-gray-600"
      onClick={onClick}
    >
      <FaCog aria-hidden="true" />
      <span>Settings</span>
    </button>
  );
};

export default SettingsButton;
