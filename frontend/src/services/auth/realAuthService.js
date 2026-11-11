import { IAuthService, AuthError } from './authInterface';
import { apiRequest, clearAuthToken, getAuthToken, setAuthToken } from '../apiClient';

function toAuthError(err) {
  if (err instanceof AuthError) return err;
  return new AuthError(
    err?.message || 'Authentication request failed.',
    err?.code || 'AUTH_ERROR',
    err?.status || 400,
    {
      isLockedOut: err?.isLockedOut || false,
      lockoutRemainingSeconds: err?.lockoutRemainingSeconds || 0,
      consecutiveFailures: err?.consecutiveFailures || 0,
    }
  );
}

/**
 * Real Backend Auth Service connected to Fastify + SQLite REST API.
 */
export class RealApiAuthService extends IAuthService {
  async signUp(params) {
    try {
      const data = await apiRequest('/auth/signup', {
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

  async logIn({ identifier, password }) {
    try {
      const data = await apiRequest('/auth/login', {
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

  async logOut() {
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

  async getSession() {
    if (!getAuthToken()) return null;
    try {
      return await apiRequest('/auth/session', { method: 'GET' });
    } catch (err) {
      if (err?.status === 401 || err?.status === 403) {
        clearAuthToken();
        return null;
      }
      throw toAuthError(err);
    }
  }

  async checkUsernameAvailable(username) {
    try {
      return await apiRequest(`/users/check-username?q=${encodeURIComponent(username)}`, {
        method: 'GET',
      });
    } catch {
      return { available: false };
    }
  }

  async updateProfile(updates) {
    try {
      return await apiRequest('/users/me', {
        method: 'PATCH',
        body: updates,
      });
    } catch (err) {
      throw toAuthError(err);
    }
  }

  async requestPasswordReset(identifier) {
    try {
      return await apiRequest('/auth/forgot-password', {
        method: 'POST',
        body: { identifier },
      });
    } catch (err) {
      throw toAuthError(err);
    }
  }

  async verifyPassword(password) {
    try {
      const res = await apiRequest('/auth/verify-password', {
        method: 'POST',
        body: { password },
      });
      return Boolean(res?.verified);
    } catch (err) {
      throw toAuthError(err);
    }
  }

  async exportMyData() {
    return apiRequest('/users/me/export', { method: 'GET' });
  }

  async deleteMyAccount() {
    const res = await apiRequest('/users/me', { method: 'DELETE' });
    clearAuthToken();
    return res;
  }
}
