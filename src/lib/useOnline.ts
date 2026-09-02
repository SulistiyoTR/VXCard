"use client";

import { useCallback, useSyncExternalStore } from "react";

export function useOnline(): boolean {
  const subscribe = useCallback((cb: () => void) => {
    window.addEventListener("online", cb);
    window.addEventListener("offline", cb);
    return () => {
      window.removeEventListener("online", cb);
      window.removeEventListener("offline", cb);
    };
  }, []);
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}
