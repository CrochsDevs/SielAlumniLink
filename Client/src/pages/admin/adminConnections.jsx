import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Search, Users, Eye, X } from "lucide-react";
import { useAuth } from "../../context/useAuth";
import AdminSidebar from "../../layout/sidebar/admin/adminSidebar";
import AdminTopbar from "../../layout/topbar/alumni/adminTopbar";
import DataPagination from "../../components/ui/data-pagination";
import { Avatar } from "../../components/search/SearchPerson";
import api from "../../utils/axios";
import { getSocket } from "../../realtime/socket";

const FILTERS = ["all", "students", "alumni"];
const profileUrl = (person) => `/${person.role}/profile/${person.profileId}`;

function useLiveConnectionPage(endpoint, params, setPage) {
  const [response, setResponse] = useState(null);
  const [revision, setRevision] = useState(0);
  const key = `${endpoint}?${new URLSearchParams(params)}`;
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      api
        .get(key, { signal: controller.signal })
        .then(({ data }) => {
          if (controller.signal.aborted) return;
          if (data.data.page > data.data.pages) {
            setPage(data.data.pages);
            return;
          }
          setResponse({ key, data: data.data });
        })
        .catch((error) => {
          if (!controller.signal.aborted)
            setResponse({
              key,
              error:
                error.response?.data?.message || "Unable to load connections.",
            });
        });
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [key, revision, setPage]);
  useEffect(() => {
    const socket = getSocket();
    const refresh = () => setRevision((value) => value + 1);
    const memberId = endpoint.split("/members/")[1];
    const changed = (event) => {
      if (
        !memberId ||
        !event?.authIds?.length ||
        event.authIds.includes(memberId)
      )
        refresh();
    };
    socket.on("connections:changed", changed);
    // Re-fetch on reconnect to recover changes made while this tab was offline.
    socket.on("connect", refresh);
    return () => {
      socket.off("connections:changed", changed);
      socket.off("connect", refresh);
    };
  }, [endpoint]);
  return {
    data: response?.key === key ? response.data : null,
    error: response?.key === key ? response.error : null,
    loading: response?.key !== key,
    refresh: () => setRevision((value) => value + 1),
  };
}

function ConnectionDetails({ member, onClose }) {
  const dialog = useRef(null);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const { data, loading, error, refresh } = useLiveConnectionPage(
    `/connections/members/${member._id}`,
    { page, limit: perPage },
    setPage,
  );
  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => element.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      aria-labelledby="connection-title"
      className="m-auto max-h-[85vh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-0 text-zinc-900 shadow-xl backdrop:bg-black/50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
    >
      <div className="p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="connection-title" className="text-lg font-bold">
              Connection details
            </h2>
            <p className="break-words text-sm text-zinc-500">{member.name}</p>
            <p className="break-all text-xs text-zinc-500">{member.email}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close connection details"
            className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {loading ? (
          <p role="status" className="py-8 text-center text-sm text-zinc-500">
            Loading connections…
          </p>
        ) : error ? (
          <div role="alert">
            <p>{error}</p>
            <button onClick={refresh} className="mt-2 text-emerald-700">
              Try again
            </button>
          </div>
        ) : !data?.items.length ? (
          <p className="py-8 text-center text-sm text-zinc-500">
            No connections yet.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {data.items.map((person) => (
              <li key={person._id} className="flex items-center gap-3 py-3">
                <Avatar person={person} />
                <span className="min-w-0 flex-1 break-words text-sm font-semibold">
                  {person.name}
                </span>
                {person.profileId ? (
                  <Link
                    to={profileUrl(person)}
                    className="shrink-0 rounded-full bg-[#009639] px-4 py-2 text-xs font-bold text-white"
                  >
                    View
                  </Link>
                ) : (
                  <span className="text-xs text-zinc-400">
                    Profile unavailable
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      {data && (
        <DataPagination
          page={page}
          totalPages={data.pages}
          onPageChange={setPage}
          perPage={perPage}
          onPerPageChange={(value) => {
            setPerPage(value);
            setPage(1);
          }}
          totalItems={data.total}
          itemLabel="connections"
        />
      )}
    </dialog>
  );
}

export default function AdminConnections() {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [selectedMember, setSelectedMember] = useState(null);
  const { data, loading, error, refresh } = useLiveConnectionPage(
    "/connections/members",
    { q: query, role: roleFilter, page, limit: perPage },
    setPage,
  );

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
          title="Connections"
          onMenuClick={() => setSidebarOpen(true)}
        />
        <main className="mx-auto max-w-6xl space-y-4 p-4 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                Community connections
              </h1>
              <p className="mt-1 text-sm text-zinc-500">
                Select a student or alumnus to see their connections.
              </p>
            </div>
          </div>
          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
            <div className="flex flex-col gap-3 border-b border-zinc-100 p-4 dark:border-zinc-800 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-zinc-400" />
                <input
                  value={query}
                  maxLength={120}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Search by name or email..."
                  aria-label="Search connections"
                  className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-9 pr-3 text-sm outline-none focus:border-[#009639] dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {FILTERS.map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    aria-pressed={roleFilter === filter}
                    onClick={() => {
                      setRoleFilter(filter);
                      setPage(1);
                    }}
                    className={`rounded-full px-4 py-2 text-xs font-bold capitalize ${roleFilter === filter ? "bg-[#009639] text-white" : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"}`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>
            {loading ? (
              <p role="status" className="p-6 text-sm text-zinc-500">
                Loading members…
              </p>
            ) : error ? (
              <div role="alert" className="p-6 text-sm text-zinc-500">
                <p>{error}</p>
                <button onClick={refresh} className="mt-2 text-emerald-700">
                  Try again
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[540px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-100 text-xs uppercase text-zinc-400 dark:border-zinc-800">
                      <th className="px-5 py-3">Member</th>
                      <th className="px-5 py-3">Role</th>
                      <th className="px-5 py-3">Connections</th>
                      <th className="px-5 py-3 text-right">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.items.map((member) => (
                      <tr
                        key={member._id}
                        className="border-b border-zinc-100 last:border-0 dark:border-zinc-800"
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <Avatar person={member} />
                            <div>
                              <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                                {member.name}
                              </p>
                              <p className="text-xs text-zinc-500">
                                {member.email}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 capitalize text-emerald-700 dark:text-emerald-400">
                          {member.role}
                        </td>
                        <td className="px-5 py-4 font-semibold text-zinc-700 dark:text-zinc-200">
                          {member.connectionsCount}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <button
                            type="button"
                            aria-label={`View connections of ${member.email}`}
                            onClick={() => setSelectedMember(member)}
                            className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                          >
                            <Eye className="h-4 w-4" />
                            Connections
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!data?.items.length && (
                  <div className="p-10 text-center text-sm text-zinc-500">
                    <Users className="mx-auto mb-3 h-8 w-8" />
                    No matching members found.
                  </div>
                )}
              </div>
            )}
            {data && (
              <DataPagination
                page={page}
                totalPages={data.pages}
                onPageChange={setPage}
                perPage={perPage}
                onPerPageChange={(value) => {
                  setPerPage(value);
                  setPage(1);
                }}
                totalItems={data.total}
                itemLabel="members"
              />
            )}
          </div>
        </main>
      </div>
      {selectedMember && (
        <ConnectionDetails
          key={selectedMember._id}
          member={selectedMember}
          onClose={() => setSelectedMember(null)}
        />
      )}
    </div>
  );
}
