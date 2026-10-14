import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../context/useAuth";
import api from "../utils/axios";

export default function useDevelopment() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false),
    generation = useRef(0);
  const load = useCallback(async () => {
    const request = ++generation.current;
    setLoading(true);
    try {
      const response = await api.get("/development/me");
      if (request === generation.current) {
        setData(response.data.data);
        setError("");
      }
    } catch (err) {
      if (request === generation.current)
        setError(err.response?.data?.message || "Unable to load your records.");
    } finally {
      if (request === generation.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) load();
    });
    const reload = () => {
      if (active && !pending.current) load();
    };
    window.addEventListener("focus", reload);
    return () => {
      active = false;
      window.removeEventListener("focus", reload);
      // Sequence counter, not a DOM ref.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      ++generation.current;
    };
  }, [load, user?.authId]);
  const mutate = async (method, path, payload) => {
    if (pending.current) return false;
    pending.current = true;
    setBusy(true);
    setError("");
    const request = ++generation.current;
    try {
      const response = await api[method](`/development/${path}`, payload);
      if (request === generation.current) setData(response.data.data);
      return true;
    } catch (err) {
      if (request === generation.current)
        setError(
          err.response?.data?.message ||
            "Unable to save your records. Please try again.",
        );
      return false;
    } finally {
      pending.current = false;
      setBusy(false);
      setLoading(false);
    }
  };
  return { data, loading, busy, error, load, mutate };
}
