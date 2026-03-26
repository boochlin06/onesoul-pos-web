import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StatusBanner } from '../components/ui/StatusBanner';

describe('StatusBanner', () => {
  it('type=loading → 顯示 loading 訊息和提示', () => {
    render(<StatusBanner msg="結帳中..." type="loading" />);

    expect(screen.getByText('結帳中...')).toBeInTheDocument();
    expect(screen.getByText('請稍候，不要關閉頁面')).toBeInTheDocument();
  });

  it('type=err → 顯示錯誤訊息', () => {
    render(<StatusBanner msg="發生錯誤" type="err" />);

    expect(screen.getByText('發生錯誤')).toBeInTheDocument();
  });

  it('type=err + onClose → 顯示關閉按鈕', () => {
    const onClose = vi.fn();
    render(<StatusBanner msg="錯誤" type="err" onClose={onClose} />);

    const closeBtn = screen.getByRole('button');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('type=err 無 onClose → 不顯示關閉按鈕', () => {
    render(<StatusBanner msg="錯誤" type="err" />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('type=ok → 顯示成功訊息', () => {
    render(<StatusBanner msg="成功！" type="ok" />);

    expect(screen.getByText('成功！')).toBeInTheDocument();
  });
});
