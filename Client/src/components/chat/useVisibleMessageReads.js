import { useEffect, useRef } from 'react';
import { useChat } from '../../context/useChat';

export function useVisibleMessageReads(conversationId, messages) {
  const root = useRef(null);
  const { markMessagesRead } = useChat();
  useEffect(() => {
    if (!conversationId || !root.current) return;
    const visible = new Set(), confirmed = new Set();
    let pending = false, stopped = false;
    const flush = async () => {
      if (pending || stopped || document.visibilityState !== 'visible' || !document.hasFocus()) return;
      const ids = [...visible].filter(id => !confirmed.has(id)).slice(0, 100);
      if (!ids.length) return;
      pending = true;
      try {
        await markMessagesRead(conversationId, ids);
        ids.forEach(id => confirmed.add(id));
      } catch { /* Retry after reconnect/focus; never guess that a read was saved. */ }
      finally { pending = false; }
    };
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const id = entry.target.dataset.readId;
        if (entry.isIntersecting && entry.intersectionRect.height > 0) visible.add(id);
        else visible.delete(id);
      }
      void flush();
    });
    root.current.querySelectorAll('[data-read-id]').forEach(element => observer.observe(element));
    const timer = window.setInterval(flush, 3000);
    window.addEventListener('focus', flush);
    document.addEventListener('visibilitychange', flush);
    return () => {
      stopped = true;
      observer.disconnect();
      clearInterval(timer);
      window.removeEventListener('focus', flush);
      document.removeEventListener('visibilitychange', flush);
    };
  }, [conversationId, messages, markMessagesRead]);
  return root;
}
