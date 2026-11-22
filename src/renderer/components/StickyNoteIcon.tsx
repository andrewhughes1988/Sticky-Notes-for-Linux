import React, { useId } from 'react';

interface StickyNoteIconProps {
  size?: number;
  className?: string;
}

export const StickyNoteIcon: React.FC<StickyNoteIconProps> = ({ size = 18, className = '' }) => {
  const id = useId();
  const yellowGradId = `${id}-yellow`;
  const amberGradId = `${id}-amber`;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      className={className ? `sticky-note-icon ${className}` : 'sticky-note-icon'}
    >
      <defs>
        <linearGradient id={yellowGradId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FFF176" />
          <stop offset="100%" stopColor="#FFD600" />
        </linearGradient>
        <linearGradient id={amberGradId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#FFA000" />
        </linearGradient>
      </defs>
      <path
        d="M 4 2 L 20 2 A 2 2 0 0 1 22 4 L 22 17 L 17 22 L 4 22 A 2 2 0 0 1 2 20 L 2 4 A 2 2 0 0 1 4 2 Z"
        fill={`url(#${yellowGradId})`}
      />
      <path
        d="M 4 2 L 20 2 A 2 2 0 0 1 22 4 L 22 6 L 2 6 L 2 4 A 2 2 0 0 1 4 2 Z"
        fill={`url(#${amberGradId})`}
      />
      <path d="M 17 22 L 17 18 A 1 1 0 0 1 18 17 L 22 17 Z" fill="#E5A800" />
    </svg>
  );
};
