import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import type { UserProfile } from '../types/quad';

export interface UseIsAdminResult {
  isAdmin: boolean;
  isLoading: boolean;
  adminUser: UserProfile | null;
}

/**
 * useIsAdmin hook
 * Evaluates whether the currently authenticated session carries the 'admin' role
 * and has not expired.
 *
 * NOTE (Security):
 * Frontend gating is cosmetic. Real admin authorization MUST be verified
 * on the backend for every privileged API request via signed JWTs or server sessions.
 */
export function useIsAdmin(): UseIsAdminResult {
  const { user, session, isLoading } = useAuth();
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    if (!session?.expiresAt) {
      return;
    }

    const checkExpiry = () => {
      setIsExpired(Date.now() > session.expiresAt);
    };

    checkExpiry();
    const timer = setInterval(checkExpiry, 10000);
    return () => clearInterval(timer);
  }, [session?.expiresAt]);

  const isAdmin = Boolean(
    !isLoading &&
      !isExpired &&
      user &&
      user.role === 'admin' &&
      session &&
      session.role === 'admin'
  );

  return {
    isAdmin,
    isLoading,
    adminUser: isAdmin ? user : null,
  };
}

export default useIsAdmin;
