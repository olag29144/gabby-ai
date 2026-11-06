import { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { SplashScreen } from '@/components/ui/SplashScreen';
import { AuthPage } from '@/pages/AuthPage';
import { AuthCallback } from '@/pages/AuthCallback';
import { getStoredSession, getMe } from '@/lib/authApi';
import type { AuthUser } from '@/lib/authApi';

type AppState = 'splash' | 'checking-auth' | 'auth' | 'callback' | 'app';

export default function App() {
  const [appState, setAppState] = useState<AppState>('splash');
  const [_user, setUser] = useState<AuthUser | null>(null);

  const isCallback = window.location.pathname === '/auth/callback'
    || window.location.hash.includes('access_token');

  const checkAuth = useCallback(async () => {
    const session = getStoredSession();
    if (!session) {
      setAppState('auth');
      return;
    }
    try {
      const user = await getMe();
      if (user) {
        setUser(user);
        setAppState('app');
      } else {
        setAppState('auth');
      }
    } catch {
      setAppState('auth');
    }
  }, []);

  const handleSplashDone = useCallback(() => {
    if (isCallback) {
      setAppState('callback');
    } else {
      setAppState('checking-auth');
      checkAuth();
    }
  }, [isCallback, checkAuth]);

  const handleAuthenticated = useCallback(async () => {
    try {
      const user = await getMe();
      if (user) {
        setUser(user);
        setAppState('app');
      } else {
        // getMe failed — still let them into app as guest (auth worked, profile fetch failed)
        setAppState('app');
      }
    } catch {
      // Network error on profile fetch — still proceed into app
      setAppState('app');
    }
  }, []);

  // If we land directly on /auth/callback, skip splash and process immediately
  useEffect(() => {
    if (isCallback && appState === 'splash') {
      setAppState('callback');
    }
  }, [isCallback, appState]);

  switch (appState) {
    case 'splash':
      return <SplashScreen onDone={handleSplashDone} />;

    case 'checking-auth':
      return (
        <div
          style={{
            height: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#0f1117',
          }}
        >
          <div style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            border: '2px solid #4f8ef7',
            borderTopColor: 'transparent',
            animation: 'spin 0.8s linear infinite',
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      );

    case 'callback':
      return <AuthCallback onDone={(success) => {
        if (success) handleAuthenticated();
        else setAppState('auth');
      }} />;

    case 'auth':
      return <AuthPage onAuthenticated={handleAuthenticated} />;

    case 'app':
    default:
      return <AppLayout />;
  }
}
