import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

/**
 * useIsAdmin hook
 * Evaluates whether the currently authenticated session carries the 'admin' role
 * and has not expired.
 *
 * NOTE (Security):
 * Frontend gating is cosmetic. Real admin authorization MUST be verified
 * on the backend for every privileged API request via signed JWTs or server sessions.
 *
 * @returns {{ isAdmin: boolean, isLoading: boolean, adminUser: object | null }}
 */
export function useIsAdmin() {
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
