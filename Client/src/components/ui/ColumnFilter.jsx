export default function ColumnFilter({ label, value = '', onChange, options, allLabel = 'All', type = 'search', placeholder = 'Search…' }) {
  const className = 'mt-2 block h-9 w-full min-w-0 rounded-lg border border-zinc-300 bg-white px-2.5 text-xs font-normal normal-case tracking-normal text-zinc-700 outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:[color-scheme:dark]';
  return options ? <select aria-label={label} value={value} onChange={event => onChange(event.target.value)} className={className}>
    <option value="">{allLabel}</option>
    {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
  </select> : <input aria-label={label} type={type} value={value} maxLength={200} placeholder={placeholder}
    onChange={event => onChange(event.target.value)} className={className} />;
}
