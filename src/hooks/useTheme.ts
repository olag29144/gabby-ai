import { useEffect } from 'react';
import { useApp } from '@/store/appStore';
import { savePreferences } from '@/lib/db';
import type { Theme } from '@/types';

export function useTheme() {
  const { state, dispatch } = useApp();
  const { theme } = state.preferences;

  useEffect(() => {
    const root = document.documentElement;

    const applyTheme = (dark: boolean) => {
      root.classList.remove('dark', 'light');
      root.classList.add(dark ? 'dark' : 'light');
    };

    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      applyTheme(mq.matches);
      const handler = (e: MediaQueryListEvent) => applyTheme(e.matches);
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    } else {
      applyTheme(theme === 'dark');
    }
  }, [theme]);

  const setTheme = async (t: Theme) => {
    const updated = { ...state.preferences, theme: t };
    dispatch({ type: 'SET_THEME', payload: t });
    await savePreferences(updated);
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return { theme, setTheme, toggleTheme };
}
