import AdminStatCard from "../../components/admin/AdminStatCard";
import { AdminStatGrid, AdminTabs, AdminButton } from "../../components/admin/AdminUI";
import PageHeader from "../../components/ui/PageHeader";
import { useCallback, useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import { gooeyToast as toast } from 'goey-toast';
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  FileText,
  ListChecks,
  Power,
  X,
  BarChart3,
  ClipboardList,
} from "lucide-react";
import { useAuth } from "../../context/useAuth";
import AdminSidebar from "../../layout/sidebar/admin/adminSidebar";
import AdminTopbar from "../../layout/topbar/alumni/adminTopbar";
import DataPagination from "../../components/ui/data-pagination";
import api from "../../utils/axios";

const EMPTY_FORM = {
  title: "",
  description: "",
  isActive: true,
  questions: [{ text: "", type: "text", options: [] }],
};

const QUESTION_TYPES = [
  { value: "text", label: "Short answer" },
  { value: "paragraph", label: "Paragraph" },
  { value: "choice", label: "Multiple choice" },
  { value: "dropdown", label: "Dropdown" },
  { value: "checkbox", label: "Checkboxes" },
  { value: "rating", label: "Rating (1-5)" },
];

export default function AdminSurveys() {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [surveys, setSurveys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [resultsFor, setResultsFor] = useState(null);
  const [results, setResults] = useState([]);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("questions");

  const fetchSurveys = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/surveys", { params: { all: "true" } });
      setSurveys(res.data.data || []);
    } catch (err) {
      toast.error("Error", { description: err.response?.data?.message || "Failed to load surveys" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSurveys();
  }, [fetchSurveys]);

  const counts = useMemo(
    () => ({
      total: surveys.length,
      active: surveys.filter((s) => s.isActive).length,
      questions: surveys.reduce(
        (sum, s) => sum + (s.questions?.length || 0),
        0,
      ),
    }),
    [surveys],
  );

  const filtered = surveys.filter((s) =>
    `${s.title} ${s.description || ""}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paged = filtered.slice((page - 1) * perPage, page * perPage);

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (survey) => {
    setEditing(survey);
    setForm({
      title: survey.title || "",
      description: survey.description || "",
      isActive: survey.isActive !== false,
      questions: survey.questions?.length
        ? survey.questions.map((q) => ({ ...q }))
        : [{ text: "", type: "text", options: [] }],
    });
    setModalOpen(true);
  };

  const setQuestion = (i, patch) => {
    setForm((prev) => ({
      ...prev,
      questions: prev.questions.map((q, j) =>
        j === i ? { ...q, ...patch } : q,
      ),
    }));
  };

  const addQuestion = () => {
    setForm((prev) => ({
      ...prev,
      questions: [...prev.questions, { text: "", type: "text", options: [] }],
    }));
  };

  const removeQuestion = (i) => {
    setForm((prev) => ({
      ...prev,
      questions: prev.questions.filter((_, j) => j !== i),
    }));
  };

  const addOption = (qi) => {
    setForm((prev) => ({
      ...prev,
      questions: prev.questions.map((q, j) =>
        j === qi ? { ...q, options: [...(q.options || []), ""] } : q,
      ),
    }));
  };

  const setOption = (qi, oi, val) => {
    setForm((prev) => ({
      ...prev,
      questions: prev.questions.map((q, j) =>
        j === qi
          ? { ...q, options: q.options.map((o, k) => (k === oi ? val : o)) }
          : q,
      ),
    }));
  };

  const removeOption = (qi, oi) => {
    setForm((prev) => ({
      ...prev,
      questions: prev.questions.map((q, j) =>
        j === qi ? { ...q, options: q.options.filter((_, k) => k !== oi) } : q,
      ),
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const questions = form.questions.filter((q) => q.text.trim());
    if (questions.length === 0) {
      toast.error("Error", { description: "Add at least one question" });
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/surveys/${editing._id}`, { ...form, questions });
      } else {
        await api.post("/surveys", { ...form, questions });
      }
      setModalOpen(false);
      fetchSurveys();
      toast.success("Saved");
    } catch (err) {
      toast.error("Error", { description: err.response?.data?.message || "Failed to save survey" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (survey) => {
    const result = await Swal.fire({
      title: "Delete survey?",
      text: `${survey.title} will be removed.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, delete",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#dc2626",
      reverseButtons: true,
    });
    if (!result.isConfirmed) return;
    try {
      await api.delete(`/surveys/${survey._id}`);
      fetchSurveys();
      toast.success("Deleted");
    } catch (err) {
      toast.error("Error", { description: err.response?.data?.message || "Failed to delete survey" });
    }
  };

  const toggleActive = async (survey) => {
    try {
      await api.put(`/surveys/${survey._id}`, { isActive: !survey.isActive });
      fetchSurveys();
    } catch (err) {
      toast.error("Error", { description: err.response?.data?.message || "Failed to update survey" });
    }
  };

  const openResults = async (survey) => {
    if (resultsFor?._id === survey._id) {
      setResultsFor(null);
      return;
    }
    setResultsFor(survey);
    setResultsLoading(true);
    try {
      const res = await api.get(`/surveys/${survey._id}/results`);
      setResults(res.data.data.responses || []);
    } catch (err) {
      toast.error("Error", { description: err.response?.data?.message || "Failed to load results" });
      setResultsFor(null);
    } finally {
      setResultsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <AdminSidebar
        user={user}
        mobileOpen={sidebarOpen}
        setMobileOpen={setSidebarOpen}
      />

      <div className="lg:pl-64">
        <AdminTopbar
          user={user}
          title="Surveys"
          onMenuClick={() => setSidebarOpen(true)}
        />

        <main className="workspace-page mx-auto max-w-6xl space-y-4 p-4 sm:p-6">
          <PageHeader title="Surveys" description="Create surveys and review responses from your community." />
          <AdminStatGrid columns={3}>
            {[
              { label: "Total Surveys", value: counts.total, icon: FileText, caption: "community surveys", detail: "Active and inactive surveys" },
              { label: "Active", value: counts.active, icon: Power, caption: "accepting responses", detail: "Available to community members" },
              { label: "Questions", value: counts.questions, icon: ListChecks, caption: "survey questions", detail: "Across all surveys" },
            ].map((item, index) => <AdminStatCard key={item.label} {...item} featured={index === 0} loading={loading} />)}
          </AdminStatGrid>

          <AdminTabs label="Survey views" value={activeTab} onChange={setActiveTab} items={[
            { id: "questions", label: "Questions", icon: FileText },
            { id: "responses", label: "Responses", icon: BarChart3, count: results.length || null },
          ]} />

          {/* Questions tab */}
          {activeTab === "questions" && (
            <div className="admin-panel admin-data-table overflow-hidden">
              <div className="admin-toolbar">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
                  <input
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Search surveys..."
                    className="h-10 w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 pl-9 pr-3 text-[12.5px] outline-none transition focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/15"
                  />
                </div>

                <AdminButton onClick={openAdd}><Plus size={15} />New Survey</AdminButton>
              </div>

              {loading ? (
                <p className="p-6 text-[13px] text-zinc-500 dark:text-zinc-400">
                  Loading surveys...
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[680px] text-left text-[12.5px]">
                    <thead>
                      <tr className="border-b border-zinc-100 dark:border-zinc-800 text-[10.5px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                        <th className="px-5 py-3 font-semibold">Survey</th>
                        <th className="px-5 py-3 font-semibold">Questions</th>
                        <th className="px-5 py-3 font-semibold">Status</th>
                        <th className="px-5 py-3 font-semibold">Created</th>
                        <th className="px-5 py-3 font-semibold text-right">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {paged.map((survey) => (
                        <tr
                          key={survey._id}
                          className="border-b border-zinc-50 dark:border-zinc-800 last:border-0 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                        >
                          <td className="px-5 py-3">
                            <p className="font-semibold text-zinc-800 dark:text-zinc-100">
                              {survey.title}
                            </p>
                            <p className="max-w-xs truncate text-[11px] text-zinc-500 dark:text-zinc-400">
                              {survey.description || "—"}
                            </p>
                          </td>
                          <td className="px-5 py-3">
                            <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 text-[11px] font-bold text-zinc-600 dark:text-zinc-300">
                              {survey.questions?.length || 0}
                            </span>
                          </td>
                          <td className="px-5 py-3">
                            <button
                              type="button"
                              onClick={() => toggleActive(survey)}
                              title={
                                survey.isActive
                                  ? "Hide survey"
                                  : "Publish survey"
                              }
                              className={`inline-block rounded-full px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wide ring-1 transition ${
                                survey.isActive
                                  ? "bg-brand/10 text-brand ring-emerald-200/60"
                                  : "bg-zinc-100 text-zinc-400 ring-zinc-200"
                              }`}
                            >
                              {survey.isActive ? "Active" : "Draft"}
                            </button>
                          </td>
                          <td className="px-5 py-3 text-zinc-500 dark:text-zinc-400">
                            {survey.createdAt
                              ? new Date(survey.createdAt).toLocaleDateString(
                                  "en-US",
                                  {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  },
                                )
                              : "—"}
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => openResults(survey)}
                                className={`rounded-lg p-2 transition ${resultsFor?._id === survey._id ? "bg-brand/10 text-brand dark:text-brand" : "text-zinc-300 dark:text-zinc-500 hover:bg-emerald-50 hover:text-brand"}`}
                                aria-label="View results"
                                title="View results"
                              >
                                <BarChart3 className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => openEdit(survey)}
                                className="rounded-lg p-2 text-zinc-300 dark:text-zinc-500 transition hover:bg-emerald-50 hover:text-brand"
                                aria-label="Edit survey"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(survey)}
                                className="rounded-lg p-2 text-zinc-300 dark:text-zinc-500 transition hover:bg-red-50 hover:text-red-600"
                                aria-label="Delete survey"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {paged.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-5 py-10 text-center">
                            <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-brand dark:text-brand">
                              <ClipboardList className="h-6 w-6" />
                            </span>
                            <p className="text-[13px] font-bold text-zinc-700 dark:text-zinc-200">
                              {surveys.length === 0
                                ? "No surveys yet"
                                : "No surveys found"}
                            </p>
                            <p className="mt-0.5 text-[12px] text-zinc-400 dark:text-zinc-500">
                              {surveys.length === 0
                                ? "Click New Survey to create one."
                                : "Try a different keyword."}
                            </p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
              <DataPagination
                page={Math.min(page, totalPages)}
                totalPages={totalPages}
                onPageChange={setPage}
                perPage={perPage}
                onPerPageChange={(n) => {
                  setPerPage(n);
                  setPage(1);
                }}
                totalItems={filtered.length}
                itemLabel="surveys"
              />
            </div>
          )}

          {/* Results panel: kalagayan ng alumni per survey */}
          {resultsFor && (
            <div className="overflow-hidden rounded-2xl border border-brand/10 bg-white dark:bg-zinc-900 shadow-sm">
              <div className="flex items-start justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800 bg-emerald-50/50 p-4">
                <div>
                  <h2 className="admin-section-title flex items-center gap-2 text-[14px] font-extrabold text-zinc-900 dark:text-zinc-100">
                    <BarChart3 className="h-4 w-4 text-brand dark:text-brand" />
                    Results: {resultsFor.title}
                  </h2>
                  <p className="text-[11.5px] text-zinc-500 dark:text-zinc-400">
                    {resultsLoading
                      ? "Loading..."
                      : `${results.length} response${results.length !== 1 ? "s" : ""}`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setResultsFor(null)}
                  className="rounded-lg p-1.5 text-zinc-400 dark:text-zinc-500 transition hover:bg-white dark:hover:bg-zinc-900 hover:text-zinc-700"
                  aria-label="Close results"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-4 p-4">
                {resultsLoading ? (
                  <p className="py-4 text-center text-[13px] text-zinc-500 dark:text-zinc-400">
                    Loading responses...
                  </p>
                ) : results.length === 0 ? (
                  <p className="py-4 text-center text-[13px] text-zinc-400 dark:text-zinc-500">
                    No responses yet.
                  </p>
                ) : (
                  (resultsFor.questions || []).map((q, qi) => (
                    <div
                      key={qi}
                      className="rounded-xl border border-zinc-100 dark:border-zinc-800 p-3.5"
                    >
                      <p className="text-[12.5px] font-bold text-zinc-800 dark:text-zinc-100">
                        Q{qi + 1}. {q.text}
                      </p>
                      <ul className="mt-2 space-y-1.5">
                        {results.map((r) => (
                          <li
                            key={r._id}
                            className="flex items-start justify-between gap-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/70 px-3 py-2"
                          >
                            <span className="text-[12px] text-zinc-700 dark:text-zinc-200">
                              {r.answers?.[qi] || "—"}
                            </span>
                            <span className="shrink-0 text-[10.5px] text-zinc-400 dark:text-zinc-500">
                              {r.email}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Responses tab */}
          {activeTab === "responses" && (
            <div className="admin-panel admin-data-table overflow-hidden">
              <div className="border-b border-zinc-100 dark:border-zinc-800 p-4">
                <h2 className="admin-section-title flex items-center gap-2 text-[14px] font-extrabold text-zinc-900 dark:text-zinc-100">
                  <BarChart3 className="h-4 w-4 text-brand dark:text-brand" />
                  Survey Responses
                </h2>
                <p className="mt-0.5 text-[12px] text-zinc-500 dark:text-zinc-400">
                  View all respondent answers per survey.
                </p>
              </div>
              {loading ? (
                <p className="p-6 text-[13px] text-zinc-500 dark:text-zinc-400">
                  Loading responses...
                </p>
              ) : surveys.length === 0 ? (
                <div className="p-10 text-center">
                  <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-brand dark:text-brand">
                    <ClipboardList className="h-6 w-6" />
                  </span>
                  <p className="text-[13px] font-bold text-zinc-700 dark:text-zinc-200">
                    No surveys yet
                  </p>
                  <p className="mt-0.5 text-[12px] text-zinc-400 dark:text-zinc-500">
                    Create a survey to see responses.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {surveys.map((survey) => (
                    <div key={survey._id} className="p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[13.5px] font-bold text-zinc-900 dark:text-zinc-100">
                            {survey.title}
                          </p>
                          <p className="text-[11.5px] text-zinc-500 dark:text-zinc-400">
                            {survey.questions?.length || 0} questions
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => openResults(survey)}
                          className="flex items-center gap-1.5 rounded-lg bg-brand/10 px-3 py-1.5 text-[11.5px] font-bold text-brand transition hover:bg-brand hover:text-white"
                        >
                          <BarChart3 className="h-3.5 w-3.5" />
                          View
                        </button>
                      </div>
                      {resultsFor?._id === survey._id && (
                        <div className="mt-3 space-y-3">
                          {resultsLoading ? (
                            <p className="py-2 text-center text-[12px] text-zinc-400">
                              Loading...
                            </p>
                          ) : results.length === 0 ? (
                            <p className="py-2 text-center text-[12px] text-zinc-400">
                              No responses yet.
                            </p>
                          ) : (
                            (survey.questions || []).map((q, qi) => (
                              <div
                                key={qi}
                                className="rounded-xl border border-zinc-100 dark:border-zinc-800 p-3"
                              >
                                <p className="text-[12px] font-bold text-zinc-800 dark:text-zinc-100">
                                  Q{qi + 1}. {q.text}
                                </p>
                                <ul className="mt-1.5 space-y-1">
                                  {results.map((r) => (
                                    <li
                                      key={r._id}
                                      className="flex items-center justify-between gap-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/70 px-2.5 py-1.5"
                                    >
                                      <span className="text-[11.5px] text-zinc-700 dark:text-zinc-200">
                                        {r.answers?.[qi] || "—"}
                                      </span>
                                      <span className="shrink-0 text-[10px] text-zinc-400 dark:text-zinc-500">
                                        {r.email}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Google Forms-style builder modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white dark:bg-zinc-900 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Form header — Google Forms style */}
            <div className="border-t-8 border-brand rounded-t-2xl bg-white dark:bg-zinc-900 p-5 sm:p-6">
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Survey title"
                className="w-full border-b-2 border-zinc-200 dark:border-zinc-700 bg-transparent pb-2 text-[18px] font-bold text-zinc-900 dark:text-zinc-100 outline-none transition focus:border-brand placeholder-zinc-400"
              />
              <textarea
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder="Form description"
                rows={2}
                className="mt-2 w-full resize-none border-b border-zinc-100 dark:border-zinc-800 bg-transparent pb-2 text-[13px] text-zinc-600 dark:text-zinc-300 outline-none transition focus:border-brand placeholder-zinc-400"
              />
            </div>

            {/* Questions */}
            <div className="space-y-4 p-5 sm:p-6">
              {form.questions.map((q, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 space-y-3">
                      <input
                        value={q.text}
                        onChange={(e) =>
                          setQuestion(i, { text: e.target.value })
                        }
                        placeholder={`Question ${i + 1}`}
                        className="w-full border-b border-zinc-200 dark:border-zinc-700 bg-transparent pb-1.5 text-[13.5px] font-medium text-zinc-800 dark:text-zinc-100 outline-none transition focus:border-brand placeholder-zinc-400"
                      />
                      {(q.type === "choice" ||
                        q.type === "dropdown" ||
                        q.type === "checkbox") && (
                        <div className="space-y-2">
                          {(q.options || []).map((opt, oi) => (
                            <div key={oi} className="flex items-center gap-2">
                              <span className="h-2 w-2 shrink-0 rounded-full border border-zinc-300 dark:border-zinc-600" />
                              <input
                                value={opt}
                                onChange={(e) =>
                                  setOption(i, oi, e.target.value)
                                }
                                placeholder={`Option ${oi + 1}`}
                                className="flex-1 bg-transparent text-[12.5px] text-zinc-700 dark:text-zinc-300 outline-none placeholder-zinc-400"
                              />
                              {(q.options || []).length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removeOption(i, oi)}
                                  className="shrink-0 rounded p-1 text-zinc-400 hover:text-red-600"
                                  aria-label="Remove option"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() => addOption(i)}
                            className="flex items-center gap-1.5 text-[11.5px] font-semibold text-brand hover:text-brand"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Add option
                          </button>
                        </div>
                      )}
                      {q.type === "rating" && (
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((n) => (
                            <span
                              key={n}
                              className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 dark:border-zinc-700 text-[12px] font-bold text-zinc-500 dark:text-zinc-400"
                            >
                              {n}
                            </span>
                          ))}
                        </div>
                      )}
                      {q.type === "text" && (
                        <p className="text-[12px] text-zinc-400 dark:text-zinc-500">
                          Short answer
                        </p>
                      )}
                      {q.type === "paragraph" && (
                        <p className="text-[12px] text-zinc-400 dark:text-zinc-500">
                          Long answer
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-center gap-1">
                      <select
                        value={q.type}
                        onChange={(e) =>
                          setQuestion(i, { type: e.target.value })
                        }
                        className="h-9 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2 text-[11.5px] font-medium text-zinc-600 dark:text-zinc-300 outline-none"
                      >
                        {QUESTION_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                      {form.questions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeQuestion(i)}
                          className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-red-50 hover:text-red-600"
                          aria-label="Remove question"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={addQuestion}
                className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-200 dark:border-zinc-700 py-3 text-[13px] font-bold text-zinc-500 dark:text-zinc-400 transition hover:border-brand hover:text-brand"
              >
                <Plus className="h-4 w-4" />
                Add question
              </button>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-zinc-100 dark:border-zinc-800 p-4">
              <label className="flex items-center gap-2 text-[12.5px] font-medium text-zinc-600 dark:text-zinc-300">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) =>
                    setForm({ ...form, isActive: e.target.checked })
                  }
                  className="h-4 w-4 accent-brand"
                />
                Visible to alumni
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="h-10 rounded-xl px-4 text-[13px] font-bold text-zinc-600 dark:text-zinc-300 transition hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="h-10 rounded-xl bg-brand px-5 text-[13px] font-bold text-white transition hover:bg-brand disabled:opacity-60"
                >
                  {saving
                    ? "Saving..."
                    : editing
                      ? "Save changes"
                      : "Create survey"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
