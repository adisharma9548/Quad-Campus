import { MockAuthService } from './mockAuthService';
import { RealApiAuthService } from './realAuthService';
import { IAuthService, AuthError } from './authInterface';

/**
 * Global Auth Configuration Switch
 *
 * Set VITE_AUTH_MODE=real in .env to connect to real backend API services.
 * Defaults to 'mock' for local, offline development.
 */
export const AUTH_MODE: 'real' | 'mock' = __AUTH_REAL__ ? 'real' : 'mock';

/**
 * Factory for Auth Service Implementation
 */
function createAuthService(): IAuthService {
  if (__AUTH_REAL__) {
    return new RealApiAuthService();
  }

  return new MockAuthService();
}

export const authService: IAuthService = createAuthService();

export { IAuthService, AuthError };
export default authService;
