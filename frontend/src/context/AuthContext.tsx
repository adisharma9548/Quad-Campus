import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { authService, AuthError } from '../services/auth';
import type {
  AuthResult,
  LoginCredentials,
  SignUpPayload,
  UserProfile,
  UserSession,
  UsernameCheckResult,
} from '../types/quad';

export interface AuthContextValue {
  user: UserProfile | null;
  session: UserSession | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signUp: (params: SignUpPayload) => Promise<AuthResult>;
  logIn: (credentials: LoginCredentials) => Promise<AuthResult>;
  logOut: () => Promise<void>;
  checkUsernameAvailable: (username: string) => Promise<UsernameCheckResult>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<UserProfile>;
  requestPasswordReset: (identifier: string) => Promise<{ message?: string }>;
  verifyPassword: (password: string) => Promise<boolean>;
  exportMyData: () => Promise<unknown>;
  deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  isLoading: true,
  isAuthenticated: false,
  signUp: async () => {
    throw new Error('AuthProvider missing');
  },
  logIn: async () => {
    throw new Error('AuthProvider missing');
  },
  logOut: async () => {},
  checkUsernameAvailable: async () => ({ available: false }),
  updateProfile: async () => {
    throw new Error('AuthProvider missing');
  },
  requestPasswordReset: async () => ({}),
  verifyPassword: async () => false,
  exportMyData: async () => ({}),
  deleteAccount: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<UserSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session on app boot
  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      try {
        const stored = await authService.getSession();
        if (mounted && stored) {
          setUser(stored.user);
          setSession(stored.session);
        }
      } catch (err) {
        console.warn('Session restoration failed:', err);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    loadSession();

    return () => {
      mounted = false;
    };
  }, []);

  const signUp = useCallback(async (params: SignUpPayload) => {
    const result = await authService.signUp(params);
    setUser(result.user);
    setSession(result.session);
    return result;
  }, []);

  const logIn = useCallback(async (credentials: LoginCredentials) => {
    const result = await authService.logIn(credentials);
    setUser(result.user);
    setSession(result.session);
    return result;
  }, []);

  const logOut = useCallback(async () => {
    await authService.logOut();
    setUser(null);
    setSession(null);
  }, []);

  const checkUsernameAvailable = useCallback(async (username: string) => {
    return authService.checkUsernameAvailable(username);
  }, []);

  const updateProfile = useCallback(async (updates: Partial<UserProfile>) => {
    const updated = await authService.updateProfile(updates);
    setUser(updated);
    return updated;
  }, []);

  const requestPasswordReset = useCallback(async (identifier: string) => {
    return authService.requestPasswordReset(identifier);
  }, []);

  const verifyPassword = useCallback(async (password: string) => {
    return authService.verifyPassword(password);
  }, []);

  const exportMyData = useCallback(async () => {
    if ('exportMyData' in authService && typeof authService.exportMyData === 'function') {
      return authService.exportMyData();
    }
    return { exportedAt: new Date().toISOString(), profile: user };
  }, [user]);

  const deleteAccount = useCallback(async () => {
    if ('deleteMyAccount' in authService && typeof authService.deleteMyAccount === 'function') {
      await authService.deleteMyAccount();
    } else {
      await authService.logOut();
    }
    setUser(null);
    setSession(null);
  }, []);

  const value = {
    user,
    session,
    isLoading,
    isAuthenticated: Boolean(user),
    signUp,
    logIn,
    logOut,
    checkUsernameAvailable,
    updateProfile,
    requestPasswordReset,
    verifyPassword,
    exportMyData,
    deleteAccount,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
export { AuthError };
export default AuthContext;
