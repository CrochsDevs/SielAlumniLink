import { useEffect, useRef } from "react";

// Only refresh visible pages, and never stack requests from a slow connection.
export default function useVisiblePolling(callback, interval, enabled = true) {
  const latest = useRef(callback);
  useEffect(() => { latest.current = callback; }, [callback]);
  useEffect(() => {
    if (!enabled) return;
    let running = false;
    let active = true;
    const refresh = async () => {
      if (!active || document.hidden || running) return;
      running = true;
      try { await latest.current(); } catch { /* Keep the existing page and retry on the next tick. */ }
      finally { running = false; }
    };
    const timer = setInterval(refresh, interval);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      active = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [interval, enabled]);
}
