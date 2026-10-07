import { useState } from 'react';
import Swal from 'sweetalert2';
import {
  UserRound, ShieldCheck, Lock, Mail, BadgeCheck, Palette, Sun, Moon, Monitor,
  HelpCircle, Shield, ScrollText, ChevronDown, LifeBuoy,
} from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import StudentSidebar from '../../layout/sidebar/student/studentSidebar';
import StudentTopbar from '../../layout/topbar/student/studentTopbar';
import api from '../../utils/axios';
import { getTheme, setTheme } from '../../lib/theme';

const TAB_GROUPS = [
  {
    label: 'Account Settings',
    tabs: [
      { key: 'profile', label: 'Profile', desc: 'Name and account details', icon: UserRound },
      { key: 'password', label: 'Change Password', desc: 'Keep your account secure', icon: ShieldCheck },
      { key: 'appearance', label: 'Appearance', desc: 'Light, dark, or system theme', icon: Palette },
    ],
  },
  {
    label: 'Help & Legal',
    tabs: [
      { key: 'help', label: 'Help & Support', desc: 'Answers and contact', icon: HelpCircle },
      { key: 'privacy', label: 'Privacy Policy', desc: 'How we handle your data', icon: Shield },
      { key: 'terms', label: 'Terms & Conditions', desc: 'Rules for using SielAlumni', icon: ScrollText },
    ],
  },
];

// TODO: replace with your real support address and review the legal text with your institution.
const SUPPORT_EMAIL = 'support@sielalumni.edu.ph';
const LAST_UPDATED = 'October 7, 2026';

const FAQS = [
  {
    q: 'How do I change my name?',
    a: 'Go to Accounts, open Profile, update your full name, and select Save changes. Your email address is managed by your institution and cannot be changed here.',
  },
  {
    q: 'How do I change or reset my password?',
    a: 'Open Change Password, enter your current password, then your new password twice. If you cannot sign in, contact support so an admin can help you reset it.',
  },
  {
    q: 'How do I connect with an alumni?',
    a: 'Open the alumni’s profile and select Connect. They will be notified, and once they accept you can message each other.',
  },
  {
    q: 'How do I apply for a job, internship, or scholarship?',
    a: 'Open the opportunity from your portal and apply. The alumni who posted it reviews your application, and its status (pending, reviewed, accepted, or declined) is updated for you.',
  },
  {
    q: 'Who can see my profile?',
    a: 'Other signed-in members of SielAlumni and administrators can see your profile. See the Privacy Policy for details.',
  },
  {
    q: 'How do I switch to dark mode?',
    a: 'Open Appearance and choose Light, Dark, or System. The setting is saved on the device you are using.',
  },
];

const PRIVACY = [
  {
    title: 'Information we collect',
    body: 'We collect only what is needed to run SielAlumni:',
    bullets: [
      'Account details: your name, institutional email, and role (student or alumni).',
      'Profile details you add: program, batch, location, bio, skills, employment history, and education.',
      'Activity on the platform: connections, messages, referral applications, and profile views.',
      'Basic technical information, such as device and browser type, used to keep the service secure and working.',
    ],
  },
  {
    title: 'How we use your information',
    bullets: [
      'To create and manage your account and show your profile to other members.',
      'To connect students with alumni and share job, internship, and scholarship opportunities.',
      'To send notifications about connection requests, messages, and application updates.',
      'To help your institution understand alumni outcomes and improve its programs.',
      'To protect the platform from misuse and fix technical problems.',
    ],
  },
  {
    title: 'Who can see your information',
    body: 'Your profile is visible to other signed-in members and to administrators. Messages are visible only to the people in the conversation and to administrators where needed for safety or support. We do not sell your personal information. We may share it with service providers that host or operate the platform, and when required by law.',
  },
  {
    title: 'How we protect your information',
    body: 'We apply reasonable technical and organizational measures, including role-based access, to protect your data. No online service can be completely secure, so please use a strong, unique password and never share it.',
  },
  {
    title: 'Your choices and rights',
    body: 'You can review and update your profile at any time. You may also ask us to correct, export, or delete your personal information, or to object to certain uses, by contacting support. These rights follow the Data Privacy Act of 2012 (Republic Act No. 10173) where it applies.',
  },
  {
    title: 'How long we keep your data',
    body: 'We keep your information while your account is active and for as long as your institution or the law requires. When data is no longer needed, it is deleted or anonymized.',
  },
  {
    title: 'Changes to this policy',
    body: 'We may update this policy from time to time. Significant changes will be announced on the platform, and the date at the top will show when it was last updated.',
  },
];

const TERMS = [
  {
    title: 'Acceptance of terms',
    body: 'By creating an account or using SielAlumni, you agree to these Terms & Conditions and the Privacy Policy. If you do not agree, please do not use the platform.',
  },
  {
    title: 'Eligibility and your account',
    body: 'SielAlumni is for students and alumni of the institution. You are responsible for keeping your login details confidential and for all activity under your account. Provide accurate information and keep it up to date.',
  },
  {
    title: 'Acceptable use',
    body: 'When using SielAlumni, you agree not to:',
    bullets: [
      'Impersonate another person or misrepresent your education, work history, or affiliation.',
      'Harass, threaten, discriminate against, or spam other members.',
      'Post unlawful, misleading, or offensive content, or fraudulent opportunities.',
      'Collect other members’ information without permission or use it for unrelated purposes.',
      'Attempt to access accounts or data you are not authorized to, or disrupt the service.',
    ],
  },
  {
    title: 'Your content',
    body: 'You keep ownership of the content you post, such as your bio, experience, and referrals. By posting, you allow SielAlumni to display it to other members for the purpose of running the platform. You are responsible for making sure you have the right to share it.',
  },
  {
    title: 'Opportunities and referrals',
    body: 'Jobs, internships, and scholarships are shared by alumni and other third parties. SielAlumni does not guarantee any opportunity, interview, or outcome, and does not endorse every listing. Check details yourself, and never send money to secure an opportunity. Report anything suspicious to support.',
  },
  {
    title: 'Messages and connections',
    body: 'Be respectful in all conversations. Connection requests and messages must be relevant to professional, academic, or community purposes.',
  },
  {
    title: 'Suspension and termination',
    body: 'We may limit, suspend, or remove accounts or content that break these terms or put other members at risk. You may stop using SielAlumni at any time and can ask support to delete your account.',
  },
  {
    title: 'Disclaimer and limitation of liability',
    body: 'The platform is provided “as is” and “as available.” To the extent permitted by law, SielAlumni and your institution are not liable for losses that result from your use of the platform or from interactions with other members.',
  },
  {
    title: 'Changes to these terms',
    body: 'We may update these terms from time to time. Continued use of SielAlumni after changes take effect means you accept the updated terms.',
  },
];

const labelClass =
  'mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400';

const DocHeader = ({ title, subtitle }) => (
  <div className="border-b border-zinc-100 px-5 py-4 dark:border-zinc-800 sm:px-6">
    <h2 className="text-[15px] font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">{title}</h2>
    <p className="text-[12px] text-zinc-500 dark:text-zinc-400">{subtitle}</p>
  </div>
);

const LegalDoc = ({ sections }) => (
  <div className="space-y-6 p-5 sm:p-6">
    {sections.map((sec, i) => (
      <article key={sec.title}>
        <h3 className="text-[13.5px] font-bold text-zinc-900 dark:text-zinc-100">
          {i + 1}. {sec.title}
        </h3>
        {sec.body && (
          <p className="mt-1.5 max-w-prose text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-300">{sec.body}</p>
        )}
        {sec.bullets && (
          <ul className="mt-2 max-w-prose list-disc space-y-1.5 pl-5 text-[13px] leading-relaxed text-zinc-600 marker:text-[#009639] dark:text-zinc-300">
            {sec.bullets.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        )}
      </article>
    ))}
    <p className="border-t border-zinc-100 pt-4 text-[12px] text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
      Questions about this document? Contact{' '}
      <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-[#007a2e] hover:underline dark:text-emerald-300">
        {SUPPORT_EMAIL}
      </a>
      .
    </p>
  </div>
);

const StudentAccounts = () => {
  const { user, refreshUser } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');
  const [name, setName] = useState(user?.name || '');
  const [saving, setSaving] = useState(false);
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwLoading, setPwLoading] = useState(false);
  const [theme, setThemeState] = useState(getTheme);

  const changeTheme = (value) => {
    setTheme(value);
    setThemeState(value);
  };

  const inputClass =
    'w-full h-11 px-3.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50/60 dark:bg-zinc-800 text-[13px] text-zinc-800 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 outline-none transition-all hover:border-zinc-300 dark:hover:border-zinc-600 focus:border-[#009639] focus:bg-white dark:focus:bg-zinc-900 focus:ring-2 focus:ring-[#009639]/15';

  const handleSaveName = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      Swal.fire('Error', 'Please enter your name', 'error');
      return;
    }
    setSaving(true);
    try {
      await api.put('/users/me', { name: name.trim() });
      await refreshUser();
      Swal.fire({ title: 'Saved', text: 'Your profile has been updated.', icon: 'success', timer: 1500, showConfirmButton: false });
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to update profile', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      Swal.fire('Error', 'New passwords do not match', 'error');
      return;
    }
    setPwLoading(true);
    try {
      const res = await api.post('/auth/password/change', pwForm);
      Swal.fire('Success', res.data.message, 'success');
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to change password', 'error');
    } finally {
      setPwLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f3f6f3] dark:bg-zinc-950">
      <StudentSidebar user={user} mobileOpen={sidebarOpen} setMobileOpen={setSidebarOpen} />

      <div className="lg:pl-64">
        <StudentTopbar user={user} title="Accounts" onMenuClick={() => setSidebarOpen(true)} />

        <main className="mx-auto max-w-5xl p-4 sm:p-6">
          {/* Page header */}
          <div className="relative mb-5 overflow-hidden rounded-3xl bg-gradient-to-br from-[#0F4C3A] via-[#007a2e] to-[#009639] p-6 text-white shadow-lg shadow-emerald-900/10 sm:p-7">
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                backgroundImage:
                  'radial-gradient(circle at 85% 20%, rgba(255,255,255,0.25), transparent 40%), radial-gradient(circle at 70% 85%, rgba(255,255,255,0.12), transparent 35%)',
              }}
            />
            <div className="relative flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-2xl font-extrabold text-white ring-1 ring-white/30 backdrop-blur">
                {(user?.name || 'A').charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-lg font-extrabold tracking-tight sm:text-xl">
                  {user?.name || 'Account Settings'}
                </h1>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px] text-white/85">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{user?.email}</span>
                  </span>
                  {user?.role && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white ring-1 ring-white/30">
                      <BadgeCheck className="h-3 w-3" />
                      {user.role}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-start gap-5 md:flex-row">
            {/* Sub-sidebar */}
            <aside className="w-full shrink-0 overflow-hidden rounded-3xl border border-emerald-900/10 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900 md:w-64">
              {TAB_GROUPS.map((group, gi) => (
                <div key={group.label} className={gi > 0 ? 'border-t border-zinc-100 dark:border-zinc-800' : ''}>
                  <p className="px-4 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                    {group.label}
                  </p>
                  <nav className="space-y-1 p-2">
                    {group.tabs.map(({ key, label, desc, icon: Icon }) => {
                      const active = activeTab === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setActiveTab(key)}
                          aria-current={active ? 'page' : undefined}
                          className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-all ${active
                              ? 'bg-[#009639]/10 ring-1 ring-emerald-200/60 dark:ring-emerald-800/60'
                              : 'hover:bg-zinc-50 dark:hover:bg-zinc-800'
                            }`}
                        >
                          <span
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors ${active
                                ? 'bg-[#009639] text-white shadow-sm'
                                : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
                              }`}
                          >
                            <Icon className="h-4 w-4" />
                          </span>
                          <span className="min-w-0">
                            <span
                              className={`block truncate text-[12.5px] font-bold ${active ? 'text-[#007a2e] dark:text-emerald-300' : 'text-zinc-700 dark:text-zinc-200'
                                }`}
                            >
                              {label}
                            </span>
                            <span className="block truncate text-[10.5px] text-zinc-400 dark:text-zinc-500">{desc}</span>
                          </span>
                        </button>
                      );
                    })}
                  </nav>
                </div>
              ))}
              <div className="m-2 mt-1 rounded-2xl bg-emerald-50/70 p-3 text-[11px] leading-relaxed text-zinc-500 dark:bg-emerald-950/50 dark:text-zinc-300">
                Your email is managed by your institution. Contact an admin to change it.
              </div>
            </aside>

            {/* Content */}
            <div className="w-full min-w-0 flex-1">
              {activeTab === 'profile' && (
                <section className="overflow-hidden rounded-3xl border border-emerald-900/10 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="border-b border-zinc-100 px-5 py-4 dark:border-zinc-800 sm:px-6">
                    <h2 className="text-[15px] font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">Profile Information</h2>
                    <p className="text-[12px] text-zinc-500 dark:text-zinc-400">How you appear across the network.</p>
                  </div>
                  <form onSubmit={handleSaveName} className="space-y-4 p-5 sm:p-6">
                    <div>
                      <label className={labelClass}>Full Name</label>
                      <input value={name} onChange={(e) => setName(e.target.value)} required
                        placeholder="Your full name" className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>Email Address</label>
                      <input value={user?.email || ''} disabled
                        className={`${inputClass} cursor-not-allowed !bg-zinc-100 !text-zinc-400 dark:!bg-zinc-800/70 dark:!text-zinc-500`} />
                    </div>
                    <div className="flex justify-end border-t border-zinc-100 pt-4 dark:border-zinc-800">
                      <button type="submit" disabled={saving}
                        className="h-10 rounded-xl bg-[#009639] px-6 text-[13px] font-bold text-white shadow-sm transition hover:bg-[#007a2e] disabled:opacity-60">
                        {saving ? 'Saving...' : 'Save changes'}
                      </button>
                    </div>
                  </form>
                </section>
              )}

              {activeTab === 'password' && (
                <section className="overflow-hidden rounded-3xl border border-emerald-900/10 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="border-b border-zinc-100 px-5 py-4 dark:border-zinc-800 sm:px-6">
                    <h2 className="flex items-center gap-2 text-[15px] font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">
                      Change Password
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#007a2e] dark:bg-emerald-950 dark:text-emerald-300">
                        <Lock className="h-2.5 w-2.5" />
                        Secure
                      </span>
                    </h2>
                    <p className="text-[12px] text-zinc-500 dark:text-zinc-400">Use at least 6 characters with a mix of letters and numbers.</p>
                  </div>
                  <form onSubmit={handlePasswordChange} className="space-y-4 p-5 sm:p-6">
                    <div>
                      <label className={labelClass}>Current Password</label>
                      <input type="password" required value={pwForm.currentPassword}
                        onChange={(e) => setPwForm({ ...pwForm, currentPassword: e.target.value })}
                        placeholder="Enter current password" className={inputClass} />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className={labelClass}>New Password</label>
                        <input type="password" required minLength={6} value={pwForm.newPassword}
                          onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })}
                          placeholder="At least 6 characters" className={inputClass} />
                      </div>
                      <div>
                        <label className={labelClass}>Confirm New</label>
                        <input type="password" required minLength={6} value={pwForm.confirmPassword}
                          onChange={(e) => setPwForm({ ...pwForm, confirmPassword: e.target.value })}
                          placeholder="Repeat new password" className={inputClass} />
                      </div>
                    </div>
                    <div className="flex justify-end border-t border-zinc-100 pt-4 dark:border-zinc-800">
                      <button type="submit" disabled={pwLoading}
                        className="h-10 rounded-xl bg-zinc-900 px-6 text-[13px] font-bold text-white transition hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white">
                        {pwLoading ? 'Updating...' : 'Update password'}
                      </button>
                    </div>
                  </form>
                </section>
              )}

              {activeTab === 'appearance' && (
                <section className="overflow-hidden rounded-3xl border border-emerald-900/10 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="border-b border-zinc-100 px-5 py-4 dark:border-zinc-800 sm:px-6">
                    <h2 className="text-[15px] font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">Appearance</h2>
                    <p className="text-[12px] text-zinc-500 dark:text-zinc-400">Choose how SielAlumni looks on this device.</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2 p-5 sm:p-6">
                    {[
                      { key: 'light', label: 'Light', icon: Sun },
                      { key: 'dark', label: 'Dark', icon: Moon },
                      { key: 'system', label: 'System', icon: Monitor },
                    ].map(({ key, label, icon: Icon }) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => changeTheme(key)}
                        className={`flex flex-col items-center gap-1.5 rounded-2xl border-2 px-3 py-3.5 transition ${theme === key
                            ? 'border-[#009639] bg-emerald-50/50 text-[#007a2e] dark:bg-emerald-950/30 dark:text-emerald-300'
                            : 'border-zinc-200 text-zinc-500 hover:border-zinc-300 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600'
                          }`}
                      >
                        <Icon className="h-5 w-5" />
                        <span className="text-[12px] font-bold">{label}</span>
                      </button>
                    ))}
                  </div>
                  <p className="px-5 pb-5 text-[11.5px] text-zinc-400 dark:text-zinc-500 sm:px-6">
                    System follows your device setting and updates automatically.
                  </p>
                </section>
              )}

              {activeTab === 'help' && (
                <section className="overflow-hidden rounded-3xl border border-emerald-900/10 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                  <DocHeader title="Help & Support" subtitle="Quick answers to common questions." />
                  <div className="divide-y divide-zinc-100 px-5 dark:divide-zinc-800 sm:px-6">
                    {FAQS.map(({ q, a }) => (
                      <details key={q} className="group py-4">
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[13.5px] font-bold text-zinc-900 outline-none marker:hidden focus-visible:ring-2 focus-visible:ring-[#009639]/40 dark:text-zinc-100 [&::-webkit-details-marker]:hidden">
                          {q}
                          <ChevronDown className="h-4 w-4 shrink-0 text-zinc-400 transition-transform group-open:rotate-180" />
                        </summary>
                        <p className="mt-2 max-w-prose text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-300">{a}</p>
                      </details>
                    ))}
                  </div>
                  <div className="m-5 flex flex-col gap-3 rounded-2xl bg-emerald-50/70 p-4 dark:bg-emerald-950/40 sm:m-6 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#009639] text-white">
                        <LifeBuoy className="h-5 w-5" />
                      </span>
                      <div>
                        <p className="text-[13.5px] font-bold text-zinc-900 dark:text-zinc-100">Still need help?</p>
                        <p className="text-[12px] text-zinc-600 dark:text-zinc-300">Our team will get back to you by email.</p>
                      </div>
                    </div>
                    <a
                      href={`mailto:${SUPPORT_EMAIL}?subject=SielAlumni%20support`}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#009639] px-5 text-[13px] font-bold text-white shadow-sm transition hover:bg-[#007a2e]"
                    >
                      <Mail className="h-4 w-4" />
                      Contact support
                    </a>
                  </div>
                </section>
              )}

              {activeTab === 'privacy' && (
                <section className="overflow-hidden rounded-3xl border border-emerald-900/10 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                  <DocHeader title="Privacy Policy" subtitle={`Last updated ${LAST_UPDATED}`} />
                  <LegalDoc sections={PRIVACY} />
                </section>
              )}

              {activeTab === 'terms' && (
                <section className="overflow-hidden rounded-3xl border border-emerald-900/10 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                  <DocHeader title="Terms & Conditions" subtitle={`Last updated ${LAST_UPDATED}`} />
                  <LegalDoc sections={TERMS} />
                </section>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default StudentAccounts;