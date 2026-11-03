import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, X } from 'lucide-react';
import { chatAttachmentUrl } from '../../utils/chatAttachments';

export default function ChatPhoto({ attachment, pending }) {
  const dialog = useRef(null);
  const [viewing, setViewing] = useState(false);
  useEffect(() => { if (viewing) dialog.current?.showModal(); }, [viewing]);
  const url = chatAttachmentUrl(attachment);
  return <>
    <button type="button" onClick={() => setViewing(true)} aria-label={`Open ${attachment.name || 'shared photo'}`}
      data-slot="message-photo" style={{ maxWidth: 'min(100%, var(--chat-photo-max-width, 320px))' }} className="relative block w-fit overflow-hidden rounded-2xl border border-border/40 bg-muted/20 p-0 group-data-[align=end]/bubble:self-end focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <img src={url} alt={attachment.name || 'Shared photo'} style={{ maxHeight: 'var(--chat-photo-max-height, 320px)' }} className="block h-auto w-auto max-w-full object-contain" />
      {pending && <span className="absolute inset-0 flex items-center justify-center bg-black/15"><span className="h-6 w-6 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" /></span>}
    </button>
    {viewing && createPortal(<dialog ref={dialog} aria-label="Photo viewer" onClose={() => setViewing(false)}
      onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}
      className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none border-0 bg-black/95 p-4 text-white backdrop:bg-black/70">
      <div className="pointer-events-none flex h-full items-center justify-center"><img src={url} alt={attachment.name || 'Shared photo'} className="max-h-[calc(100dvh-100px)] max-w-full object-contain" /></div>
      <div className="absolute right-4 top-4 flex gap-2">
        <a href={url} target="_blank" rel="noopener noreferrer" download={attachment.name} aria-label="Download photo" className="rounded-full bg-white/10 p-3 hover:bg-white/20"><Download size={22} /></a>
        <button type="button" onClick={() => dialog.current?.close()} aria-label="Close photo viewer" className="rounded-full bg-white/10 p-3 hover:bg-white/20"><X size={22} /></button>
      </div>
    </dialog>, document.body)}
  </>;
}
