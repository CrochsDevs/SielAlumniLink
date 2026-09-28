import { useState } from 'react';
import { Plus, Award, BadgeCheck, Presentation, FolderKanban, FileText, Sparkles, X } from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import StudentSidebar from '../../layout/sidebar/student/studentSidebar';
import StudentTopbar from '../../layout/topbar/student/studentTopbar';

// TEMPORARY content — papalitan ng totoong data mula sa API.
// TODO(student): wire portfolio to backend endpoints.
const INITIAL = {
  skills: ['React', 'Python', 'Public Speaking'],
  certifications: ['AWS Cloud Practitioner (2025)', 'Google Data Analytics (2024)'],
  seminars: ['CLSU Research Congress 2025', 'Leadership Summit 2024'],
  projects: [
    { title: 'Enrollment Queue System', desc: 'Capstone project for the registrar office.' },
    { title: 'Alumni Directory Prototype', desc: 'Class project in Web Systems.' },
  ],
  research: [
    { title: 'Queueing Efficiency in Registrar Offices', desc: 'Undergraduate research, 2025.' },
  ],
  awards: ['Dean’s Lister (2023–2025)', 'Hackathon Finalist (2024)'],
};

const SECTIONS = [
  { key: 'skills', label: 'Skills', icon: Sparkles, type: 'tags' },
  { key: 'certifications', label: 'Certifications', icon: BadgeCheck, type: 'list' },
  { key: 'seminars', label: 'Seminars Attended', icon: Presentation, type: 'list' },
  { key: 'projects', label: 'Projects', icon: FolderKanban, type: 'cards' },
  { key: 'research', label: 'Research Papers', icon: FileText, type: 'cards' },
  { key: 'awards', label: 'Awards', icon: Award, type: 'list' },
];

const StudentPortfolio = () => {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [data, setData] = useState(INITIAL);
  const [adding, setAdding] = useState(null);
  const [draft, setDraft] = useState({ title: '', desc: '' });

  const startAdd = (key) => {
    setAdding(key);
    setDraft({ title: '', desc: '' });
  };

  const saveAdd = (key, type) => {
    if (type === 'tags' || type === 'list') {
      if (!draft.title.trim()) return;
      setData((prev) => ({ ...prev, [key]: [...prev[key], draft.title.trim()] }));
    } else {
      if (!draft.title.trim()) return;
      setData((prev) => ({ ...prev, [key]: [...prev[key], { title: draft.title.trim(), desc: draft.desc.trim() }] }));
    }
    setAdding(null);
  };

  const removeItem = (key, index) => {
    setData((prev) => ({ ...prev, [key]: prev[key].filter((_, i) => i !== index) }));
  };

  return (
    <div className="min-h-screen bg-zinc-50">
      <StudentSidebar user={user} mobileOpen={sidebarOpen} setMobileOpen={setSidebarOpen} />

      <div className="lg:pl-64">
        <StudentTopbar user={user} title="Portfolio" onMenuClick={() => setSidebarOpen(true)} />

        <main className="mx-auto max-w-4xl space-y-4 p-4 sm:p-6">
          {/* Header */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400">Module 3</p>
            <h1 className="mt-1 text-xl font-extrabold tracking-tight text-zinc-900">
              {user?.name || 'Student'}'s Portfolio
            </h1>
            <p className="mt-1 text-[13px] text-zinc-500">
              Built during college — remains available after graduation.
            </p>
          </div>

          {SECTIONS.map(({ key, label, icon: Icon, type }) => (
            <section key={key} className="rounded-2xl border border-zinc-200 bg-white p-5">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-[14px] font-extrabold text-zinc-900">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-900 text-white">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  {label}
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10.5px] font-bold text-zinc-500">
                    {data[key].length}
                  </span>
                </h2>
                {adding !== key && (
                  <button
                    type="button"
                    onClick={() => startAdd(key)}
                    className="flex items-center gap-1 text-[12px] font-bold text-zinc-500 transition hover:text-zinc-900"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add
                  </button>
                )}
              </div>

              {/* Items */}
              <div className="mt-3">
                {type === 'tags' && (
                  <div className="flex flex-wrap gap-1.5">
                    {data[key].map((item, i) => (
                      <span key={i} className="group flex items-center gap-1 rounded-full bg-zinc-100 py-1 pl-3 pr-1.5 text-[12px] font-semibold text-zinc-700">
                        {item}
                        <button type="button" onClick={() => removeItem(key, i)}
                          className="rounded-full p-0.5 text-zinc-400 opacity-0 transition group-hover:opacity-100 hover:bg-zinc-200 hover:text-zinc-700"
                          aria-label={`Remove ${item}`}>
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                    {data[key].length === 0 && <p className="text-[12px] text-zinc-400">Nothing here yet.</p>}
                  </div>
                )}

                {type === 'list' && (
                  <ul className="space-y-1.5">
                    {data[key].map((item, i) => (
                      <li key={i} className="group flex items-center gap-2 rounded-xl border border-zinc-100 px-3 py-2 text-[13px] text-zinc-700">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-900" />
                        <span className="flex-1">{item}</span>
                        <button type="button" onClick={() => removeItem(key, i)}
                          className="rounded-md p-1 text-zinc-300 opacity-0 transition group-hover:opacity-100 hover:bg-red-50 hover:text-red-600"
                          aria-label="Remove item">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    ))}
                    {data[key].length === 0 && <p className="text-[12px] text-zinc-400">Nothing here yet.</p>}
                  </ul>
                )}

                {type === 'cards' && (
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {data[key].map((item, i) => (
                      <div key={i} className="group relative rounded-2xl border border-zinc-100 p-4 transition hover:border-zinc-300">
                        <button type="button" onClick={() => removeItem(key, i)}
                          className="absolute right-2.5 top-2.5 rounded-md p-1 text-zinc-300 opacity-0 transition group-hover:opacity-100 hover:bg-red-50 hover:text-red-600"
                          aria-label="Remove item">
                          <X className="h-3.5 w-3.5" />
                        </button>
                        <p className="pr-6 text-[13px] font-bold text-zinc-900">{item.title}</p>
                        {item.desc && <p className="mt-0.5 text-[12px] leading-relaxed text-zinc-500">{item.desc}</p>}
                      </div>
                    ))}
                    {data[key].length === 0 && <p className="text-[12px] text-zinc-400">Nothing here yet.</p>}
                  </div>
                )}
              </div>

              {/* Add form */}
              {adding === key && (
                <div className="mt-3 rounded-2xl bg-zinc-50 p-3">
                  <input
                    value={draft.title}
                    onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                    placeholder={type === 'tags' ? 'e.g. JavaScript' : type === 'list' ? 'e.g. AWS Certified (2026)' : 'Title'}
                    className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-[13px] outline-none focus:border-zinc-900"
                  />
                  {type === 'cards' && (
                    <input
                      value={draft.desc}
                      onChange={(e) => setDraft({ ...draft, desc: e.target.value })}
                      placeholder="Short description (optional)"
                      className="mt-2 h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-[13px] outline-none focus:border-zinc-900"
                    />
                  )}
                  <div className="mt-2 flex justify-end gap-2">
                    <button type="button" onClick={() => setAdding(null)}
                      className="h-9 rounded-xl px-4 text-[12px] font-bold text-zinc-500 hover:bg-zinc-200/60">
                      Cancel
                    </button>
                    <button type="button" onClick={() => saveAdd(key, type)}
                      className="h-9 rounded-xl bg-zinc-900 px-4 text-[12px] font-bold text-white hover:bg-zinc-800">
                      Add
                    </button>
                  </div>
                </div>
              )}
            </section>
          ))}
        </main>
      </div>
    </div>
  );
};

export default StudentPortfolio;
