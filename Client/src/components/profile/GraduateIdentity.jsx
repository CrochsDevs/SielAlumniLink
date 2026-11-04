import ProfileAvatar from './ProfileAvatar';

export default function GraduateIdentity({ user }) {
  return <div className="flex items-start gap-3">
    <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand/10 text-xs font-semibold text-brand ring-1 ring-black/5 dark:ring-white/10">
      <ProfileAvatar user={user} fallback={user.email || 'U'} />
    </span>
    <div className="min-w-0 flex-1">
      <p className="break-words text-sm font-semibold leading-5 text-zinc-900 dark:text-zinc-100">{user.name || user.email || 'Graduate'}</p>
      {user.name && user.email && <p title={user.email} className="mt-0.5 truncate text-xs leading-5 text-zinc-500 dark:text-zinc-400">{user.email}</p>}
      {user.program && <p className="mt-2 break-words text-xs leading-5 text-zinc-600 dark:text-zinc-300">{user.program}</p>}
      {user.batch && <p className="mt-1 text-[11px] leading-4 text-zinc-500 dark:text-zinc-400">Graduated {user.batch}</p>}
    </div>
  </div>;
}
