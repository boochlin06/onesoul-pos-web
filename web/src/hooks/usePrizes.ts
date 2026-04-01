import { useState, useCallback } from 'react';
import type { PrizeEntry } from '../types';
import type { Branch } from '../types';
import { gasPost } from '../services/api';
import type { BannerState } from './useBanner';
import { MSG } from '../constants/messages';

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
      showBanner(MSG.prizes.crossBranchVoid(prizeBranch), 'err');
      setVoidConfirmPrize(null);
      return;
    }
    const { setId } = voidConfirmPrize[0];
    setVoidingPrizeLoading(true);
    showBanner(MSG.prizes.voiding, 'loading', false);
    gasPost('deletePrizeLibraryFast', { branch, setId })
      .then(res => {
        if (res.success) { 
          showBanner('作廢成功，正在背景彙整廢套紀錄...', 'loading', false); 
          fetchLibrary(); 
          setVoidConfirmPrize(null); 
          
          if (res.data?.matchedRows) {
            gasPost('calculateVoidLog', { branch, setId, matchedRows: res.data.matchedRows })
              .then(logRes => {
                if (logRes.success) showBanner('廢套紀錄彙整完成', 'ok');
                else console.error('背景彙整失敗:', logRes.message);
              })
              .catch(e => console.error('背景彙整異常:', e));
          } else {
            showBanner(MSG.prizes.voidSuccess, 'ok');
          }
        }
        else { showBanner(MSG.prizes.voidFail(res.message), 'err'); }
      })
      .catch(e => { console.error('[usePrizes] executeVoidPrize failed:', e); showBanner(MSG.prizes.voidNetworkFail, 'err'); })
      .finally(() => setVoidingPrizeLoading(false));
  }, [branch, voidConfirmPrize, showBanner, fetchLibrary]);

  return {
    prizes, loadingLibrary, fetchLibrary,
    voidingPrizeLoading, voidConfirmPrize, setVoidConfirmPrize,
    handleDeletePrize, executeVoidPrize,
  };
}
