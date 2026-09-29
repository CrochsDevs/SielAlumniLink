import { useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import { UserPlus } from 'lucide-react';
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
        .slice(0, 6);
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

  return (
    <div className="min-h-screen bg-[#f3f6f3] dark:bg-zinc-950">
      <AlumniSidebar user={user} mobileOpen={sidebarOpen} setMobileOpen={setSidebarOpen} />

      <div className="lg:pl-64">
        <AlumniTopbar user={user} title="Requests" onMenuClick={() => setSidebarOpen(true)} />

        <main className="mx-auto max-w-3xl space-y-3 p-4 sm:p-6">
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
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {suggestions.map((person) => (
                  <div
                    key={person._id}
                    className="flex items-center gap-3 rounded-2xl border border-zinc-100 dark:border-zinc-800 p-3.5"
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#009639]/10 dark:bg-[#009639]/20 text-sm font-bold text-[#009639] dark:text-emerald-300">
                      {(person.name || 'A').charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-bold text-zinc-900 dark:text-zinc-100">
                        {person.name || 'Alumni'}
                      </p>
                      <p className="truncate text-[11px] text-zinc-500 dark:text-zinc-400">
                        {person.program || person.email}
                      </p>
                      <button
                        type="button"
                        disabled={connecting === person.email}
                        onClick={() => handleConnect(person.email)}
                        className="mt-2 flex items-center gap-1 rounded-full bg-[#009639] px-3.5 py-1.5 text-[11px] font-bold text-white transition hover:bg-[#007a2e] disabled:opacity-50"
                      >
                        <UserPlus className="h-3 w-3" />
                        {connecting === person.email ? '...' : 'Connect'}
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
