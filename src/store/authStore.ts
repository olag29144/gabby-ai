import { createContext, useContext } from 'react';
import type { AuthUser } from '@/lib/authApi';

export interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export type AuthAction =
  | { type: 'SET_USER'; payload: AuthUser | null }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SIGN_OUT' };

export const initialAuthState: AuthState = {
  user: null,
  isLoading: true,
  isAuthenticated: false,
};

export function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'SET_USER':
      return { ...state, user: action.payload, isAuthenticated: !!action.payload, isLoading: false };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SIGN_OUT':
      return { ...state, user: null, isAuthenticated: false, isLoading: false };
    default:
      return state;
  }
}

export interface AuthContextType {
  state: AuthState;
  dispatch: React.Dispatch<AuthAction>;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
