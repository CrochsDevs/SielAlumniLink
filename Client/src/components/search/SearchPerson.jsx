import { Link } from "react-router-dom";
import { profilePath } from "./searchLinks";

export function Highlight({ text = "", query = "" }) {
  const words = query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!words.length) return String(text);
  const pattern = new RegExp(`(${words.join("|")})`, "gi");
  return String(text)
    .split(pattern)
    .map((part, index) =>
      index % 2 ? (
        <mark
          key={index}
          className="rounded bg-emerald-100 text-emerald-950 dark:bg-emerald-900 dark:text-emerald-100"
        >
          {part}
        </mark>
      ) : (
        part
      ),
    );
}

export function Avatar({ person }) {
  return (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-emerald-100 font-bold text-brand">
      {person.profilePicture ? (
        <img
          src={person.profilePicture}
          alt=""
          className="h-full w-full object-cover"
        />
      ) : (
        (person.name || person.authorName || "?").charAt(0).toUpperCase()
      )}
    </span>
  );
}

export function PersonSummary({ person, query }) {
  return (
    <>
      <Avatar person={person} />
      <span className="min-w-0 flex-1">
        <span className="block break-words font-semibold text-zinc-900 dark:text-zinc-100">
          <Highlight text={person.name} query={query} />
        </span>
        <span className="block text-xs capitalize text-brand dark:text-brand">
          {person.role}
        </span>
        <span className="block text-xs text-zinc-500 dark:text-zinc-400">
          {[
            person.program,
            person.role === "alumni" && person.batch
              ? `Class of ${person.batch}`
              : "",
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
        {person.position && (
          <span className="block text-xs text-zinc-500 dark:text-zinc-400">
            {[person.position, person.company].filter(Boolean).join(" at ")}
          </span>
        )}
      </span>
    </>
  );
}

export default function SearchPerson({ person, query, onConnect, busy }) {
  const status = {
    accepted: "Connected",
    pending: "Pending",
    declined: "Declined",
  }[person.connectionStatus];
  return (
    <article className="rounded-2xl border border-brand/10 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <Link to={profilePath(person)} className="flex items-start gap-3">
        <PersonSummary person={person} query={query} />
      </Link>
      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
        <Link
          to={profilePath(person)}
          className="rounded-full border border-brand px-4 py-1.5 font-semibold text-brand dark:text-brand"
        >
          View Profile
        </Link>
        {status ? (
          <span className="text-zinc-500">{status}</span>
        ) : (
          person.canConnect && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onConnect(person)}
              className="rounded-full bg-brand px-4 py-1.5 font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Sending…" : "Connect"}
            </button>
          )
        )}
      </div>
    </article>
  );
}
