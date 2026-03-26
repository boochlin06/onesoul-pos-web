import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock window methods
window.alert = vi.fn();
window.confirm = vi.fn(() => true);

// Mock fetch globally
global.fetch = vi.fn();
