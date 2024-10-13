import React from "react";
import { FaExclamationTriangle } from "react-icons/fa";

interface WarningProps {
  text: string;
}

const Warning: React.FC<WarningProps> = ({ text }) => {
  return (
    <div className="flex items-center text-yellow-400 text-sm">
      <FaExclamationTriangle className="mr-1" />
      <span>{text}</span>
    </div>
  );
};

export default Warning;
