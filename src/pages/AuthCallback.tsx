import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { storeSession } from '@/lib/authApi';

const supabase = createClient(
  'https://kdzxcdrmltgrmnknxsml.supabase.co',
  'sb_publishable_LxbXpckAPL1xIek-ogPSHw_q19p-Feh'
);

interface AuthCallbackProps {
  onDone: (success: boolean) => void;
}

export function AuthCallback({ onDone }: AuthCallbackProps) {
  const [status, setStatus] = useState<'processing' | 'error'>('processing');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    async function handleCallback() {
      // Supabase puts the tokens in the URL hash fragment after OAuth
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        setErrorMsg(error.message);
        setStatus('error');
        return;
      }

      if (data.session) {
        // Persist the session tokens for our backend middleware
        storeSession({
          accessToken: data.session.access_token,
          refreshToken: data.session.refresh_token,
          expiresAt: data.session.expires_at ?? Math.floor(Date.now() / 1000) + 3600,
        });
        onDone(true);
        return;
      }

      // No session yet — Supabase will fire an auth state change
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session) {
          storeSession({
            accessToken: session.access_token,
            refreshToken: session.refresh_token,
            expiresAt: session.expires_at ?? Math.floor(Date.now() / 1000) + 3600,
          });
          subscription.unsubscribe();
          onDone(true);
        }
      });

      // Timeout after 8s
      setTimeout(() => {
        subscription.unsubscribe();
        setErrorMsg('Authentication timed out. Please try again.');
        setStatus('error');
      }, 8000);
    }

    handleCallback();
  }, [onDone]);

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-[#0f1117] flex items-center justify-center flex-col gap-4 p-6">
        <p className="text-red-400 text-sm font-medium">Sign in failed</p>
        <p className="text-[#9aa0a6] text-xs max-w-xs text-center">{errorMsg}</p>
        <button
          onClick={() => onDone(false)}
          className="px-5 py-2 rounded-full bg-[#4f8ef7] text-white text-sm font-medium hover:bg-[#6ba3ff] transition-colors"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center flex-col gap-4">
      <div className="w-8 h-8 border-2 border-[#4f8ef7] border-t-transparent rounded-full animate-spin" />
      <p className="text-[#9aa0a6] text-sm">Completing sign in...</p>
    </div>
  );
}
