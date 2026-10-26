import { useRef, useState } from 'react';
import { Pencil } from 'lucide-react';
import { useChat } from '../../context/useChat';
import { useAuth } from '../../context/useAuth';
import { FeedDialog } from '../feed/FeedComposer';

export default function EditGroupName({ conversation }) {
  const { user } = useAuth();
  const { renameGroupChat } = useChat();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);
  const submit = async event => {
    event.preventDefault();
    if (pending.current || !name.trim() || name.trim().length > 80) return;
    pending.current = true;
    setSaving(true);
    setError('');
    try {
      await renameGroupChat(conversation._id, name.trim());
      setOpen(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to save the group name. Please try again.');
    } finally {
      pending.current = false;
      setSaving(false);
    }
  };
  if (!conversation.isGroup || !conversation.adminAuthIds?.includes(String(user?.authId || user?._id))) return null;
  return <>
    <button type="button" aria-label="Edit group name" title="Edit group name"
      className="shrink-0 rounded-full p-2 text-zinc-500 hover:bg-zinc-100 hover:text-brand dark:text-zinc-400 dark:hover:bg-zinc-800"
      onClick={() => { setName(conversation.name || ''); setError(''); setOpen(true); }}>
      <Pencil size={16} />
    </button>
    {open && <FeedDialog title="Edit group name" busy={saving} onClose={() => setOpen(false)}>
      <form onSubmit={submit} className="space-y-4">
        <label className="block text-sm font-medium">
          Group name
          <input autoFocus required maxLength={80} value={name} disabled={saving}
            onChange={event => setName(event.target.value)}
            className="mt-2 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100" />
        </label>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">All group members will see this name. Maximum 80 characters.</p>
        {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" disabled={saving} onClick={() => setOpen(false)} className="rounded-lg px-4 py-2 text-sm disabled:opacity-50">Cancel</button>
          <button type="submit" disabled={saving || !name.trim() || name.trim() === conversation.name}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Saving...' : 'Save changes'}</button>
        </div>
      </form>
    </FeedDialog>}
  </>;
}
