import { useEffect, useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import { TracerQuarterContext } from "../../context/TracerQuarterContext";
import api from "../../utils/axios";
import { PageSkeleton } from "../ui/Skeleton";

const accessErrorMessage = (error) => {
  if ([401, 403].includes(error.response?.status))
    return "Your session could not be verified. Please sign in again.";
  if (!error.response)
    return "Cannot reach the server. Check your connection and try again.";
  return "The Tracer Study service is temporarily unavailable. Please try again.";
};

export default function QuarterlyTracerGate({ children }) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [result, setResult] = useState(null);
  const [revision, setRevision] = useState(0);
  const owner = user?.authId || user?._id;
  const enabled = user?.role === "alumni" && !user?.passwordSetupRequired &&
    !["/login", "/logout"].includes(pathname);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    let pending = false;
    let checkAgain = false;
    const controller = new AbortController();
    const check = async (force = false) => {
      if (pending) {
        if (force) checkAgain = true;
        return;
      }
      pending = true;
      try {
        let data;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const response = await api.get("/tracer/access", {
              signal: controller.signal,
              timeout: 8000,
            });
            data = response.data?.data;
            if (response.data?.success !== true ||
              typeof data?.updateRequired !== "boolean" ||
              typeof data?.quarter !== "string" ||
              !Number.isFinite(Date.parse(data?.nextUpdateAt))) {
              throw Object.assign(new Error("Invalid quarterly status"), { response });
            }
            break;
          } catch (error) {
            if (!active) return;
            const status = error.response?.status;
            const retryable = !status || status >= 500 || [408, 429].includes(status);
            if (!retryable || attempt === 2) throw error;
            await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
            if (!active) return;
          }
        }
        if (active) setResult({ owner, data });
      } catch (error) {
        if (active) setResult(previous => ({
          owner,
          data: previous?.owner === owner ? previous.data : null,
          error: accessErrorMessage(error),
          sessionExpired: [401, 403].includes(error.response?.status),
        }));
      } finally {
        pending = false;
        if (active && checkAgain) {
          checkAgain = false;
          void check();
        }
      }
    };
    const refresh = () => { void check(); };
    const afterSubmission = () => { void check(true); };
    void check();
    const timer = setInterval(refresh, 60000);
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    window.addEventListener("tracer-updated", afterSubmission);
    return () => {
      active = false;
      controller.abort();
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
      window.removeEventListener("tracer-updated", afterSubmission);
    };
  }, [enabled, owner, revision]);

  const retry = () => {
    setResult(previous => ({ ...previous, retrying: true }));
    setRevision(value => value + 1);
  };

  if (!enabled) return children;
  if (result?.owner !== owner || !result)
    return <PageSkeleton label="Checking your Tracer Study update" />;
  // A failed refresh must preserve a confirmed status and any form in progress.
  // A previous-quarter confirmation cannot unlock the new reporting period.
  const hasCurrentStatus = result.data && (
    result.data.updateRequired || Date.parse(result.data.nextUpdateAt) > Date.now()
  );
  if (result.sessionExpired || !hasCurrentStatus) return (
    <div role="alert" className="p-6">
      <p>{result.error || "Unable to check your Tracer Study update. Please try again."}</p>
      {result.sessionExpired ? (
        <Link to="/login" className="mt-3 inline-block rounded-lg bg-brand px-4 py-2 text-white">Sign in again</Link>
      ) : (
        <button disabled={result.retrying} className="mt-3 rounded-lg bg-brand px-4 py-2 text-white disabled:opacity-50" onClick={retry}>
          {result.retrying ? "Checking..." : "Retry"}
        </button>
      )}
      <Link to="/logout" className="ml-4 underline">Logout</Link>
    </div>
  );
  if (result.data?.updateRequired && pathname !== "/alumni/tracer")
    return <Navigate to="/alumni/tracer" replace />;
  return (
    <TracerQuarterContext.Provider key={`${owner}:${result.data?.quarter}`} value={result.data}>
      {result.error && (
        <div role="status" className="border-b border-zinc-300 bg-white p-4 text-sm text-zinc-900 lg:pl-72 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100">
          Tracer Study status could not be refreshed.{" "}
          <button disabled={result.retrying} className="underline disabled:opacity-50" onClick={retry}>
            {result.retrying ? "Checking..." : "Retry"}
          </button>
        </div>
      )}
      {result.data?.updateRequired && (
        <div role="status" className="border-b border-zinc-300 bg-white p-4 text-sm text-zinc-900 lg:pl-72 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100">
          <strong>Tracer Study update required: {result.data.quarter}.</strong>{" "}
          Review and submit your current details to continue. Submit even if nothing has changed.
        </div>
      )}
      {children}
    </TracerQuarterContext.Provider>
  );
}
