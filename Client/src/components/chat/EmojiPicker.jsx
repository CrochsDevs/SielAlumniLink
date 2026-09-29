import { useEffect, useRef } from 'react';

const EMOJIS = [
  '😀', '😁', '😂', '🤣', '😊', '😍', '😎', '🤔',
  '😉', '😋', '😜', '🤩', '🥳', '😇', '🙂', '🙃',
  '😢', '😭', '😮', '😴', '😷', '🤯', '🥺', '😤',
  '👍', '👎', '👏', '🙏', '💪', '🤝', '👋', '✌️',
  '❤️', '💔', '🔥', '⭐', '💯', '🎉', '🎓', '✅',
  '📌', '📣', '💼', '📚', '🎯', '🚀', '☕', '👀',
  '🌟', '💡', '🏆', '🎖️', '📅', '⏰', '💬', '📞',
  '🎥', '📷', '🎨', '⚽', '🏀', '🍕', '🌈', '🙌',
];

// Tiny built-in emoji picker (no dependency).
const EmojiPicker = ({ onPick, onClose }) => {
  const ref = useRef(null);

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute bottom-12 left-0 z-30 grid w-60 grid-cols-8 gap-0.5 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-2 shadow-xl"
    >
      {EMOJIS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onPick(emoji)}
          className="rounded-lg p-1.5 text-lg leading-none transition hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          {emoji}
        </button>
      ))}
    </div>
  );
};

export default EmojiPicker;
