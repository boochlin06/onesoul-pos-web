import { useState, useCallback, useRef } from 'react';

export interface BannerState {
  msg: string;
  type: 'ok' | 'err' | 'loading';
}

export function useBanner() {
  const [banner, setBanner] = useState<BannerState | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const showBanner = useCallback((msg: string, type: BannerState['type'], autoDismiss = true) => {
    clearTimeout(timerRef.current);
    setBanner({ msg, type });
    if (autoDismiss) {
      timerRef.current = setTimeout(() => setBanner(null), 3500);
    }
  }, []);

  const clearBanner = useCallback(() => {
    clearTimeout(timerRef.current);
    setBanner(null);
  }, []);

  return { banner, showBanner, clearBanner };
}
