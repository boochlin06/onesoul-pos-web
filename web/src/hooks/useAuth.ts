import { useState, useCallback, useEffect, useRef } from 'react';
import { GOOGLE_CLIENT_ID, AUTH_ROLES } from '../constants';
import type { Branch } from '../types';

// ── Google GIS types ──
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: any) => void;
          renderButton: (el: HTMLElement, config: any) => void;
          prompt: () => void;
          revoke: (email: string, cb: () => void) => void;
        };
      };
    };
  }
}

export interface AuthUser {
  email: string;
  name: string;
  picture: string;
  idToken: string;
}

interface UseAuthReturn {
  user: AuthUser | null;
  isAuthenticated: boolean;
  allowedBranches: Branch[];
  isLoading: boolean;
  error: string | null;
  renderGoogleButton: (el: HTMLElement | null) => void;
  logout: () => void;
}

/** decode JWT payload without library */
function decodeJwtPayload(token: string): any {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  } catch { return null; }
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const saved = sessionStorage.getItem('os_auth_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const googleInitialized = useRef(false);

  const handleCredentialResponse = useCallback((response: any) => {
    const payload = decodeJwtPayload(response.credential);
    if (!payload?.email) {
      setError('無法解析登入資訊');
      return;
    }

    const email = payload.email.toLowerCase();
    const roles = AUTH_ROLES[email];

    if (!roles) {
      setError(`⚠️ ${email} 不在授權名單中`);
      return;
    }

    const authUser: AuthUser = {
      email,
      name: payload.name || email,
      picture: payload.picture || '',
      idToken: response.credential,
    };

    sessionStorage.setItem('os_auth_user', JSON.stringify(authUser));
    setUser(authUser);
    setError(null);
  }, []);

  // Initialize Google Identity Services
  useEffect(() => {
    if (googleInitialized.current) return;

    const initGoogle = () => {
      if (!window.google?.accounts?.id) {
        // GIS script not loaded yet, retry
        setTimeout(initGoogle, 200);
        return;
      }

      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse,
        auto_select: true,
        cancel_on_tap_outside: false,
      });

      googleInitialized.current = true;
      setIsLoading(false);
    };

    initGoogle();
  }, [handleCredentialResponse]);

  // Check existing session token validity
  useEffect(() => {
    if (user) {
      const payload = decodeJwtPayload(user.idToken);
      if (payload?.exp && payload.exp * 1000 < Date.now()) {
        // Token expired → logout
        sessionStorage.removeItem('os_auth_user');
        setUser(null);
      }
      setIsLoading(false);
    }
  }, []);

  const renderGoogleButton = useCallback((el: HTMLElement | null) => {
    if (!el || !window.google?.accounts?.id) return;
    window.google.accounts.id.renderButton(el, {
      theme: 'outline',
      size: 'large',
      text: 'signin_with',
      shape: 'pill',
      width: 300,
      locale: 'zh-TW',
    });
  }, []);

  const logout = useCallback(() => {
    if (user?.email && window.google?.accounts?.id) {
      window.google.accounts.id.revoke(user.email, () => {});
    }
    sessionStorage.removeItem('os_auth_user');
    setUser(null);
    setError(null);
  }, [user]);

  const allowedBranches: Branch[] = user ? (AUTH_ROLES[user.email] || []) : [];

  return {
    user,
    isAuthenticated: !!user && allowedBranches.length > 0,
    allowedBranches,
    isLoading,
    error,
    renderGoogleButton,
    logout,
  };
}

/** get current idToken for API calls */
export function getIdToken(): string | null {
  const saved = sessionStorage.getItem('os_auth_user');
  if (!saved) return null;
  try { return JSON.parse(saved).idToken; }
  catch { return null; }
}
