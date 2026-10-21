import { useEffect, useState } from "react";

export function deadlinePassed(job, now = Date.now()) {
  return Boolean(job?.applicationDeadline && Date.parse(job.applicationDeadline) <= now);
}

export function deadlineLabel(value) {
  return new Date(value).toLocaleString("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) + " (PH time)";
}

export function deadlineInput(value) {
  if (!value) return "";
  return new Date(Date.parse(value) + 8 * 3600000).toISOString().slice(0, 16);
}

export default function useJobDeadline() {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const refresh = () => setNow(Date.now());
    const timer = setInterval(refresh, 1000);
    window.addEventListener("focus", refresh);
    return () => { clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, []);
  return now;
}
