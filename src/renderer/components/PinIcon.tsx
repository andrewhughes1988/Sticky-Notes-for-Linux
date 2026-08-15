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
      {/* Iconic Tapered Pushpin Silhouette: Flat Cap + Tapered Neck + Needle Point */}
      <path d="M8 4h8v2.5l-1.5 5.5h-5L8 6.5z" />
      <line x1="12" y1="12" x2="12" y2="20.5" stroke="currentColor" fill="none" strokeWidth="2.2" />
    </svg>
  );
};
