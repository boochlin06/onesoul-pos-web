import { useState, useCallback, useEffect, useRef } from 'react';
import { GOOGLE_CLIENT_ID } from '../constants';
import type { Branch } from '../types';
import { getAllowedBranches, isTokenExpired, getRefreshDelay, parseCredential } from '../logic/auth';

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

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const saved = sessionStorage.getItem('os_auth_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const googleInitialized = useRef(false);

  const handleCredentialResponse = useCallback((response: any) => {
    const { authUser, error: parseError } = parseCredential(response.credential);
    if (parseError || !authUser) {
      setError(parseError);
      return;
    }
    sessionStorage.setItem('os_auth_user', JSON.stringify(authUser));
    setUser(authUser);
    setError(null);
  }, []);

  // Initialize Google Identity Services
  useEffect(() => {
    if (googleInitialized.current) return;

    const initGoogle = () => {
      if (!window.google?.accounts?.id) {
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

  // Token 自動刷新 — 到期前 5 分鐘靜默取得新 credential
  useEffect(() => {
    if (!user) return;

    if (isTokenExpired(user.idToken)) {
      sessionStorage.removeItem('os_auth_user');
      setUser(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(false);

    const delay = getRefreshDelay(user.idToken);
    if (delay === null) return;

    const timer = setTimeout(() => {
      if (window.google?.accounts?.id) {
        window.google.accounts.id.prompt();
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [user]);

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

  const allowedBranches: Branch[] = user ? getAllowedBranches(user.email) : [];

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
