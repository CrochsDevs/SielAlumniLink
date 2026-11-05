import { useId, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export default function GroupCallDialog({ title, subtitle, onClose, children, room = false }) {
  const ref = useRef(null);
  const titleId = useId();
  useLayoutEffect(() => {
    const dialog = ref.current;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.showModal();
    return () => { dialog.close(); document.body.style.overflow = previous; };
  }, []);
  return createPortal(
    <dialog ref={ref} aria-labelledby={titleId}
      className={`group-call-dialog ${room ? 'group-call-dialog--room' : 'group-call-dialog--incoming'}`}
      onCancel={event => { event.preventDefault(); onClose(); }}>
      <header className="group-call-topbar">
        <div className="group-call-heading">
          <h2 id={titleId}>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <button type="button" onClick={onClose} className="group-call-close" aria-label={room ? 'Leave group call' : 'Dismiss group call'}>
          <X size={19} />
        </button>
      </header>
      {children}
    </dialog>, document.body,
  );
}
