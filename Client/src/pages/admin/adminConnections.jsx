import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { AdminTabs } from "../../components/admin/AdminUI";
import PageHeader from "../../components/ui/PageHeader";
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
import "./adminConnections.css";

const MEMBER_COLUMNS = [
  {
    accessorKey: "name",
    header: "Member",
    meta: { headerClassName: "px-5 py-3" },
  },
  {
    accessorKey: "role",
    header: "Role",
    meta: { headerClassName: "px-5 py-3" },
  },
  {
    accessorKey: "connectionsCount",
    header: "Connections",
    meta: { headerClassName: "px-5 py-3" },
  },
  {
    accessorKey: "details",
    header: "Details",
    meta: { headerClassName: "px-5 py-3 text-right" },
  },
];

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
            <button onClick={refresh} className="mt-2 text-brand">
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
                    className="shrink-0 rounded-full bg-brand px-4 py-2 text-xs font-bold text-white"
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

  const membersTable = useReactTable({
    data: data?.items || [],
    columns: MEMBER_COLUMNS,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => String(row._id),
    autoResetPageIndex: false,
    manualPagination: true,
    rowCount: data?.total || 0,
    pageCount: data?.pages || 1,
    state: { pagination: { pageIndex: page - 1, pageSize: perPage } },
    onPaginationChange: (updater) => {
      const next =
        typeof updater === "function"
          ? updater(membersTable.getState().pagination)
          : updater;
      setPage(next.pageIndex + 1);
      setPerPage(next.pageSize);
    },
  });
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
        <main className="workspace-page admin-connections mx-auto max-w-6xl space-y-4 p-4 sm:p-6">
          <PageHeader
            title="Connections"
            description="Select a student or alumnus to see their community connections."
          />
          <div className="admin-panel admin-data-table overflow-hidden">
            <div className="admin-toolbar">
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
                  className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-9 pr-3 text-sm outline-none focus:border-brand dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                />
              </div>
              <AdminTabs
                label="Filter connections by role"
                value={roleFilter}
                onChange={(value) => {
                  setRoleFilter(value);
                  setPage(1);
                }}
                items={FILTERS.map((filter) => ({
                  id: filter,
                  label: filter.charAt(0).toUpperCase() + filter.slice(1),
                }))}
              />
            </div>
            {loading ? (
              <p role="status" className="p-6 text-sm text-zinc-500">
                Loading members…
              </p>
            ) : error ? (
              <div role="alert" className="p-6 text-sm text-zinc-500">
                <p>{error}</p>
                <button onClick={refresh} className="mt-2 text-brand">
                  Try again
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[540px] text-left text-sm">
                  <thead>
                    {membersTable.getHeaderGroups().map((group) => (
                      <tr
                        key={group.id}
                        className={
                          "border-b border-zinc-100 text-xs uppercase text-zinc-400 dark:border-zinc-800"
                        }
                      >
                        {group.headers.map((header) => (
                          <th
                            key={header.id}
                            scope="col"
                            colSpan={header.colSpan}
                            className={
                              header.column.columnDef.meta?.headerClassName
                            }
                          >
                            {header.isPlaceholder
                              ? null
                              : flexRender(
                                  header.column.columnDef.header,
                                  header.getContext(),
                                )}
                          </th>
                        ))}
                      </tr>
                    ))}
                  </thead>
                  <tbody>
                    {membersTable
                      .getRowModel()
                      .rows.map(({ original: member }) => (
                        <tr
                          key={member._id}
                          className="border-b border-zinc-100 last:border-0 dark:border-zinc-800"
                        >
                          <td className="px-5 py-4">
                            <div className="flex min-w-0 items-center gap-3">
                              <Avatar person={member} />
                              <div className="min-w-0">
                                <p className="break-words font-semibold text-zinc-900 dark:text-zinc-100">
                                  {member.name}
                                </p>
                                <p className="break-all text-xs text-zinc-500">
                                  {member.email}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4 capitalize text-brand dark:text-brand">
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
                              className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-2 text-xs font-bold text-brand dark:bg-emerald-950 dark:text-brand"
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
                onPageChange={(value) => membersTable.setPageIndex(value - 1)}
                perPage={perPage}
                onPerPageChange={(pageSize) =>
                  membersTable.setPagination({ pageIndex: 0, pageSize })
                }
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
