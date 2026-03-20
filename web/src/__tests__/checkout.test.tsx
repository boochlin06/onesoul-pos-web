import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import App from '../App';

describe('Checkout Validation (防呆機制)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it('1. 購物車為空時應阻擋結帳', async () => {
    render(<App />);

    // By default, merch array has 2 empty items and lotteries has 5.
    // Clicking checkout directly should trigger empty cart validation.
    const checkoutBtn = screen.getByText('確認送出結帳');
    fireEvent.click(checkoutBtn);

    expect(window.alert).toHaveBeenCalledWith('無法結帳：請至少輸入一項福袋或商品');
  });

  it('2. 未載入會員資料時應阻擋結帳', async () => {
    render(<App />);

    // Add a valid merchandise item
    const merchNameInputs = screen.getAllByPlaceholderText('商品名稱');
    const merchIdInputs = screen.getAllByPlaceholderText('輸入貨號');
    const objIds = Array.from(merchIdInputs) as HTMLInputElement[];
    const objNames = Array.from(merchNameInputs) as HTMLInputElement[];

    fireEvent.change(objIds[0], { target: { value: 'TEST-01' } });
    fireEvent.change(objNames[0], { target: { value: '測試公仔' } });
    
    // Find quantity and amount
    const numbers = screen.getAllByRole('spinbutton') as HTMLInputElement[];
    // Indexing the spinbuttons could be tricky. Let's just mock it out manually if we can.
    // Let's use getByText or whatever we can find. The quantity is next to ID.
    
    // Just click checkout. Customer is empty.
    const checkoutBtn = screen.getByText('確認送出結帳');
    fireEvent.click(checkoutBtn);

    expect(window.alert).toHaveBeenCalledWith('無法結帳：請輸入客戶電話號碼並按下 Enter 帶出會員資料！');
  });

});
