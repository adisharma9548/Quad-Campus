import { IAuthService, AuthError } from './authInterface';
import type {
  AuthResult,
  LoginCredentials,
  SignUpPayload,
  UsernameCheckResult,
  UserProfile,
} from '../../types/quad';
import { apiRequest, clearAuthToken, getAuthToken, setAuthToken } from '../apiClient';

interface ErrLike {
  message?: string;
  code?: string;
  status?: number;
  isLockedOut?: boolean;
  lockoutRemainingSeconds?: number;
  consecutiveFailures?: number;
}

function toAuthError(err: unknown): AuthError {
  if (err instanceof AuthError) return err;
  const e = (err && typeof err === 'object' ? err : {}) as ErrLike;
  return new AuthError(
    e.message || 'Authentication request failed.',
    e.code || 'AUTH_ERROR',
    e.status || 400,
    {
      isLockedOut: e.isLockedOut || false,
      lockoutRemainingSeconds: e.lockoutRemainingSeconds || 0,
      consecutiveFailures: e.consecutiveFailures || 0,
    }
  );
}

/**
 * Real Backend Auth Service connected to Fastify + SQLite REST API.
 */
export class RealApiAuthService extends IAuthService {
  async signUp(params: SignUpPayload): Promise<AuthResult> {
    try {
      const data = await apiRequest<AuthResult>('/auth/signup', {
        method: 'POST',
        body: params,
      });
      if (data?.session?.token) {
        setAuthToken(data.session.token);
      }
      return data;
    } catch (err) {
      throw toAuthError(err);
    }
  }

  async logIn({ identifier, password }: LoginCredentials): Promise<AuthResult> {
    try {
      const data = await apiRequest<AuthResult>('/auth/login', {
        method: 'POST',
        body: { identifier, password },
      });
      if (data?.session?.token) {
        setAuthToken(data.session.token);
      }
      return data;
    } catch (err) {
      throw toAuthError(err);
    }
  }

  async logOut(): Promise<void> {
    try {
      if (getAuthToken()) {
        await apiRequest('/auth/logout', { method: 'POST' });
      }
    } catch {
      // Clear local session token regardless of transient network errors
    } finally {
      clearAuthToken();
    }
  }

  async getSession(): Promise<AuthResult | null> {
    if (!getAuthToken()) return null;
    try {
      return await apiRequest<AuthResult>('/auth/session', { method: 'GET' });
    } catch (err) {
      const status = (err as ErrLike | null)?.status;
      if (status === 401 || status === 403) {
        clearAuthToken();
        return null;
      }
      throw toAuthError(err);
    }
  }

  async checkUsernameAvailable(username: string): Promise<UsernameCheckResult> {
    try {
      return await apiRequest<UsernameCheckResult>(
        `/users/check-username?q=${encodeURIComponent(username)}`,
        {
          method: 'GET',
        }
      );
    } catch {
      return { available: false };
    }
  }

  async updateProfile(updates: Partial<UserProfile>): Promise<UserProfile> {
    try {
      return await apiRequest<UserProfile>('/users/me', {
        method: 'PATCH',
        body: updates,
      });
    } catch (err) {
      throw toAuthError(err);
    }
  }

  async requestPasswordReset(
    identifier: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      return await apiRequest<{ success: boolean; message: string }>(
        '/auth/forgot-password',
        {
          method: 'POST',
          body: { identifier },
        }
      );
    } catch (err) {
      throw toAuthError(err);
    }
  }

  async verifyPassword(password: string): Promise<boolean> {
    try {
      const res = await apiRequest<{ verified?: boolean }>('/auth/verify-password', {
        method: 'POST',
        body: { password },
      });
      return Boolean(res?.verified);
    } catch (err) {
      throw toAuthError(err);
    }
  }

  async exportMyData(): Promise<Record<string, unknown>> {
    return apiRequest<Record<string, unknown>>('/users/me/export', { method: 'GET' });
  }

  async deleteMyAccount(): Promise<Record<string, unknown>> {
    const res = await apiRequest<Record<string, unknown>>('/users/me', { method: 'DELETE' });
    clearAuthToken();
    return res;
  }
}
