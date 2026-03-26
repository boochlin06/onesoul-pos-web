import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VoidPrizeModal } from '../components/checkout/VoidPrizeModal';
import type { PrizeEntry } from '../types';

const mockEntries: PrizeEntry[] = [
  { setId: 'S1', setName: '測試套組', unitPrice: 700, prize: 'A', prizeId: 'P1', prizeName: '獎A', points: 10, draws: 1, date: '2026/01/01', branch: '竹北' },
  { setId: 'S1', setName: '測試套組', unitPrice: 700, prize: 'B', prizeId: 'P2', prizeName: '獎B', points: 20, draws: 2, date: '2026/01/01', branch: '竹北' },
];

describe('VoidPrizeModal', () => {
  it('顯示套組名稱和獎項數量', () => {
    render(<VoidPrizeModal entries={mockEntries} isLoading={false} onConfirm={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByText('確定作廢整套福袋？')).toBeInTheDocument();
    expect(screen.getByText('測試套組')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument(); // entries.length
  });

  it('點擊確認 → 呼叫 onConfirm', () => {
    const onConfirm = vi.fn();
    render(<VoidPrizeModal entries={mockEntries} isLoading={false} onConfirm={onConfirm} onCancel={vi.fn()} />);

    fireEvent.click(screen.getByText('確認作廢'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('點擊取消 → 呼叫 onCancel', () => {
    const onCancel = vi.fn();
    render(<VoidPrizeModal entries={mockEntries} isLoading={false} onConfirm={vi.fn()} onCancel={onCancel} />);

    fireEvent.click(screen.getByText('取消'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('isLoading=true → 按鈕 disabled', () => {
    render(<VoidPrizeModal entries={mockEntries} isLoading={true} onConfirm={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByText('確認作廢').closest('button')).toBeDisabled();
    expect(screen.getByText('取消').closest('button')).toBeDisabled();
  });
});
