import { useId } from 'react';

interface GabbyLogoProps {
  size?: number;
  className?: string;
}

export function GabbyLogo({ size = 28, className = '' }: GabbyLogoProps) {
  const reactId = useId();
  const gradId = `gabby-grad-${reactId.replace(/[^a-zA-Z0-9]/g, '')}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
      style={{ minWidth: size, minHeight: size, display: 'inline-block', verticalAlign: 'middle' }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id={gradId}
          x1="3"
          y1="3"
          x2="29"
          y2="29"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="35%" stopColor="#f43f5e" />
          <stop offset="70%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>
      </defs>
      <path
        d="M16 2C16 9.732 22.268 16 30 16C22.268 16 16 22.268 16 30C16 22.268 9.732 16 2 16C9.732 16 16 9.732 16 2Z"
        fill="#3b82f6"
        opacity="0.25"
      />
      <path
        d="M16 2C16 9.732 22.268 16 30 16C22.268 16 16 22.268 16 30C16 22.268 9.732 16 2 16C9.732 16 16 9.732 16 2Z"
        fill={`url(#${gradId})`}
      />
    </svg>
  );
}
