import '@testing-library/jest-dom';
import { vi } from 'vitest';

declare global {
  interface Window {
    google: any;
  }
}

window.google = {
  script: {
    run: {
      withSuccessHandler: vi.fn().mockReturnThis(),
      withFailureHandler: vi.fn().mockReturnThis(),
      apiGetCache: vi.fn(),
      apiGetBlindBoxList: vi.fn(),
      apiTopUpPoints: vi.fn(),
      checkout: vi.fn()
    }
  }
};

window.alert = vi.fn();
window.confirm = vi.fn(() => true);
