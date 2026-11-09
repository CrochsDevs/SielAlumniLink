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
import PageHeader from "../../components/ui/PageHeader";

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

        <main className="mx-auto max-w-3xl space-y-3 p-4 sm:p-6 workspace-page">
          <PageHeader title="Surveys" description="Share your experience and help improve the alumni community." />
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
                className="alumni-survey-card group w-full rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-5 text-left shadow-sm transition hover:shadow-md"
              >
                <div className="flex items-start gap-3.5">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand dark:text-brand">
                    <FileText className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-bold text-zinc-900 dark:text-zinc-100">
                      {survey.title}
                    </span>
                    <span className="mt-0.5 block text-[12px] text-zinc-500 dark:text-zinc-400">
                      {survey.description ||
                        `${survey.questions?.length || 0} questions`}
                    </span>
                    <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-brand/10 px-2.5 py-0.5 text-[11px] font-bold text-brand dark:text-brand">
                      {survey.questions?.length || 0} questions
                    </span>
                  </span>
                  <ChevronRight className="h-5 w-5 shrink-0 text-zinc-300 dark:text-zinc-500 transition group-hover:text-brand" />
                </div>
              </button>
            ))
          )}
          {surveys.length > 0 && (
            <p className="flex items-center justify-center gap-1.5 text-[11.5px] text-zinc-400 dark:text-zinc-500">
              <CheckCircle2 className="h-3.5 w-3.5 text-brand dark:text-brand" />
              Your answers help CLSU serve alumni better.
            </p>
          )}
        </main>
      </div>
    </div>
  );
};

export default AlumniSurveys;
