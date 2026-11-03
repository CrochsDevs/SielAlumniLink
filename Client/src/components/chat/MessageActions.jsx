import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Pencil, Trash2 } from 'lucide-react';

export default function MessageActions({ canEdit, canDelete, onEdit, onDelete }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const trigger = useRef(null), menu = useRef(null);
  const id = useId();
  useLayoutEffect(() => {
    if (open) menu.current?.querySelector('button')?.focus({ preventScroll: true });
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const outside = event => {
      if (!menu.current?.contains(event.target) && !trigger.current?.contains(event.target)) setOpen(false);
    };
    const close = () => setOpen(false);
    document.addEventListener('pointerdown', outside);
    document.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);
  const select = action => {
    setOpen(false);
    trigger.current?.focus({ preventScroll: true });
    action();
  };
  return <>
    <div className={`message-actions absolute right-full top-0 flex min-h-11 items-start pr-1 transition-opacity ${open ? 'opacity-100' : 'opacity-0 group-hover/bubble:opacity-100 group-focus-within/bubble:opacity-100 [@media(hover:none)]:opacity-100'}`}>
      <button ref={trigger} type="button" aria-label="Message options" aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined}
        className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => {
          const rect = trigger.current.getBoundingClientRect();
          const height = (Number(!!canEdit) + Number(!!canDelete)) * 40 + 10;
          setPosition({ left: Math.max(8, Math.min(window.innerWidth - 184, rect.right - 176)),
            top: rect.bottom + height + 8 < window.innerHeight ? rect.bottom + 4 : Math.max(8, rect.top - height - 4) });
          setOpen(value => !value);
        }}>
        <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true"><circle cx="6" cy="9" r="1.7" /><circle cx="12" cy="9" r="1.7" /></svg>
      </button>
    </div>
    {open && createPortal(<div ref={menu} id={id} role="menu" aria-label="Message actions"
      className="w-44 max-w-[calc(100vw-16px)] rounded-xl border border-border bg-popover p-1 text-xs text-popover-foreground shadow-panel"
      style={{ position: 'fixed', ...position, zIndex: 1000 }}
      onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); setOpen(false); trigger.current?.focus({ preventScroll: true }); }
        if (event.key === 'Tab') setOpen(false);
        if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
          event.preventDefault();
          const buttons = [...menu.current.querySelectorAll('button')];
          const index = buttons.indexOf(document.activeElement);
          buttons[event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowUp' ? -1 : 1) + buttons.length) % buttons.length]?.focus();
        }
      }}>
      {canEdit && <button type="button" role="menuitem" onClick={() => select(onEdit)} className="flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-left hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"><Pencil size={14} aria-hidden="true" />Edit message</button>}
      {canDelete && <button type="button" role="menuitem" onClick={() => select(onDelete)} className="flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-red-600 hover:bg-muted focus-visible:bg-muted focus-visible:outline-none dark:text-red-400"><Trash2 size={14} aria-hidden="true" />Delete message</button>}
    </div>, document.body)}
  </>;
}
