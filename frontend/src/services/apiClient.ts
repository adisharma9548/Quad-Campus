/**
 * Shared HTTP API Client for Quad Campus Backend
 */

export const API_BASE_URL = (import.meta.env?.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '');
export const IS_REAL_BACKEND: boolean = __AUTH_REAL__;

const TOKEN_STORAGE_KEY = 'quad_session_token';

export function getAuthToken() {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export interface ApiErrorExtra {
  isLockedOut?: boolean;
  lockoutRemainingSeconds?: number;
  consecutiveFailures?: number;
  retryAfterSec?: number;
  message?: string;
  code?: string;
}

export interface ApiRequestOptions {
  method?: string;
  body?: unknown;
  formData?: FormData;
  headers?: Record<string, string>;
}

export function setAuthToken(token: string) {
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
  code: string;
  status: number;
  isLockedOut: boolean;
  lockoutRemainingSeconds: number;
  consecutiveFailures: number;
  retryAfterSec: number;

  constructor(
    message: string,
    code = 'API_ERROR',
    status = 500,
    extra: ApiErrorExtra = {}
  ) {
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

export function resolveApiMediaUrl(urlOrPath?: string | null): string {
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

export async function apiRequest<T = Record<string, unknown>>(
  path: string,
  { method = 'GET', body, formData, headers = {} }: ApiRequestOptions = {}
): Promise<T> {
  const normalizedPath = path.startsWith('/api/')
    ? path
    : `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;

  const reqHeaders: Record<string, string> = { ...headers };
  const token = getAuthToken();
  if (token && !reqHeaders.Authorization && !reqHeaders.authorization) {
    reqHeaders.Authorization = `Bearer ${token}`;
  }

  let requestBody: BodyInit | undefined;
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
  const data = (
    contentType.includes('application/json') ? await response.json() : await response.text()
  ) as Record<string, unknown> | string;

  if (!response.ok) {
    const errPayload =
      data && typeof data === 'object' && 'error' in data && data.error && typeof data.error === 'object'
        ? (data.error as ApiErrorExtra)
        : {};
    throw new ApiError(
      errPayload.message || (typeof data === 'string' && data) || `Request failed (${response.status})`,
      errPayload.code || 'API_ERROR',
      response.status,
      errPayload
    );
  }

  return data as T;
}
