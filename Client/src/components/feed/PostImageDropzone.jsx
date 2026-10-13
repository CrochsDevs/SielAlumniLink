import { useId, useRef, useState } from 'react';
import { POST_IMAGE_ACCEPT } from '../../utils/feedImages';

function ImageIcon() {
  const id = useId();
  return <svg className="h-[54px] w-[42px] shrink-0" viewBox="0 0 42 54" aria-hidden="true">
    <defs>
      <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#e3f0ff" /><stop offset="1" stopColor="#cfe4fd" />
      </linearGradient>
      <linearGradient id={`${id}-mountain`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#3b9bff" /><stop offset="1" stopColor="#0a6cf5" />
      </linearGradient>
    </defs>
    <rect width="42" height="54" rx="4" fill={`url(#${id}-bg)`} />
    <circle cx="12" cy="14" r="4.5" fill="#1a8cff" />
    <path d="M0 50V43l12-9 7 6 8-10 15 14v6a4 4 0 0 1-4 4H4a4 4 0 0 1-4-4z" fill={`url(#${id}-mountain)`} opacity=".5" />
    <path d="M12 54V45l14-14 16 14v5a4 4 0 0 1-4 4z" fill={`url(#${id}-mountain)`} />
  </svg>;
}

export default function PostImageDropzone({ onFilesSelect, count, maxImages, disabled = false, inputRef }) {
  const picker = useRef(null);
  const dragDepth = useRef(0);
  const [dragOver, setDragOver] = useState(false);
  const prevent = e => { e.preventDefault(); e.stopPropagation(); };
  const onDrop = e => {
    prevent(e); dragDepth.current = 0; setDragOver(false);
    if (!disabled) onFilesSelect(Array.from(e.dataTransfer.files));
  };
  return <div className="rounded-[28px] bg-white p-4 shadow-[0_16px_40px_-20px_rgba(120,160,215,0.35)] sm:p-5 dark:bg-[#14233a] dark:shadow-none"
    onDragEnter={e => { prevent(e); dragDepth.current++; if (!disabled) setDragOver(true); }}
    onDragOver={prevent}
    onDragLeave={e => { prevent(e); dragDepth.current = Math.max(0, dragDepth.current - 1); if (!dragDepth.current) setDragOver(false); }}
    onDrop={onDrop}>
    <button type="button" disabled={disabled} onClick={() => (inputRef?.current || picker.current)?.click()} aria-label="Upload photos: drop them here or browse"
      className={`flex min-h-[180px] w-full flex-col items-center justify-center gap-3 rounded-xl border-[1.5px] border-dashed px-4 py-7 text-center text-[#0b3a7a] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#0a7cff] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none dark:text-[#e6f0ff] ${dragOver ? 'border-[#0a7cff] bg-[#f3f9ff] dark:border-[#4da3ff] dark:bg-[#182b47]' : 'border-[#a9bdd6] hover:border-[#0a7cff] hover:bg-[#f3f9ff] dark:border-[#3a5478] dark:hover:border-[#4da3ff] dark:hover:bg-[#182b47]'}`}>
      <ImageIcon />
      <span className="text-[15px] font-semibold tracking-[0.01em]">{count >= maxImages ? 'Photo limit reached' : count ? <>Drop more images, or <span className="text-[#0a7cff] dark:text-[#4da3ff]">browse</span></> : <>Drop your image here, or <span className="text-[#0a7cff] dark:text-[#4da3ff]">browse</span></>}</span>
      <span className="text-[11.5px] tracking-[0.02em] text-[#7089aa] dark:text-[#9bb0cc]">Supports: JPG, PNG, GIF, WebP</span>
      <span className="text-xs text-[#7089aa] dark:text-[#9bb0cc]">{count}/{maxImages} photos · 10 MB each</span>
    </button>
    <input ref={inputRef || picker} type="file" multiple accept={POST_IMAGE_ACCEPT} disabled={disabled} aria-label="Choose post photos" className="hidden"
      onChange={e => { const files = Array.from(e.target.files || []); e.target.value = ''; onFilesSelect(files); }} />
  </div>;
}
