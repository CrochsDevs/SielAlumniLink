import { Reply, X } from 'lucide-react';

export default function ComposerReplyNotice({ message, onCancel, saving }) {
  return <div className="chat-reply-composer" role="status">
    <Reply size={17} aria-hidden="true" />
    <div className="min-w-0 flex-1">
      <strong>Replying to {message.from === 'me' ? 'yourself' : message.senderName || 'this message'}</strong>
      <p>{message.unsent ? 'Original message unavailable' : message.text || (message.attachment?.kind === 'image' ? 'Photo' : message.attachment?.name || 'Attachment')}</p>
    </div>
    <button type="button" onClick={onCancel} disabled={saving} aria-label="Cancel reply"><X size={17} aria-hidden="true" /></button>
  </div>;
}
