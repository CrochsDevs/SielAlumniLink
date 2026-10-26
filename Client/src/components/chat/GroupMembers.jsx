import { useEffect, useRef, useState } from 'react';
import { Users, UserPlus, Search } from 'lucide-react';
import { FeedDialog } from '../feed/FeedComposer';
import { useChat } from '../../context/useChat';
import { useAuth } from '../../context/useAuth';
import { getSocket } from '../../realtime/socket';
import api from '../../utils/axios';
import ChatAvatar from './ChatAvatar';

export default function GroupMembers({ conversation }) {
  const [open, setOpen] = useState(false);
  if (!conversation.isGroup) return null;
  return <>
    <button type="button" aria-label="View group members" title="View group members" onClick={() => setOpen(true)}
      className="shrink-0 rounded-full p-2 text-zinc-500 hover:bg-zinc-100 hover:text-brand dark:text-zinc-400 dark:hover:bg-zinc-800"><Users size={17} /></button>
    {open && <MembersDialog key={conversation._id} conversation={conversation} onClose={() => setOpen(false)} />}
  </>;
}

function MembersDialog({ conversation, onClose }) {
  const { user } = useAuth();
  const { addGroupMembers, promoteGroupAdmin, leaveGroup, removeGroupMember } = useChat();
  const [state, setState] = useState({ loading: true, members: [], candidates: [], maxMembers: 20, error: '' });
  const [tab, setTab] = useState('members');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [notice, setNotice] = useState('');
  const [revision, setRevision] = useState(0);
  const [exitTarget, setExitTarget] = useState(null);
  const pending = useRef(false);
  const myId = String(user?.authId || user?._id);
  const canPromote = state.adminAuthIds?.includes(myId);
  const confirmExit = async () => {
    if (pending.current || !exitTarget) return;
    pending.current = true;
    setSaving(true);
    setSaveError('');
    setNotice('');
    try {
      if (exitTarget.authId === myId) {
        await leaveGroup(conversation._id);
        onClose();
      } else {
        await removeGroupMember(conversation._id, exitTarget.authId);
        setNotice(`${exitTarget.name} was removed from the group.`);
        setRevision(value => value + 1);
      }
      setExitTarget(null);
    } catch (error) {
      setSaveError(error.response?.data?.message || 'Unable to update the group. Please try again.');
    } finally { pending.current = false; setSaving(false); }
  };
  const promote = async person => {
    if (pending.current) return;
    pending.current = true;
    setSaving(true);
    setSaveError('');
    setNotice('');
    try {
      const result = await promoteGroupAdmin(conversation._id, person.authId);
      setState(prev => ({ ...prev, ...result }));
      setNotice(`${person.name} is now a group admin.`);
      setRevision(value => value + 1);
    } catch (error) {
      setSaveError(error.response?.data?.message || 'Unable to update group admins. Please try again.');
    } finally { pending.current = false; setSaving(false); }
  };

  useEffect(() => {
    const socket = getSocket();
    const refresh = () => setRevision(value => value + 1);
    const changed = event => { if (String(event.conversationId) === String(conversation._id)) refresh(); };
    socket.on('conversation:members', changed);
    socket.on('connect', refresh);
    return () => { socket.off('conversation:members', changed); socket.off('connect', refresh); };
  }, [conversation._id]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    Promise.all([
      api.get(`/conversations/${conversation._id}/members`, { signal: controller.signal }),
      api.get(`/conversations/${conversation._id}/candidates`, { signal: controller.signal }),
    ]).then(([members, candidates]) => {
      if (!active) return;
      setState({ ...members.data.data, candidates: candidates.data.data, loading: false, error: '' });
      setSelected(prev => prev.filter(id => candidates.data.data.some(person => person.authId === id)));
    }).catch(error => {
      if (active) setState(prev => ({ ...prev, loading: false, error: error.response?.data?.message || 'Unable to load group members. Please try again.' }));
    });
    return () => { active = false; controller.abort(); };
  }, [conversation._id, revision]);

  const submit = async event => {
    event.preventDefault();
    if (pending.current || !selected.length) return;
    pending.current = true;
    setSaving(true);
    setSaveError('');
    setNotice('');
    try {
      const result = await addGroupMembers(conversation._id, selected);
      setState(prev => ({ ...prev, ...result, candidates: prev.candidates.filter(person => !result.members.some(member => member.authId === person.authId)) }));
      setSelected([]);
      setQuery('');
      setTab('members');
      setNotice('Group members updated.');
      setRevision(value => value + 1);
    } catch (error) {
      setSaveError(error.response?.data?.message || 'Unable to add members. Please try again.');
      setRevision(value => value + 1);
    } finally { pending.current = false; setSaving(false); }
  };
  const people = tab === 'members' ? state.members : state.candidates;
  const filtered = people.filter(person => `${person.name} ${person.email}`.toLowerCase().includes(query.trim().toLowerCase()));
  const remaining = Math.max(0, state.maxMembers - state.members.length);
  const changeTab = value => { setTab(value); setQuery(''); setSaveError(''); setNotice(''); setExitTarget(null); };
  return <FeedDialog title="Group members" busy={saving} onClose={onClose}>
    <p className="mb-4 break-words text-sm text-zinc-500 dark:text-zinc-400">{conversation.name}</p>
    <div className="mb-4 flex gap-2" role="group" aria-label="Group member views">
      <button type="button" disabled={saving} aria-pressed={tab === 'members'} onClick={() => changeTab('members')}
        className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${tab === 'members' ? 'bg-brand text-white' : 'bg-zinc-100 dark:bg-zinc-800'}`}>Members{!state.loading && ` (${state.members.length})`}</button>
      <button type="button" disabled={saving} aria-pressed={tab === 'add'} onClick={() => changeTab('add')}
        className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${tab === 'add' ? 'bg-brand text-white' : 'bg-zinc-100 dark:bg-zinc-800'}`}><UserPlus size={16} />Add members</button>
    </div>
    {state.loading ? <p role="status" className="p-6 text-center text-sm text-zinc-500">Loading members...</p> : state.error ? (
      <div role="alert" className="space-y-3 py-4 text-sm text-red-600"><p>{state.error}</p><button type="button" className="underline" onClick={() => { setState(prev => ({ ...prev, loading: true, error: '' })); setRevision(value => value + 1); }}>Retry</button></div>
    ) : <form onSubmit={submit}>
      <label className="relative mb-3 block">
        <span className="sr-only">{tab === 'members' ? 'Search members' : 'Search connections'}</span>
        <Search size={16} className="absolute left-3 top-3 text-zinc-400" />
        <input value={query} disabled={saving} onChange={event => setQuery(event.target.value)} placeholder={tab === 'members' ? 'Search members...' : 'Search your connections...'}
          className="w-full rounded-lg border border-zinc-300 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-brand dark:border-zinc-700 dark:bg-zinc-800" />
      </label>
      {tab === 'add' && <p className="mb-3 text-xs leading-5 text-zinc-500 dark:text-zinc-400">Select from your accepted connections. {remaining ? `${remaining} places available.` : 'This group is full.'} Existing members are already included.</p>}
      <ul aria-label={tab === 'members' ? 'Group member list' : 'Available connections'} className="max-h-[40dvh] space-y-1 overflow-y-auto overscroll-contain">
        {filtered.map(person => <li key={person.authId}>
          <div className={`flex flex-wrap items-center gap-2 rounded-lg p-2.5 ${tab === 'add' ? 'hover:bg-zinc-50 dark:hover:bg-zinc-800' : ''}`}>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand/10 text-sm font-bold text-brand"><ChatAvatar convo={person} /></span>
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{person.name}{person.authId === myId ? ' (You)' : ''}</span><span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">{person.email}</span></span>
            {tab === 'members' && (person.isAdmin ? <span className="shrink-0 rounded-full bg-brand/10 px-2 py-1 text-[10px] font-semibold text-brand">{person.authId === state.createdBy ? 'Creator · Admin' : 'Admin'}</span> : canPromote && <button type="button" disabled={saving} aria-label={`Make ${person.name} admin`} onClick={() => promote(person)} className="shrink-0 rounded-lg border border-zinc-300 px-2 py-1.5 text-xs font-semibold hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800">Make admin</button>)}
            {tab === 'add' && <input type="checkbox" aria-label={`Add ${person.name}`} checked={selected.includes(person.authId)} disabled={saving || (!selected.includes(person.authId) && selected.length >= remaining)}
              onChange={event => setSelected(prev => event.target.checked ? [...prev, person.authId] : prev.filter(id => id !== person.authId))} className="h-4 w-4 accent-brand" />}
            {tab === 'members' && canPromote && person.authId !== myId && <button type="button" disabled={saving} aria-label={`Remove ${person.name} from group`} onClick={() => { setExitTarget(person); setSaveError(''); }} className="shrink-0 rounded-lg px-2 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-950">Remove</button>}
          </div>
        </li>)}
      </ul>
      {!filtered.length && <p className="py-6 text-center text-sm text-zinc-500">{query.trim() ? 'No matching people.' : tab === 'add' ? 'No connections available to add.' : 'No members to show.'}</p>}
      {saveError && <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">{saveError}</p>}
      {notice && <p role="status" className="mt-3 text-sm text-brand">{notice}</p>}
      {exitTarget && <div className="mt-4 space-y-3 rounded-xl border border-red-200 p-3 dark:border-red-900">
        <p className="text-sm">{exitTarget.authId === myId ? 'Leave this group? You will need to be added again to rejoin. If you are the last admin, another member will become admin.' : `Remove ${exitTarget.name} from this group? They will need to be added again to rejoin.`}</p>
        <div className="flex justify-end gap-2">
          <button type="button" disabled={saving} onClick={() => setExitTarget(null)} className="rounded-lg px-3 py-2 text-sm disabled:opacity-50">Cancel</button>
          <button type="button" disabled={saving} onClick={confirmExit} className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Saving...' : exitTarget.authId === myId ? 'Confirm leave' : 'Confirm remove'}</button>
        </div>
      </div>}
      <div className="mt-4 flex items-center justify-end gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-700">
        <button type="button" disabled={saving} onClick={() => { setExitTarget({ authId: myId }); setSaveError(''); }} className="mr-auto rounded-lg px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-950">Leave group</button>
        {tab === 'add' && <span className="mr-auto text-xs text-zinc-500">{selected.length} selected</span>}
        <button type="button" disabled={saving} onClick={onClose} className="rounded-lg px-3 py-2 text-sm disabled:opacity-50">Close</button>
        {tab === 'add' && <button type="submit" disabled={saving || !selected.length || selected.length > remaining} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Adding...' : 'Add selected'}</button>}
      </div>
    </form>}
  </FeedDialog>;
}
