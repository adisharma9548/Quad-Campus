import React, { Suspense, lazy } from 'react';
import { useIsAdmin } from '../hooks/useIsAdmin';
import NotFoundPage from '../screens/NotFoundPage';
import { Spinner } from './ui';

import type { NavigateFn } from '../types/quad';

// Code-split / lazy-load the Admin Panel so it is never included in the initial bundle
// and never fetched over the network by unauthenticated or non-admin users.
const LazyAdminPanel = lazy(() => import('../screens/admin/AdminPanel'));

/**
 * AdminRouteGuard
 * 
 * Strict stealth authorization guard:
 * 1. If session is loading: renders a clean loading state.
 * 2. If the user does NOT possess the verified admin role (or is logged out):
 *    Renders the app's standard 404 Not Found screen.
 *    Does NOT redirect to login, does NOT prompt for admin credentials,
 *    and reveals zero hints that /admin is a recognized endpoint.
 * 3. Only when role === "admin" is cryptographically verified does it load and render the Admin Panel.
 */
export default function AdminRouteGuard({ onNavigate }: { onNavigate: NavigateFn }) {
  const { isAdmin, isLoading } = useIsAdmin();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-canvas text-ink flex items-center justify-center p-6">
        <Spinner size="lg" />
      </div>
    );
  }

  // Non-admins and unauthenticated users receive the standard 404 Page Not Found
  if (!isAdmin) {
    return <NotFoundPage onNavigate={onNavigate} />;
  }

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-canvas text-ink flex items-center justify-center p-6">
          <Spinner size="lg" />
        </div>
      }
    >
      <LazyAdminPanel onNavigate={onNavigate} />
    </Suspense>
  );
}
