import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Pagination } from '../components/ui/Pagination';

// Mock window.scrollTo
beforeEach(() => {
  window.scrollTo = vi.fn() as any;
});

describe('Pagination', () => {
  it('totalPages <= 1 時不渲染', () => {
    const { container } = render(<Pagination currentPage={1} totalPages={1} onPageChange={vi.fn()} />);
    expect(container.innerHTML).toBe('');
  });

  it('顯示頁碼資訊文字', () => {
    const { container } = render(<Pagination currentPage={2} totalPages={5} onPageChange={vi.fn()} />);
    expect(container.textContent).toContain('第');
    expect(container.textContent).toContain('頁');
  });

  it('顯示 totalItems', () => {
    const { container } = render(<Pagination currentPage={1} totalPages={3} onPageChange={vi.fn()} totalItems={150} />);
    expect(container.textContent).toContain('150');
  });

  it('點擊頁碼按鈕觸發 onPageChange', () => {
    const onChange = vi.fn();
    render(<Pagination currentPage={3} totalPages={5} onPageChange={onChange} />);
    // currentPage=3, delta=1 → shows 1, 2, 3, 4, 5 (no ellipsis for small range)
    const buttons = screen.getAllByRole('button');
    // Find button with text "2"
    const btn2 = buttons.find(b => b.textContent === '2');
    expect(btn2).toBeTruthy();
    fireEvent.click(btn2!);
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it('第一頁時「上一頁」和「第一頁」disabled', () => {
    render(<Pagination currentPage={1} totalPages={5} onPageChange={vi.fn()} />);
    const firstBtn = screen.getByTitle('第一頁');
    const prevBtn = screen.getByTitle('上一頁');
    expect(firstBtn).toHaveProperty('disabled', true);
    expect(prevBtn).toHaveProperty('disabled', true);
  });

  it('最後一頁時「下一頁」和「最後一頁」disabled', () => {
    render(<Pagination currentPage={5} totalPages={5} onPageChange={vi.fn()} />);
    const nextBtn = screen.getByTitle('下一頁');
    const lastBtn = screen.getByTitle('最後一頁');
    expect(nextBtn).toHaveProperty('disabled', true);
    expect(lastBtn).toHaveProperty('disabled', true);
  });

  it('點「下一頁」傳入 currentPage+1', () => {
    const onChange = vi.fn();
    render(<Pagination currentPage={2} totalPages={5} onPageChange={onChange} />);
    fireEvent.click(screen.getByTitle('下一頁'));
    expect(onChange).toHaveBeenCalledWith(3);
  });

  it('點「最後一頁」傳入 totalPages', () => {
    const onChange = vi.fn();
    render(<Pagination currentPage={1} totalPages={10} onPageChange={onChange} />);
    fireEvent.click(screen.getByTitle('最後一頁'));
    expect(onChange).toHaveBeenCalledWith(10);
  });

  it('點「第一頁」傳入 1', () => {
    const onChange = vi.fn();
    render(<Pagination currentPage={5} totalPages={10} onPageChange={onChange} />);
    fireEvent.click(screen.getByTitle('第一頁'));
    expect(onChange).toHaveBeenCalledWith(1);
  });

  it('點「上一頁」傳入 currentPage-1', () => {
    const onChange = vi.fn();
    render(<Pagination currentPage={3} totalPages={10} onPageChange={onChange} />);
    fireEvent.click(screen.getByTitle('上一頁'));
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it('大量頁數時顯示省略號', () => {
    render(<Pagination currentPage={5} totalPages={10} onPageChange={vi.fn()} />);
    const ellipses = screen.getAllByText('⋯');
    expect(ellipses.length).toBeGreaterThanOrEqual(1);
  });
});
