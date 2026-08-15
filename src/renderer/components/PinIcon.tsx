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
      {/* Classic Flat Pushpin: Top Cap + Hourglass Neck + Base Collar + Needle Point */}
      <path d="M7 4h10" />
      <path d="M8 4v2a3 3 0 0 0 1.2 2.4L10 9.2a3 3 0 0 1 .8 2v1.8H5.5a1 1 0 0 0-1 1v1h15v-1a1 1 0 0 0-1-1H13.2v-1.8a3 3 0 0 1 .8-2l.8-.8A3 3 0 0 0 16 6V4" />
      <line x1="12" y1="15" x2="12" y2="21" stroke="currentColor" fill="none" strokeWidth="2" />
    </svg>
  );
};
