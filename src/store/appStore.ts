import { createContext, useContext } from 'react';
import type { Conversation, UserPreferences, Theme } from '@/types';
import { DEFAULT_MODEL } from '@/types';

export interface AppState {
  conversations: Conversation[];
  activeConversationId: string | null;
  preferences: UserPreferences;
  sidebarOpen: boolean;
  searchQuery: string;
  isLoading: boolean;
}

export type AppAction =
  | { type: 'SET_CONVERSATIONS'; payload: Conversation[] }
  | { type: 'ADD_CONVERSATION'; payload: Conversation }
  | { type: 'UPDATE_CONVERSATION'; payload: Conversation }
  | { type: 'DELETE_CONVERSATION'; payload: string }
  | { type: 'SET_ACTIVE'; payload: string | null }
  | { type: 'SET_PREFERENCES'; payload: UserPreferences }
  | { type: 'SET_THEME'; payload: Theme }
  | { type: 'SET_DEFAULT_MODEL'; payload: string }
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'SET_SIDEBAR'; payload: boolean }
  | { type: 'SET_SEARCH'; payload: string }
  | { type: 'SET_LOADING'; payload: boolean };

export const initialState: AppState = {
  conversations: [],
  activeConversationId: null,
  preferences: { theme: 'dark', defaultModel: DEFAULT_MODEL, sidebarOpen: true },
  sidebarOpen: true,
  searchQuery: '',
  isLoading: true,
};

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_CONVERSATIONS':
      return { ...state, conversations: action.payload };
    case 'ADD_CONVERSATION':
      return { ...state, conversations: [action.payload, ...state.conversations] };
    case 'UPDATE_CONVERSATION':
      return {
        ...state,
        conversations: state.conversations.map(c =>
          c.id === action.payload.id ? action.payload : c
        ),
      };
    case 'DELETE_CONVERSATION':
      return {
        ...state,
        conversations: state.conversations.filter(c => c.id !== action.payload),
        activeConversationId:
          state.activeConversationId === action.payload ? null : state.activeConversationId,
      };
    case 'SET_ACTIVE':
      return { ...state, activeConversationId: action.payload };
    case 'SET_PREFERENCES':
      return { ...state, preferences: action.payload, sidebarOpen: action.payload.sidebarOpen };
    case 'SET_THEME':
      return { ...state, preferences: { ...state.preferences, theme: action.payload } };
    case 'SET_DEFAULT_MODEL':
      return { ...state, preferences: { ...state.preferences, defaultModel: action.payload } };
    case 'TOGGLE_SIDEBAR':
      return { ...state, sidebarOpen: !state.sidebarOpen };
    case 'SET_SIDEBAR':
      return { ...state, sidebarOpen: action.payload };
    case 'SET_SEARCH':
      return { ...state, searchQuery: action.payload };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    default:
      return state;
  }
}

export interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
}

export const AppContext = createContext<AppContextType | null>(null);

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
