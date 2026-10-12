import { useEffect, useId, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ImageOff, X } from 'lucide-react';
import { postImageUrl } from '../../utils/feedImages';

function Photo({ image, className, eager = false }) {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  if (failed) return <span className="flex h-full min-h-32 w-full flex-col items-center justify-center gap-2 bg-zinc-100 p-3 text-xs text-zinc-500 dark:bg-zinc-800">
    <ImageOff size={24} />Photo unavailable
    {eager ? <button type="button" onClick={() => { setAttempt(prev => prev + 1); setFailed(false); }} className="min-h-11 rounded-lg border px-3 py-2 font-bold">Retry photo</button> : <span>Open to retry</span>}
  </span>;
  const url = postImageUrl(image);
  return <img key={attempt} src={attempt ? `${url}?retry=${attempt}` : url} alt={image.alt || 'Photo shared in a post'}
    width={image.width || undefined} height={image.height || undefined} loading={eager ? 'eager' : 'lazy'} decoding="async"
    onError={() => setFailed(true)} className={className} />;
}

function ImageViewer({ images, initialIndex, onClose }) {
  const [index, setIndex] = useState(initialIndex);
  const dialogRef = useRef(null);
  const labelId = useId();
  const touchStart = useRef(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  const previous = () => setIndex(prev => (prev - 1 + images.length) % images.length);
  const next = () => setIndex(prev => (prev + 1) % images.length);
  return <dialog ref={dialogRef} aria-labelledby={labelId} onCancel={e => { e.preventDefault(); onClose(); }}
    onKeyDown={e => { if (e.key === 'ArrowLeft') { e.preventDefault(); previous(); } if (e.key === 'ArrowRight') { e.preventDefault(); next(); } }}
    className="m-auto h-[100dvh] max-h-[100dvh] w-screen max-w-none overflow-y-auto overscroll-contain bg-zinc-950 p-3 text-white backdrop:bg-black/80 sm:h-auto sm:max-h-[94dvh] sm:w-[calc(100%-2rem)] sm:max-w-5xl sm:rounded-2xl sm:p-5">
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 id={labelId} className="text-sm font-semibold">Photo {index + 1} of {images.length}</h2>
      <button type="button" onClick={onClose} aria-label="Close photo viewer" className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-white/10"><X size={24} /></button>
    </div>
    <div className="relative flex h-[calc(100dvh-13rem)] min-h-40 items-center justify-center sm:h-[65dvh]"
      onTouchStart={e => { touchStart.current = e.changedTouches[0].clientX; }}
      onTouchEnd={e => { if (touchStart.current === null) return; const distance = e.changedTouches[0].clientX - touchStart.current; touchStart.current = null; if (Math.abs(distance) > 50) { if (distance > 0) previous(); else next(); } }}>
      <Photo key={images[index].id} image={images[index]} eager className="max-h-full w-full object-contain" />
      {images.length > 1 && <>
        <button type="button" aria-label="Previous photo" onClick={previous} className="absolute left-1 flex h-11 w-11 items-center justify-center rounded-full bg-black/60 hover:bg-black/80"><ChevronLeft size={24} /></button>
        <button type="button" aria-label="Next photo" onClick={next} className="absolute right-1 flex h-11 w-11 items-center justify-center rounded-full bg-black/60 hover:bg-black/80"><ChevronRight size={24} /></button>
      </>}
    </div>
    {images[index].alt && <p className="mt-2 max-h-12 overflow-y-auto break-words text-center text-sm text-white/80">{images[index].alt}</p>}
    {images.length > 1 && <div className="mt-3 flex gap-2 overflow-x-auto py-1" aria-label="Photo thumbnails">
      {images.map((image, i) => <button key={image.id} type="button" onClick={() => setIndex(i)} aria-label={`Show photo ${i + 1}`} aria-pressed={i === index}
        className={`h-12 w-12 shrink-0 overflow-hidden rounded-lg border-2 ${i === index ? 'border-emerald-400' : 'border-transparent'}`}><img src={postImageUrl(image)} alt="" className="h-full w-full object-cover" /></button>)}
    </div>}
  </dialog>;
}

export default function FeedImages({ images = [] }) {
  const [selected, setSelected] = useState(null);
  if (!images.length) return null;
  return <>
    <div className={`mt-3 overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-800 ${images.length > 1 ? 'grid aspect-[4/3] grid-cols-2 grid-rows-2 gap-1' : ''}`}>
      {images.slice(0, 4).map((image, i) => <button key={image.id} type="button" aria-label={`View photo ${i + 1} of ${images.length}`} onClick={() => setSelected(i)}
        className={`relative min-h-0 min-w-0 overflow-hidden focus-visible:z-10 focus-visible:outline focus-visible:outline-4 focus-visible:outline-emerald-500 ${images.length === 2 || (images.length === 3 && i === 0) ? 'row-span-2' : ''}`}>
        <Photo image={image} className={images.length === 1 ? 'mx-auto max-h-[560px] w-full object-contain' : 'h-full w-full object-cover'} />
        {i === 3 && images.length > 4 && <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-3xl font-bold text-white">+{images.length - 4}</span>}
      </button>)}
    </div>
    {selected !== null && <ImageViewer images={images} initialIndex={selected} onClose={() => setSelected(null)} />}
  </>;
}
