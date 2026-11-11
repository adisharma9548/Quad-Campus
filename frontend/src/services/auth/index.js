import { MockAuthService } from './mockAuthService';
import { RealApiAuthService } from './realAuthService';
import { IAuthService, AuthError } from './authInterface';

/**
 * Global Auth Configuration Switch
 *
 * Set VITE_AUTH_MODE=real in .env to connect to real backend API services.
 * Defaults to 'mock' for local, offline development.
 */
export const AUTH_MODE = (import.meta.env?.VITE_AUTH_MODE || 'mock').toLowerCase();

/**
 * Factory for Auth Service Implementation
 */
function createAuthService() {
  if (AUTH_MODE === 'real') {
    return new RealApiAuthService();
  }

  return new MockAuthService();
}

export const authService = createAuthService();

export { IAuthService, AuthError };
export default authService;
