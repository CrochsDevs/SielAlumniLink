import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MessageSquareOff, Search } from 'lucide-react';
import TopbarPanel from '../ui/TopbarPanel';
import ChatAvatar from './ChatAvatar';
import { formatTime } from './messageFormat';
import useMobileView from '../../hooks/useMobileView';

export default function ChatsDropdown({ conversations, messagePath, onClose, onDesktopSelect, triggerRef, id }) {
  const [query, setQuery] = useState('');
  const isMobile = useMobileView();
  const navigate = useNavigate();
  const filtered = conversations.filter(conversation => `${conversation.name || ''} ${conversation.preview || ''}`.toLowerCase().includes(query.trim().toLowerCase()));
  const select = conversation => {
    onClose();
    if (isMobile) navigate(`${messagePath}?conversation=${encodeURIComponent(conversation._id)}`);
    else onDesktopSelect(conversation);
  };
  return <TopbarPanel title="Messages" id={id} triggerRef={triggerRef} onClose={onClose} className="chats-panel"
    action={<Link to={messagePath} onClick={onClose} className="text-[11.5px] font-semibold text-primary hover:underline">See all</Link>}>
    {isMobile && <label className="relative mx-4 mb-3 block">
      <span className="sr-only">Search messages</span>
      <Search size={17} aria-hidden="true" className="pointer-events-none absolute left-3 top-3 text-zinc-400" />
      <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search messages"
        className="h-11 w-full rounded-full border border-border bg-muted pl-10 pr-4 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
    </label>}
    <ul className="topbar-panel-list max-h-80 overflow-y-auto pb-1.5">
      {filtered.map(conversation => <li key={conversation._id}>
        <button type="button" onClick={() => select(conversation)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-zinc-50 dark:hover:bg-zinc-800">
          <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
            <ChatAvatar convo={conversation} />
            {conversation.unread > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white ring-2 ring-white">{conversation.unread}</span>}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-bold text-zinc-800 dark:text-zinc-100">{conversation.name}</span>
            <span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">{conversation.preview || 'No received messages yet'}</span>
          </span>
          <span className="shrink-0 text-[10.5px] text-zinc-400">{formatTime(conversation.previewAt === undefined ? conversation.time : conversation.previewAt)}</span>
        </button>
      </li>)}
      {!filtered.length && <li className="flex flex-col items-center gap-2 px-4 py-10 text-center text-xs text-muted-foreground">
        <MessageSquareOff size={28} aria-hidden="true" />
        <p>{query ? 'No matching conversations.' : 'No conversations yet.'}</p>
      </li>}
    </ul>
  </TopbarPanel>;
}
