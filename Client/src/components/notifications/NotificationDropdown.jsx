import { useNavigate } from 'react-router-dom';
import { BellOff } from 'lucide-react';
import { useAuth } from '../../context/useAuth';

// Notification links are authored for alumni pages — resolve them
// to the equivalent page for the current role.
const ADMIN_LINKS = {
  '/alumni/message': '/admin/message',
  '/alumni/career': '/admin/jobs',
  '/requests': '/admin/users',
};
const STUDENT_LINKS = {
  '/alumni/message': '/inbox',
  '/alumni/career': '/student/career',
  '/requests': '/student/requests',
};

const formatTime = (iso) => {
  if (!iso) return '';
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// Shared notification dropdown panel (wired to useNotifications data).
const NotificationDropdown = ({ items, onRead, onReadAll, onClose }) => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const resolveLink = (link) => {
    if (!link) return null;
    if (user?.role === 'admin') return ADMIN_LINKS[link] || link;
    if (user?.role === 'student') return STUDENT_LINKS[link] || link;
    if (link === '/requests') return '/alumni/requests';
    return link;
  };

  const open = (item) => {
    if (!item.read) onRead(item._id);
    onClose();
    const target = resolveLink(item.link);
    if (target) navigate(target);
  };

  return (
    <div className="absolute right-0 mt-2 w-80 overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-xl shadow-zinc-900/5 z-20">
      <div className="flex items-center justify-between px-4 py-3">
        <p className="text-[14px] font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">Notifications</p>
        <button
          type="button"
          onClick={onReadAll}
          className="text-[11.5px] font-semibold text-[#009639] dark:text-emerald-300 hover:underline"
        >
          Mark all read
        </button>
      </div>
      <ul className="max-h-80 overflow-y-auto pb-1.5">
        {items.map((item) => (
          <li key={item._id}>
            <button
              type="button"
              onClick={() => open(item)}
              className={`flex w-full items-start gap-2.5 px-4 py-2.5 text-left transition hover:bg-zinc-50 dark:hover:bg-zinc-800 ${
                !item.read ? 'bg-emerald-50/50 dark:bg-emerald-950/30' : ''
              }`}
            >
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${!item.read ? 'bg-[#009639]' : 'bg-zinc-200 dark:bg-zinc-700'}`} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] font-bold text-zinc-800 dark:text-zinc-100">{item.title}</span>
                {item.body && (
                  <span className="block truncate text-[11.5px] text-zinc-500 dark:text-zinc-400">{item.body}</span>
                )}
                <span className="block text-[10.5px] text-zinc-400 dark:text-zinc-500">{formatTime(item.createdAt)}</span>
              </span>
            </button>
          </li>
        ))}
        {items.length === 0 && (
          <li className="flex flex-col items-center px-4 py-8 text-center">
            <BellOff className="h-7 w-7 text-zinc-300 dark:text-zinc-600" />
            <p className="mt-2 text-[12.5px] font-semibold text-zinc-500 dark:text-zinc-400">No notifications yet</p>
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500">New announcements, jobs, and events appear here.</p>
          </li>
        )}
      </ul>
    </div>
  );
};

export default NotificationDropdown;
