import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles, LoaderCircle, ArrowUpRight, Check, ChevronDown, Target } from "lucide-react";
import api from "../../utils/axios";
import StudentMentorCard from "./StudentMentorCard";
const card = "rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900";
const button = "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-brand px-4 text-xs font-semibold text-white hover:bg-brand disabled:opacity-50";
const input = "mt-2 w-full rounded-lg border border-zinc-300 bg-white p-3 text-sm text-zinc-900 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100";
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
  if (loading) return <div role="status" className={`${card} flex items-center gap-3 text-sm text-zinc-500`}><LoaderCircle className="animate-spin text-brand" size={20} />Finding mentors for you…</div>;
  if (!data) return <div role="alert" className={card}><p className="text-sm text-zinc-500">{error}</p><button type="button" className={`${button} mt-4`} onClick={() => {
      setLoading(true);
      setAttempt(value => value + 1);
    }}>Try again</button></div>;
  return <div className="mentorship-matching-layout">
    <div className="min-w-0 space-y-6">
    <section className={`${card} !rounded-2xl !p-0`} aria-label="Your career direction">
      <button type="button" onClick={() => setPreferencesOpen(value => !value)} aria-expanded={preferencesOpen} aria-controls="mentor-preferences-form" className="flex min-h-20 w-full items-center gap-3 rounded-2xl p-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-brand dark:bg-emerald-950 dark:text-brand"><Target size={21} /></span>
        <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">Your career direction</span><span className="mt-1 block text-xs leading-5 text-zinc-500 dark:text-zinc-400">Edit your interests and goals.</span></span>
        <ChevronDown size={17} className={`shrink-0 text-zinc-400 transition-transform ${preferencesOpen ? 'rotate-180' : ''}`} />
      </button>
      {!preferencesOpen && <div className="space-y-4 border-t border-zinc-100 px-5 pb-5 pt-4 dark:border-zinc-800">
        <div><p className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">Your interests</p><div className="mt-2 flex flex-wrap gap-1.5">
          {data.preferences.interests.length ? data.preferences.interests.map(interest => <span key={interest} className="mentorship-tag max-w-full break-words bg-emerald-50 text-brand dark:bg-emerald-950">{interest}</span>) : <p className="text-xs leading-5 text-zinc-400">Add the fields you want to explore.</p>}
        </div></div>
        <div><p className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">Your career goal</p><p className="mt-2 whitespace-pre-line break-words text-xs leading-6 text-zinc-500 dark:text-zinc-400">{data.preferences.careerGoals || "Share what you would like to work toward."}</p></div>
      </div>}
      <form id="mentor-preferences-form" hidden={!preferencesOpen} onSubmit={save} aria-label="Mentor matching preferences" className="border-t border-zinc-100 p-4 sm:p-5 dark:border-zinc-800">
        <p className="mb-5 max-w-2xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">What would you like guidance on? Your answers help us suggest alumni with relevant experience.</p>
        <fieldset disabled={saving} className="grid gap-5">
          <label className="block text-xs font-semibold" htmlFor="mentor-interests">Career interests<input id="mentor-interests" className={input} value={interests} maxLength={1638} onChange={event => {
              setInterests(event.target.value);
              setSaved(false);
            }} placeholder="e.g. Software development, data science" aria-describedby="mentor-interests-help" /><span id="mentor-interests-help" className="mt-2 block text-xs font-normal text-zinc-500">Separate interests with commas. You can add up to 20.</span></label>
          <label className="block text-xs font-semibold" htmlFor="mentor-goals">What do you want to work toward?<textarea id="mentor-goals" rows={3} maxLength={1000} className={`${input} resize-y`} value={careerGoals} onChange={event => {
              setCareerGoals(event.target.value);
              setSaved(false);
            }} placeholder="e.g. Prepare for my first developer role and improve my interview skills" /><span className="mt-1 block text-right text-[11px] font-normal text-zinc-400">{careerGoals.length}/1,000</span></label>
          <div><p className="mb-2 text-xs text-zinc-500">We also use the skills in your portfolio.</p><div className="flex flex-wrap items-center gap-2">{data.profile.skills.map(skill => <span key={skill} className="rounded-md bg-zinc-100 px-2 py-1 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">{skill}</span>)}<Link to="/student/portfolio" className="inline-flex min-h-9 items-center gap-1 text-xs font-semibold text-brand dark:text-brand">{data.profile.skills.length ? 'Edit skills' : 'Add your skills'}<ArrowUpRight size={13} /></Link></div></div>
          {error && <p role="alert" className="text-sm text-red-600 dark:text-red-300">{error}</p>}
          <div><button type="submit" disabled={saving} className={`${button} !min-h-11 w-full`}>{saving ? <LoaderCircle size={16} className="animate-spin" /> : <Sparkles size={16} />} {saving ? 'Updating…' : 'Update recommendations'}</button></div>
        </fieldset>
      </form>
    </section>
    <div className="hidden px-1 xl:block">
      <h2 className="text-sm font-semibold">Start your mentorship</h2>
      <ol className="mt-4 space-y-4">
        {[["Choose a mentor", "Explore their experience and shared interests."], ["Send a request", "You can message them once they accept."], ["Work on your goals", "Open My progress to share activities and get feedback."]].map(([title, description], index) => <li key={title} className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand/10 text-[11px] font-semibold text-brand">{index + 1}</span>
          <div><p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">{title}</p><p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">{description}</p></div>
        </li>)}
      </ol>
    </div>
    </div>
    <div className="min-w-0 space-y-4">
    {saved && <p role="status" className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-brand dark:bg-emerald-950 dark:text-brand"><Check size={16} />Your career direction is saved. Recommendations are updated.</p>}
    <section aria-label="Recommended mentors" aria-busy={saving} className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">Recommended mentors</h2><p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{data.matches.length} {data.matches.length === 1 ? 'alumnus' : 'alumni'} with experience related to your skills and interests.</p></div>{onBrowse && <button type="button" onClick={onBrowse} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-brand/20 px-3 text-xs font-semibold text-brand hover:bg-brand/5 dark:text-brand">Browse all mentors<ArrowUpRight size={15} /></button>}</div>
      {connectionError && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{connectionError}</p>}
      {notice && <p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-brand dark:bg-emerald-950 dark:text-brand">{notice}</p>}
      {!data.matches.length && <div className={`${card} !rounded-2xl py-10 text-center`}><Sparkles size={28} className="mx-auto text-brand" /><h3 className="mt-4 text-base font-semibold">{data.candidateCount ? 'Let’s find the right mentor for you' : 'Your alumni community is growing'}</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-500 dark:text-zinc-400">{data.candidateCount ? 'Share your career interests or add portfolio skills. You can also browse all alumni and make your own connection.' : 'Save your career interests now and check back as alumni join.'}</p><div className="mt-5 flex flex-wrap justify-center gap-3"><button type="button" onClick={() => {
            setPreferencesOpen(true);
            requestAnimationFrame(() => document.getElementById('mentor-interests')?.focus());
          }} className={`${button} !min-h-11`}>Add interests & goals</button>{onBrowse && <button type="button" onClick={onBrowse} className="min-h-11 px-3 text-sm font-semibold text-zinc-600 dark:text-zinc-300">Browse all mentors</button>}</div></div>}
      <div className="grid items-stretch gap-5 md:grid-cols-2">{data.matches.map(({ mentor, score, reasons }) => (
        <StudentMentorCard key={mentor._id} mentor={mentor} score={score} reasons={reasons}
          status={states[mentor.email]} connect={connect} message={message} sending={sending}
          disabled={connectionsLoading || !!connectionError} onProgress={onProgress} />
      ))}</div>
      {!!data.matches.length && <p className="px-1 text-xs leading-6 text-zinc-400">Recommendations use profile similarities. Explore their experience and connect once you find someone you would like to learn from.</p>}
    </section>
    </div>
  </div>;
}
