import { presenceLabel } from './presenceStatus';

export default function PresenceBadge({ status = 'offline', className = '' }) {
  return (
    <span
      role="img"
      aria-label={presenceLabel(status)}
      title={presenceLabel(status)}
      className={`absolute -bottom-0.5 -right-0.5 flex h-3 w-3 items-center justify-center rounded-full border-2 border-white dark:border-zinc-900 ${status === 'active' ? 'bg-emerald-500' : status === 'busy' ? 'bg-red-500' : 'bg-zinc-400'} ${className}`}
    >
      {status === 'busy' && <span className="h-[1.5px] w-1 rounded-full bg-white" />}
    </span>
  );
}
