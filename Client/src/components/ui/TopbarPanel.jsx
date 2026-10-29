import { useLayoutEffect, useRef } from 'react';
import { X } from 'lucide-react';
import useMobileView from '../../hooks/useMobileView';
import { cn } from '../../lib/utils';
import './TopbarPanel.css';

// Header menus share a native full-screen modal on phones and a desktop dropdown.
export default function TopbarPanel({ title, action, children, onClose, triggerRef, className, id }) {
  const isMobile = useMobileView();
  const panelRef = useRef(null);
  const closeRef = useRef(null);
  const Panel = isMobile ? 'dialog' : 'div';
  useLayoutEffect(() => {
    if (!isMobile) return;
    const dialog = panelRef.current;
    const trigger = triggerRef?.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.showModal();
    closeRef.current?.focus({ preventScroll: true });
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, [isMobile, triggerRef]);

  return <Panel ref={panelRef} id={id} role={isMobile ? 'dialog' : 'region'} aria-modal={isMobile || undefined} aria-label={title}
    onCancel={isMobile ? event => { event.preventDefault(); onClose(); } : undefined}
    className={cn('topbar-panel absolute right-0 z-20 mt-2 w-80 max-w-[calc(100vw-5rem)] overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-panel dark:border-zinc-700 dark:bg-zinc-900', className)}>
    <div className="topbar-panel-heading flex items-center justify-between gap-3 px-4 py-3">
      <p className="text-[14px] font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">{title}</p>
      <div className="flex items-center gap-3">
        {action}
        {isMobile && <button ref={closeRef} type="button" onClick={onClose} aria-label={`Close ${title.toLowerCase()}`}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-zinc-600 hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary dark:text-zinc-300 dark:hover:bg-zinc-800">
          <X size={22} aria-hidden="true" />
        </button>}
      </div>
    </div>
    {children}
  </Panel>;
}
