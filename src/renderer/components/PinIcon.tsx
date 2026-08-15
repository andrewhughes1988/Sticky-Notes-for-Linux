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
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{
        display: 'inline-block',
        verticalAlign: 'middle',
        transform: 'rotate(35deg)',
        ...style,
      }}
    >
      {/* Pushpin Head & Flared Skirt (matches Screenshot 1 & 2, flipped along Y axis) */}
      <path d="M7 3h10a1.5 1.5 0 0 1 1.5 1.5v.8a1.5 1.5 0 0 1-.8 1.4L16.2 7l-.8 5.2c1.8.8 3.6 1.8 3.6 3.6 0 .8-.6 1.2-1.5 1.2-1.5 0-3.5-.5-5.5-.5s-4 .5-5.5.5c-.9 0-1.5-.4-1.5-1.2 0-1.8 1.8-2.8 3.6-3.6L7.8 7l-1.5-.3a1.5 1.5 0 0 1-.8-1.4v-.8A1.5 1.5 0 0 1 7 3z" />
      {/* Attached Needle Point */}
      <path d="M12 17v6.5" strokeWidth="2.4" fill="none" />
    </svg>
  );
};
