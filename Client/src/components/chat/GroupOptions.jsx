import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal, Pencil, Users } from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import EditGroupName from './EditGroupName';
import GroupMembers from './GroupMembers';
import './GroupOptions.css';

export default function GroupOptions({ conversation }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [action, setAction] = useState(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const trigger = useRef(null);
  const menu = useRef(null);
  const id = useId();
  const canRename = conversation.adminAuthIds?.includes(String(user?.authId || user?._id));
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
  const select = value => { setOpen(false); setAction(value); };
  const closeDialog = () => { setAction(null); trigger.current?.focus(); };
  return <>
    <button ref={trigger} type="button" aria-label="Group options" title="Group options"
      aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined}
      className="group-options-trigger"
      onClick={() => {
        const rect = trigger.current.getBoundingClientRect();
        const height = canRename ? 100 : 56;
        setPosition({ left: Math.max(8, Math.min(window.innerWidth - 208, rect.right - 200)),
          top: rect.bottom + height + 8 < window.innerHeight ? rect.bottom + 6 : Math.max(8, rect.top - height - 6) });
        setOpen(previous => !previous);
      }}><MoreHorizontal size={20} /></button>
    {open && createPortal(<div ref={menu} id={id} role="menu" aria-label="Group options"
      className="group-options-menu" style={{ position: 'fixed', ...position }}
      onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); setOpen(false); trigger.current?.focus(); }
        if (event.key === 'Tab') setOpen(false);
        if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
          event.preventDefault();
          const items = [...menu.current.querySelectorAll('button')];
          const index = items.indexOf(document.activeElement);
          items[event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowUp' ? -1 : 1) + items.length) % items.length]?.focus();
        }
      }}>
      {canRename && <button type="button" role="menuitem" onClick={() => select('rename')}><Pencil size={16} />Edit group name</button>}
      <button type="button" role="menuitem" onClick={() => select('members')}><Users size={17} />Group members</button>
    </div>, document.body)}
    {action === 'rename' && <EditGroupName conversation={conversation} dialogOnly onClosed={closeDialog} />}
    {action === 'members' && <GroupMembers conversation={conversation} dialogOnly onClosed={closeDialog} />}
  </>;
}
