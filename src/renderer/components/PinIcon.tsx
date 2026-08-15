import React from 'react';

interface PinIconProps {
  isPinned: boolean;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export const PinIcon: React.FC<PinIconProps> = ({
  isPinned,
  size = 16,
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
      {/* Scaled-up Pushpin Body */}
      <path d="M14.5 2.5l7 7-2.5 2.5-1-1-4.5 4.5 1.5 1.5-2 2-7.5-7.5 2-2 1.5 1.5 4.5-4.5-1-1L14.5 2.5z" />
      {/* Needle Attached Directly to Collar Base */}
      <line x1="9" y1="15" x2="2.5" y2="21.5" stroke="currentColor" fill="none" strokeWidth="2.2" />
    </svg>
  );
};
