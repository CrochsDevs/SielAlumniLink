import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import {
  BadgeCheck,
  MapPin,
  Mail,
  Briefcase,
  GraduationCap,
  Plus,
  Check,
  Clock,
  Pencil,
  Sparkles,
  Award,
  Users,
  ArrowLeft,
  Share2,
  Trash2,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import { useChat } from '../../context/ChatContext';
import AlumniSidebar from '../../layout/sidebar/alumni/alumniSidebar';
import AlumniTopbar from '../../layout/topbar/alumni/alumniTopbar';
import StudentSidebar from '../../layout/sidebar/student/studentSidebar';
import StudentTopbar from '../../layout/topbar/student/studentTopbar';
import api from '../../utils/axios';
import { getSocket } from '../../realtime/socket';

const AlumniProfile = () => {
  const { user } = useAuth();
  const { openChatByEmail } = useChat();
  const { id } = useParams();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [connectState, setConnectState] = useState('none');
  const [connectLoading, setConnectLoading] = useState(false);
  const [profile, setProfile] = useState(null);
  const [loadingOther, setLoadingOther] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showAddExp, setShowAddExp] = useState(false);
  const [showAddEdu, setShowAddEdu] = useState(false);
  const [editingExp, setEditingExp] = useState(null);
  const [editingEdu, setEditingEdu] = useState(null);
  const [editExpForm, setEditExpForm] = useState({ position: '', company: '', location: '', startMonth: '', startDay: '', startYear: '', endMonth: '', endDay: '', endYear: '', current: false });
  const [editEduForm, setEditEduForm] = useState({ school: '', degree: '', year: '', location: '' });
  const [newSkill, setNewSkill] = useState('');
  const [connectionsCount, setConnectionsCount] = useState(0);
  const [form, setForm] = useState({
    name: '', program: '', batch: '', location: '', bio: '', skills: [],
  });
  const [expForm, setExpForm] = useState({ position: '', company: '', location: '', startMonth: '', startDay: '', startYear: '', endMonth: '', endDay: '', endYear: '', current: false });
  const [eduForm, setEduForm] = useState({ school: '', degree: '', year: '', location: '' });

  const isOwn = !id || String(id) === String(user?._id);

  const fetchConnectionState = async () => {
    if (isOwn || !profile?.email) return;
    try {
      const res = await api.get('/connections/me');
      setConnectionsCount((res.data.data || []).filter((c) => c.status === 'accepted').length);
      const found = (res.data.data || []).find(
        (c) => c.requesterEmail === profile.email || c.recipientEmail === profile.email
      );
      if (found) setConnectState(found.status === 'accepted' ? 'connected' : 'pending');
      else setConnectState('none');
    } catch {
      // ignore
    }
  };

  const fetchConnectionsCount = async () => {
    try {
      const res = await api.get('/connections/me');
      setConnectionsCount((res.data.data || []).filter((c) => c.status === 'accepted').length);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (!id) return;
    setLoadingOther(true);
    setNotFound(false);
    api.get(`/users/${id}`)
      .then((res) => {
        setProfile(res.data.data);
        fetchConnectionState();
        api.post(`/users/${id}/view`).catch(() => {});
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoadingOther(false));
  }, [id, isOwn]);

  useEffect(() => {
    if (isOwn) return;
    fetchConnectionState();

    const socket = getSocket();
    const onNotification = () => { fetchConnectionState(); };
    socket.on('notification:new', onNotification);

    return () => {
      socket.off('notification:new', onNotification);
    };
  }, [isOwn, profile?.email]);

  useEffect(() => {
    if (!isOwn) return;
    fetchConnectionsCount();
    api.get(`/users/${user?._id || user?.authId}`)
      .then((res) => {
        const p = res.data.data || {};
        setForm({
          name: p.name || user?.name || '',
          program: p.program || '',
          batch: p.batch || '',
          location: p.location || '',
          bio: p.bio || '',
          skills: p.skills || [],
          employmentHistory: p.employmentHistory || [],
          education: p.education || [],
        });
      })
      .catch(() => {});
  }, [isOwn, user?._id, user?.authId, user?.name]);

  const handleConnect = async () => {
    if (connectState !== 'none' || !profile?.email) return;
    setConnectLoading(true);
    try {
      await api.post('/connections', { email: profile.email });
      setConnectState('pending');
      Swal.fire({ title: 'Request sent', text: 'They will be notified.', icon: 'success', timer: 1500, showConfirmButton: false });
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to send request', 'error');
    } finally {
      setConnectLoading(false);
    }
  };

  const refreshConnection = () => {
    fetchConnectionState();
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      await api.put('/users/me', {
        name: form.name,
        program: form.program,
        batch: form.batch,
        location: form.location,
        bio: form.bio,
      });
      setEditing(false);
      Swal.fire({ title: 'Saved', text: 'Profile updated.', icon: 'success', timer: 1500, showConfirmButton: false });
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  };

  const addExperience = async () => {
    setSaving(true);
    try {
      const startDate = `${expForm.startYear}-${expForm.startMonth}-${expForm.startDay}`;
      const endDate = expForm.current ? '' : `${expForm.endYear}-${expForm.endMonth}-${expForm.endDay}`;
      await api.put('/users/me', {
        $push: { employmentHistory: { ...expForm, startDate, endDate } },
      });
      setShowAddExp(false);
      setExpForm({ position: '', company: '', location: '', startMonth: '', startDay: '', startYear: '', endMonth: '', endDay: '', endYear: '', current: false });
      Swal.fire({ title: 'Added', text: 'Experience added.', icon: 'success', timer: 1500, showConfirmButton: false });
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to add', 'error');
    } finally {
      setSaving(false);
    }
  };

  const removeExperience = async (index) => {
    try {
      const res = await api.get('/users/me');
      const history = res.data.data?.employmentHistory || [];
      history.splice(index, 1);
      await api.put('/users/me', { employmentHistory: history });
      Swal.fire({ title: 'Removed', icon: 'success', timer: 1500, showConfirmButton: false });
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to remove', 'error');
    }
  };

  const addEducation = async () => {
    setSaving(true);
    try {
      await api.put('/users/me', {
        $push: { education: eduForm },
      });
      setShowAddEdu(false);
      setEduForm({ school: '', degree: '', year: '', location: '' });
      Swal.fire({ title: 'Added', text: 'Education added.', icon: 'success', timer: 1500, showConfirmButton: false });
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to add', 'error');
    } finally {
      setSaving(false);
    }
  };

  const removeEducation = async (index) => {
    try {
      const res = await api.get('/users/me');
      const edu = res.data.data?.education || [];
      edu.splice(index, 1);
      await api.put('/users/me', { education: edu });
      Swal.fire({ title: 'Removed', icon: 'success', timer: 1500, showConfirmButton: false });
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to remove', 'error');
    }
  };

  const updateExperience = async (index) => {
    setSaving(true);
    try {
      const res = await api.get('/users/me');
      const history = res.data.data?.employmentHistory || [];
      const startDate = `${editExpForm.startYear}-${editExpForm.startMonth}-${editExpForm.startDay}`;
      const endDate = editExpForm.current ? '' : `${editExpForm.endYear}-${editExpForm.endMonth}-${editExpForm.endDay}`;
      history[index] = { ...history[index], ...editExpForm, startDate, endDate };
      await api.put('/users/me', { employmentHistory: history });
      setEditingExp(null);
      Swal.fire({ title: 'Updated', text: 'Experience updated.', icon: 'success', timer: 1500, showConfirmButton: false });
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to update', 'error');
    } finally {
      setSaving(false);
    }
  };

  const updateEducation = async (index) => {
    setSaving(true);
    try {
      const res = await api.get('/users/me');
      const edu = res.data.data?.education || [];
      edu[index] = { ...edu[index], ...editEduForm };
      await api.put('/users/me', { education: edu });
      setEditingEdu(null);
      Swal.fire({ title: 'Updated', text: 'Education updated.', icon: 'success', timer: 1500, showConfirmButton: false });
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to update', 'error');
    } finally {
      setSaving(false);
    }
  };

  const addSkill = async () => {
    if (!newSkill.trim()) return;
    try {
      await api.put('/users/me', {
        $addToSet: { skills: newSkill.trim() },
      });
      setForm((prev) => ({ ...prev, skills: [...prev.skills, newSkill.trim()] }));
      setNewSkill('');
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to add skill', 'error');
    }
  };

  const removeSkill = async (skill) => {
    try {
      await api.put('/users/me', {
        $pull: { skills: skill },
      });
      setForm((prev) => ({ ...prev, skills: prev.skills.filter((s) => s !== skill) }));
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to remove skill', 'error');
    }
  };

  const computePeriod = (startDate, endDate, current) => {
    if (!startDate) return '';
    const start = new Date(startDate);
    const end = current ? new Date() : (endDate ? new Date(endDate) : new Date());
    const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    if (years === 0) return `${remainingMonths} mo${remainingMonths !== 1 ? 's' : ''}`;
    if (remainingMonths === 0) return `${years} yr${years !== 1 ? 's' : ''}`;
    return `${years} yr${years !== 1 ? 's' : ''} ${remainingMonths} mo${remainingMonths !== 1 ? 's' : ''}`;
  };

  const person = isOwn ? { ...user, ...form, employmentHistory: form.employmentHistory, education: form.education } : profile;
  const isStudent = user?.role === 'student';
  const Sidebar = isStudent ? StudentSidebar : AlumniSidebar;
  const Topbar = isStudent ? StudentTopbar : AlumniTopbar;

  const inputClass = 'w-full h-10 px-3.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-[13px] text-zinc-800 dark:text-zinc-100 outline-none transition focus:border-[#009639] focus:ring-2 focus:ring-[#009639]/15';

  return (
    <div className="min-h-screen bg-[#f3f6f3] dark:bg-zinc-950">
      <Sidebar user={user} mobileOpen={sidebarOpen} setMobileOpen={setSidebarOpen} />

      <div className="lg:pl-64">
        <Topbar user={user} title="Profile" onMenuClick={() => setSidebarOpen(true)} />

        <main className="mx-auto max-w-4xl space-y-4 p-4 sm:p-6">
          {!isOwn && (
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex items-center gap-1.5 text-[12.5px] font-semibold text-zinc-500 dark:text-zinc-400 transition hover:text-[#007a2e]"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
          )}

          {loadingOther ? (
            <div className="rounded-3xl border border-emerald-900/10 bg-white dark:bg-zinc-900 p-10 text-center shadow-sm">
              <svg className="mx-auto h-8 w-8 animate-spin text-[#009639] dark:text-emerald-300" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <p className="mt-3 text-[13px] font-medium text-zinc-500 dark:text-zinc-400">Loading profile...</p>
            </div>
          ) : notFound || (!isOwn && !profile) ? (
            <div className="rounded-3xl border border-emerald-900/10 bg-white dark:bg-zinc-900 p-10 text-center shadow-sm">
              <p className="text-[15px] font-bold text-zinc-800 dark:text-zinc-100">Profile not found</p>
              <p className="mt-1 text-[12.5px] text-zinc-500 dark:text-zinc-400">This alumni profile does not exist.</p>
            </div>
          ) : (
            <>
              {/* Profile header */}
              <section className="overflow-hidden rounded-3xl border border-emerald-900/10 bg-white dark:bg-zinc-900 shadow-sm">
                <div
                  className="relative h-32 bg-gradient-to-br from-[#0F4C3A] via-[#007a2e] to-[#009639] sm:h-40"
                  style={{
                    backgroundImage:
                      'radial-gradient(circle at 15% 30%, rgba(255,255,255,0.18) 0 2px, transparent 3px), radial-gradient(circle at 30% 70%, rgba(255,255,255,0.12) 0 2px, transparent 3px), radial-gradient(circle at 70% 20%, rgba(255,255,255,0.15) 0 2px, transparent 3px), radial-gradient(circle at 85% 65%, rgba(255,255,255,0.18) 0 2px, transparent 3px), linear-gradient(to bottom right, #0F4C3A, #007a2e, #009639)',
                  }}
                />
                <div className="px-5 pb-5 sm:px-7">
                  <div className="-mt-10 flex flex-wrap items-end justify-between gap-3">
                    <div className="relative">
                      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white dark:bg-zinc-900 text-3xl font-extrabold text-[#009639] dark:text-emerald-300 shadow-lg ring-4 ring-white">
                        {(person?.name || 'A').charAt(0).toUpperCase()}
                      </div>
                      <span className="absolute bottom-1 right-1 h-4 w-4 rounded-full border-2 border-white bg-[#009639]" title="Active" />
                    </div>
                    {isOwn && (
                      <button
                        type="button"
                        onClick={() => setEditing(!editing)}
                        className="flex items-center gap-1.5 rounded-full border border-zinc-200 dark:border-zinc-700 px-3.5 py-1.5 text-[12px] font-semibold text-zinc-600 dark:text-zinc-300 transition hover:border-emerald-300 hover:text-[#007a2e]"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        {editing ? 'Cancel' : 'Edit profile'}
                      </button>
                    )}
                  </div>

                  {editing ? (
                    <div className="mt-4 space-y-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name" className={inputClass} />
                        <input value={form.program} onChange={(e) => setForm({ ...form, program: e.target.value })} placeholder="Program (e.g. BS Psychology)" className={inputClass} />
                        <input value={form.batch} onChange={(e) => setForm({ ...form, batch: e.target.value })} placeholder="Batch (e.g. 2015)" className={inputClass} />
                        <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Location" className={inputClass} />
                      </div>
                      <textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} placeholder="Bio" rows={3} className={`${inputClass} h-auto py-2.5`} />
                      <button
                        type="button"
                        onClick={saveProfile}
                        disabled={saving}
                        className="flex items-center gap-1.5 rounded-xl bg-[#009639] px-5 py-2 text-[13px] font-bold text-white transition hover:bg-[#007a2e] disabled:opacity-50"
                      >
                        <Check className="h-4 w-4" />
                        {saving ? 'Saving...' : 'Save Profile'}
                      </button>
                    </div>
                  ) : (
                    <>
                      <h2 className="mt-3 flex items-center gap-1.5 text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">
                        {person?.name || 'Alumni'}
                        <BadgeCheck className="h-5 w-5 shrink-0 text-[#009639] dark:text-emerald-300" />
                      </h2>
                      <p className="text-[13.5px] font-medium text-zinc-600 dark:text-zinc-300">
                        {person?.program}{person?.batch ? ` • Batch ${person.batch}` : ''}
                      </p>
                      <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-zinc-400 dark:text-zinc-500">
                        {person?.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5" />
                            {person.location}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Mail className="h-3.5 w-3.5" />
                          {person?.email || 'alumni@clsu.edu.ph'}
                        </span>
                      </p>
                    </>
                  )}

                  {isOwn && !editing && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setEditing(true)}
                        className="rounded-full border border-zinc-300 px-5 py-2 text-[13px] font-bold text-zinc-600 dark:text-zinc-300 transition hover:border-[#009639] hover:text-[#007a2e]"
                      >
                        Edit profile
                      </button>
                      <button
                        type="button"
                        className="flex items-center gap-1.5 rounded-full border border-zinc-300 px-5 py-2 text-[13px] font-bold text-zinc-600 dark:text-zinc-300 transition hover:border-[#009639] hover:text-[#007a2e]"
                      >
                        <Share2 className="h-4 w-4" />
                        Share profile
                      </button>
                    </div>
                  )}

                  {!isOwn && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={handleConnect}
                        disabled={connectState !== 'none' || connectLoading}
                        className={`flex items-center gap-1.5 rounded-full px-5 py-2 text-[13px] font-bold shadow-sm transition disabled:cursor-default ${
                          connectState === 'connected'
                            ? 'border border-[#009639] text-[#007a2e]'
                            : connectState === 'pending'
                              ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
                              : 'bg-[#009639] text-white shadow-emerald-900/20 hover:bg-[#007a2e]'
                        }`}
                      >
                        {connectState === 'connected' ? (
                          <><Check className="h-4 w-4" /> Connected</>
                        ) : connectState === 'pending' ? (
                          <><Clock className="h-4 w-4" /> Pending</>
                        ) : (
                          <><Plus className="h-4 w-4" /> {connectLoading ? 'Sending...' : 'Connect'}</>
                        )}
                      </button>
                      {connectState === 'connected' && (
                        <button
                          type="button"
                          onClick={() => profile?.email && openChatByEmail(profile.email)}
                          className="rounded-full border border-zinc-300 px-5 py-2 text-[13px] font-bold text-zinc-600 dark:text-zinc-300 transition hover:border-[#009639] hover:text-[#007a2e]"
                        >
                          Message
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Stats strip */}
                <div className="grid grid-cols-3 divide-x divide-zinc-100 dark:divide-zinc-800 border-t border-zinc-100 dark:border-zinc-800 bg-emerald-50/40 dark:bg-zinc-800/50">
                  {[
                    { icon: Users, value: String(connectionsCount), label: 'Connections' },
                    { icon: Briefcase, value: String(person?.employmentHistory?.length || 0), label: 'Experience' },
                    { icon: Award, value: String(person?.skills?.length || 0), label: 'Skills' },
                  ].map(({ icon: Icon, value, label }) => (
                    <div key={label} className="flex items-center justify-center gap-2.5 px-2 py-3.5">
                      <span className="hidden h-9 w-9 items-center justify-center rounded-xl bg-white dark:bg-zinc-900 text-[#009639] dark:text-emerald-300 shadow-sm sm:flex">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="text-center sm:text-left">
                        <span className="block text-[16px] font-extrabold leading-none text-zinc-900 dark:text-zinc-100">{value}</span>
                        <span className="block text-[10.5px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">{label}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              {/* About */}
              <section className="rounded-3xl border border-emerald-900/10 bg-white dark:bg-zinc-900 p-5 shadow-sm sm:p-6">
                <h3 className="flex items-center gap-2 text-[14px] font-bold text-zinc-900 dark:text-zinc-100">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#009639]/10 text-[#009639] dark:text-emerald-300">
                    <Sparkles className="h-3.5 w-3.5" />
                  </span>
                  About
                </h3>
                {editing ? (
                  <textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} rows={4} className={`${inputClass} mt-3 h-auto py-2.5`} />
                ) : (
                  <p className="mt-2.5 text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-300">
                    {person?.bio || 'No bio yet.'}
                  </p>
                )}

                {/* Skills */}
                <div className="mt-4">
                  <p className="text-[12px] font-bold text-zinc-700 dark:text-zinc-300">Skills</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {(editing ? form.skills : person?.skills || []).map((skill) => (
                      <span
                        key={skill}
                        className="group flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950 px-3 py-1 text-[11px] font-semibold text-[#007a2e] dark:text-emerald-300 ring-1 ring-emerald-100 dark:ring-emerald-900"
                      >
                        {skill}
                        {editing && (
                          <button type="button" onClick={() => removeSkill(skill)} className="text-[#007a2e] hover:text-red-600">
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                  {editing && (
                    <div className="mt-2 flex gap-2">
                      <input
                        value={newSkill}
                        onChange={(e) => setNewSkill(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addSkill()}
                        placeholder="Add a skill..."
                        className={`${inputClass} h-9 text-[12px]`}
                      />
                      <button
                        type="button"
                        onClick={addSkill}
                        className="flex h-9 shrink-0 items-center gap-1 rounded-xl bg-[#009639] px-3 text-[12px] font-bold text-white transition hover:bg-[#007a2e]"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add
                      </button>
                    </div>
                  )}
                </div>
              </section>

              {/* Experience timeline */}
              <section className="rounded-3xl border border-emerald-900/10 bg-white dark:bg-zinc-900 p-5 shadow-sm sm:p-6">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-[14px] font-bold text-zinc-900 dark:text-zinc-100">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#009639]/10 text-[#009639] dark:text-emerald-300">
                      <Briefcase className="h-3.5 w-3.5" />
                    </span>
                    Experience
                  </h3>
                  <div className="flex items-center gap-1.5">
                    {isOwn && !editing && (
                      <button
                        type="button"
                        onClick={() => setShowAddExp(!showAddExp)}
                        className="flex items-center gap-1 rounded-full bg-[#009639] px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-[#007a2e]"
                      >
                        <Plus className="h-3 w-3" />
                        Add
                      </button>
                    )}
                    {showAddExp && (
                      <button
                        type="button"
                        onClick={() => setShowAddExp(false)}
                        className="flex items-center gap-1 rounded-full border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-[11px] font-bold text-zinc-500 dark:text-zinc-400 transition hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      >
                        <X className="h-3 w-3" />
                        Cancel
                      </button>
                    )}
                  </div>
                </div>

                {showAddExp && (
                  <div className="mt-4 grid gap-2.5 rounded-2xl border border-zinc-200 dark:border-zinc-700 p-4 sm:grid-cols-2">
                    <input value={expForm.position} onChange={(e) => setExpForm({ ...expForm, position: e.target.value })} placeholder="Position" className={inputClass} />
                    <input value={expForm.company} onChange={(e) => setExpForm({ ...expForm, company: e.target.value })} placeholder="Company" className={inputClass} />
                    <input value={expForm.location} onChange={(e) => setExpForm({ ...expForm, location: e.target.value })} placeholder="Location" className={inputClass} />
                    <div className="col-span-2">
                      <p className="mb-1.5 text-[11px] font-bold text-zinc-500 dark:text-zinc-400">Start Date</p>
                      <div className="grid grid-cols-3 gap-2">
                        <select value={expForm.startMonth} onChange={(e) => setExpForm({ ...expForm, startMonth: e.target.value })} className={inputClass}>
                          <option value="">Month</option>
                          {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m, i) => (
                            <option key={m} value={String(i + 1).padStart(2, '0')}>{m}</option>
                          ))}
                        </select>
                        <select value={expForm.startDay} onChange={(e) => setExpForm({ ...expForm, startDay: e.target.value })} className={inputClass}>
                          <option value="">Day</option>
                          {Array.from({ length: 31 }, (_, i) => (
                            <option key={i + 1} value={String(i + 1).padStart(2, '0')}>{i + 1}</option>
                          ))}
                        </select>
                        <input type="number" value={expForm.startYear} onChange={(e) => setExpForm({ ...expForm, startYear: e.target.value })} placeholder="Year" className={inputClass} />
                      </div>
                    </div>
                    <div className="col-span-2">
                      <p className="mb-1.5 text-[11px] font-bold text-zinc-500 dark:text-zinc-400">End Date</p>
                      <div className="grid grid-cols-3 gap-2">
                        <select value={expForm.endMonth} onChange={(e) => setExpForm({ ...expForm, endMonth: e.target.value })} disabled={expForm.current} className={inputClass}>
                          <option value="">Month</option>
                          {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m, i) => (
                            <option key={m} value={String(i + 1).padStart(2, '0')}>{m}</option>
                          ))}
                        </select>
                        <select value={expForm.endDay} onChange={(e) => setExpForm({ ...expForm, endDay: e.target.value })} disabled={expForm.current} className={inputClass}>
                          <option value="">Day</option>
                          {Array.from({ length: 31 }, (_, i) => (
                            <option key={i + 1} value={String(i + 1).padStart(2, '0')}>{i + 1}</option>
                          ))}
                        </select>
                        <input type="number" value={expForm.endYear} onChange={(e) => setExpForm({ ...expForm, endYear: e.target.value })} placeholder="Year" disabled={expForm.current} className={inputClass} />
                      </div>
                    </div>
                    <label className="flex items-center gap-2 text-[12.5px] font-medium text-zinc-600 dark:text-zinc-300 sm:col-span-2">
                      <input type="checkbox" checked={expForm.current} onChange={(e) => setExpForm({ ...expForm, current: e.target.checked })} className="h-4 w-4 rounded border-zinc-300 text-[#009639] focus:ring-[#009639]/30" />
                      I currently work here
                    </label>
                    <button type="button" onClick={addExperience} disabled={saving} className="h-10 rounded-xl bg-[#009639] text-[13px] font-bold text-white transition hover:bg-[#007a2e] disabled:opacity-50 sm:col-span-2">
                      {saving ? 'Adding...' : 'Add Experience'}
                    </button>
                  </div>
                )}

                <ol className="mt-3 space-y-0">
                  {(person?.employmentHistory || []).length === 0 ? (
                    <li className="py-4 text-center text-[12.5px] text-zinc-400">No experience yet.</li>
                  ) : (
                    (person?.employmentHistory || []).map((job, i) => (
                      <li key={i} className="group relative flex gap-4 pb-6 last:pb-0">
                        {i < (person?.employmentHistory || []).length - 1 && (
                          <span className="absolute left-[15px] top-9 h-[calc(100%-2rem)] w-0.5 rounded bg-emerald-100 dark:bg-emerald-900" />
                        )}
                        <span className={`relative z-10 mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-4 ring-white ${
                          job.current ? 'bg-[#009639] text-white' : 'bg-emerald-50 text-[#009639]'
                        }`}>
                          <Briefcase className="h-3.5 w-3.5" />
                        </span>
                        <div className="min-w-0 flex-1 rounded-2xl bg-zinc-50 dark:bg-zinc-800/70 p-3.5 transition hover:bg-emerald-50/50">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="flex flex-wrap items-center gap-2 text-[13.5px] font-bold text-zinc-900 dark:text-zinc-100">
                                {job.position || job.role}
                                {job.current && (
                                  <span className="rounded-full bg-[#009639] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
                                    Current
                                  </span>
                                )}
                              </p>
                              <p className="text-[12px] font-medium text-zinc-600 dark:text-zinc-300">{job.company}</p>
                              <p className="mt-0.5 text-[11px] text-zinc-400 dark:text-zinc-500">
                                {job.period || computePeriod(job.startDate, job.endDate, job.current)}
                                {job.location ? ` • ${job.location}` : ''}
                              </p>
                            </div>
                            {isOwn && !editing && (
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingExp(i);
                                    setEditExpForm({
                                      position: job.position || job.role || '',
                                      company: job.company || '',
                                      location: job.location || '',
                                      startMonth: job.startDate ? String(parseInt(job.startDate.split('-')[1], 10)).padStart(2, '0') : '',
                                      startDay: job.startDate ? String(parseInt(job.startDate.split('-')[2], 10)).padStart(2, '0') : '',
                                      startYear: job.startDate ? job.startDate.split('-')[0] : '',
                                      endMonth: job.endDate ? String(parseInt(job.endDate.split('-')[1], 10)).padStart(2, '0') : '',
                                      endDay: job.endDate ? String(parseInt(job.endDate.split('-')[2], 10)).padStart(2, '0') : '',
                                      endYear: job.endDate ? job.endDate.split('-')[0] : '',
                                      current: job.current || false,
                                    });
                                  }}
                                  className="rounded-lg p-1.5 text-zinc-400 opacity-0 transition hover:bg-blue-50 hover:text-blue-600 group-hover:opacity-100"
                                  aria-label="Edit experience"
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeExperience(i)}
                                  className="rounded-lg p-1.5 text-zinc-400 opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
                                  aria-label="Remove experience"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </li>
                    ))
                  )}
                </ol>
              </section>

              {/* Education */}
              <section className="rounded-3xl border border-emerald-900/10 bg-white dark:bg-zinc-900 p-5 shadow-sm sm:p-6">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-[14px] font-bold text-zinc-900 dark:text-zinc-100">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#009639]/10 text-[#009639] dark:text-emerald-300">
                      <GraduationCap className="h-3.5 w-3.5" />
                    </span>
                    Education
                  </h3>
                  <div className="flex items-center gap-1.5">
                    {isOwn && !editing && (
                      <button
                        type="button"
                        onClick={() => setShowAddEdu(!showAddEdu)}
                        className="flex items-center gap-1 rounded-full bg-[#009639] px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-[#007a2e]"
                      >
                        <Plus className="h-3 w-3" />
                        Add
                      </button>
                    )}
                    {showAddEdu && (
                      <button
                        type="button"
                        onClick={() => setShowAddEdu(false)}
                        className="flex items-center gap-1 rounded-full border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-[11px] font-bold text-zinc-500 dark:text-zinc-400 transition hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      >
                        <X className="h-3 w-3" />
                        Cancel
                      </button>
                    )}
                  </div>
                </div>

                {showAddEdu && (
                  <div className="mt-4 grid gap-2.5 rounded-2xl border border-zinc-200 dark:border-zinc-700 p-4 sm:grid-cols-2">
                    <input value={eduForm.school} onChange={(e) => setEduForm({ ...eduForm, school: e.target.value })} placeholder="School" className={inputClass} />
                    <input value={eduForm.degree} onChange={(e) => setEduForm({ ...eduForm, degree: e.target.value })} placeholder="Degree" className={inputClass} />
                    <input value={eduForm.year} onChange={(e) => setEduForm({ ...eduForm, year: e.target.value })} placeholder="Year (e.g. 2011 — 2015)" className={inputClass} />
                    <input value={eduForm.location} onChange={(e) => setEduForm({ ...eduForm, location: e.target.value })} placeholder="Location" className={inputClass} />
                    <button type="button" onClick={addEducation} disabled={saving} className="h-10 rounded-xl bg-[#009639] text-[13px] font-bold text-white transition hover:bg-[#007a2e] disabled:opacity-50 sm:col-span-2">
                      {saving ? 'Adding...' : 'Add Education'}
                    </button>
                  </div>
                )}

                <div className="mt-3 space-y-3">
                  {(person?.education || []).length === 0 ? (
                    <p className="py-4 text-center text-[12.5px] text-zinc-400">No education yet.</p>
                  ) : (
                    (person?.education || []).map((edu, i) => (
                      <div key={i} className="group flex items-center gap-3.5 rounded-2xl bg-gradient-to-r from-emerald-50 to-white dark:from-zinc-800 dark:to-zinc-900 p-4 ring-1 ring-emerald-100 dark:ring-emerald-900">
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#009639] text-white shadow-sm">
                          <GraduationCap className="h-5 w-5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13.5px] font-bold text-zinc-900 dark:text-zinc-100">{edu.school}</p>
                          <p className="text-[12px] text-zinc-600 dark:text-zinc-300">{edu.degree}</p>
                          <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
                            {edu.year}{edu.location ? ` • ${edu.location}` : ''}
                          </p>
                        </div>
                        {isOwn && !editing && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingEdu(i);
                                setEditEduForm({
                                  school: edu.school || '',
                                  degree: edu.degree || '',
                                  year: edu.year || '',
                                  location: edu.location || '',
                                });
                              }}
                              className="rounded-lg p-1.5 text-zinc-400 opacity-0 transition hover:bg-blue-50 hover:text-blue-600 group-hover:opacity-100"
                              aria-label="Edit education"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeEducation(i)}
                              className="rounded-lg p-1.5 text-zinc-400 opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
                              aria-label="Remove education"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                        {editingEdu === i && (
                          <div className="mt-3 grid gap-2.5 rounded-2xl border border-zinc-200 dark:border-zinc-700 p-4 sm:grid-cols-2">
                            <input value={editEduForm.school} onChange={(e) => setEditEduForm({ ...editEduForm, school: e.target.value })} placeholder="School" className={inputClass} />
                            <input value={editEduForm.degree} onChange={(e) => setEditEduForm({ ...editEduForm, degree: e.target.value })} placeholder="Degree" className={inputClass} />
                            <input value={editEduForm.year} onChange={(e) => setEditEduForm({ ...editEduForm, year: e.target.value })} placeholder="Year (e.g. 2011 — 2015)" className={inputClass} />
                            <input value={editEduForm.location} onChange={(e) => setEditEduForm({ ...editEduForm, location: e.target.value })} placeholder="Location" className={inputClass} />
                            <button type="button" onClick={() => updateEducation(i)} disabled={saving} className="h-10 rounded-xl bg-[#009639] text-[13px] font-bold text-white transition hover:bg-[#007a2e] disabled:opacity-50 sm:col-span-2">
                              {saving ? 'Saving...' : 'Save Changes'}
                            </button>
                            <button type="button" onClick={() => setEditingEdu(null)} className="h-10 rounded-xl border border-zinc-200 dark:border-zinc-700 text-[13px] font-bold text-zinc-600 dark:text-zinc-300 transition hover:bg-zinc-100 dark:hover:bg-zinc-800 sm:col-span-2">
                              Cancel
                            </button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default AlumniProfile;
