import { useEffect, useState } from 'react';

interface SplashScreenProps {
  onDone: () => void;
}

export function SplashScreen({ onDone }: SplashScreenProps) {
  const [phase, setPhase] = useState<'enter' | 'hold' | 'exit'>('enter');

  useEffect(() => {
    // enter → hold → exit → done
    const t1 = setTimeout(() => setPhase('hold'), 600);
    const t2 = setTimeout(() => setPhase('exit'), 2000);
    const t3 = setTimeout(() => onDone(), 2600);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onDone]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0f1117',
        gap: '20px',
        opacity: phase === 'exit' ? 0 : 1,
        transform: phase === 'exit' ? 'scale(1.03)' : 'scale(1)',
        transition: phase === 'exit'
          ? 'opacity 0.5s ease-in, transform 0.5s ease-in'
          : 'none',
      }}
    >
      {/* Ambient glow */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(79,142,247,0.18) 0%, rgba(167,139,250,0.08) 50%, transparent 100%)',
        pointerEvents: 'none',
      }} />

      {/* Logo */}
      <div style={{
        opacity: phase === 'enter' ? 0 : 1,
        transform: phase === 'enter' ? 'scale(0.7) translateY(16px)' : 'scale(1) translateY(0)',
        transition: 'opacity 0.5s cubic-bezier(0.34,1.56,0.64,1), transform 0.5s cubic-bezier(0.34,1.56,0.64,1)',
      }}>
        <AnimatedLogo size={72} />
      </div>

      {/* Wordmark */}
      <div style={{
        opacity: phase === 'enter' ? 0 : 1,
        transform: phase === 'enter' ? 'translateY(12px)' : 'translateY(0)',
        transition: 'opacity 0.4s ease 0.15s, transform 0.4s ease 0.15s',
        textAlign: 'center',
      }}>
        <h1 style={{
          fontFamily: "'Google Sans', Roboto, system-ui, sans-serif",
          fontSize: '2rem',
          fontWeight: 600,
          color: '#e3e3e3',
          letterSpacing: '-0.02em',
          margin: 0,
          lineHeight: 1.2,
        }}>
          Gabby AI
        </h1>
        <p style={{
          fontFamily: "'Google Sans', Roboto, system-ui, sans-serif",
          fontSize: '0.85rem',
          color: '#9aa0a6',
          margin: '6px 0 0',
          letterSpacing: '0.01em',
        }}>
          Your intelligent assistant
        </p>
      </div>

      {/* Pulse dots loader */}
      <div style={{
        display: 'flex',
        gap: '7px',
        marginTop: '8px',
        opacity: phase === 'enter' ? 0 : 1,
        transition: 'opacity 0.3s ease 0.3s',
      }}>
        {[0, 1, 2].map(i => (
          <div
            key={i}
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: '#4f8ef7',
              animation: `gabby-pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes gabby-pulse {
          0%, 80%, 100% { opacity: 0.25; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

function AnimatedLogo({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      style={{ filter: 'drop-shadow(0 0 18px rgba(79,142,247,0.55))' }}
    >
      <defs>
        <linearGradient id="splash-g" x1="3" y1="3" x2="29" y2="29" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="35%" stopColor="#f43f5e" />
          <stop offset="70%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>
      </defs>
      <path
        d="M16 2C16 9.732 22.268 16 30 16C22.268 16 16 22.268 16 30C16 22.268 9.732 16 2 16C9.732 16 16 9.732 16 2Z"
        fill="url(#splash-g)"
      />
    </svg>
  );
}
