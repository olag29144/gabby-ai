interface NovaLogoProps {
  size?: number;
  className?: string;
}

export function NovaLogo({ size = 28, className = '' }: NovaLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="nova-g1" x1="2" y1="2" x2="30" y2="30" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#4f8ef7" />
          <stop offset="50%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#34d399" />
        </linearGradient>
      </defs>
      <path
        d="M16 3 L19.5 13 L30 13 L21.5 19 L24.5 29 L16 23 L7.5 29 L10.5 19 L2 13 L12.5 13 Z"
        fill="url(#nova-g1)"
      />
    </svg>
  );
}
