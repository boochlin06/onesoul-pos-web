import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfirmCheckoutModal } from '../components/checkout/ConfirmCheckoutModal';
import { emptyLottery, emptyMerch } from '../logic/checkout';
import type { LotteryItem, MerchItem } from '../types';

describe('ConfirmCheckoutModal (結帳確認彈窗與防呆檢核)', () => {
  const baseLottery: LotteryItem = {
    ...emptyLottery(),
    id: 'SET-1',
    setName: '海賊王一番賞',
    prize: 'A',
    prizeName: '魯夫大賞公仔',
    draws: 1,
    type: '帶走',
    amount: 350,
  };

  const baseMerch: MerchItem = {
    ...emptyMerch(),
    id: 'BB-1',
    name: '盲盒商品',
    quantity: 1,
    paymentType: '現金',
    unitAmount: 350,
    actualAmount: 350,
  };

  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onConfirm: vi.fn(),
    lotteries: [baseLottery],
    merchandises: [baseMerch],
    summary: { dueAmount: 700, pointsChange: 0 },
    payment: { cash: 700, remittance: 0, creditCard: 0, linePay: 0 },
  };

  it('isOpen=false 時不渲染任何內容', () => {
    const { container } = render(<ConfirmCheckoutModal {...defaultProps} isOpen={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('渲染標題、應收金額與收款管道明細 (含 LINE Pay)', () => {
    render(
      <ConfirmCheckoutModal
        {...defaultProps}
        payment={{ cash: 300, remittance: 100, creditCard: 100, linePay: 200 }}
      />
    );
    expect(screen.getByText('結帳內容最終確認')).toBeTruthy();
    expect(screen.getByText('NT$ 700')).toBeTruthy();
    expect(screen.getByText('現 $300')).toBeTruthy();
    expect(screen.getByText('匯 $100')).toBeTruthy();
    expect(screen.getByText('刷 $100')).toBeTruthy();
    expect(screen.getByText('LINE $200')).toBeTruthy();
  });

  it('大獎設定為「帶走」時，正常顯示帶走數量且送出按鈕立即可點擊', () => {
    const onConfirm = vi.fn();
    render(<ConfirmCheckoutModal {...defaultProps} onConfirm={onConfirm} />);
    
    // 實體帶走統計 (一番賞 1 項 + 現金商品 1 項 = 2 項)
    expect(screen.getByText('🛍️ 實體帶走')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();

    const confirmBtn = screen.getByRole('button', { name: /確認無誤，送出訂單/i });
    expect(confirmBtn).toHaveProperty('disabled', false);
    fireEvent.click(confirmBtn);
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('大獎設定為「點數」(不帶走) 時，出現醒目紅色警示且必須勾選核可方能送出', () => {
    const onConfirm = vi.fn();
    const bigPrizePoints: LotteryItem = {
      ...baseLottery,
      type: '點數',
      totalPoints: 50,
    };

    render(
      <ConfirmCheckoutModal
        {...defaultProps}
        lotteries={[bigPrizePoints]}
        summary={{ dueAmount: 350, pointsChange: 50 }}
        payment={{ cash: 350, remittance: 0, creditCard: 0 }}
        onConfirm={onConfirm}
      />
    );

    // 必須包含「大獎換點再三確認」警示
    expect(screen.getByText(/大獎換點再三確認/i)).toBeTruthy();
    
    // 按鈕初始應呈現 disabled，提示「大獎換點需打勾確認」
    const confirmBtn = screen.getByRole('button', { name: /大獎換點需打勾確認/i });
    expect(confirmBtn).toHaveProperty('disabled', true);

    // 勾選核可核取方塊
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toHaveProperty('checked', false);
    fireEvent.click(checkbox);
    expect(checkbox).toHaveProperty('checked', true);

    // 勾選後按鈕解除鎖定
    expect(confirmBtn).toHaveProperty('disabled', false);
    fireEvent.click(confirmBtn);
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('非大獎 (X 賞 / Z 賞) 選擇「帶走」時，出現小獎現場交付提醒', () => {
    const smallPrizeTakeaway: LotteryItem = {
      ...baseLottery,
      prize: 'Z',
      prizeName: '小周邊',
      type: '帶走',
    };

    render(
      <ConfirmCheckoutModal
        {...defaultProps}
        lotteries={[smallPrizeTakeaway]}
      />
    );

    expect(screen.getByText('小獎帶走確認')).toBeTruthy();
    expect(screen.getByText(/有 1 項非大獎商品被設定為「實體帶走」/)).toBeTruthy();
  });

  it('點擊「取消返回」按鈕時觸發 onClose 回呼', () => {
    const onClose = vi.fn();
    render(<ConfirmCheckoutModal {...defaultProps} onClose={onClose} />);
    
    fireEvent.click(screen.getByRole('button', { name: /取消返回/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('正確匯總套組抽數統計 (本次抽賞清單)', () => {
    const lot1: LotteryItem = { ...baseLottery, setName: '七龍珠大賞', draws: 3 };
    const lot2: LotteryItem = { ...baseLottery, setName: '七龍珠大賞', prize: 'B', draws: 2 };
    const lot3: LotteryItem = { ...baseLottery, setName: '火影忍者', prize: 'C', draws: 4 };

    render(
      <ConfirmCheckoutModal
        {...defaultProps}
        lotteries={[lot1, lot2, lot3]}
      />
    );

    expect(screen.getByText('七龍珠大賞')).toBeTruthy();
    expect(screen.getByText('共 5 抽')).toBeTruthy();
    expect(screen.getByText('火影忍者')).toBeTruthy();
    expect(screen.getByText('共 4 抽')).toBeTruthy();
  });
});
