import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles, LoaderCircle, ArrowUpRight, Check, Plus, MessageSquare, ChevronDown, Target } from "lucide-react";
import api from "../../utils/axios";
import ProfileAvatar from "../profile/ProfileAvatar";
const card = "rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900";
const button = "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#009639] px-4 text-xs font-semibold text-white hover:bg-[#007a2e] disabled:opacity-50";
const input = "mt-2 w-full rounded-lg border border-zinc-300 bg-white p-3 text-sm text-zinc-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100";
export default function MentorMatching({
  states,
  connect,
  message,
  sending,
  connectionsLoading,
  connectionError,
  notice,
  onBrowse,
  onProgress,
  initialEdit = false
}) {
  const [data, setData] = useState(null);
  const [interests, setInterests] = useState("");
  const [careerGoals, setCareerGoals] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const pending = useRef(false);
  useEffect(() => {
    let active = true;
    api.get("/mentorship/matches").then(response => {
      if (!active) return;
      const result = response.data.data;
      setData(result);
      setInterests(result.preferences.interests.join(", "));
      setCareerGoals(result.preferences.careerGoals);
      setPreferencesOpen(initialEdit || !result.preferences.interests.length && !result.preferences.careerGoals);
      setError("");
    }).catch(() => {
      if (active) setError("Unable to load mentor matches. Please try again.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [attempt, initialEdit]);
  const save = async event => {
    event.preventDefault();
    if (pending.current) return;
    const entries = interests.split(",").map(value => value.trim()).filter(Boolean);
    if (entries.length > 20 || entries.some(value => value.length > 80)) {
      setError("Use up to 20 interests, with no more than 80 characters each.");
      return;
    }
    pending.current = true;
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const response = await api.put("/mentorship/matches/preferences", {
        interests: entries,
        careerGoals
      });
      setData(response.data.data);
      setSaved(true);
      setPreferencesOpen(false);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to update your matches. Your edits are still here; please try again.");
    } finally {
      pending.current = false;
      setSaving(false);
    }
  };
  if (loading) return <div role="status" className={`${card} flex items-center gap-3 text-sm text-zinc-500`}><LoaderCircle className="animate-spin text-emerald-600" size={20} />Finding mentors for you…</div>;
  if (!data) return <div role="alert" className={card}><p className="text-sm text-zinc-500">{error}</p><button type="button" className={`${button} mt-4`} onClick={() => {
      setLoading(true);
      setAttempt(value => value + 1);
    }}>Try again</button></div>;
  return <div className="space-y-6">
    <section className={`${card} !rounded-2xl !p-0`} aria-label="Your career direction">
      <button type="button" onClick={() => setPreferencesOpen(value => !value)} aria-expanded={preferencesOpen} aria-controls="mentor-preferences-form" className="flex min-h-20 w-full items-center gap-3 rounded-2xl p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 sm:p-5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-[#007a2e] dark:bg-emerald-950 dark:text-emerald-300"><Target size={21} /></span>
        <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">Your career direction</span><span className="mt-1 block truncate text-xs text-zinc-500 dark:text-zinc-400">{data.preferences.careerGoals || (data.preferences.interests.length ? data.preferences.interests.join(', ') : 'Add your interests and goals to get more useful recommendations.')}</span></span>
        <span className="hidden text-xs font-semibold text-[#007a2e] sm:block dark:text-emerald-300">{preferencesOpen ? 'Hide' : 'Edit'}</span><ChevronDown size={17} className={`shrink-0 text-zinc-400 transition-transform ${preferencesOpen ? 'rotate-180' : ''}`} />
      </button>
      <form id="mentor-preferences-form" hidden={!preferencesOpen} onSubmit={save} aria-label="Mentor matching preferences" className="border-t border-zinc-100 p-4 sm:p-5 dark:border-zinc-800">
        <p className="mb-5 max-w-2xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">What would you like guidance on? Your answers help us suggest alumni with relevant experience.</p>
        <fieldset disabled={saving} className="grid gap-5 md:grid-cols-2">
          <label className="block text-xs font-semibold" htmlFor="mentor-interests">Career interests<input id="mentor-interests" className={input} value={interests} maxLength={1638} onChange={event => {
              setInterests(event.target.value);
              setSaved(false);
            }} placeholder="e.g. Software development, data science" aria-describedby="mentor-interests-help" /><span id="mentor-interests-help" className="mt-2 block text-xs font-normal text-zinc-500">Separate interests with commas. You can add up to 20.</span></label>
          <label className="block text-xs font-semibold" htmlFor="mentor-goals">What do you want to work toward?<textarea id="mentor-goals" rows={3} maxLength={1000} className={`${input} resize-y`} value={careerGoals} onChange={event => {
              setCareerGoals(event.target.value);
              setSaved(false);
            }} placeholder="e.g. Prepare for my first developer role and improve my interview skills" /><span className="mt-1 block text-right text-[11px] font-normal text-zinc-400">{careerGoals.length}/1,000</span></label>
          <div className="md:col-span-2"><p className="mb-2 text-xs text-zinc-500">We also use the skills in your portfolio.</p><div className="flex flex-wrap items-center gap-2">{data.profile.skills.map(skill => <span key={skill} className="rounded-md bg-zinc-100 px-2 py-1 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">{skill}</span>)}<Link to="/student/portfolio" className="inline-flex min-h-9 items-center gap-1 text-xs font-semibold text-[#007a2e] dark:text-emerald-300">{data.profile.skills.length ? 'Edit skills' : 'Add your skills'}<ArrowUpRight size={13} /></Link></div></div>
          {error && <p role="alert" className="text-sm text-red-600 md:col-span-2 dark:text-red-300">{error}</p>}
          <div className="md:col-span-2"><button type="submit" disabled={saving} className={`${button} !min-h-11 !text-sm`}>{saving ? <LoaderCircle size={16} className="animate-spin" /> : <Sparkles size={16} />} {saving ? 'Updating…' : 'Update recommendations'}</button></div>
        </fieldset>
      </form>
    </section>
    {saved && <p role="status" className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"><Check size={16} />Your career direction is saved. Recommendations are updated.</p>}
    <section aria-label="Recommended mentors" aria-busy={saving} className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">Recommended mentors</h2><p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{data.matches.length} {data.matches.length === 1 ? 'alumnus' : 'alumni'} with experience related to your skills and interests.</p></div>{onBrowse && <button type="button" onClick={onBrowse} className="inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-[#007a2e] dark:text-emerald-300">Browse all mentors<ArrowUpRight size={15} /></button>}</div>
      {connectionError && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{connectionError}</p>}
      {notice && <p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">{notice}</p>}
      {!data.matches.length && <div className={`${card} !rounded-2xl py-10 text-center`}><Sparkles size={28} className="mx-auto text-emerald-600" /><h3 className="mt-4 text-base font-semibold">{data.candidateCount ? 'Let’s find the right mentor for you' : 'Your alumni community is growing'}</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-500 dark:text-zinc-400">{data.candidateCount ? 'Share your career interests or add portfolio skills. You can also browse all alumni and make your own connection.' : 'Save your career interests now and check back as alumni join.'}</p><div className="mt-5 flex flex-wrap justify-center gap-3"><button type="button" onClick={() => {
            setPreferencesOpen(true);
            requestAnimationFrame(() => document.getElementById('mentor-interests')?.focus());
          }} className={`${button} !min-h-11`}>Add interests & goals</button>{onBrowse && <button type="button" onClick={onBrowse} className="min-h-11 px-3 text-sm font-semibold text-zinc-600 dark:text-zinc-300">Browse all mentors</button>}</div></div>}
      <div className="grid gap-4 md:grid-cols-2">{data.matches.map(({
          mentor,
          score,
          reasons
        }) => {
          const status = states[mentor.email];
          return <article key={mentor._id} className={`${card} flex min-w-0 flex-col !rounded-2xl !p-5 sm:!p-6`}>
          <div className="flex items-start gap-3"><span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-emerald-50 text-lg font-semibold text-[#007a2e] dark:bg-emerald-950 dark:text-emerald-300"><ProfileAvatar user={mentor} fallback="A" /></span><div className="min-w-0 flex-1"><h3 className="text-sm font-semibold"><Link to={`/alumni/profile/${mentor._id}`} className="break-words hover:text-emerald-700 hover:underline">{mentor.name}</Link></h3><p className="mt-1 text-sm leading-5 text-zinc-500 dark:text-zinc-400">{mentor.headline}</p></div></div>
          <div className="mt-4 flex flex-wrap gap-2"><span title="Similarity between your profile and the mentor’s experience" className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">{score}% profile similarity</span>{status === 'connected' && <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-medium text-zinc-500 dark:bg-zinc-800">Connected</span>}</div>
          <details className="mb-5 mt-4 text-xs"><summary className="cursor-pointer py-1 font-medium text-zinc-600 dark:text-zinc-400">Why this mentor?</summary><ul className="mt-2 space-y-2">{reasons.map(reason => <li key={reason} className="flex gap-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400"><Check size={13} className="mt-1 shrink-0 text-emerald-600" /><span className="min-w-0 break-words">{reason}</span></li>)}</ul></details>
          <div className="mt-auto flex flex-wrap items-center gap-3">{status === 'connected' ? <><button type="button" className={`${button} !min-h-11`} onClick={() => message(mentor)}><MessageSquare size={15} />Message</button>{onProgress && <button type="button" onClick={() => onProgress(mentor)} className="min-h-11 rounded-lg border border-zinc-200 px-3 text-xs font-semibold dark:border-zinc-700">View progress</button>}</> : status === 'incoming' ? <Link className={`${button} !min-h-11`} to="/student/requests">Review request</Link> : <button type="button" className={`${button} !min-h-11`} disabled={connectionsLoading || !!connectionError || !!sending || status === 'pending'} onClick={() => connect(mentor)}>{sending === mentor.email ? <LoaderCircle size={15} className="animate-spin" /> : status === 'pending' ? <Check size={15} /> : <Plus size={15} />} {status === 'pending' ? 'Request sent' : sending === mentor.email ? 'Sending…' : 'Connect'}</button>}<Link to={`/alumni/profile/${mentor._id}`} className="inline-flex min-h-11 items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">View profile<ArrowUpRight size={13} /></Link></div>
        </article>;
        })}</div>
      {!!data.matches.length && <p className="px-1 text-xs leading-6 text-zinc-400">Recommendations use profile similarities. Explore their experience and connect once you find someone you would like to learn from.</p>}
    </section>
  </div>;
}
