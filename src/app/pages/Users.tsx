import { useState, useMemo, useEffect } from "react";
import {
  Users, Search, Plus, Shield, Lock, Eye, EyeOff,
  Trash2, X, Edit2, Download, CheckCircle, XCircle, Clock,
} from "lucide-react";
import { useAuth, ROLE_META, UserRole } from "../context/AuthContext";
import { AccessDenied } from "../components/RoleGuard";
import Pagination from "../components/Pagination";
import {
  createUser,
  deleteUser,
  getApiErrorMessage,
  getUsers,
  updateUser,
  type UserDto,
} from "../services/userService";
import { exportUsers, safeExport } from "../services/exportService";

// ─── Types ────────────────────────────────────────────────────────────────────
type UserStatus = "Active" | "Inactive";
type ModalType  = "add" | "edit" | "view" | "delete" | null;

type SystemUser = {
  id:         string;
  name:       string;
  email:      string;
  role:       UserRole;
  status:     UserStatus;
  lastLogin:  string;
  createdAt:  string;
};

type UserForm = {
  name:       string;
  email:      string;
  role:       UserRole;
  status:     UserStatus;
  password:   string;
};

// ─── Constants ────────────────────────────────────────────────────────────────
type PermissionRow = { module: string; access: string };

const PERMISSION_SUMMARY: Record<UserRole, PermissionRow[]> = {
  Admin: [
    { module: "Dashboard",    access: "Full access"  },
    { module: "Properties",   access: "Full access"  },
    { module: "Tax Calc",     access: "Full access"  },
    { module: "Payments",     access: "Full access"  },
    { module: "Compliance",   access: "Full access"  },
    { module: "Filing",       access: "Full access"  },
    { module: "Reporting",    access: "Full access"  },
    { module: "Audit Logs",   access: "Full access"  },
    { module: "User Mgmt",    access: "Full access"  },
  ],
  Accountant: [
    { module: "Dashboard",    access: "View"         },
    { module: "Properties",   access: "View"         },
    { module: "Tax Calc",     access: "View"         },
    { module: "Payments",     access: "Full access"  },
    { module: "Compliance",   access: "View & Update"},
    { module: "Filing",       access: "Full access"  },
    { module: "Reporting",    access: "Full access"  },
    { module: "Audit Logs",   access: "No access"    },
    { module: "User Mgmt",    access: "No access"    },
  ],
  Staff: [
    { module: "Dashboard",    access: "View"         },
    { module: "Properties",   access: "View, Create & Edit"},
    { module: "Tax Calc",     access: "View & Assess"},
    { module: "Payments",     access: "No access"    },
    { module: "Compliance",   access: "No access"    },
    { module: "Filing",       access: "View & Upload"},
    { module: "Reporting",    access: "No access"    },
    { module: "Audit Logs",   access: "No access"    },
    { module: "User Mgmt",    access: "No access"    },
  ],
  Auditor: [
    { module: "Dashboard",    access: "View"         },
    { module: "Properties",   access: "View"         },
    { module: "Tax Calc",     access: "View"         },
    { module: "Payments",     access: "View"         },
    { module: "Compliance",   access: "View"         },
    { module: "Filing",       access: "No access"    },
    { module: "Reporting",    access: "View & Export"},
    { module: "Audit Logs",   access: "View"         },
    { module: "User Mgmt",    access: "No access"    },
  ],
};

const USER_ROLES: UserRole[] = ["Admin", "Accountant", "Staff", "Auditor"];
const INITIAL_USERS: SystemUser[] = [];

const BLANK_FORM: UserForm = {
  name: "", email: "", role: "Staff", status: "Active", password: "",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function initials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

function toUserStatus(isActive: boolean): UserStatus {
  return isActive ? "Active" : "Inactive";
}

function formatCreatedAt(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function normalizeRole(role: string): UserRole {
  return USER_ROLES.find((candidate) => candidate.toLowerCase() === role.trim().toLowerCase()) ?? "Staff";
}

function mapUser(dto: UserDto): SystemUser {
  const role = normalizeRole(dto.role);

  return {
    id: dto.id,
    name: dto.fullName,
    email: dto.email,
    role,
    status: toUserStatus(dto.isActive),
    lastLogin: "Never",
    createdAt: formatCreatedAt(dto.createdAtUtc),
  };
}

function sortUsers(users: SystemUser[]) {
  return [...users].sort((a, b) => a.name.localeCompare(b.name));
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function UsersPage() {
  const { can, user: authUser } = useAuth();

  const isAdmin = authUser?.role === "Admin";
  const canViewUsers = can("users.view");
  const canManageUsers = can("users.manage");

  const [users,       setUsers]     = useState<SystemUser[]>(INITIAL_USERS);
  const [loadingUsers,setLoadingUsers] = useState(false);
  const [saving,      setSaving]    = useState(false);
  const [pageError,   setPageError] = useState("");
  const [formError,   setFormError] = useState("");
  const [modal,       setModal]     = useState<ModalType>(null);
  const [selected,    setSelected]  = useState<SystemUser | null>(null);
  const [form,        setForm]      = useState<UserForm>(BLANK_FORM);
  const [showPw,      setShowPw]    = useState(false);
  const [search,      setSearch]    = useState("");
  const [roleFilter,  setRoleFilter]= useState<string>("All Roles");
  const [statusFilter,setStatusFilter] = useState<string>("All");
  const [currentPage, setCurrentPage] = useState(1);
  const perPage = 10;

  useEffect(() => {
    if (!canViewUsers) {
      return;
    }

    let ignore = false;

    async function loadUsers() {
      setLoadingUsers(true);
      setPageError("");

      try {
        const result = await getUsers();

        if (!ignore) {
          setUsers(sortUsers(result.map(mapUser)));
        }
      } catch (error) {
        if (!ignore) {
          setPageError(getApiErrorMessage(error));
        }
      } finally {
        if (!ignore) {
          setLoadingUsers(false);
        }
      }
    }

    void loadUsers();

    return () => {
      ignore = true;
    };
  }, [canViewUsers]);

  // ── Derived filtered list ─────────────────────────────────────────────────
  const filtered = useMemo(() =>
    users.filter((u) => {
      const q = search.toLowerCase();
      const mSearch = !q ||
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.id.toLowerCase().includes(q);
      const mRole   = roleFilter   === "All Roles" || u.role   === roleFilter;
      const mStatus = statusFilter === "All"        || u.status === statusFilter;
      return mSearch && mRole && mStatus;
    }),
  [users, search, roleFilter, statusFilter]);

  const totalPages = Math.ceil(filtered.length / perPage);
  const paginated  = filtered.slice((currentPage - 1) * perPage, currentPage * perPage);

  if (!canViewUsers) {
    return <AccessDenied requiredRole="System Administrator" />;
  }

  // ── Counts ────────────────────────────────────────────────────────────────
  const counts = {
    total:     users.length,
    active:    users.filter((u) => u.status === "Active").length,
    inactive:  users.filter((u) => u.status === "Inactive").length,
    admins:    users.filter((u) => u.role === "Admin").length,
  };

  // ── Handlers ──────────────────────────────────────────────────────────────
  function openAdd() {
    setForm(BLANK_FORM);
    setFormError("");
    setShowPw(false);
    setModal("add");
  }

  function openEdit(u: SystemUser) {
    setSelected(u);
    setForm({ name: u.name, email: u.email, role: u.role, status: u.status, password: "" });
    setFormError("");
    setShowPw(false);
    setModal("edit");
  }

  function openView(u: SystemUser) {
    setSelected(u);
    setModal("view");
  }

  function openDelete(u: SystemUser) {
    setSelected(u);
    setFormError("");
    setModal("delete");
  }

  function closeModal() {
    setModal(null);
    setSelected(null);
    setFormError("");
  }

  async function handleSave() {
    if (!form.name.trim() || !form.email.trim()) return;

    if (!canManageUsers) {
      setFormError("Only administrators can manage users.");
      return;
    }

    if (modal === "add" && form.password.trim().length < 8) {
      setFormError("Temporary password must be at least 8 characters.");
      return;
    }

    if (modal === "edit" && form.password.trim() && form.password.trim().length < 8) {
      setFormError("New password must be at least 8 characters.");
      return;
    }

    setSaving(true);
    setFormError("");

    try {
      const email = form.email.trim();

      if (modal === "add") {
        const created = await createUser({
          username: email,
          email,
          password: form.password,
          fullName: form.name.trim(),
          role: form.role,
          isActive: form.status === "Active",
        });

        setUsers((prev) => sortUsers([...prev, mapUser(created)]));
      } else if (modal === "edit" && selected) {
        const password = form.password.trim();
        const updated = await updateUser(selected.id, {
          username: email,
          email,
          fullName: form.name.trim(),
          role: form.role,
          isActive: form.status === "Active",
          ...(password ? { password } : {}),
        });

        setUsers((prev) => sortUsers(prev.map((u) => u.id === selected.id ? mapUser(updated) : u)));
      }

      closeModal();
    } catch (error) {
      setFormError(getApiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!selected) return;

    if (!canManageUsers) {
      setFormError("Only administrators can remove users.");
      return;
    }

    setSaving(true);
    setFormError("");

    try {
      await deleteUser(selected.id);
      setUsers((prev) => prev.filter((u) => u.id !== selected.id));
      closeModal();
    } catch (error) {
      setFormError(getApiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-7xl mx-auto">

      {/* ── Page Header ────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-slate-900 tracking-tight">User Management</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage system accounts, roles, and access permissions for TaxSync LGU.
            {!isAdmin && <span className="ml-1 text-amber-600 font-medium">Read-only view for your role.</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              try {
                await safeExport(
                  () => exportUsers(),
                  () => ({
                    data: users.map(u => ({
                      id: u.id,
                      name: u.name,
                      email: u.email,
                      role: u.role,
                      status: u.status,
                      lastLogin: u.lastLogin,
                      createdAt: u.createdAt,
                    })),
                    fileName: 'users.csv',
                  }),
                );
              } catch (err: any) {
                console.error('Export users failed', err)
                const message = err?.message || 'Unable to export users. Please try again or contact admin.'
                alert(message)
              }
            }}
            className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 shadow-sm flex items-center gap-2"
          >
            <Download className="h-4 w-4" /> Export
          </button>
          {canManageUsers && (
            <button
              onClick={openAdd}
              className="px-4 py-2 text-white rounded-lg text-sm font-medium shadow-sm flex items-center gap-2 transition-colors"
              style={{ backgroundColor: "#0d2137" }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#1e3a5f")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#0d2137")}
            >
              <Plus className="h-4 w-4" /> Add User
            </button>
          )}
        </div>
      </div>

      {/* ── Read-only banner for non-Admins ────────────────────────────────── */}
      {!canManageUsers && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-amber-200 bg-amber-50">
          <Lock className="h-4 w-4 text-amber-600 flex-shrink-0" />
          <p className="text-sm font-medium text-amber-700">
            Read-Only Access — Only Administrators can create, edit, or remove users.
          </p>
          <span className="ml-auto px-2.5 py-1 rounded-full text-xs font-bold border bg-amber-100 text-amber-700 border-amber-200 flex-shrink-0">
            {authUser?.role}
          </span>
        </div>
      )}

      {pageError && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-red-200 bg-red-50">
          <XCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-700">Unable to load users</p>
            <p className="text-xs text-red-600 mt-0.5">{pageError}</p>
          </div>
        </div>
      )}

      {/* ── KPI Cards ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Users",    value: counts.total,    icon: Users,        color: "border-l-blue-500",   bg: "bg-blue-50 text-blue-600"   },
          { label: "Active",         value: counts.active,   icon: CheckCircle,  color: "border-l-emerald-500",bg: "bg-emerald-50 text-emerald-600"},
          { label: "Inactive",       value: counts.inactive, icon: XCircle,      color: "border-l-slate-400",  bg: "bg-slate-50 text-slate-500" },
          { label: "Administrators", value: counts.admins,   icon: Shield,       color: "border-l-purple-500", bg: "bg-purple-50 text-purple-600"},
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className={`bg-white p-4 rounded-xl border border-slate-200 border-l-4 shadow-sm flex items-center justify-between gap-3 ${color}`}>
            <div className="flex items-center gap-2">
              <div className={`p-2 rounded-lg flex-shrink-0 ${bg}`}><Icon className="h-4 w-4" /></div>
              <p className="text-xs text-slate-500">{label}</p>
            </div>
            <p className="text-2xl font-bold text-slate-900">{value}</p>
          </div>
        ))}
      </div>

      {/* ── Main Table Card ────────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden">

        {/* Filters */}
        <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-48 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, email, or ID..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              className="pl-8 pr-3 py-2 w-full border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => { setRoleFilter(e.target.value); setCurrentPage(1); }}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white text-slate-600 focus:outline-none"
          >
            <option>All Roles</option>
            {(["Admin","Accountant","Staff","Auditor"] as UserRole[]).map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white text-slate-600 focus:outline-none"
          >
            <option value="All">All Status</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
          <span className="ml-auto text-xs text-slate-400">{filtered.length} user{filtered.length !== 1 ? "s" : ""}</span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-medium border-b border-slate-200 tracking-wider">
              <tr>
                <th className="px-5 py-3.5">User</th>
                <th className="px-5 py-3.5">Role</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Last Login</th>
                <th className="px-5 py-3.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {paginated.map((u) => {
                const meta = ROLE_META[u.role];
                return (
                  <tr key={u.id} className="hover:bg-slate-50 transition-colors group">
                    {/* User */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${meta.badgeClass}`}>
                          {initials(u.name)}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900">{u.name}</p>
                          <p className="text-xs text-slate-400">{u.email}</p>
                          <p className="text-[10px] text-slate-300 font-mono">{u.id}</p>
                        </div>
                      </div>
                    </td>

                    {/* Role */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5">
                        <Shield className={`h-3.5 w-3.5 flex-shrink-0 ${meta.textClass}`} />
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${meta.badgeClass}`}>
                          {meta.label}
                        </span>
                      </div>
                      <div className={`flex gap-0.5 mt-1.5 ${meta.textClass}`}>
                        {[1,2,3,4].map((i) => (
                          <div key={i} className={`h-1 w-5 rounded-full ${i <= meta.accessLevel ? "bg-current opacity-50" : "bg-current opacity-10"}`} />
                        ))}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                        u.status === "Active"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-slate-100 text-slate-500 border-slate-200"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${u.status === "Active" ? "bg-emerald-500" : "bg-slate-400"}`} />
                        {u.status}
                      </span>
                    </td>

                    {/* Last Login */}
                    <td className="px-5 py-4 text-xs text-slate-500">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3 w-3 text-slate-300 flex-shrink-0" />
                        {u.lastLogin}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => openView(u)}
                          title="View profile"
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        {canManageUsers && (
                          <>
                            <button
                              onClick={() => openEdit(u)}
                              title="Edit user"
                              className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => openDelete(u)}
                              title="Remove user"
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {loadingUsers && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-slate-400 text-sm">
                    Loading users from database...
                  </td>
                </tr>
              )}
              {!loadingUsers && paginated.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-slate-400 text-sm">
                    No users match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer / Pagination */}
        <div className="p-4 border-t border-slate-200 bg-slate-50/50 flex items-center justify-between text-xs text-slate-400 flex-wrap gap-2">
          <span className="flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5" />
            Showing {filtered.length === 0 ? 0 : Math.min((currentPage - 1) * perPage + 1, filtered.length)}–{Math.min(currentPage * perPage, filtered.length)} of {filtered.length} user(s)
          </span>
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
          <span>TaxSync LGU · RBAC v3.1 · {canManageUsers ? "Full Admin Access" : "Read-Only"}</span>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          MODALS
      ══════════════════════════════════════════════════════════════════════ */}

      {/* Add / Edit Modal */}
      {(modal === "add" || modal === "edit") && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <h3 className="text-slate-900">{modal === "add" ? "Add New User" : "Edit User"}</h3>
              <button onClick={closeModal} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {formError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {formError}
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm text-slate-700 mb-1.5">Full Name <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    placeholder="Enter full name"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm text-slate-700 mb-1.5">Email Address <span className="text-red-500">*</span></label>
                  <input
                    type="email"
                    placeholder="user@taxsync.gov.ph"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-700 mb-1.5">Role <span className="text-red-500">*</span></label>
                  <select
                    value={form.role}
                    onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as UserRole }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                  >
                    {(["Admin","Accountant","Staff","Auditor"] as UserRole[]).map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-700 mb-1.5">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as UserStatus }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                  >
                    <option>Active</option>
                    <option>Inactive</option>
                  </select>
                </div>
                {(modal === "add" || modal === "edit") && (
                  <div className="col-span-2">
                    <label className="block text-sm text-slate-700 mb-1.5">
                      <Lock className="h-3.5 w-3.5 inline mr-1" />
                      {modal === "add" ? "Temporary Password" : "New Password"} {modal === "add" && <span className="text-red-500">*</span>}
                    </label>
                    <div className="relative">
                      <input
                        type={showPw ? "text" : "password"}
                        placeholder={modal === "add" ? "Set initial password" : "Leave blank to keep current password"}
                        value={form.password}
                        onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                        className="w-full px-3 py-2 pr-10 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw(!showPw)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Role permission preview */}
              <div className={`p-3 rounded-lg border ${ROLE_META[form.role].bgClass}`}>
                <p className={`text-xs font-bold mb-2 ${ROLE_META[form.role].textClass}`}>
                  <Shield className="h-3 w-3 inline mr-1" /> {ROLE_META[form.role].label} Permissions Preview:
                </p>
                <div className="grid grid-cols-2 gap-1">
                  {PERMISSION_SUMMARY[form.role].slice(0, 4).map(({ module, access }) => (
                    <div key={module} className="text-xs flex items-center gap-1">
                      {access === "No access"
                        ? <Lock className="h-2.5 w-2.5 text-slate-400" />
                        : <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${ROLE_META[form.role].textClass} bg-current opacity-60`} />
                      }
                      <span className={access === "No access" ? "text-slate-400" : ROLE_META[form.role].textClass}>
                        {module}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
              <button
                onClick={closeModal}
                disabled={saving}
                className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.name.trim() || !form.email.trim() || (modal === "add" && !form.password.trim())}
                className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "Saving..." : modal === "add" ? "Create User" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {modal === "view" && selected && (() => {
        const meta = ROLE_META[selected.role];
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
              <div className={`p-6 text-center border-b border-slate-100 ${meta.bgClass}`}>
                <div className={`w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-3 ${meta.badgeClass}`}>
                  {initials(selected.name)}
                </div>
                <h3 className="text-slate-900">{selected.name}</h3>
                <p className="text-sm text-slate-500 mt-0.5">{selected.email}</p>
                <span className={`inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full text-xs font-bold border ${meta.badgeClass}`}>
                  <Shield className="h-3 w-3" /> {meta.label} · Level {meta.accessLevel}
                </span>
              </div>
              <div className="p-5 space-y-2">
                {([
                  ["User ID",    selected.id],
                  ["Status",     selected.status],
                  ["Last Login", selected.lastLogin],
                  ["Created",    selected.createdAt],
                ] as [string, string][]).map(([l, v]) => (
                  <div key={l} className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-xs text-slate-500">{l}</span>
                    <span className="text-sm font-medium text-slate-800">{v}</span>
                  </div>
                ))}
                <div className="pt-3">
                  <p className="text-xs text-slate-500 mb-2 font-medium">Module Access:</p>
                  <div className="grid grid-cols-1 gap-1.5 max-h-48 overflow-y-auto">
                    {PERMISSION_SUMMARY[selected.role].map(({ module, access }) => (
                      <div
                        key={module}
                        className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs ${
                          access === "No access" ? "bg-slate-50" : meta.bgClass
                        }`}
                      >
                        <span className={access === "No access" ? "text-slate-400" : "text-slate-700 font-medium"}>
                          {module}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                          access === "No access" ? "bg-slate-200 text-slate-400" : meta.badgeClass
                        }`}>
                          {access === "No access" ? "🔒 No access" : access}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex gap-3 px-6 pb-6">
                <button onClick={closeModal} className="flex-1 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
                  Close
                </button>
                {canManageUsers && (
                  <button onClick={() => openEdit(selected)} className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                    Edit User
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Delete Modal */}
      {modal === "delete" && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-slate-900 mb-2">Remove User?</h3>
              <p className="text-sm text-slate-500 mb-3">
                This will permanently remove{" "}
                <span className="font-medium text-slate-900">{selected.name}</span> and revoke all access.
              </p>
              <p className="text-xs text-red-500">This action cannot be undone.</p>
              {formError && (
                <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{formError}</p>
              )}
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button disabled={saving} onClick={closeModal} className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                Cancel
              </button>
              <button disabled={saving} onClick={handleDelete} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50">
                {saving ? "Removing..." : "Remove User"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
