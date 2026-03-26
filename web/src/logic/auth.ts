import { AUTH_ROLES } from '../constants';
import type { Branch } from '../types';

/**
 * Decode JWT payload without library.
 * Returns parsed payload object or null on failure.
 */
export function decodeJwtPayload(token: string): any {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  } catch { return null; }
}

/**
 * Check if an email is in the AUTH_ROLES whitelist.
 * Returns the roles array if authorized, or null if not.
 */
export function getAuthorizedRoles(email: string): Branch[] | null {
  const normalized = email.toLowerCase();
  return AUTH_ROLES[normalized] || null;
}

/**
 * Get allowed branches for an email.
 * Returns empty array if not authorized.
 */
export function getAllowedBranches(email: string): Branch[] {
  return getAuthorizedRoles(email) || [];
}

/**
 * Check if a JWT token is expired.
 * Returns true if expired, false otherwise.
 * If token is invalid (no exp claim), returns true (treat as expired).
 */
export function isTokenExpired(token: string, nowMs = Date.now()): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) return true;
  return payload.exp * 1000 < nowMs;
}

/**
 * Calculate delay in ms before token refresh should occur.
 * Refreshes 5 minutes before expiry, minimum 10 seconds.
 * Returns null if token is invalid or already expired.
 */
export function getRefreshDelay(token: string, nowMs = Date.now()): number | null {
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) return null;
  const expMs = payload.exp * 1000;
  if (expMs < nowMs) return null; // already expired
  return Math.max(expMs - nowMs - 5 * 60 * 1000, 10_000);
}

/**
 * Build AuthUser from a credential response.
 * Returns { authUser, error } — one will be non-null.
 */
export function parseCredential(credential: string): { authUser: { email: string; name: string; picture: string; idToken: string } | null; error: string | null } {
  const payload = decodeJwtPayload(credential);
  if (!payload?.email) {
    return { authUser: null, error: '無法解析登入資訊' };
  }
  const email = payload.email.toLowerCase();
  const roles = getAuthorizedRoles(email);
  if (!roles) {
    return { authUser: null, error: `⚠️ ${email} 不在授權名單中` };
  }
  return {
    authUser: {
      email,
      name: payload.name || email,
      picture: payload.picture || '',
      idToken: credential,
    },
    error: null,
  };
}
