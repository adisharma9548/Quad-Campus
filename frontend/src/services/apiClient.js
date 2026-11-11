/**
 * Shared HTTP API Client for Quad Campus Backend
 */

export const API_BASE_URL = (import.meta.env?.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '');
export const IS_REAL_BACKEND =
  (import.meta.env?.VITE_AUTH_MODE || 'mock').toLowerCase() === 'real';

const TOKEN_STORAGE_KEY = 'quad_session_token';

export function getAuthToken() {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function setAuthToken(token) {
  try {
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // ignore storage failures
  }
}

export function clearAuthToken() {
  setAuthToken('');
}

export class ApiError extends Error {
  constructor(message, code = 'API_ERROR', status = 500, extra = {}) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.isLockedOut = extra.isLockedOut || false;
    this.lockoutRemainingSeconds = extra.lockoutRemainingSeconds || 0;
    this.consecutiveFailures = extra.consecutiveFailures || 0;
    this.retryAfterSec = extra.retryAfterSec || 0;
  }
}

export function resolveApiMediaUrl(urlOrPath) {
  if (!urlOrPath) return '';
  if (urlOrPath.startsWith('http://') || urlOrPath.startsWith('https://') || urlOrPath.startsWith('data:')) {
    return urlOrPath;
  }
  const token = getAuthToken();
  const base = urlOrPath.startsWith('/') ? urlOrPath : `/${urlOrPath}`;
  if (!token) return base;
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}token=${encodeURIComponent(token)}`;
}

export async function apiRequest(path, { method = 'GET', body, formData, headers = {} } = {}) {
  const normalizedPath = path.startsWith('/api/')
    ? path
    : `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;

  const reqHeaders = { ...headers };
  const token = getAuthToken();
  if (token && !reqHeaders.Authorization && !reqHeaders.authorization) {
    reqHeaders.Authorization = `Bearer ${token}`;
  }

  let requestBody;
  if (formData instanceof FormData) {
    requestBody = formData;
  } else if (body !== undefined) {
    reqHeaders['Content-Type'] = 'application/json';
    requestBody = JSON.stringify(body);
  }

  const response = await fetch(normalizedPath, {
    method,
    headers: reqHeaders,
    body: requestBody,
    credentials: 'include',
  });

  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json() : await response.text();

  if (!response.ok) {
    const errPayload = (data && typeof data === 'object' && data.error) ? data.error : {};
    throw new ApiError(
      errPayload.message || (typeof data === 'string' && data) || `Request failed (${response.status})`,
      errPayload.code || 'API_ERROR',
      response.status,
      errPayload
    );
  }

  return data;
}
