import '@testing-library/jest-dom';
import { vi } from 'vitest';

window.alert = vi.fn();
window.confirm = vi.fn(() => true);
