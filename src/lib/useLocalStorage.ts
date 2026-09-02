"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Read/write a localStorage key without a setState-in-effect. Server snapshot is
 * always null, so there's no hydration mismatch; the real value lands after mount.
 */
export function useLocalStorage(key: string): [string | null, (value: string) => void] {
  const subscribe = useCallback((cb: () => void) => {
    window.addEventListener("storage", cb);
    return () => window.removeEventListener("storage", cb);
  }, []);

  const getSnapshot = useCallback(() => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }, [key]);

  const value = useSyncExternalStore(subscribe, getSnapshot, () => null);

  const setValue = useCallback(
    (v: string) => {
      try {
        localStorage.setItem(key, v);
        window.dispatchEvent(new Event("storage"));
      } catch {
        /* private mode / disabled storage */
      }
    },
    [key],
  );

  return [value, setValue];
}
