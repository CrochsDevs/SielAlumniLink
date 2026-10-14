import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Swal from "sweetalert2";
import { ArrowLeft, CheckCircle2, Send } from "lucide-react";
import { useAuth } from "../../context/useAuth";
import AlumniSidebar from "../../layout/sidebar/alumni/alumniSidebar";
import AlumniTopbar from "../../layout/topbar/alumni/alumniTopbar";
import api from "../../utils/axios";

const AlumniSurveyAnswer = () => {
  const { user } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [survey, setSurvey] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [answered, setAnswered] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get(`/surveys/${id}`),
      api.get(`/surveys/me/answers/${id}`),
    ])
      .then(([surveyRes, mineRes]) => {
        setSurvey(surveyRes.data.data);
        const mine = mineRes.data.data;
        setAnswers(
          (surveyRes.data.data.questions || []).map(
            (_, i) => mine?.answers?.[i] || "",
          ),
        );
        setAnswered(!!mine);
      })
      .catch(() => setSurvey(null))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (answers.some((a) => !a.trim())) {
      Swal.fire("Error", "Please answer all questions", "error");
      return;
    }
    setSaving(true);
    try {
      await api.post(`/surveys/${id}/answers`, { answers });
      Swal.fire({
        title: "Thank you!",
        text: "Your response has been recorded.",
        icon: "success",
        timer: 1800,
        showConfirmButton: false,
      });
      navigate("/alumni/surveys");
    } catch (err) {
      Swal.fire(
        "Error",
        err.response?.data?.message || "Failed to submit",
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

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
          title="Survey"
          onMenuClick={() => setSidebarOpen(true)}
        />

        <main className="mx-auto max-w-2xl p-4 sm:p-6">
          <button
            type="button"
            onClick={() => navigate("/alumni/surveys")}
            className="mb-3 flex items-center gap-1.5 text-[12.5px] font-semibold text-zinc-500 dark:text-zinc-400 transition hover:text-[#007a2e]"
          >
            <ArrowLeft className="h-4 w-4" />
            All surveys
          </button>

          {loading ? (
            <p className="rounded-3xl border border-emerald-900/10 bg-white dark:bg-zinc-900 p-8 text-center text-[13px] text-zinc-500 dark:text-zinc-400 shadow-sm">
              Loading survey...
            </p>
          ) : !survey ? (
            <p className="rounded-3xl border border-emerald-900/10 bg-white dark:bg-zinc-900 p-8 text-center text-[13px] text-zinc-500 dark:text-zinc-400 shadow-sm">
              Survey not found.
            </p>
          ) : (
            <section className="overflow-hidden rounded-3xl border border-emerald-900/10 bg-white dark:bg-zinc-900 shadow-sm">
              <div className="bg-gradient-to-r from-[#0F4C3A] to-[#009639] px-5 py-5 sm:px-6">
                <h1 className="text-[16px] font-extrabold text-white">
                  {survey.title}
                </h1>
                {survey.description && (
                  <p className="mt-0.5 text-[12px] text-white/70">
                    {survey.description}
                  </p>
                )}
                {answered && (
                  <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white dark:bg-zinc-900/15 px-3 py-1 text-[11px] font-bold text-white">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Already answered — update anytime
                  </p>
                )}
              </div>

              <form onSubmit={handleSubmit} className="space-y-4 p-5 sm:p-6">
                {(survey.questions || []).map((q, i) => (
                  <div key={i}>
                    <label className="mb-1.5 block text-[13px] font-bold text-zinc-800 dark:text-zinc-100">
                      {i + 1}. {q.text}
                    </label>
                    <textarea
                      value={answers[i] || ""}
                      onChange={(e) =>
                        setAnswers((prev) =>
                          prev.map((a, j) => (j === i ? e.target.value : a)),
                        )
                      }
                      required
                      rows={2}
                      placeholder="Your answer..."
                      className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 px-3.5 py-2.5 text-[13px] text-zinc-800 dark:text-zinc-100 outline-none transition focus:border-[#009639] focus:bg-white dark:focus:bg-zinc-900 focus:ring-2 focus:ring-[#009639]/15"
                    />
                  </div>
                ))}
                <button
                  type="submit"
                  disabled={saving}
                  className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-[#009639] text-[13px] font-bold text-white transition hover:bg-[#007a2e] disabled:opacity-60"
                >
                  <Send className="h-4 w-4" />
                  {saving
                    ? "Submitting..."
                    : answered
                      ? "Update response"
                      : "Submit response"}
                </button>
              </form>
            </section>
          )}
        </main>
      </div>
    </div>
  );
};

export default AlumniSurveyAnswer;
