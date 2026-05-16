import { useEffect, useMemo, useState } from "react";
import {
  Search, History, Download, Calendar, Eye, ChevronRight,
  Shield, Lock, AlertTriangle, FileText, Filter, Users,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { AccessDenied, ReadOnlyBanner } from "../components/RoleGuard";
import Pagination from "../components/Pagination";
import { getApiErrorMessage, getAuditLogs, type AuditLogDto } from "../services/auditService";
import { exportAuditLogs, exportAuditEntry, safeExport } from "../services/exportService";

type ActionType   = "Property Registered" | "Payment Recorded" | "Tax Rate Updated" | "User Role Change" | "Report Generated" | "Document Uploaded" | "Document Deleted" | "Login" | "Compliance Updated" | "Property Edited" | "System Event";
type RoleType     = "Admin" | "Accountant" | "Staff" | "Auditor" | "System";
type SeverityType = "info" | "warning" | "critical";

type AuditLog = {
  id: string; user: string; role: RoleType; action: ActionType;
  details: string; timestamp: string; ip: string; severity: SeverityType;
};

const ACTION_COLORS: Record<ActionType, string> = {
  "Property Registered": "bg-blue-100 text-blue-700",
  "Payment Recorded":    "bg-emerald-100 text-emerald-700",
  "Tax Rate Updated":    "bg-amber-100 text-amber-700",
  "User Role Change":    "bg-purple-100 text-purple-700",
  "Report Generated":    "bg-indigo-100 text-indigo-700",
  "Document Uploaded":   "bg-sky-100 text-sky-700",
  "Document Deleted":    "bg-red-100 text-red-700",
  "Login":               "bg-slate-100 text-slate-700",
  "Compliance Updated":  "bg-teal-100 text-teal-700",
  "Property Edited":     "bg-orange-100 text-orange-700",
  "System Event":        "bg-slate-100 text-slate-700",
};

const ROLE_COLORS: Record<RoleType, string> = {
  Admin:      "bg-purple-100 text-purple-700",
  Accountant: "bg-blue-100 text-blue-700",
  Staff:      "bg-slate-100 text-slate-600",
  System:     "bg-slate-200 text-slate-600",
  Auditor:    "bg-amber-100 text-amber-700",
};

const SEVERITY_CFG: Record<SeverityType, { dot: string; label: string; rowBg: string }> = {
  info:     { dot: "bg-blue-400",              label: "Info",     rowBg: "" },
  warning:  { dot: "bg-amber-400",             label: "Warning",  rowBg: "bg-amber-50/30" },
  critical: { dot: "bg-red-500 animate-pulse", label: "Critical", rowBg: "bg-red-50/40"   },
};

const ALL_ACTIONS: ActionType[] = ["Property Registered","Payment Recorded","Tax Rate Updated","User Role Change","Report Generated","Document Uploaded","Document Deleted","Login","Compliance Updated","Property Edited","System Event"];
const ALL_ROLES:   RoleType[]   = ["Admin","Accountant","Staff","System","Auditor"];
const PER_PAGE = 8;

function normalizeAction(value: string): ActionType {
  const normalized = value.trim().toLowerCase();

  switch (normalized) {
    case "propertyregistered":
    case "propertycreated":
      return "Property Registered";
    case "propertyupdated":
      return "Property Edited";
    case "paymentrecorded":
    case "paymentcreated":
      return "Payment Recorded";
    case "taxrateupdated":
      return "Tax Rate Updated";
    case "userrolechange":
    case "userrolechanged":
      return "User Role Change";
    case "reportgenerated":
      return "Report Generated";
    case "documentuploaded":
      return "Document Uploaded";
    case "documentdeleted":
      return "Document Deleted";
    case "login":
      return "Login";
    case "complianceupdated":
      return "Compliance Updated";
    default:
      return "System Event";
  }
}

function normalizeRole(value?: string | null): RoleType {
  const normalized = value?.trim().toLowerCase();

  switch (normalized) {
    case "admin":
      return "Admin";
    case "accountant":
      return "Accountant";
    case "staff":
      return "Staff";
    case "auditor":
      return "Auditor";
    default:
      return "System";
  }
}

function formatTimestamp(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function inferSeverity(log: AuditLogDto, action: ActionType): SeverityType {
  if (!log.succeeded) {
    return "critical";
  }

  if (action === "Document Deleted" || action === "User Role Change") {
    return "warning";
  }

  return "info";
}

function mapAuditLog(log: AuditLogDto): AuditLog {
  const action = normalizeAction(log.action);

  return {
    id: `LOG-${String(log.id).padStart(4, "0")}`,
    user: log.performedByUsername?.trim() || "System",
    role: normalizeRole(log.userRole),
    action,
    details: log.description?.trim() || `${log.entityName ?? "System"}${log.entityId ? ` ${log.entityId}` : ""}`.trim() || "No additional details provided.",
    timestamp: formatTimestamp(log.timestamp || log.createdAtUtc),
    ip: log.ipAddress?.trim() || "N/A",
    severity: inferSeverity(log, action),
  };
}

export default function Audit() {
  const { can, user } = useAuth();
  const canView = can("audit.view");

  const [search,     setSearch]    = useState("");
  const [actFilter,  setActFilter] = useState("All Actions");
  const [roleFilter, setRoleFilter]= useState("All Roles");
  const [sevFilter,  setSevFilter] = useState("All");
  const [view,       setView]      = useState<"table" | "timeline">("table");
  const [page,       setPage]      = useState(1);
  const [logs,       setLogs]      = useState<AuditLog[]>([]);
  const [loading,    setLoading]   = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selected,   setSelected]  = useState<AuditLog | null>(null);

  useEffect(() => {
    if (!canView) {
      return;
    }

    let ignore = false;

    async function loadLogs() {
      setLoading(true);
      setErrorMessage(null);

      try {
        const result = await getAuditLogs();

        if (!ignore) {
          setLogs(result.map(mapAuditLog));
        }
      } catch (error) {
        if (!ignore) {
          setErrorMessage(getApiErrorMessage(error));
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    void loadLogs();

    return () => {
      ignore = true;
    };
  }, [canView]);

  const filtered = useMemo(() =>
    logs.filter((l) => {
      const mSearch   = l.user.toLowerCase().includes(search.toLowerCase()) || l.action.toLowerCase().includes(search.toLowerCase()) || l.details.toLowerCase().includes(search.toLowerCase()) || l.id.toLowerCase().includes(search.toLowerCase());
      const mAction   = actFilter  === "All Actions" || l.action   === actFilter;
      const mRole     = roleFilter === "All Roles"   || l.role     === roleFilter;
      const mSeverity = sevFilter  === "All"         || l.severity === sevFilter;
      return mSearch && mAction && mRole && mSeverity;
    }), [search, actFilter, roleFilter, sevFilter, logs]
  );

  if (!canView) {
    return <AccessDenied requiredRole="Admin or Auditor" />;
  }

  const isAuditor = user?.role === "Auditor";

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated  = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const counts = {
    info:     logs.filter(l => l.severity === "info").length,
    warning:  logs.filter(l => l.severity === "warning").length,
    critical: logs.filter(l => l.severity === "critical").length,
  };

  const criticalLog = logs.find((log) => log.severity === "critical") ?? null;

  // Auditor-specific KPI counts
  const auditStats = {
    totalLogs:     logs.length,
    criticalCount: counts.critical,
    warningCount:  counts.warning,
    usersTracked:  new Set(logs.map(l => l.user)).size,
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-slate-900 tracking-tight">Audit Support & Activity Logs</h1>
          <p className="text-sm text-slate-500 mt-1">
            Immutable record of all system activities, data modifications, login events, and access logs.
            {isAuditor && <span className="ml-1 text-amber-600 font-medium">Auditor read-only view.</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-white border border-slate-200 rounded-lg p-0.5">
            <button onClick={() => setView("table")}    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${view === "table"    ? "text-white" : "text-slate-600 hover:text-slate-800"}`} style={view === "table"    ? { backgroundColor: "#0d2137" } : {}}>Table</button>
            <button onClick={() => setView("timeline")} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${view === "timeline" ? "text-white" : "text-slate-600 hover:text-slate-800"}`} style={view === "timeline" ? { backgroundColor: "#0d2137" } : {}}>Timeline</button>
          </div>
          <button
            onClick={async () => {
              try {
                await safeExport(
                  () => exportAuditLogs(),
                  () => ({ data: logs.map(l => ({ id: l.id, user: l.user, role: l.role, action: l.action, details: l.details, timestamp: l.timestamp, ip: l.ip, severity: l.severity })), fileName: 'audit-logs.csv' }),
                );
              } catch (err: any) {
                console.error('Export audit logs failed', err)
                const message = err?.message || 'Unable to export audit trail. Please try again later.'
                alert(message)
              }
            }}
            className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 shadow-sm flex items-center gap-2">
            <Download className="h-4 w-4" /> Export Trail
          </button>
        </div>
      </div>

      <ReadOnlyBanner message={`Read-Only Access — Audit logs are immutable records per R.A. 7160. ${user?.role} accounts can view, filter, and export logs but cannot modify any entries.`} />

      {errorMessage && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
          <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-800">Unable to load audit logs</p>
            <p className="text-xs text-red-600 mt-0.5">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* ── Auditor KPI cards ─────────────────────────────────────────────── */}
      {isAuditor && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Log Entries",  value: auditStats.totalLogs,     icon: FileText,       color: "border-l-blue-500",    bg: "bg-blue-50 text-blue-600"        },
            { label: "Critical Events",    value: auditStats.criticalCount, icon: AlertTriangle,  color: "border-l-red-500",     bg: "bg-red-50 text-red-600"          },
            { label: "Warning Events",     value: auditStats.warningCount,  icon: Shield,         color: "border-l-amber-500",   bg: "bg-amber-50 text-amber-600"      },
            { label: "Users Tracked",      value: auditStats.usersTracked,  icon: Users,          color: "border-l-purple-500",  bg: "bg-purple-50 text-purple-600"    },
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
      )}

      {/* Non-auditor severity cards (original) */}
      {!isAuditor && (
        <div className="grid grid-cols-3 gap-4">
          {(["info","warning","critical"] as SeverityType[]).map((s) => (
            <button key={s} onClick={() => setSevFilter(sevFilter === s ? "All" : s)}
              className={`bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between gap-3 text-left hover:shadow-md transition-all ${sevFilter === s ? "ring-2 ring-blue-500 ring-offset-1" : ""}`}>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full flex-shrink-0 ${SEVERITY_CFG[s].dot}`} />
                <p className="text-xs text-slate-500 uppercase tracking-wider">{SEVERITY_CFG[s].label}</p>
              </div>
              <p className="text-xl font-bold text-slate-900">{counts[s]}</p>
            </button>
          ))}
        </div>
      )}

      {/* ── Critical Events Alert (Auditor-specific) ─────────────────────── */}
      {isAuditor && counts.critical > 0 && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
          <div className="p-2 bg-red-100 rounded-lg flex-shrink-0">
            <AlertTriangle className="h-5 w-5 text-red-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-800">
              {counts.critical} Critical Event{counts.critical > 1 ? "s" : ""} Detected
            </p>
            <p className="text-xs text-red-600 mt-0.5">
              Flagged events include failed or high-risk operations. Review <span className="font-semibold">{criticalLog?.id}</span> — {criticalLog?.details}
            </p>
          </div>
          <button onClick={() => { setSevFilter("critical"); setPage(1); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 text-red-700 border border-red-300 rounded-lg text-xs font-medium hover:bg-red-200 flex-shrink-0">
            <Filter className="h-3.5 w-3.5" /> Filter Critical
          </button>
        </div>
      )}

      {/* ── Severity filter buttons for Auditor ───────────────────────────── */}
      {isAuditor && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-medium">Filter by severity:</span>
          {(["All","info","warning","critical"] as const).map((s) => (
            <button key={s} onClick={() => { setSevFilter(s); setPage(1); }}
              className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                sevFilter === s
                  ? s === "All"      ? "bg-slate-800 text-white border-slate-800"
                    : s === "info"    ? "bg-blue-600 text-white border-blue-600"
                    : s === "warning" ? "bg-amber-500 text-white border-amber-500"
                                     : "bg-red-600 text-white border-red-600"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}>
              {s === "All" ? "All Levels" : SEVERITY_CFG[s].label}
              {s !== "All" && ` (${counts[s]})`}
            </button>
          ))}
        </div>
      )}

      {/* ── Main Logs Panel ───────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden">
        {/* Filters */}
        <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-48 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input type="text" placeholder="Search by user, action, ID, details..." value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-8 pr-3 py-2 w-full border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white" />
          </div>
          <select value={actFilter} onChange={(e) => { setActFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white text-slate-600 focus:outline-none">
            <option>All Actions</option>
            {ALL_ACTIONS.map((a) => <option key={a}>{a}</option>)}
          </select>
          <select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white text-slate-600 focus:outline-none">
            <option>All Roles</option>
            {ALL_ROLES.map((r) => <option key={r}>{r}</option>)}
          </select>
          <button className="p-2 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50" title="Filter by date range">
            <Calendar className="h-4 w-4" />
          </button>
          <span className="ml-auto text-xs text-slate-400">{filtered.length} entries</span>
        </div>

        {view === "table" ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-medium border-b border-slate-200 tracking-wider sticky top-0 z-10">
                  <tr>
                    <th className="px-5 py-3.5">Severity</th>
                    <th className="px-5 py-3.5">Timestamp</th>
                    <th className="px-5 py-3.5">User / Role</th>
                    <th className="px-5 py-3.5">Action</th>
                    <th className="px-5 py-3.5">Details</th>
                    <th className="px-5 py-3.5">IP Address</th>
                    <th className="px-5 py-3.5 text-center">View</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {loading ? (
                    <tr><td colSpan={7} className="px-5 py-10 text-center text-slate-400 text-sm">Loading audit logs from the backend...</td></tr>
                  ) : paginated.map((log) => (
                    <tr key={log.id} className={`hover:bg-slate-50 transition-colors group ${SEVERITY_CFG[log.severity].rowBg}`}>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${SEVERITY_CFG[log.severity].dot}`} />
                          <span className={`text-[10px] font-semibold uppercase ${
                            log.severity === "critical" ? "text-red-600"
                            : log.severity === "warning" ? "text-amber-600"
                            : "text-slate-500"
                          }`}>{SEVERITY_CFG[log.severity].label}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5 text-xs text-slate-600 font-mono">
                          <History className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" /> {log.timestamp}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2.5">
                          <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${ROLE_COLORS[log.role]}`}>
                            {log.user.charAt(0)}
                          </div>
                          <div>
                            <p className="text-xs font-medium text-slate-900">{log.user}</p>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${ROLE_COLORS[log.role]}`}>{log.role}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`px-2 py-1 rounded-md text-xs font-medium ${ACTION_COLORS[log.action]}`}>{log.action}</span>
                      </td>
                      <td className="px-5 py-4 text-xs text-slate-500 max-w-xs truncate" title={log.details}>{log.details}</td>
                      <td className="px-5 py-4 text-xs text-slate-400 font-mono">{log.ip}</td>
                      <td className="px-5 py-4 text-center">
                        <button onClick={() => setSelected(log)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!loading && paginated.length === 0 && (
                    <tr><td colSpan={7} className="px-5 py-10 text-center text-slate-400 text-sm">No audit logs match the current filters.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t border-slate-200 bg-slate-50/50 flex items-center justify-between text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-slate-400" />
                Read-only · {filtered.length} entries shown · {logs.length} total
              </span>
              <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
            </div>
          </>
        ) : (
          <div className="p-6 space-y-0">
            {loading ? (
              <div className="py-10 text-center text-slate-400 text-sm">Loading audit logs from the backend...</div>
            ) : filtered.map((log, idx) => (
              <div key={log.id} className="flex gap-4 group">
                <div className="flex flex-col items-center">
                  <div className={`w-3 h-3 rounded-full flex-shrink-0 mt-1 z-10 ${SEVERITY_CFG[log.severity].dot}`} />
                  {idx < filtered.length - 1 && <div className="w-px flex-1 bg-slate-200 my-1" />}
                </div>
                <div className="flex-1 pb-5 min-w-0">
                  <div className="flex items-start gap-3 bg-white border border-slate-200 rounded-xl p-4 hover:shadow-sm transition-all group-hover:border-blue-200">
                    <div className={`p-2 rounded-lg flex-shrink-0 ${ROLE_COLORS[log.role]}`}>
                      <Shield className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-slate-900">{log.user}</p>
                        <ChevronRight className="h-3 w-3 text-slate-400" />
                        <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${ACTION_COLORS[log.action]}`}>{log.action}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${SEVERITY_CFG[log.severity].dot.replace("bg-","text-")} ${log.severity === "critical" ? "bg-red-100" : log.severity === "warning" ? "bg-amber-100" : "bg-blue-100"}`}>
                          {SEVERITY_CFG[log.severity].label}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1 truncate">{log.details}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-[10px] text-slate-400 font-mono">{log.timestamp}</span>
                        <span className="text-[10px] text-slate-400 font-mono">IP: {log.ip}</span>
                        <span className="text-[10px] text-slate-400">{log.id}</span>
                      </div>
                    </div>
                    <button onClick={() => setSelected(log)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg opacity-0 group-hover:opacity-100 flex-shrink-0">
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {!loading && filtered.length === 0 && <div className="py-10 text-center text-slate-400 text-sm">No logs match the current filters.</div>}
          </div>
        )}
      </div>

      {/* ── Detail Modal ────────────────────────────────────────────────────── */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <div>
                <h3 className="text-slate-900">Audit Log Detail</h3>
                <p className="text-xs text-slate-400 mt-0.5 font-mono">{selected.id}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 rounded text-xs font-medium ${ACTION_COLORS[selected.action]}`}>{selected.action}</span>
                <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${SEVERITY_CFG[selected.severity].dot}`} />
                <button onClick={() => setSelected(null)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">✕</button>
              </div>
            </div>
            <div className="p-6 space-y-3">
              {[
                ["Log ID",     selected.id],
                ["Timestamp",  selected.timestamp],
                ["User",       selected.user],
                ["Role",       selected.role],
                ["IP Address", selected.ip],
                ["Severity",   SEVERITY_CFG[selected.severity].label],
              ].map(([l, v]) => (
                <div key={l} className="flex justify-between items-start py-2 border-b border-slate-100 last:border-0">
                  <span className="text-xs text-slate-500 w-28 flex-shrink-0">{l}</span>
                  <span className="text-sm font-medium text-slate-800 text-right">{v}</span>
                </div>
              ))}
              <div className="py-2">
                <span className="text-xs text-slate-500 block mb-1.5">Full Details</span>
                <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-200 leading-relaxed">{selected.details}</p>
              </div>
              {isAuditor && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-xs font-semibold text-amber-800 mb-1">Auditor Note</p>
                  <p className="text-xs text-amber-700">
                    Cross-reference this activity with <strong>Compliance Monitoring</strong> and <strong>Property Registry</strong> to verify data integrity.
                    Log is immutable per R.A. 7160 §515.
                  </p>
                </div>
              )}
              <div className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                <Lock className="h-3.5 w-3.5 text-slate-500 flex-shrink-0" />
                <p className="text-xs text-slate-600">Audit logs are read-only and cannot be modified or deleted.</p>
              </div>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button onClick={() => setSelected(null)} className="flex-1 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Close</button>
              <button
                onClick={async () => {
                  try {
                    await safeExport(
                      () => exportAuditEntry(selected.id.replace('LOG-', '')),
                      () => ({ data: [{ id: selected.id, user: selected.user, role: selected.role, action: selected.action, details: selected.details, timestamp: selected.timestamp, ip: selected.ip, severity: selected.severity }], fileName: `${selected.id.replace('LOG-','')}-audit.csv` }),
                    );
                  } catch (err: any) {
                    console.error('Export audit entry failed', err)
                    const message = err?.message || 'Unable to export audit entry. Please try again later.'
                    alert(message)
                  }
                }}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700">
                <Download className="h-4 w-4" /> Export Entry
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}