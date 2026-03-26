import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfirmModal } from '../components/ui/ConfirmModal';

describe('ConfirmModal', () => {
  const defaultProps = {
    title: '確認作廢',
    message: '此操作無法復原',
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  };

  it('渲染 title 和 message', () => {
    render(<ConfirmModal {...defaultProps} />);
    expect(screen.getByText('確認作廢')).toBeTruthy();
    expect(screen.getByText('此操作無法復原')).toBeTruthy();
  });

  it('預設 confirmLabel 為「確認」', () => {
    render(<ConfirmModal {...defaultProps} />);
    expect(screen.getByText('確認')).toBeTruthy();
  });

  it('自訂 confirmLabel', () => {
    render(<ConfirmModal {...defaultProps} confirmLabel="刪除" />);
    expect(screen.getByText('刪除')).toBeTruthy();
  });

  it('點擊取消觸發 onCancel', () => {
    const onCancel = vi.fn();
    render(<ConfirmModal {...defaultProps} onCancel={onCancel} />);
    fireEvent.click(screen.getByText('取消'));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('點擊確認觸發 onConfirm', () => {
    const onConfirm = vi.fn();
    render(<ConfirmModal {...defaultProps} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByText('確認'));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('isLoading 時按鈕 disabled', () => {
    render(<ConfirmModal {...defaultProps} isLoading />);
    const buttons = screen.getAllByRole('button');
    buttons.forEach(btn => expect(btn).toHaveProperty('disabled', true));
  });

  it('message 可以是 JSX', () => {
    render(<ConfirmModal {...defaultProps} message={<span data-testid="jsx-msg">自訂元件</span>} />);
    expect(screen.getByTestId('jsx-msg')).toBeTruthy();
  });
});
