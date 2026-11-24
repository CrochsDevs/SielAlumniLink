import { useEffect, useId, useRef, useState } from 'react';
import { Camera, ImagePlus, Images, Paperclip } from 'lucide-react';

export default function ComposerGallery({ disabled, onAttach, onOpen, compact = false }) {
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  const trigger = useRef(null);
  const images = useRef(null);
  const picture = useRef(null);
  const files = useRef(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const dismiss = (event) => {
      if (!root.current?.contains(event.target)) setOpen(false);
    };
    const escape = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  const choose = (ref) => {
    ref.current?.click();
    setOpen(false);
    trigger.current?.focus();
  };
  const attach = (kind) => (event) => {
    const file = event.target.files?.[0];
    if (file) onAttach(file, kind);
    event.target.value = '';
  };

  return (
    <div ref={root} className="relative shrink-0" onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
    }}>
      <button ref={trigger} type="button" disabled={disabled}
        aria-label="Open gallery and attachments" aria-expanded={open && !disabled}
        aria-controls={panelId} aria-haspopup="dialog"
        onClick={() => { if (!open) onOpen?.(); setOpen(!open); }}
        className={`flex ${compact ? 'h-9 w-9' : 'h-10 w-10'} items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-100 hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-40 dark:text-zinc-300 dark:hover:bg-zinc-800`}>
        <ImagePlus className="h-[18px] w-[18px]" />
      </button>
      {open && !disabled && (
        <div id={panelId} role="dialog" aria-label="Add an attachment"
          className="absolute bottom-full left-0 z-50 mb-2 w-44 rounded-2xl border border-zinc-200 bg-white p-1.5 text-zinc-800 shadow-xl dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100">
          {[
            { label: 'Images', icon: <Images className="h-[18px] w-[18px] text-emerald-600 dark:text-emerald-400" />, ref: images },
            { label: 'Picture', icon: <Camera className="h-[18px] w-[18px] text-emerald-600 dark:text-emerald-400" />, ref: picture },
            { label: 'Files', icon: <Paperclip className="h-[18px] w-[18px] text-emerald-600 dark:text-emerald-400" />, ref: files },
          ].map(({ label, icon, ref }) => (
            <button key={label} type="button" onClick={() => choose(ref)}
              className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium hover:bg-zinc-100 focus-visible:bg-zinc-100 focus-visible:outline-none dark:hover:bg-zinc-800 dark:focus-visible:bg-zinc-800">
              {icon}
              {label}
            </button>
          ))}
        </div>
      )}
      <input ref={images} type="file" disabled={disabled} className="hidden" accept="image/jpeg,image/png,image/gif,image/webp" onChange={attach('image')} />
      <input ref={picture} type="file" disabled={disabled} className="hidden" accept="image/*" capture="environment" onChange={attach('image')} />
      <input ref={files} type="file" disabled={disabled} className="hidden" onChange={attach('file')} />
    </div>
  );
}
