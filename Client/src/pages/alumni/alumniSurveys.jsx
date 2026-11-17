import ContentSkeleton from "../../components/ui/Skeleton";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileText,
  ChevronRight,
  CheckCircle2,
  ClipboardList,
} from "lucide-react";
import { useAuth } from "../../context/useAuth";
import AlumniSidebar from "../../layout/sidebar/alumni/alumniSidebar";
import AlumniTopbar from "../../layout/topbar/alumni/alumniTopbar";
import api from "../../utils/axios";

const AlumniSurveys = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [surveys, setSurveys] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/surveys")
      .then((res) => setSurveys(res.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-[#f3f6f3] dark:bg-zinc-950">
      <AlumniSidebar
        user={user}
        mobileOpen={sidebarOpen}
        setMobileOpen={setSidebarOpen}
      />

      <div className="lg:pl-64">
        <AlumniTopbar
          user={user}
          title="Surveys"
          onMenuClick={() => setSidebarOpen(true)}
        />

        <main className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6 workspace-page">
          <section className="relative overflow-hidden rounded-3xl border border-emerald-100 bg-gradient-to-br from-white via-emerald-50 to-green-100 p-5 shadow-sm dark:border-zinc-800 dark:from-zinc-900 dark:via-zinc-900 dark:to-emerald-950/40 sm:p-7">
            <div className="absolute -right-8 -top-10 h-36 w-36 rounded-full bg-emerald-200/40 blur-2xl dark:bg-emerald-500/10" />
            <div className="relative flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand text-white shadow-md shadow-emerald-900/15">
                <ClipboardList className="h-6 w-6" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-brand dark:text-emerald-300">Alumni voice</p>
                <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-white">Surveys</h1>
                <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-300">Share your experience and help improve the alumni community.</p>
                {!loading && surveys.length > 0 && (
                  <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-white/80 px-3 py-1 text-[11px] font-bold text-zinc-600 dark:border-emerald-900 dark:bg-zinc-900/70 dark:text-zinc-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-brand" />
                    {surveys.length} {surveys.length === 1 ? "survey" : "surveys"} available
                  </span>
                )}
              </div>
            </div>
          </section>
          {loading ? (
            <ContentSkeleton variant="list" count={3} label="Loading surveys..." />
          ) : surveys.length === 0 ? (
            <div className="rounded-3xl border border-brand/10 bg-white dark:bg-zinc-900 p-10 text-center shadow-sm">
              <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-brand dark:text-brand">
                <ClipboardList className="h-6 w-6" />
              </span>
              <p className="text-[14px] font-bold text-zinc-800 dark:text-zinc-100">
                No surveys right now
              </p>
              <p className="mt-0.5 text-[12px] text-zinc-500 dark:text-zinc-400">
                Check back later for new surveys.
              </p>
            </div>
          ) : (
            surveys.map((survey) => (
              <button
                key={survey._id}
                type="button"
                onClick={() => navigate(`/alumni/surveys/${survey._id}`)}
                className="alumni-survey-card group w-full rounded-2xl border border-zinc-200/80 bg-white p-4 text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-emerald-900 sm:p-5"
              >
                <div className="flex items-center gap-3.5">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-brand transition group-hover:bg-brand group-hover:text-white dark:bg-emerald-950/50 dark:text-emerald-300 dark:group-hover:bg-brand dark:group-hover:text-white">
                    <FileText className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-extrabold text-zinc-900 dark:text-zinc-100">
                      {survey.title}
                    </span>
                    <span className="mt-1 block line-clamp-2 text-[12px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                      {survey.description || "Take a moment to share your thoughts."}
                    </span>
                    <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-brand dark:bg-emerald-950/60 dark:text-emerald-300">
                      <FileText className="h-3 w-3" />
                      {survey.questions?.length || 0} questions
                    </span>
                  </span>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-50 text-zinc-400 transition group-hover:bg-emerald-50 group-hover:text-brand dark:bg-zinc-800 dark:text-zinc-500 dark:group-hover:bg-emerald-950/50 dark:group-hover:text-emerald-300">
                    <ChevronRight className="h-5 w-5" />
                  </span>
                </div>
              </button>
            ))
          )}
          {surveys.length > 0 && (
            <p className="flex items-center justify-center gap-1.5 rounded-xl bg-white/70 px-3 py-3 text-[11.5px] text-zinc-500 dark:bg-zinc-900/70 dark:text-zinc-400">
              <CheckCircle2 className="h-4 w-4 text-brand dark:text-emerald-300" />
              Your answers help CLSU serve alumni better.
            </p>
          )}
        </main>
      </div>
    </div>
  );
};

export default AlumniSurveys;
