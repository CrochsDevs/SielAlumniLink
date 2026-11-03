import { Pencil, X } from 'lucide-react';

export default function ComposerEditNotice({ onCancel, saving }) {
  return <div className="flex shrink-0 items-center gap-2 border-t border-border bg-primary/5 px-3 py-1.5 text-xs text-primary" role="status">
    <Pencil size={14} aria-hidden="true" />
    <span className="flex-1 font-medium">{saving ? 'Saving changes…' : 'Editing message'}</span>
    <button type="button" onClick={onCancel} disabled={saving} aria-label="Cancel edit"
      className="rounded-full p-2 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"><X size={16} /></button>
  </div>;
}
