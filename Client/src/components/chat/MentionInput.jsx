import { useEffect, useId, useRef, useState } from 'react';
import api from '../../utils/axios';
import { getSocket } from '../../realtime/socket';
import { mentionQuery } from './mentionText';
import ChatAvatar from './ChatAvatar';

export default function MentionInput({ conversationId, isGroup, composer, value, onChange, onKeyDown, className, ref: bindInput, ...props }) {
  const input = useRef(null);
  const id = useId();
  const [query, setQuery] = useState(null);
  const [selected, setSelected] = useState(0);
  const [result, setResult] = useState({ owner: null, members: [], error: '' });
  const open = !!isGroup && !!query && !props.disabled;
  useEffect(() => {
    const socket = getSocket();
    const invalidate = data => { if (String(data.conversationId) === String(conversationId)) setResult({ owner: null, members: [], error: '' }); };
    socket.on('conversation:members', invalidate);
    return () => socket.off('conversation:members', invalidate);
  }, [conversationId]);
  useEffect(() => {
    if (!open || result.owner === conversationId) return;
    const controller = new AbortController();
    api.get(`/conversations/${conversationId}/members`, { signal: controller.signal }).then(response => {
      if (!controller.signal.aborted) setResult({ owner: conversationId, members: response.data.data.members || [], error: '' });
    }).catch(error => {
      if (!controller.signal.aborted) setResult({ owner: conversationId, members: [], error: error.response?.data?.message || 'Unable to load group members.' });
    });
    return () => controller.abort();
  }, [conversationId, open, result.owner]);
  const candidates = result.owner === conversationId ? result.members.filter(member => member.name?.toLowerCase().includes(query?.query.trim().toLowerCase() || '')).slice(0, 20) : [];
  const findQuery = (text, caret) => {
    const found = mentionQuery(text, caret);
    if (found && result.members.some(member => member.name?.toLowerCase().startsWith(found.query.trim().toLowerCase()))) return found;
    if (found && result.members.some(member => composer.mentionAuthIds.includes(member.authId) && found.query.startsWith(`${member.name} `))) return null;
    return found;
  };
  const choose = member => {
    const label = `@${member.name} `;
    const next = value.slice(0, query.start) + label + value.slice(query.end);
    if (next.length > 2000) return;
    onChange({ target: { value: next } });
    composer.addMention(member.authId);
    const caret = query.start + label.length;
    setQuery(null);
    requestAnimationFrame(() => { input.current?.focus(); input.current?.setSelectionRange(caret, caret); });
  };
  const showMembers = () => {
    const caret = input.current?.selectionStart ?? value.length;
    let next = value, position = caret;
    if (!mentionQuery(next, position)) {
      const token = caret > 0 && !/\s/.test(value[caret - 1]) ? ' @' : '@';
      next = value.slice(0, caret) + token + value.slice(caret);
      if (next.length > 2000) return;
      position += token.length;
      onChange({ target: { value: next } });
    }
    setResult({ owner: null, members: [], error: '' });
    setQuery(mentionQuery(next, position));
    setSelected(0);
    requestAnimationFrame(() => { input.current?.focus(); input.current?.setSelectionRange(position, position); });
  };
  return <div className="relative min-w-0 flex-1">
    {open && <div id={id} role="listbox" aria-label="Mention group member" className="absolute bottom-full left-0 z-50 mb-2 max-h-56 w-64 max-w-[calc(100vw-4rem)] overflow-y-auto rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-xl">
      {result.owner !== conversationId ? <p role="status" className="px-3 py-2 text-xs">Loading members…</p> : result.error ? <p role="alert" className="px-3 py-2 text-xs">{result.error} <button type="button" onPointerDown={event => event.preventDefault()} onClick={() => setResult({ owner: null, members: [], error: '' })} className="underline">Retry</button></p> : candidates.length ? candidates.map((member, index) => <button key={member.authId} id={`${id}-${index}`} type="button" role="option" aria-selected={index === selected} onPointerDown={event => event.preventDefault()} onClick={() => choose(member)} className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm ${index === selected ? 'bg-primary/10 font-semibold text-primary' : 'hover:bg-muted'}`}><span aria-hidden="true" className="h-8 w-8 shrink-0 text-xs"><ChatAvatar convo={member} /></span><span className="min-w-0 truncate">@{member.name}</span></button>) : <p className="px-3 py-2 text-xs">No matching group members.</p>}
    </div>}
    <input {...props} ref={node => { input.current = node; bindInput?.(node); }} value={value} maxLength={2000} className={`${className} w-full ${isGroup ? '!pr-9' : ''}`} autoComplete="off"
      role={isGroup ? 'combobox' : undefined} aria-expanded={isGroup ? open : undefined} aria-autocomplete={isGroup ? 'list' : undefined} aria-controls={open ? id : undefined} aria-activedescendant={open && candidates[selected] ? `${id}-${selected}` : undefined}
      onFocus={event => {
        const element = event.currentTarget;
        // Let the browser restore the caret and finish its blur/focus sequence.
        requestAnimationFrame(() => {
          if (input.current !== element || document.activeElement !== element) return;
          setQuery(findQuery(element.value, element.selectionStart));
          setSelected(0);
        });
      }}
      onBlur={() => setQuery(null)}
      onChange={event => { onChange(event); setQuery(findQuery(event.target.value, event.target.selectionStart)); setSelected(0); }}
      onClick={event => { setQuery(findQuery(value, event.currentTarget.selectionStart)); setSelected(0); }}
      onKeyDown={event => {
        if (open && event.key === 'Escape') { event.preventDefault(); setQuery(null); return; }
        if (open && event.key === 'Tab' && event.shiftKey) { setQuery(null); return; }
        if (open && candidates.length && ['ArrowDown', 'ArrowUp', 'Enter', 'Tab'].includes(event.key)) {
          event.preventDefault();
          if (['Enter', 'Tab'].includes(event.key)) choose(candidates[Math.min(selected, candidates.length - 1)]);
          else setSelected(previous => (previous + (event.key === 'ArrowDown' ? 1 : -1) + candidates.length) % candidates.length);
          return;
        }
        if (open && event.key === 'Enter') { event.preventDefault(); return; }
        onKeyDown?.(event);
      }} />
    {isGroup && <button type="button" disabled={props.disabled} aria-label="Mention a group member" title="Mention a group member" aria-haspopup="listbox" aria-expanded={open} onPointerDown={event => event.preventDefault()} onClick={showMembers} className="absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-sm font-semibold text-brand hover:bg-primary/10 disabled:opacity-40">@</button>}
  </div>;
}
