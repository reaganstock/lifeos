import React from 'react';

interface LifelyLogoProps {
  size?: number;
  className?: string;
  color?: string;
}

export const LifelyLogo: React.FC<LifelyLogoProps> = ({ size = 24, className = "", color = "#2B7FFF" }) => {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" fill={color} />
    </svg>
  );
};

export default LifelyLogo;