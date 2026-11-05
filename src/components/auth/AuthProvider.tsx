import { useReducer, useEffect, type ReactNode } from 'react';
import { AuthContext, authReducer, initialAuthState } from '@/store/authStore';
import { getStoredSession, refreshSession, getMe, clearSession } from '@/lib/authApi';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, initialAuthState);

  useEffect(() => {
    async function restoreSession() {
      dispatch({ type: 'SET_LOADING', payload: true });

      const session = getStoredSession();
      if (!session) {
        dispatch({ type: 'SET_USER', payload: null });
        return;
      }

      // Try to get the user with the stored token
      const user = await getMe();
      if (user) {
        dispatch({ type: 'SET_USER', payload: user });
        return;
      }

      // Token might be expired — try refreshing
      const newSession = await refreshSession(session.refreshToken);
      if (newSession) {
        const refreshedUser = await getMe();
        dispatch({ type: 'SET_USER', payload: refreshedUser });
      } else {
        clearSession();
        dispatch({ type: 'SET_USER', payload: null });
      }
    }

    restoreSession();
  }, []);

  return (
    <AuthContext.Provider value={{ state, dispatch }}>
      {children}
    </AuthContext.Provider>
  );
}
