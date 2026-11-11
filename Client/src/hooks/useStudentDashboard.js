import { useCallback, useEffect, useRef, useState } from "react";
import api from "../utils/axios";
import { createPendingTask } from "../utils/pendingTask";

const sources = {
  jobs: "/jobs",
  referrals: "/referrals",
  events: "/events",
  jobApplications: "/jobs/applications/me",
  referralApplications: "/referrals/applications/me",
};
const initial = () =>
  Object.fromEntries(
    Object.keys(sources).map((key) => [
      key,
      { items: [], loading: true, error: "" },
    ]),
  );

export default function useStudentDashboard(accountId, refreshKey) {
  const [resources, setResources] = useState(initial);
  const generation = useRef(0);
  const pending = useRef(createPendingTask());
  const load = useCallback(() => pending.current.run(async () => {
    const request = ++generation.current;
    // Each source settles independently so one unavailable module cannot hide the others.
    await Promise.allSettled(
      Object.entries(sources).map(async ([key, path]) => {
        try {
          const response = await api.get(path);
          if (request === generation.current)
            setResources((previous) => ({
              ...previous,
              [key]: {
                items: response.data.data || [],
                loading: false,
                error: "",
              },
            }));
        } catch {
          if (request === generation.current)
            setResources((previous) => ({
              ...previous,
              [key]: {
                ...previous[key],
                loading: false,
                error: `Unable to load ${key === "jobApplications" ? "job applications" : key === "referralApplications" ? "referral applications" : key}. Please retry.`,
              },
            }));
        }
      }),
    );
  }), []);
  useEffect(() => {
    const gate = pending.current;
    // Clear the previous account's cards while its replacement is loading.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setResources(initial());
    void load();
    const reload = () => {
      if (!document.hidden) void load();
    };
    window.addEventListener("focus", reload);
    const timer = setInterval(reload, 60000);
    return () => {
      // Request sequence counter, not a DOM reference.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      ++generation.current;
      gate.clear();
      clearInterval(timer);
      window.removeEventListener("focus", reload);
    };
  }, [accountId, refreshKey, load]);
  const replace = (key, item, field = "_id") =>
    setResources((previous) => ({
      ...previous,
      [key]: {
        ...previous[key],
        items: [
          item,
          ...previous[key].items.filter(
            (existing) => String(existing[field]) !== String(item[field]),
          ),
        ],
      },
    }));
  return { resources, load, replace };
}
