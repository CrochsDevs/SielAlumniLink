import { FileText, X } from 'lucide-react';

export default function ComposerImagePreview({ attachment, saving, onRemove }) {
  if (!attachment) return null;
  return <div className="flex shrink-0 items-center gap-3 border-t border-border bg-background px-3 py-2" aria-label="Attachment preview">
    <div className="relative shrink-0">
      {attachment.kind === 'image' ? <img src={attachment.url} alt="Image ready to send" className="h-24 w-24 rounded-2xl object-cover" />
        : <span className="flex h-20 w-20 items-center justify-center rounded-2xl bg-muted text-muted-foreground"><FileText size={28} /></span>}
      <button type="button" onClick={onRemove} disabled={saving} aria-label="Remove attachment"
        className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background text-foreground shadow-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"><X size={16} /></button>
    </div>
    <div className="min-w-0 flex-1 text-xs text-muted-foreground"><p className="truncate">{attachment?.name}</p><p className="mt-1">{saving ? 'Sending attachment…' : 'Add a message, then press send'}</p></div>
  </div>;
}
