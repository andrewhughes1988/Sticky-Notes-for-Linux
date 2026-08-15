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
        transform: isPinned ? 'rotate(0deg)' : 'rotate(45deg)',
        transition: 'transform 0.18s cubic-bezier(0.4, 0, 0.2, 1), fill 0.18s ease, opacity 0.18s ease',
        transformOrigin: 'center center',
        display: 'inline-block',
        verticalAlign: 'middle',
        ...style,
      }}
    >
      {/* Needle Point */}
      <line x1="12" y1="17" x2="12" y2="22" strokeWidth="2" stroke="currentColor" fill="none" />
      {/* Thumbtack Head & Body */}
      <path d="M9 11a3 3 0 0 1-1.2-2.3V6.5h8.4V8.7A3 3 0 0 1 15 11l-1 4H10z" />
      {/* Collar Base */}
      <line x1="6" y1="15" x2="18" y2="15" strokeWidth="2" stroke="currentColor" fill="none" />
      {/* Top Cap */}
      <line x1="7" y1="4" x2="17" y2="4" strokeWidth="2" stroke="currentColor" fill="none" />
    </svg>
  );
};
