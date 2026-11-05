export const presenceLabel = status => status === 'active' ? 'Active now' : status === 'busy' ? 'Busy' : 'Offline';
export const presenceTextColor = status => status === 'active' ? 'text-emerald-600 dark:text-emerald-400' : status === 'busy' ? 'text-red-600 dark:text-red-400' : 'text-zinc-500 dark:text-zinc-400';
