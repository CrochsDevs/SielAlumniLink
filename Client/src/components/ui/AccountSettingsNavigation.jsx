import { createElement, useId, useLayoutEffect, useRef, useState } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';
import { scrollAfterViewChange } from '../../lib/scroll';
import './AccountSettingsNavigation.css';

export default function AccountSettingsNavigation({ groups, value, onChange, footer }) {
  const sheetId = useId();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  const selected = groups.flatMap(group => group.tabs).find(tab => tab.key === value);
  const selectSection = (key) => {
    onChange(key);
    setOpen(false);
    scrollAfterViewChange(triggerRef.current);
  };
  useLayoutEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    const trigger = triggerRef.current;
    const previousOverflow = document.body.style.overflow;
    const desktop = window.matchMedia('(min-width: 768px)');
    const onResize = () => { if (desktop.matches) setOpen(false); };
    document.body.style.overflow = 'hidden';
    dialog.showModal();
    closeRef.current?.focus({ preventScroll: true });
    desktop.addEventListener('change', onResize);
    return () => {
      desktop.removeEventListener('change', onResize);
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, [open]);

  return <aside className="account-settings-navigation w-full shrink-0 overflow-hidden rounded-panel border border-primary/10 bg-white shadow-panel dark:border-zinc-800 dark:bg-zinc-900 md:w-64">
    <button ref={triggerRef} type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open}
      aria-controls={open ? sheetId : undefined} aria-label={`Settings section: ${selected?.label || 'Choose section'}`}
      className="flex w-full items-center gap-3 p-3 text-left outline-none transition hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary md:hidden">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary" aria-hidden="true">
        {selected?.icon && createElement(selected.icon, { size: 20 })}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-foreground">{selected?.label}</span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">{selected?.desc || 'Choose a settings section'}</span>
      </span>
      <ChevronDown size={18} className="shrink-0 text-muted-foreground" aria-hidden="true" />
    </button>
    <div className="hidden md:block">
      {groups.map((group, index) => <div key={group.label} className={index ? 'border-t border-border' : ''}>
        <p className="px-4 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{group.label}</p>
        <nav aria-label={group.label} className="space-y-1 p-2">
          {group.tabs.map(tab => {
            const active = value === tab.key;
            return <button key={tab.key} type="button" onClick={() => selectSection(tab.key)} aria-current={active ? 'page' : undefined}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${active ? 'bg-primary/10 ring-1 ring-primary/20' : 'hover:bg-muted'}`}>
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                {tab.icon && createElement(tab.icon, { size: 16, 'aria-hidden': true })}
              </span>
              <span className="min-w-0">
                <span className={`block truncate text-[12.5px] font-bold ${active ? 'text-primary' : 'text-foreground'}`}>{tab.label}</span>
                {tab.desc && <span className="block truncate text-[10.5px] text-muted-foreground">{tab.desc}</span>}
              </span>
            </button>;
          })}
        </nav>
      </div>)}
      {footer && <p className="m-2 mt-1 rounded-xl bg-primary/5 p-3 text-[11px] leading-relaxed text-muted-foreground">{footer}</p>}
    </div>
    {open && <dialog ref={dialogRef} id={sheetId} aria-labelledby={`${sheetId}-title`} aria-modal="true"
      className="account-settings-sheet bg-card text-card-foreground"
      onCancel={event => { event.preventDefault(); setOpen(false); }}
      onClick={event => {
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) setOpen(false);
      }}>
      <div className="shrink-0">
        <div className="mx-auto mb-1 mt-3 h-1 w-10 rounded-full bg-muted-foreground/25" aria-hidden="true" />
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 pb-3 pt-1">
          <div>
            <h2 id={`${sheetId}-title`} className="text-lg font-semibold tracking-tight">Account settings</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Choose a section</p>
          </div>
          <button ref={closeRef} type="button" aria-label="Close settings sections" onClick={() => setOpen(false)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
            <X size={20} aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className="account-settings-sheet-content">
        {groups.map(group => <nav key={group.label} aria-label={group.label} className="px-3 pb-2 pt-3">
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{group.label}</p>
          <div className="space-y-1">
            {group.tabs.map(tab => {
              const active = tab.key === value;
              return <button key={tab.key} type="button" aria-current={active ? 'page' : undefined}
                onClick={() => selectSection(tab.key)}
                className={`flex min-h-14 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${active ? 'bg-primary/10' : 'hover:bg-muted'}`}>
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`} aria-hidden="true">
                  {tab.icon && createElement(tab.icon, { size: 19 })}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-sm font-semibold ${active ? 'text-primary' : 'text-foreground'}`}>{tab.label}</span>
                  {tab.desc && <span className="mt-0.5 block text-[11px] leading-4 text-muted-foreground">{tab.desc}</span>}
                </span>
                {active && <Check size={20} className="shrink-0 text-primary" aria-label="Selected section" />}
              </button>;
            })}
          </div>
        </nav>)}
      </div>
    </dialog>}
  </aside>;
}
