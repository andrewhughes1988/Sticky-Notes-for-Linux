import React from 'react';

interface PinIconProps {
  isPinned: boolean;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export const PinIcon: React.FC<PinIconProps> = ({
  isPinned,
  size = 15,
  className = '',
  style = {},
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={isPinned ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{
        display: 'inline-block',
        verticalAlign: 'middle',
        ...style,
      }}
    >
      {/* Classic Flat Pushpin Body */}
      <path d="M16 3l5 5-2 2-1-1-4 4 1 1-1.5 1.5-7-7L9 7l1 1 4-4-1-1 2-2z" />
      {/* Sharp Needle Point */}
      <line x1="8.5" y1="15.5" x2="3" y2="21" stroke="currentColor" fill="none" strokeWidth="2.2" />
    </svg>
  );
};
