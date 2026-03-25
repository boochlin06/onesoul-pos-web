import { useState, useEffect } from 'react';

export function useStickyState<T>(defaultValue: T | (() => T), key: string): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    const stickyValue = window.localStorage.getItem(key);
    return stickyValue !== null ? JSON.parse(stickyValue) : (typeof defaultValue === 'function' ? (defaultValue as any)() : defaultValue);
  });
  useEffect(() => {
    window.localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);
  return [value, setValue];
}
