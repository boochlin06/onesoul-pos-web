import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LoginScreen } from '../components/LoginScreen';

describe('LoginScreen', () => {
  const defaultProps = {
    renderGoogleButton: vi.fn(),
    error: null,
    isLoading: false,
  };

  it('渲染標題', () => {
    render(<LoginScreen {...defaultProps} />);
    expect(screen.getByText('OneSoul POS')).toBeTruthy();
    expect(screen.getByText('銷售管理系統')).toBeTruthy();
  });

  it('渲染底部文字', () => {
    render(<LoginScreen {...defaultProps} />);
    expect(screen.getByText('僅限授權帳號登入')).toBeTruthy();
  });

  it('isLoading 時顯示載入中', () => {
    render(<LoginScreen {...defaultProps} isLoading />);
    expect(screen.getByText('載入中…')).toBeTruthy();
  });

  it('有 error 時顯示錯誤訊息', () => {
    render(<LoginScreen {...defaultProps} error="帳號未授權" />);
    expect(screen.getByText('帳號未授權')).toBeTruthy();
  });

  it('無 error 時不顯示錯誤區塊', () => {
    render(<LoginScreen {...defaultProps} />);
    expect(screen.queryByText('帳號未授權')).toBeNull();
  });

  it('非 loading 時呼叫 renderGoogleButton', () => {
    const renderBtn = vi.fn();
    render(<LoginScreen {...defaultProps} renderGoogleButton={renderBtn} />);
    expect(renderBtn).toHaveBeenCalled();
  });
});
