import { useCallback, useState } from "react";

// localStorage-backed state. Settings survive reload. Disable (enabled=false) for kiosk/wallpaper
// so the headless surface always uses the fixed defaults. Merges saved partials over `initial`
// (via the optional `merge` so nested keys like sizes/layers keep their default), and an
// optional `override` (e.g. ?cfg=…) wins over localStorage.
export function usePersisted<T extends object>(
  key: string,
  initial: T,
  enabled = true,
  merge: (initial: T, saved: Partial<T>) => T = (i, s) => ({ ...i, ...s }),
  override?: Partial<T> | null,
): [T, (patch: Partial<T> | ((p: T) => T)) => void, () => void] {
  const [v, setV] = useState<T>(() => {
    if (override) return merge(initial, override); // url-pinned cfg wins over everything
    if (!enabled || typeof window === "undefined") return initial;
    try {
      const s = window.localStorage.getItem(key);
      if (s) return merge(initial, JSON.parse(s));
    } catch {
      /* ignore corrupt storage */
    }
    return initial;
  });

  const update = useCallback(
    (patch: Partial<T> | ((p: T) => T)) => {
      setV((prev) => {
        const next = typeof patch === "function" ? (patch as (p: T) => T)(prev) : { ...prev, ...patch };
        if (enabled && typeof window !== "undefined") {
          try {
            window.localStorage.setItem(key, JSON.stringify(next));
          } catch {
            /* quota / private mode — keep it in memory */
          }
        }
        return next;
      });
    },
    [key, enabled],
  );

  const reset = useCallback(() => {
    if (enabled && typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(key);
      } catch {
        /* ignore */
      }
    }
    setV(initial);
  }, [key, enabled, initial]);

  return [v, update, reset];
}
