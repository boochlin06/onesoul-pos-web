import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCheckout } from '../hooks/useCheckout';
import { edgePosClient } from '../services/edgeClient';
import { sendPrintJob } from '../services/printClient';
import type { PrizeEntry, StockEntry, BlindBoxEntry, MemberEntry } from '../types';

// Mock dependencies
vi.mock('../services/api', () => ({
  gasPost: vi.fn(),
  apiSaveDraft: vi.fn().mockResolvedValue({ success: true }),
  apiClearDraft: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('../services/edgeClient', () => ({
  edgePosClient: {
    checkout: vi.fn(),
  },
}));

vi.mock('../services/printClient', () => ({
  sendPrintJob: vi.fn().mockResolvedValue({ success: true }),
}));

describe('useCheckout Hook (收銀台狀態機與操作流程測試)', () => {
  const mockPrizes: PrizeEntry[] = [
    {
      setId: 'S1',
      setName: '海賊王一番賞',
      unitPrice: 350,
      prize: 'A',
      prizeId: 'PID_A',
      prizeName: '魯夫模型',
      points: 100,
      draws: 2,
      date: '2026/04/20',
      branch: '竹北',
      isPointsSet: false,
    },
    {
      setId: 'PS1',
      setName: '限定點數套',
      unitPrice: 400,
      prize: 'A',
      prizeId: 'PID_PSA',
      prizeName: '特賞公仔',
      points: 0,
      draws: 5,
      date: '2026/04/20',
      branch: '竹北',
      isPointsSet: true,
    },
  ];

  const mockStocks: StockEntry[] = [
    {
      id: '100065',
      name: '航海王GK雕像',
      points: 50,
      category: 'GK海賊王',
      quantity: 5,
      remark: '',
      branch: '竹北',
    },
  ];

  const mockBlindBoxes: BlindBoxEntry[] = [
    {
      id: 'BB001',
      name: '泡泡瑪特盲盒',
      points: 5,
      manualPrice: 300,
      autoSuggestPrice: 280,
      cost: 150,
      prizePoints: 5,
      inventory: 20,
      category: '盲盒',
      configuring: 0,
      shipped: 0,
      remaining: 20,
      remark: '',
    },
  ];

  const mockMembers: MemberEntry[] = [
    {
      phone: '0912345678',
      name: '王小明',
      gender: 'M',
      birthday: '1990/01/01',
      store: '竹北',
      points: 200,
      note: '',
      duplicate: '',
      timestamp: '',
    },
  ];

  const showBannerMock = vi.fn();
  const setMembersMock = vi.fn();
  const fetchMembersMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  const getHook = () =>
    renderHook(() =>
      useCheckout({
        branch: '竹北',
        prizes: mockPrizes,
        stocks: mockStocks,
        allStocks: mockStocks,
        blindBoxes: mockBlindBoxes,
        members: mockMembers,
        setMembers: setMembersMock,
        fetchMembers: fetchMembersMock,
        showBanner: showBannerMock,
        email: 'cashier@onesoul.com',
      })
    );

  it('初始狀態初始化正確：5 列空福袋與 2 列空直購商品', () => {
    const { result } = getHook();
    expect(result.current.lotteries).toHaveLength(5);
    expect(result.current.merchandises).toHaveLength(2);
    expect(result.current.customer.phoneName).toBe('');
    expect(result.current.customer.currentPoints).toBe(0);
    expect(result.current.payment.cash).toBe(0);
    expect(result.current.summary.dueAmount).toBe(0);
  });

  it('支援增刪福袋列與商品列', () => {
    const { result } = getHook();

    act(() => {
      result.current.addLotteryRow();
    });
    expect(result.current.lotteries).toHaveLength(6);

    act(() => {
      result.current.removeLotteryRow(0);
    });
    expect(result.current.lotteries).toHaveLength(5);

    act(() => {
      result.current.addMerchRow();
    });
    expect(result.current.merchandises).toHaveLength(3);

    act(() => {
      result.current.removeMerchRow(0);
    });
    expect(result.current.merchandises).toHaveLength(2);
  });

  it('選取快取會員可自動帶入電話、姓名與點數', () => {
    const { result } = getHook();

    act(() => {
      result.current.selectCacheMember(mockMembers[0]);
    });

    expect(result.current.customer.name).toBe('王小明');
    expect(result.current.customer.phoneName).toBe('0912345678');
    expect(result.current.customer.currentPoints).toBe(200);
    expect(showBannerMock).toHaveBeenCalledWith(expect.stringContaining('王小明'), 'ok');
  });

  it('更新一番賞套組與獎項時自動聯動計算金額與點數', () => {
    const { result } = getHook();

    act(() => {
      result.current.updateLottery(0, 'id', 'S1');
    });
    expect(result.current.lotteries[0].setName).toBe('海賊王一番賞');
    expect(result.current.lotteries[0].unitPrice).toBe(350);

    act(() => {
      result.current.updateLottery(0, 'prize', 'A');
      result.current.updateLottery(0, 'draws', 2);
    });
    expect(result.current.lotteries[0].prizeName).toBe('魯夫模型');
    expect(result.current.lotteries[0].amount).toBe(700);
  });

  it('更新限定點數套時金額為 0 且自動扣除點數', () => {
    const { result } = getHook();

    act(() => {
      result.current.updateLottery(0, 'id', 'PS1');
      result.current.updateLottery(0, 'prize', 'A');
      result.current.updateLottery(0, 'draws', 2);
    });

    expect(result.current.lotteries[0].amount).toBe(0);
    expect(result.current.lotteries[0].remark).toBe('點數套');
    expect(result.current.lotteries[0].pointsCost).toBe(40); // 400/20 * 2 = 40
  });

  it('更新直購商品時自動關聯庫存與價格', () => {
    const { result } = getHook();

    act(() => {
      result.current.updateMerch(0, 'id', 'BB001');
    });

    expect(result.current.merchandises[0].name).toBe('泡泡瑪特盲盒');
    expect(result.current.merchandises[0].actualAmount).toBe(300);
  });

  it('重置結帳表單 (handleResetCheckout) 正確清空所有資料', () => {
    const { result } = getHook();

    act(() => {
      result.current.updateMerch(0, 'id', 'BB001');
      result.current.setCustomer(p => ({ ...p, phoneName: '0912345678', name: '王小明' }));
    });

    act(() => {
      result.current.handleResetCheckout();
    });

    expect(result.current.customer.phoneName).toBe('');
    expect(result.current.customer.name).toBe('');
    expect(result.current.merchandises[0].name).toBe('');
    expect(showBannerMock).toHaveBeenCalledWith(expect.stringContaining('已清空'), 'ok');
  });

  it('結帳預檢 (handlePreCheckout) 失敗時顯示防呆 Banner，不開啟確認視窗', () => {
    const { result } = getHook();

    // 購物車為空直接結帳
    act(() => {
      result.current.handlePreCheckout();
    });

    expect(result.current.isConfirmModalOpen).toBe(false);
    expect(showBannerMock).toHaveBeenCalledWith(expect.stringContaining('無法結帳'), 'err');
  });

  it('散客嘗試扣點時，結帳預檢阻斷並報錯', () => {
    const { result } = getHook();

    act(() => {
      result.current.setCustomer(p => ({ ...p, phoneName: '111111', name: '散客' }));
      result.current.updateMerch(0, 'id', 'BB001');
      result.current.setPayment(p => ({ ...p, cash: 200, pointsUsed: 100 }));
    });

    act(() => {
      result.current.handlePreCheckout();
    });

    expect(result.current.isConfirmModalOpen).toBe(false);
    expect(showBannerMock).toHaveBeenCalledWith(expect.stringContaining('散客無會員帳號'), 'err');
  });

  it('結帳提交 (handleCheckout) 成功時，呼叫 edgePosClient.checkout 注入 checkoutUID 與 storeId，並非同步觸發 sendPrintJob', async () => {
    const { result } = getHook();
    const mockCheckout = vi.mocked(edgePosClient.checkout);
    mockCheckout.mockResolvedValueOnce({
      success: true,
      message: '結帳成功',
      orderId: 'ord-test-999',
      checkoutUID: 'uid-test-123',
      newPoints: 250,
    });

    act(() => {
      result.current.selectCacheMember(mockMembers[0]);
      result.current.updateMerch(0, 'id', 'BB001');
      result.current.setPayment(p => ({ ...p, cash: 300 }));
    });

    await act(async () => {
      await result.current.handleCheckout();
    });

    // 驗證呼叫 edgePosClient.checkout
    expect(mockCheckout).toHaveBeenCalledTimes(1);
    const checkoutPayload = mockCheckout.mock.calls[0][0];
    expect(checkoutPayload.storeId).toBe('chupei');
    expect(checkoutPayload.checkoutUID).toBeDefined();
    expect(typeof checkoutPayload.checkoutUID).toBe('string');
    expect(checkoutPayload.customer.name).toBe('王小明');
    expect(checkoutPayload.merchandises).toHaveLength(1);
    expect(checkoutPayload.cashierEmail).toBe('cashier@onesoul.com');

    // 驗證非同步發送出單
    expect(sendPrintJob).toHaveBeenCalledTimes(1);
    const printPayload = vi.mocked(sendPrintJob).mock.calls[0][0];
    expect(printPayload.orderId).toBe('ord-test-999');
    expect(printPayload.storeId).toBe('chupei');
    expect(printPayload.items).toHaveLength(1);
    expect(printPayload.payment.cash).toBe(300);

    // 驗證 Banner 與表單重置
    expect(showBannerMock).toHaveBeenCalledWith(expect.stringContaining('結帳成功'), 'ok');
    expect(result.current.customer.phoneName).toBe('');
  });

  it('結帳成功但本機出單 (sendPrintJob) 失敗時，結帳依然成功，不拋出例外 (Non-blocking Invariant)', async () => {
    const { result } = getHook();
    const mockCheckout = vi.mocked(edgePosClient.checkout);
    mockCheckout.mockResolvedValueOnce({
      success: true,
      message: '結帳成功',
      orderId: 'ord-print-fail-1',
      checkoutUID: 'uid-fail-456',
      newPoints: 200,
    });
    vi.mocked(sendPrintJob).mockRejectedValueOnce(new Error('Printer offline / paper jam'));

    act(() => {
      result.current.selectCacheMember(mockMembers[0]);
      result.current.updateMerch(0, 'id', 'BB001');
      result.current.setPayment(p => ({ ...p, cash: 300 }));
    });

    await act(async () => {
      await result.current.handleCheckout();
    });

    // 出單失敗不阻斷結帳成功
    expect(showBannerMock).toHaveBeenCalledWith(expect.stringContaining('結帳成功'), 'ok');
    expect(result.current.customer.phoneName).toBe('');
  });

  it('結帳被後端拒絕 (success: false) 時，不觸發 sendPrintJob 出單', async () => {
    const { result } = getHook();
    const mockCheckout = vi.mocked(edgePosClient.checkout);
    mockCheckout.mockResolvedValueOnce({
      success: false,
      message: '商品庫存不足',
    });

    act(() => {
      result.current.selectCacheMember(mockMembers[0]);
      result.current.updateMerch(0, 'id', 'BB001');
      result.current.setPayment(p => ({ ...p, cash: 300 }));
    });

    await act(async () => {
      await result.current.handleCheckout();
    });

    expect(sendPrintJob).not.toHaveBeenCalled();
    expect(showBannerMock).toHaveBeenCalledWith(expect.stringContaining('商品庫存不足'), 'err');
  });
});
