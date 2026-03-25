import { useRef, useEffect } from 'react';
import { ShieldAlert } from 'lucide-react';

interface LoginScreenProps {
  renderGoogleButton: (el: HTMLElement | null) => void;
  error: string | null;
  isLoading: boolean;
}

export function LoginScreen({ renderGoogleButton, error, isLoading }: LoginScreenProps) {
  const btnRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isLoading && btnRef.current) {
      renderGoogleButton(btnRef.current);
    }
  }, [isLoading, renderGoogleButton]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-white/10 backdrop-blur-xl rounded-3xl border border-white/10 shadow-2xl p-8 text-center">
          {/* Logo */}
          <img src="/logo-full.png" alt="OneSoul 玩獸" className="w-48 mx-auto mb-4 drop-shadow-2xl" />
          <h1 className="text-3xl font-black text-white mb-1 tracking-tight">OneSoul POS</h1>
          <p className="text-white/50 text-sm mb-8">銷售管理系統</p>

          {/* Error */}
          {error && (
            <div className="mb-6 bg-rose-500/20 border border-rose-400/30 rounded-xl px-4 py-3 flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <p className="text-rose-200 text-sm text-left leading-relaxed">{error}</p>
            </div>
          )}

          {/* Google Button */}
          <div className="flex justify-center mb-6">
            {isLoading ? (
              <div className="flex items-center gap-2 text-white/50 text-sm">
                <div className="w-5 h-5 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
                載入中…
              </div>
            ) : (
              <div ref={btnRef} />
            )}
          </div>

          {/* Footer hint */}
          <p className="text-white/30 text-xs">
            僅限授權帳號登入
          </p>
        </div>

        {/* Bottom text */}
        <p className="text-center text-white/20 text-xs mt-6">
          © {new Date().getFullYear()} OneSoul — All rights reserved
        </p>
      </div>
    </div>
  );
}
