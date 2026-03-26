import { useState, useCallback } from 'react';
import type { PrizeEntry } from '../types';
import type { Branch } from '../types';
import { gasPost } from '../services/api';
import type { BannerState } from './useBanner';

interface UsePrizesDeps {
  branch: Branch;
  showBanner: (msg: string, type: BannerState['type'], autoDismiss?: boolean) => void;
}

export function usePrizes({ branch, showBanner }: UsePrizesDeps) {
  const [prizes, setPrizes] = useState<PrizeEntry[]>([]);
  const [loadingLibrary, setLoadingLibrary] = useState(true);

  const fetchLibrary = useCallback(() => {
    setLoadingLibrary(true);
    gasPost('getPrizeLibrary')
      .then(res => { if (res.success && res.data?.length) setPrizes(res.data); })
      .catch(e => console.error('[usePrizes] fetchLibrary failed:', e))
      .finally(() => setLoadingLibrary(false));
  }, []);

  // ── Voiding ──
  const [voidingPrizeLoading, setVoidingPrizeLoading] = useState(false);
  const [voidConfirmPrize, setVoidConfirmPrize] = useState<PrizeEntry[] | null>(null);

  const handleDeletePrize = useCallback((entries: PrizeEntry[]) => {
    if (!entries.length) return;
    setVoidConfirmPrize(entries);
  }, []);

  const executeVoidPrize = useCallback(() => {
    if (!voidConfirmPrize || !voidConfirmPrize.length) return;
    const prizeBranch = voidConfirmPrize[0].branch;
    if (prizeBranch && prizeBranch !== branch) {
      showBanner(`無法作廢其他門市（${prizeBranch}）的套組`, 'err');
      setVoidConfirmPrize(null);
      return;
    }
    const { setId } = voidConfirmPrize[0];
    setVoidingPrizeLoading(true);
    showBanner('執行整套作廢中...', 'loading', false);
    gasPost('deletePrizeLibrary', { branch, setId })
      .then(res => {
        if (res.success) { showBanner('整套獎項作廢成功！', 'ok'); fetchLibrary(); setVoidConfirmPrize(null); }
        else { showBanner(`作廢失敗：${res.message}`, 'err'); }
      })
      .catch(e => { console.error('[usePrizes] executeVoidPrize failed:', e); showBanner('網路錯誤，作廢失敗', 'err'); })
      .finally(() => setVoidingPrizeLoading(false));
  }, [branch, voidConfirmPrize, showBanner, fetchLibrary]);

  return {
    prizes, loadingLibrary, fetchLibrary,
    voidingPrizeLoading, voidConfirmPrize, setVoidConfirmPrize,
    handleDeletePrize, executeVoidPrize,
  };
}
