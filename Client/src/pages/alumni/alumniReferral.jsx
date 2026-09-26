import { useState } from 'react';
import Swal from 'sweetalert2';
import { Share2, Send, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import AlumniSidebar from '../../layout/sidebar/alumni/alumniSidebar';
import AlumniTopbar from '../../layout/topbar/alumni/alumniTopbar';

// TEMPORARY content — papalitan ng totoong data mula sa API.
// TODO(alumni): wire referrals to backend endpoints.
const INITIAL_REFERRALS = [
  {
    id: 1,
    candidate: 'Ana Cruz',
    job: 'Data Analyst at DataHub',
    date: 'Sep 20, 2026',
    status: 'Interviewing',
  },
  {
    id: 2,
    candidate: 'Mark Dela Peña',
    job: 'Engineer at BuildRight',
    date: 'Sep 12, 2026',
    status: 'Hired',
  },
  {
    id: 3,
    candidate: 'Jenny Lim',
    job: 'Designer at Studio Co',
    date: 'Aug 30, 2026',
    status: 'Pending',
  },
];

const STATUS_STYLE = {
  Hired: 'bg-[#009639]/10 text-[#007a2e] ring-emerald-200/60',
  Interviewing: 'bg-amber-50 text-amber-700 ring-amber-200/60',
  Pending: 'bg-zinc-100 text-zinc-500 ring-zinc-200',
  Declined: 'bg-red-50 text-red-600 ring-red-200/60',
};

const STATUS_ICON = {
  Hired: CheckCircle2,
  Interviewing: Clock,
  Pending: Clock,
  Declined: XCircle,
};

const AlumniReferral = () => {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [referrals, setReferrals] = useState(INITIAL_REFERRALS);
  const [form, setForm] = useState({ candidate: '', email: '', job: '', message: '' });
  const [sending, setSending] = useState(false);

  const inputClass =
    'w-full h-11 px-3.5 rounded-xl border border-zinc-200 bg-zinc-50/60 text-[13px] outline-none transition focus:border-[#009639] focus:bg-white focus:ring-2 focus:ring-[#009639]/15';

  const handleSubmit = (e) => {
    e.preventDefault();
    setSending(true);
    setTimeout(() => {
      setReferrals((prev) => [
        {
          id: Date.now(),
          candidate: form.candidate,
          job: form.job,
          date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          status: 'Pending',
        },
        ...prev,
      ]);
      setForm({ candidate: '', email: '', job: '', message: '' });
      setSending(false);
      Swal.fire({ title: 'Referral sent', text: 'The candidate will be notified.', icon: 'success', timer: 1500, showConfirmButton: false });
    }, 600);
  };

  return (
    <div className="min-h-screen bg-[#f3f6f3]">
      <AlumniSidebar user={user} mobileOpen={sidebarOpen} setMobileOpen={setSidebarOpen} />

      <div className="lg:pl-64">
        <AlumniTopbar user={user} title="Referral" onMenuClick={() => setSidebarOpen(true)} />

        <main className="mx-auto grid max-w-5xl items-start gap-4 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          {/* Refer form */}
          <section className="overflow-hidden rounded-3xl border border-emerald-900/10 bg-white shadow-sm">
            <div className="bg-gradient-to-r from-[#0F4C3A] to-[#009639] px-5 py-4">
              <h2 className="flex items-center gap-2 text-[14px] font-extrabold text-white">
                <Share2 className="h-4 w-4" />
                Refer a fellow Sielesyuans
              </h2>
              <p className="text-[11.5px] text-white/70">Recommend someone for an opening.</p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3 p-5">
              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-zinc-500">
                  Candidate Name
                </label>
                <input value={form.candidate} onChange={(e) => setForm({ ...form, candidate: e.target.value })}
                  required placeholder="e.g. Juan Dela Cruz" className={inputClass} />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-zinc-500">
                  Candidate Email
                </label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required placeholder="candidate@email.com" className={inputClass} />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-zinc-500">
                  Job / Opening
                </label>
                <input value={form.job} onChange={(e) => setForm({ ...form, job: e.target.value })}
                  required placeholder="e.g. HR Assistant at Tech Corp" className={inputClass} />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-zinc-500">
                  Why them? <span className="font-medium normal-case text-zinc-400">(optional)</span>
                </label>
                <textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })}
                  rows={3} placeholder="A short note about the candidate..."
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50/60 px-3.5 py-2.5 text-[13px] outline-none transition focus:border-[#009639] focus:bg-white focus:ring-2 focus:ring-[#009639]/15" />
              </div>
              <button type="submit" disabled={sending}
                className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-[#009639] text-[13px] font-bold text-white transition hover:bg-[#007a2e] disabled:opacity-60">
                <Send className="h-4 w-4" />
                {sending ? 'Sending...' : 'Send referral'}
              </button>
            </form>
          </section>

          {/* Referral list */}
          <section className="rounded-3xl border border-emerald-900/10 bg-white p-5 shadow-sm">
            <h2 className="text-[15px] font-extrabold tracking-tight text-zinc-900">My Referrals</h2>
            <p className="text-[12px] text-zinc-500">{referrals.length} total • help Sielesyuans get hired.</p>
            <ul className="mt-3 space-y-2.5">
              {referrals.map((r) => {
                const Icon = STATUS_ICON[r.status] || Clock;
                return (
                  <li key={r.id} className="flex items-center gap-3 rounded-2xl border border-zinc-100 p-3.5 transition hover:border-emerald-200 hover:bg-emerald-50/40">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#009639]/10 text-sm font-bold text-[#009639]">
                      {r.candidate.charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-bold text-zinc-900">{r.candidate}</p>
                      <p className="truncate text-[11.5px] text-zinc-500">{r.job}</p>
                      <p className="text-[10.5px] text-zinc-400">{r.date}</p>
                    </div>
                    <span className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ring-1 ${STATUS_STYLE[r.status]}`}>
                      <Icon className="h-3 w-3" />
                      {r.status}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        </main>
      </div>
    </div>
  );
};

export default AlumniReferral;
