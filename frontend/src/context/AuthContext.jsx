import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authService, AuthError } from '../services/auth';

const AuthContext = createContext({
  user: null,
  session: null,
  isLoading: true,
  isAuthenticated: false,
  signUp: async () => {},
  logIn: async () => {},
  logOut: async () => {},
  checkUsernameAvailable: async () => ({ available: false }),
  updateProfile: async () => {},
  requestPasswordReset: async () => {},
  verifyPassword: async () => false,
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
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

  const signUp = useCallback(async (params) => {
    const result = await authService.signUp(params);
    setUser(result.user);
    setSession(result.session);
    return result;
  }, []);

  const logIn = useCallback(async (credentials) => {
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

  const checkUsernameAvailable = useCallback(async (username) => {
    return authService.checkUsernameAvailable(username);
  }, []);

  const updateProfile = useCallback(async (updates) => {
    const updated = await authService.updateProfile(updates);
    setUser(updated);
    return updated;
  }, []);

  const requestPasswordReset = useCallback(async (identifier) => {
    return authService.requestPasswordReset(identifier);
  }, []);

  const verifyPassword = useCallback(async (password) => {
    return authService.verifyPassword(password);
  }, []);

  const exportMyData = useCallback(async () => {
    if (typeof authService.exportMyData === 'function') {
      return authService.exportMyData();
    }
    return { exportedAt: new Date().toISOString(), profile: user };
  }, [user]);

  const deleteAccount = useCallback(async () => {
    if (typeof authService.deleteMyAccount === 'function') {
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
