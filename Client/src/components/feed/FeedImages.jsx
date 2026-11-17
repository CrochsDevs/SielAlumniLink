import { useEffect, useId, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ImageOff, X } from "lucide-react";
import { postImageUrl } from "../../utils/feedImages";

function Photo({ image, className, eager = false }) {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  if (failed)
    return (
      <span className="flex h-full min-h-32 w-full flex-col items-center justify-center gap-2 bg-zinc-100 p-3 text-xs text-zinc-500 dark:bg-zinc-800">
        <ImageOff size={24} />
        Photo unavailable
        {eager ? (
          <button
            type="button"
            onClick={() => {
              setAttempt((prev) => prev + 1);
              setFailed(false);
            }}
            className="min-h-11 rounded-lg border px-3 py-2 font-bold"
          >
            Retry photo
          </button>
        ) : (
          <span>Open to retry</span>
        )}
      </span>
    );
  const url = postImageUrl(image);
  return (
    <img
      key={attempt}
      src={attempt ? `${url}?retry=${attempt}` : url}
      alt={image.alt || "Photo shared in a post"}
      width={image.width || undefined}
      height={image.height || undefined}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      onError={() => setFailed(true)}
      className={className}
    />
  );
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
  const previous = () =>
    setIndex((prev) => (prev - 1 + images.length) % images.length);
  const next = () => setIndex((prev) => (prev + 1) % images.length);
  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={labelId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          previous();
        }
        if (e.key === "ArrowRight") {
          e.preventDefault();
          next();
        }
      }}
      className="fixed inset-0 m-0 h-[100dvh] max-h-[100dvh] w-screen max-w-none overflow-hidden border-0 bg-black p-0 text-white backdrop:bg-black"
    >
      <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between p-3 sm:p-4">
        <h2 id={labelId} className="rounded-full bg-black/50 px-3 py-2 text-sm font-semibold">
          Photo {index + 1} of {images.length}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close photo viewer"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15 hover:bg-white/25"
        >
          <X size={24} />
        </button>
      </div>
      <div
        className="relative flex h-full min-h-0 items-center justify-center px-0 pb-20 pt-16 sm:px-16 sm:pb-24 sm:pt-16"
        onTouchStart={(e) => {
          touchStart.current = e.changedTouches[0].clientX;
        }}
        onTouchEnd={(e) => {
          if (touchStart.current === null) return;
          const distance = e.changedTouches[0].clientX - touchStart.current;
          touchStart.current = null;
          if (Math.abs(distance) > 50) {
            if (distance > 0) previous();
            else next();
          }
        }}
      >
        <Photo
          key={images[index].id}
          image={images[index]}
          eager
          className="max-h-full max-w-full object-contain"
        />
        {images.length > 1 && (
          <>
            <button
              type="button"
              aria-label="Previous photo"
              onClick={previous}
              className="absolute left-3 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/20 hover:bg-white/35 sm:left-4"
            >
              <ChevronLeft size={24} />
            </button>
            <button
              type="button"
              aria-label="Next photo"
              onClick={next}
              className="absolute right-3 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/20 hover:bg-white/35 sm:right-4"
            >
              <ChevronRight size={24} />
            </button>
          </>
        )}
      </div>
      {images[index].alt && (
        <p className="absolute inset-x-16 bottom-20 z-10 mx-auto max-h-12 max-w-3xl overflow-y-auto break-words text-center text-sm text-white/80 sm:bottom-24">
          {images[index].alt}
        </p>
      )}
      {images.length > 1 && (
        <div
          className="absolute inset-x-0 bottom-0 z-20 flex justify-center gap-2 overflow-x-auto bg-gradient-to-t from-black/80 to-transparent px-4 pb-4 pt-8"
          aria-label="Photo thumbnails"
        >
          {images.map((image, i) => (
            <button
              key={image.id}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Show photo ${i + 1}`}
              aria-pressed={i === index}
              className={`h-14 w-14 shrink-0 overflow-hidden rounded-md border-2 transition-opacity ${i === index ? "border-emerald-500 opacity-100" : "border-transparent opacity-70 hover:opacity-100"}`}
            >
              <img
                src={postImageUrl(image)}
                alt=""
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </dialog>
  );
}

export default function FeedImages({ images = [] }) {
  const [selected, setSelected] = useState(null);
  if (!images.length) return null;
  return (
    <>
      <div
        className={`mt-3 overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-800 ${images.length > 1 ? "grid aspect-[4/3] grid-cols-2 grid-rows-2 gap-1" : ""}`}
      >
        {images.slice(0, 4).map((image, i) => (
          <button
            key={image.id}
            type="button"
            aria-label={`View photo ${i + 1} of ${images.length}`}
            onClick={() => setSelected(i)}
            className={`relative min-h-0 min-w-0 overflow-hidden focus-visible:z-10 focus-visible:outline focus-visible:outline-4 focus-visible:outline-brand ${images.length === 1 ? "block w-full" : ""} ${images.length === 2 || (images.length === 3 && i === 0) ? "row-span-2" : ""}`}
          >
            <Photo
              image={image}
              className={
                images.length === 1
                  ? "mx-auto block h-auto max-h-[560px] w-full object-contain"
                  : "h-full w-full object-cover"
              }
            />
            {i === 3 && images.length > 4 && (
              <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-3xl font-bold text-white">
                +{images.length - 4}
              </span>
            )}
          </button>
        ))}
      </div>
      {selected !== null && (
        <ImageViewer
          images={images}
          initialIndex={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
