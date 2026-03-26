import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SearchInput } from '../components/ui/SearchInput';

describe('SearchInput', () => {
  it('渲染 placeholder', () => {
    render(<SearchInput value="" onChange={vi.fn()} placeholder="搜尋會員" />);
    expect(screen.getByPlaceholderText('搜尋會員')).toBeTruthy();
  });

  it('預設 placeholder 為「搜尋...」', () => {
    render(<SearchInput value="" onChange={vi.fn()} />);
    expect(screen.getByPlaceholderText('搜尋...')).toBeTruthy();
  });

  it('輸入觸發 onChange', () => {
    const onChange = vi.fn();
    render(<SearchInput value="" onChange={onChange} />);
    fireEvent.change(screen.getByPlaceholderText('搜尋...'), { target: { value: '王' } });
    expect(onChange).toHaveBeenCalledWith('王');
  });

  it('有值時顯示清除按鈕', () => {
    render(<SearchInput value="test" onChange={vi.fn()} />);
    // X button should exist
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBe(1);
  });

  it('無值時不顯示清除按鈕', () => {
    render(<SearchInput value="" onChange={vi.fn()} />);
    const buttons = screen.queryAllByRole('button');
    expect(buttons.length).toBe(0);
  });

  it('點清除按鈕觸發 onChange("")', () => {
    const onChange = vi.fn();
    render(<SearchInput value="hello" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onChange).toHaveBeenCalledWith('');
  });
});
