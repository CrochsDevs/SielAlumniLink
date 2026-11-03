import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal, Ban, Trash2 } from 'lucide-react';
import Swal from 'sweetalert2';
import { gooeyToast as toast } from 'goey-toast';
import { useChat } from '../../context/useChat';

export default function ConversationActions({ conversation, onDeleted }) {
  const { blockConversation, deleteConversation } = useChat();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const trigger = useRef(null), menu = useRef(null);
  const id = useId();
  useLayoutEffect(() => {
    if (!open) return;
    menu.current?.querySelector('button')?.focus({ preventScroll: true });
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const outside = event => { if (!menu.current?.contains(event.target) && !trigger.current?.contains(event.target)) setOpen(false); };
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
  const act = async action => {
    setOpen(false);
    const unblock = action === 'block' && conversation.blockedByMe;
    if (!unblock) {
      const confirmed = await Swal.fire({
        title: action === 'delete' ? 'Delete this chat?' : `Block ${conversation.name}?`,
        text: action === 'delete' ? 'This removes the chat and its history for you. Other participants keep their copy. New messages can bring the chat back.' : 'Neither of you can send direct messages or calls until the block is removed. Shared group chats are unaffected.',
        icon: 'warning', showCancelButton: true, confirmButtonText: action === 'delete' ? 'Delete chat' : 'Block',
        confirmButtonColor: action === 'delete' ? '#dc2626' : 'hsl(var(--primary))', focusCancel: true,
      });
      if (!confirmed.isConfirmed) return;
    }
    setBusy(true);
    try {
      if (action === 'delete') {
        await deleteConversation(conversation._id);
        onDeleted?.();
      } else await blockConversation(conversation._id, !unblock);
      toast.success(action === 'delete' ? 'Chat deleted for you' : unblock ? 'Account unblocked' : 'Account blocked');
    } catch (error) {
      toast.error('Unable to update chat', { description: error.response?.data?.message || 'Please try again.' });
    } finally { setBusy(false); }
  };
  return <>
    <button ref={trigger} type="button" disabled={busy} className="conversation-actions-trigger"
      aria-label={`Chat options for ${conversation.name}`} title="Chat options" aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined}
      onClick={() => {
        const rect = trigger.current.getBoundingClientRect();
        const height = conversation.isGroup ? 58 : 102;
        setPosition({ left: Math.max(8, Math.min(innerWidth - 216, rect.right - 208)),
          top: rect.bottom + height + 8 < innerHeight ? rect.bottom + 4 : Math.max(8, rect.top - height - 4) });
        setOpen(value => !value);
      }}><MoreHorizontal size={19} aria-hidden="true" /></button>
    {open && createPortal(<div ref={menu} id={id} role="menu" aria-label={`Chat actions for ${conversation.name}`}
      className="conversation-actions-menu" style={{ position: 'fixed', ...position, zIndex: 1000 }}
      onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); setOpen(false); trigger.current?.focus(); }
        if (event.key === 'Tab') setOpen(false);
        if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
          event.preventDefault();
          const buttons = [...menu.current.querySelectorAll('button')];
          const index = buttons.indexOf(document.activeElement);
          buttons[event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowUp' ? -1 : 1) + buttons.length) % buttons.length]?.focus();
        }
      }}>
      {!conversation.isGroup && <button type="button" role="menuitem" onClick={() => act('block')}><Ban size={18} aria-hidden="true" />{conversation.blockedByMe ? 'Unblock' : 'Block'}</button>}
      <button type="button" role="menuitem" className="conversation-delete-action" onClick={() => act('delete')}><Trash2 size={18} aria-hidden="true" />Delete chat</button>
    </div>, document.body)}
  </>;
}
