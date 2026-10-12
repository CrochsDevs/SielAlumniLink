import { useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import { UserPlus, X, GraduationCap } from 'lucide-react';
import { Link } from 'react-router-dom';
import ProfileAvatar from '../../components/profile/ProfileAvatar';
import { profilePath } from '../../components/search/searchLinks';
import { useAuth } from '../../context/useAuth';
import AlumniSidebar from '../../layout/sidebar/alumni/alumniSidebar';
import AlumniTopbar from '../../layout/topbar/alumni/alumniTopbar';
import RequestsList, { RequestsHeader, useRequests } from '../../components/connections/RequestsInbox';
import api from '../../utils/axios';

const AlumniRequests = () => {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { requests, loading, respond } = useRequests();
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(true);
  const [connecting, setConnecting] = useState(null);

  const loadSuggestions = async () => {
    setSuggestionsLoading(true);
    try {
      const [usersRes, connsRes] = await Promise.all([
        api.get('/users', { params: { role: 'alumni' } }),
        api.get('/connections/me'),
      ]);
      const connectedEmails = new Set(
        (connsRes.data.data || []).map((c) =>
          c.requesterEmail === user?.email ? c.recipientEmail : c.requesterEmail
        )
      );
      const list = (usersRes.data.data || [])
        .filter((u) => u.email && u.email !== user?.email && !connectedEmails.has(u.email))
        .slice(0, 8);
      setSuggestions(list);
    } catch {
      // ignore
    } finally {
      setSuggestionsLoading(false);
    }
  };

  useEffect(() => {
    loadSuggestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleConnect = async (email) => {
    setConnecting(email);
    try {
      await api.post('/connections', { email });
      setSuggestions((prev) => prev.filter((s) => s.email !== email));
      Swal.fire({ title: 'Request sent', icon: 'success', timer: 1500, showConfirmButton: false });
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to send request', 'error');
    } finally {
      setConnecting(null);
    }
  };

  // Hide a suggestion tile (UI only)
  const handleDismiss = (email) => {
    setSuggestions((prev) => prev.filter((s) => s.email !== email));
  };

  return (
    <div className="min-h-screen bg-[#f3f6f3] dark:bg-zinc-950">
      <AlumniSidebar user={user} mobileOpen={sidebarOpen} setMobileOpen={setSidebarOpen} />

      <div className="lg:pl-64">
        <AlumniTopbar user={user} title="Requests" onMenuClick={() => setSidebarOpen(true)} />

        <main className="mx-auto max-w-4xl space-y-3 p-4 sm:p-6">
          <RequestsHeader count={requests.length} />
          <RequestsList requests={requests} loading={loading} onRespond={respond} />

          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-5">
            <h2 className="flex items-center gap-2 text-[15px] font-extrabold text-zinc-900 dark:text-zinc-100">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#009639]/10 dark:bg-[#009639]/20 text-[#009639] dark:text-emerald-300">
                <UserPlus className="h-4 w-4" />
              </span>
              People You May Know
            </h2>
            <p className="mt-1 text-[12px] text-zinc-500 dark:text-zinc-400">
              Connect with more fellow Sielesyuans.
            </p>

            {suggestionsLoading ? (
              <p className="py-6 text-center text-[12.5px] text-zinc-400">Loading suggestions...</p>
            ) : suggestions.length === 0 ? (
              <p className="py-6 text-center text-[12.5px] text-zinc-400">No suggestions right now.</p>
            ) : (
              <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                {suggestions.map((person) => (
                  <div
                    key={person._id}
                    className="relative flex flex-col overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                  >
                    {/* Banner */}
                    <div className="h-16 bg-gradient-to-br from-[#009639]/30 via-emerald-200/60 to-zinc-200 dark:from-[#009639]/40 dark:via-emerald-900/40 dark:to-zinc-800" />

                    {/* Dismiss */}
                    <button
                      type="button"
                      onClick={() => handleDismiss(person.email)}
                      aria-label="Dismiss suggestion"
                      className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-zinc-800/80 text-white transition hover:bg-zinc-900"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>

                    {/* Avatar */}
                    <div className="relative -mt-10 flex justify-center">
                      <Link to={profilePath(person)} aria-label={`View ${person.name || 'Alumni'} profile`} className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white dark:border-zinc-900 bg-emerald-50 dark:bg-emerald-900/50 text-2xl font-bold text-[#009639] dark:text-emerald-300">
                        <ProfileAvatar user={{ ...person, profilePicture: person.profilePicture || person.avatar }} fallback="A" />
                      </Link>
                    </div>

                    {/* Info */}
                    <div className="flex flex-1 flex-col px-3 pb-3 pt-2 text-center">
                      <Link to={profilePath(person)} className="line-clamp-2 text-[13.5px] font-bold leading-tight text-zinc-900 dark:text-zinc-100 hover:underline">
                        {person.name || 'Alumni'}
                      </Link>
                      <p className="mt-1 line-clamp-2 min-h-[32px] text-[11.5px] leading-snug text-zinc-500 dark:text-zinc-400">
                        {person.program || person.email}
                      </p>

                      <div className="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                        <GraduationCap className="h-3.5 w-3.5 shrink-0 text-[#009639]" />
                        <span className="truncate">Central Luzon State University</span>
                      </div>

                      <button
                        type="button"
                        disabled={connecting === person.email}
                        onClick={() => handleConnect(person.email)}
                        className="mt-auto flex w-full items-center justify-center gap-1.5 rounded-full border border-[#009639] px-3 py-1.5 text-[12.5px] font-bold text-[#009639] transition hover:bg-[#009639]/10 disabled:opacity-50 dark:border-emerald-400 dark:text-emerald-300 dark:hover:bg-emerald-400/10"
                        style={{ marginTop: '0.75rem' }}
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                        {connecting === person.email ? 'Sending...' : 'Connect'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default AlumniRequests;
