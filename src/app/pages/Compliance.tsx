import { useEffect, useMemo, useState } from "react";
import {
  Calendar, AlertCircle, CheckCircle, Clock, Search,
  ChevronLeft, ChevronRight, ShieldCheck, Lock, MapPin,
  AlertTriangle, Download, Eye, TrendingDown,
  FileText, Users,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { AccessDenied, ReadOnlyBanner } from "../components/RoleGuard";
import Pagination from "../components/Pagination";
import { getApiErrorMessage, getComplianceStatus, type ComplianceStatusItem } from "../services/complianceService";
import { exportCompliance, safeExport } from "../services/exportService";
import {
  PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";

type CompStatus = "Compliant" | "Late" | "Unpaid";

type Taxpayer = {
  id: string;
  propertyId: string;
  ownerName: string;
  barangay: string;
  propertyType: string;
  totalDue: number;
  totalPaid: number;
  lastPaymentDate: string | null;
  status: CompStatus;
  taxYear: number;
  daysOverdue?: number;
};

const STATUS_CFG = {
  Compliant: { Icon: CheckCircle, cls: "bg-emerald-100 text-emerald-600", badge: "bg-emerald-100 text-emerald-700 border-emerald-200", row: "", rowBg: "" },
  Late:      { Icon: Clock,       cls: "bg-amber-100 text-amber-600",     badge: "bg-amber-100 text-amber-700 border-amber-200",       row: "border-l-2 border-l-amber-400", rowBg: "bg-amber-50/30" },
  Unpaid:    { Icon: AlertCircle, cls: "bg-red-100 text-red-600",         badge: "bg-red-100 text-red-700 border-red-200",             row: "border-l-2 border-l-red-400",   rowBg: "bg-red-50/20"   },
};

const MONTH_FULL = ["January","February","March","April","May","June","July","August","September","October","November","December"];

type DeadlineEvent = { day: number; month: number; label: string; type: "quarterly" | "annual" };
const DEADLINES: DeadlineEvent[] = [
  { day: 31, month: 3,  label: "Q1 RPT Deadline",    type: "quarterly" },
  { day: 30, month: 6,  label: "Q2 RPT Deadline",    type: "quarterly" },
  { day: 30, month: 9,  label: "Q3 RPT Deadline",    type: "quarterly" },
  { day: 31, month: 12, label: "Q4 RPT Deadline",    type: "quarterly" },
  { day: 31, month: 1,  label: "Annual RPT Deadline", type: "annual"   },
  { day: 30, month: 4,  label: "Annual Report Due",  type: "annual"    },
];

function normalizeStatus(value: string): CompStatus {
  return (["Compliant", "Late", "Unpaid"] as const).find((status) => status.toLowerCase() === value.trim().toLowerCase()) ?? "Unpaid";
}

function toDateInput(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().split("T")[0];
}

function mapComplianceItem(item: ComplianceStatusItem): Taxpayer {
  return {
    id: `CMP-${item.propertyId}-${item.taxYear}`,
    propertyId: item.propertyPin,
    ownerName: item.ownerName,
    barangay: item.barangay,
    propertyType: item.propertyType,
    totalDue: Number(item.totalDue),
    totalPaid: Number(item.totalPaid),
    lastPaymentDate: toDateInput(item.lastPaymentDateUtc),
    status: normalizeStatus(item.status),
    taxYear: item.taxYear,
  };
}

function CalendarView() {
  const today = new Date();
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [viewYear, setViewYear]   = useState(today.getFullYear());
  const firstDay    = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const eventsForDay = (day: number) => DEADLINES.filter((d) => d.day === day && d.month === viewMonth + 1);

  return (
    <div className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-blue-600" />
          <h3 className="text-slate-900">{MONTH_FULL[viewMonth]} {viewYear}</h3>
        </div>
        <div className="flex gap-1">
          <button onClick={() => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y=>y-1); } else setViewMonth(m=>m-1); }}
            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500"><ChevronLeft className="h-4 w-4" /></button>
          <button onClick={() => { if (viewMonth === 11) { setViewMonth(0); setViewYear(y=>y+1); } else setViewMonth(m=>m+1); }}
            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-7 mb-2">
          {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => (
            <div key={d} className="text-center text-xs font-medium text-slate-400 py-1.5">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-px bg-slate-100 border border-slate-100 rounded-lg overflow-hidden">
          {cells.map((day, idx) => {
            const events  = day ? eventsForDay(day) : [];
            const isToday = day === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();
            return (
              <div key={idx} className={`min-h-[64px] p-1.5 bg-white ${!day ? "bg-slate-50/50" : ""} ${isToday ? "ring-2 ring-blue-500 ring-inset" : ""}`}>
                {day && (
                  <>
                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium mb-0.5 ${isToday ? "text-white" : "text-slate-700"}`}
                      style={isToday ? { backgroundColor: "#0d2137" } : {}}>{day}</span>
                    {events.slice(0, 2).map((e, i) => (
                      <div key={i} title={e.label}
                        className={`text-[9px] px-1 py-0.5 rounded truncate font-medium mb-0.5 ${e.type === "annual" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                        {e.label.split(" ")[0]} {e.label.split(" ")[1]}
                      </div>
                    ))}
                  </>
                )}
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-4 mt-3 px-1">
          {[["bg-amber-400","Quarterly RPT"],["bg-red-400","Annual / Report"]].map(([c,l]) => (
            <div key={l} className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className={`w-2.5 h-2.5 rounded-full ${c} inline-block`} />{l}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const fmt = (val: number) => `₱ ${val.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

// ─── Auditor-specific Compliance Summary Panel ─────────────────────────────
function AuditorSummaryCharts({ counts, taxpayers, barangaySummary }: {
  counts: { All: number; Compliant: number; Late: number; Unpaid: number };
  taxpayers: Taxpayer[];
  barangaySummary: Array<{ name: string; compliant: number; late: number; unpaid: number }>;
}) {
  const pieData = [
    { name: "Compliant", value: counts.Compliant, color: "#10b981" },
    { name: "Late",      value: counts.Late,      color: "#f59e0b" },
    { name: "Unpaid",    value: counts.Unpaid,    color: "#ef4444" },
  ];
  const totalOutstanding = taxpayers.filter(t => t.status !== "Compliant")
    .reduce((s, t) => s + (t.totalDue - t.totalPaid), 0);
  const totalCount = counts.All || 1;
  const complianceRate = counts.All > 0 ? Math.round((counts.Compliant / counts.All) * 100) : 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Pie + stats */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck className="h-4 w-4 text-blue-600" />
          <h3 className="text-slate-900">Compliance Distribution</h3>
        </div>
        <div className="flex items-center gap-6">
          <div style={{ height: 160, width: 160, flexShrink: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={42} outerRadius={70} dataKey="value" paddingAngle={3}>
                  {pieData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, name: string | number) => [`${value} taxpayers`, String(name)]}
                  contentStyle={{ fontSize: "11px", borderRadius: "8px", border: "1px solid #e2e8f0" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex-1 space-y-3">
            {pieData.map((item) => (
              <div key={item.name} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                <div className="flex-1">
                  <div className="flex justify-between items-center mb-0.5">
                    <span className="text-xs text-slate-600 font-medium">{item.name}</span>
                    <span className="text-sm font-bold text-slate-900">{item.value}</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ backgroundColor: item.color, width: `${(item.value / totalCount) * 100}%` }} />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">{((item.value / totalCount) * 100).toFixed(1)}% of total</p>
                </div>
              </div>
            ))}
            <div className="pt-2 border-t border-slate-100">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Compliance Rate</span>
                <span className={`font-bold ${complianceRate >= 80 ? "text-emerald-600" : complianceRate >= 60 ? "text-amber-600" : "text-red-600"}`}>
                  {complianceRate}%
                </span>
              </div>
              <div className="mt-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${complianceRate}%` }} />
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Target threshold can be configured in reporting policy settings.</p>
              <div className="mt-2 pt-2 border-t border-slate-100 flex items-start gap-1.5">
                <span className="flex-shrink-0 w-3 h-3 rounded-full bg-slate-200 flex items-center justify-center mt-0.5">
                  <span className="text-[8px] text-slate-500 font-bold leading-none">i</span>
                </span>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  Based on the currently loaded dataset ({counts.All} taxpayers). Live summary metrics will update when compliance records are available.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Barangay breakdown bar chart */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-blue-600" />
            <h3 className="text-slate-900">Barangay Compliance Breakdown</h3>
          </div>
          <div className="flex items-center gap-3 text-[10px] text-slate-400">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500 inline-block"/> Compliant</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-amber-400 inline-block"/> Late</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-400 inline-block"/> Unpaid</span>
          </div>
        </div>
        <div style={{ height: 160 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barangaySummary} layout="vertical" margin={{ top: 0, right: 10, left: 60, bottom: 0 }} barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
              <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 10 }} />
              <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 9 }} width={58} />
              <Tooltip contentStyle={{ fontSize: "11px", borderRadius: "8px", border: "1px solid #e2e8f0" }} />
              <Bar dataKey="compliant" stackId="a" fill="#10b981" name="Compliant" radius={[0,0,0,0]} />
              <Bar dataKey="late"      stackId="a" fill="#f59e0b" name="Late"      />
              <Bar dataKey="unpaid"    stackId="a" fill="#ef4444" name="Unpaid"    radius={[0,3,3,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Outstanding balance alert */}
      {totalOutstanding > 0 && (
        <div className="lg:col-span-2 flex items-center gap-4 p-4 bg-red-50 border border-red-200 rounded-xl">
          <div className="p-2.5 bg-red-100 rounded-xl flex-shrink-0">
            <TrendingDown className="h-5 w-5 text-red-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-800">Total Outstanding Balance: {fmt(totalOutstanding)}</p>
            <p className="text-xs text-red-600 mt-0.5">
              {counts.Late + counts.Unpaid} taxpayers have pending obligations in the current dataset.
              Notices must be dispatched immediately per LGC §255.
            </p>
          </div>
          <button className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-red-100 text-red-700 border border-red-300 rounded-lg text-xs font-medium hover:bg-red-200 transition-colors">
            <Download className="h-3.5 w-3.5" /> Export List
          </button>
        </div>
      )}
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function Compliance() {
  const { can, user } = useAuth();
  const navigate   = useNavigate();
  const canView    = can("compliance.view");
  const canUpdate  = can("compliance.update");
  const isAuditor  = user?.role === "Auditor";
  const isReadOnly = !canUpdate;

  const [filter,    setFilter]    = useState<CompStatus | "All">("All");
  const [search,    setSearch]    = useState("");
  const [view,      setView]      = useState<"list" | "calendar" | "summary">(isAuditor ? "summary" : "list");
  const [taxpayers, setTaxpayers] = useState<Taxpayer[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selected,  setSelected]  = useState<Taxpayer | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const perPage = 10;

  useEffect(() => {
    if (!canView) {
      return;
    }

    let ignore = false;

    async function loadComplianceStatus() {
      setLoading(true);
      setErrorMessage(null);

      try {
        const result = await getComplianceStatus();

        if (!ignore) {
          setTaxpayers(result.map(mapComplianceItem));
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

    void loadComplianceStatus();

    return () => {
      ignore = true;
    };
  }, [canView]);

  const filtered = useMemo(() => taxpayers.filter((t) => {
    const mStatus = filter === "All" || t.status === filter;
    const mSearch = t.ownerName.toLowerCase().includes(search.toLowerCase()) ||
      t.propertyId.toLowerCase().includes(search.toLowerCase()) ||
      t.barangay.toLowerCase().includes(search.toLowerCase());
    return mStatus && mSearch;
  }), [filter, search, taxpayers]);

  const totalPages = Math.ceil(filtered.length / perPage);
  const paginated  = filtered.slice((currentPage - 1) * perPage, currentPage * perPage);

  const counts = {
    All:       taxpayers.length,
    Compliant: taxpayers.filter(t => t.status === "Compliant").length,
    Late:      taxpayers.filter(t => t.status === "Late").length,
    Unpaid:    taxpayers.filter(t => t.status === "Unpaid").length,
  };
  const totalCount = counts.All || 1;

  const totalOutstanding = taxpayers.filter(t => t.status !== "Compliant")
    .reduce((s, t) => s + (t.totalDue - t.totalPaid), 0);

  const barangaySummary = useMemo(() => {
    const totals = new Map<string, { name: string; compliant: number; late: number; unpaid: number }>();

    taxpayers.forEach((taxpayer) => {
      const key = taxpayer.barangay || "Unknown";
      const current = totals.get(key) ?? { name: key, compliant: 0, late: 0, unpaid: 0 };

      if (taxpayer.status === "Compliant") {
        current.compliant += 1;
      } else if (taxpayer.status === "Late") {
        current.late += 1;
      } else {
        current.unpaid += 1;
      }

      totals.set(key, current);
    });

    return Array.from(totals.values())
      .sort((left, right) => (right.compliant + right.late + right.unpaid) - (left.compliant + left.late + left.unpaid))
      .slice(0, 8);
  }, [taxpayers]);

  if (!canView) {
    return <AccessDenied requiredRole="System Administrator, Treasury Accountant, or Internal Auditor" />;
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-slate-900 tracking-tight">Compliance Monitoring</h1>
          <p className="text-sm text-slate-500 mt-1">
            Track taxpayer compliance status, delinquencies, and payment obligations across all barangays.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex bg-white border border-slate-200 rounded-lg p-0.5">
            {isAuditor && (
              <button onClick={() => setView("summary")}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${view === "summary" ? "text-white" : "text-slate-600 hover:text-slate-800"}`}
                style={view === "summary" ? { backgroundColor: "#0d2137" } : {}}>Summary</button>
            )}
            <button onClick={() => setView("list")}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${view === "list" ? "text-white" : "text-slate-600 hover:text-slate-800"}`}
              style={view === "list" ? { backgroundColor: "#0d2137" } : {}}>List View</button>
            <button onClick={() => setView("calendar")}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${view === "calendar" ? "text-white" : "text-slate-600 hover:text-slate-800"}`}
              style={view === "calendar" ? { backgroundColor: "#0d2137" } : {}}>Deadlines</button>
          </div>
          {/* Export always allowed (read-only action) */}
          <button
            onClick={async () => {
              try {
                await safeExport(
                  () => exportCompliance(),
                  () => ({ data: taxpayers.map(t => ({
                    id: t.id,
                    propertyId: t.propertyId,
                    ownerName: t.ownerName,
                    barangay: t.barangay,
                    propertyType: t.propertyType,
                    totalDue: t.totalDue,
                    totalPaid: t.totalPaid,
                    lastPaymentDate: t.lastPaymentDate,
                    status: t.status,
                    taxYear: t.taxYear,
                  })), fileName: 'compliance.csv' }),
                );
              } catch (err: any) {
                console.error('Export compliance failed', err)
                const message = err?.message || 'Unable to export compliance list. Please try again later.'
                alert(message)
              }
            }}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 shadow-sm"
          >
            <Download className="h-4 w-4" /> Export
          </button>
        </div>
      </div>

      {/* ── Read-Only Banner ────────────────────────────────────────────────── */}
      {isReadOnly && (
        <ReadOnlyBanner message={`Read-Only Mode — ${user?.role} accounts can monitor compliance status and export data, but cannot update records.`} />
      )}

      {errorMessage && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-800">Unable to load compliance records</p>
            <p className="text-xs text-red-600 mt-0.5">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* ── KPI Cards ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {([
          { key: "All",       label: "Total Taxpayers", color: "border-l-blue-500",    bg: "bg-blue-100 text-blue-600",     Icon: Users        },
          { key: "Compliant", label: "Compliant",        color: "border-l-emerald-500", bg: "bg-emerald-100 text-emerald-600",Icon: CheckCircle  },
          { key: "Late",      label: "Late",             color: "border-l-amber-500",   bg: "bg-amber-100 text-amber-600",   Icon: Clock        },
          { key: "Unpaid",    label: "Unpaid",           color: "border-l-red-500",     bg: "bg-red-100 text-red-600",       Icon: AlertCircle  },
        ] as const).map(({ key, label, color, bg, Icon }) => (
          <button key={key} onClick={() => { setFilter(key); if (view === "summary") setView("list"); }}
            className={`bg-white p-4 rounded-xl border border-slate-200 border-l-4 shadow-sm flex items-center justify-between gap-3 text-left w-full hover:shadow-md transition-all ${color} ${filter === key && view === "list" ? "ring-2 ring-blue-500 ring-offset-1" : ""}`}>
            <div className="flex items-center gap-2">
              <div className={`p-2 rounded-lg flex-shrink-0 ${bg}`}><Icon className="h-4 w-4" /></div>
              <div>
                <p className="text-xs text-slate-500">{label}</p>
                {key !== "All" && (
                  <p className="text-[10px] text-slate-400">{((counts[key] / totalCount) * 100).toFixed(1)}% of total</p>
                )}
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900">{counts[key]}</p>
          </button>
        ))}
      </div>

      {/* ── Overdue / Outstanding Alert ─────────────────────────────────────── */}
      {totalOutstanding > 0 && view !== "summary" && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
          <div className="p-2 bg-red-100 rounded-lg flex-shrink-0">
            <AlertTriangle className="h-5 w-5 text-red-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-red-800">Outstanding Balance: {fmt(totalOutstanding)}</p>
            <p className="text-xs text-red-600 mt-0.5">
              {counts.Late + counts.Unpaid} taxpayers have pending obligations for FY 2026.
              {isReadOnly ? " Cross-reference with Audit Support for delinquency verification." : " Notices should be dispatched immediately."}
            </p>
          </div>
          {isReadOnly && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700 font-medium flex-shrink-0">
              <Eye className="h-3.5 w-3.5" /> View Only
            </div>
          )}
        </div>
      )}

      {/* ── View Content ───────────────────────────────────────────────────── */}
      {view === "summary" ? (
        <AuditorSummaryCharts counts={counts} taxpayers={taxpayers} barangaySummary={barangaySummary} />
      ) : view === "calendar" ? (
        <CalendarView />
      ) : (
        /* List View */
        <div className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden">
          {/* Filter Bar */}
          <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-wrap gap-3 items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-blue-600" />
              <h3 className="text-slate-900">Compliance Checklist</h3>
              <span className="text-xs text-slate-400">Live dataset</span>
              <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                {filtered.length} records
              </span>
            </div>
            <div className="flex items-center gap-2">
              {/* Status filter buttons */}
              <div className="flex gap-1">
                {(["All","Compliant","Late","Unpaid"] as const).map((s) => (
                  <button key={s} onClick={() => { setFilter(s); setCurrentPage(1); }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border ${
                      filter === s
                        ? s === "All" ? "bg-slate-800 text-white border-slate-800"
                          : s === "Compliant" ? "bg-emerald-600 text-white border-emerald-600"
                          : s === "Late"      ? "bg-amber-500 text-white border-amber-500"
                                             : "bg-red-600 text-white border-red-600"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    }`}>
                    {s} {s !== "All" && `(${counts[s]})`}
                  </button>
                ))}
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input type="text" placeholder="Search taxpayer, property..." value={search}
                  onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                  className="pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 w-56 bg-white" />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-medium border-b border-slate-200 tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">Property / Owner</th>
                  <th className="px-5 py-3.5">Barangay</th>
                  <th className="px-5 py-3.5">Type</th>
                  <th className="px-5 py-3.5 text-right">Total Due</th>
                  <th className="px-5 py-3.5 text-right">Total Paid</th>
                  <th className="px-5 py-3.5">Last Payment</th>
                  <th className="px-5 py-3.5">Status</th>
                  {/* Auditor sees a "Flag for Review" column instead of Action */}
                  <th className="px-5 py-3.5 text-center">{isAuditor ? "Audit Note" : "Action"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {loading ? (
                  <tr><td colSpan={8} className="px-5 py-10 text-center text-slate-400 text-sm">Loading compliance records from the backend...</td></tr>
                ) : paginated.map((t) => {
                  const { Icon, badge, row, rowBg } = STATUS_CFG[t.status];
                  return (
                    <tr key={t.id} className={`hover:bg-slate-50/80 transition-colors group ${row} ${rowBg}`}>
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-slate-900">{t.ownerName}</p>
                        <p className="text-xs text-blue-700 font-mono">{t.propertyId}</p>
                        {t.daysOverdue && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-red-600 font-semibold mt-0.5">
                            <AlertTriangle className="h-2.5 w-2.5" /> {t.daysOverdue}d overdue
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5 text-xs text-slate-600">
                          <MapPin className="h-3 w-3 text-slate-400 flex-shrink-0" />{t.barangay}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded">{t.propertyType}</span>
                      </td>
                      <td className="px-5 py-3.5 text-right text-xs text-slate-600">{fmt(t.totalDue)}</td>
                      <td className="px-5 py-3.5 text-right">
                        <p className="text-xs font-bold text-slate-900">{t.totalPaid > 0 ? fmt(t.totalPaid) : "—"}</p>
                        {t.totalDue > 0 && t.totalPaid > 0 && (
                          <p className="text-[10px] text-emerald-600">{Math.round((t.totalPaid / t.totalDue) * 100)}% paid</p>
                        )}
                        {t.totalPaid === 0 && t.status !== "Compliant" && (
                          <p className="text-[10px] text-red-500">₱ 0.00 paid</p>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-500">
                        {t.lastPaymentDate || <span className="text-red-500 font-medium">Not paid</span>}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${badge}`}>
                          <Icon className="h-3 w-3" />{t.status}
                        </span>
                      </td>
                      {/* Action column — read-only for Auditor */}
                      <td className="px-5 py-3.5 text-center">
                        {isAuditor ? (
                          <button
                            onClick={() => setSelected(selected?.id === t.id ? null : t)}
                            className="px-2.5 py-1.5 bg-amber-50 text-amber-700 text-xs rounded-lg border border-amber-200 hover:bg-amber-100 transition-colors font-medium flex items-center gap-1 mx-auto"
                          >
                            <Eye className="h-3 w-3" /> Review
                          </button>
                        ) : canUpdate ? (
                          <div>
                            {t.status !== "Compliant" ? (
                              <button onClick={() => navigate("/app/payment-management")}
                                className="px-3 py-1.5 bg-emerald-600 text-white text-xs rounded-lg hover:bg-emerald-700 font-medium">
                                Open Payments
                              </button>
                            ) : (
                              <span className="text-xs text-emerald-600 font-medium flex items-center gap-1 justify-center">
                                <CheckCircle className="h-3.5 w-3.5" /> Compliant
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 justify-center px-3 py-1.5 bg-slate-100 text-slate-400 text-xs rounded-lg cursor-not-allowed border border-slate-200">
                            <Lock className="h-3 w-3" /> Restricted
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {!loading && paginated.length === 0 && (
                  <tr><td colSpan={8} className="px-5 py-10 text-center text-slate-400 text-sm">No taxpayers found for the selected filter.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Table footer / Pagination */}
          <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs text-slate-400 flex-wrap gap-2">
            <span>Showing {filtered.length === 0 ? 0 : Math.min((currentPage - 1) * perPage + 1, filtered.length)}–{Math.min(currentPage * perPage, filtered.length)} of {filtered.length} taxpayer(s)</span>
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
            {isReadOnly && (
              <div className="flex items-center gap-1.5 text-amber-600">
                <Lock className="h-3 w-3" />
                <span className="font-medium">Read-Only — No modifications permitted</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Auditor Detail Panel (slides in on Review click) ─────────────────── */}
      {isAuditor && selected && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className={`p-2 rounded-lg ${STATUS_CFG[selected.status].cls}`}>
                {(() => { const { Icon } = STATUS_CFG[selected.status]; return <Icon className="h-4 w-4" />; })()}
              </div>
              <div>
                <h3 className="text-slate-900">{selected.ownerName}</h3>
                <p className="text-xs text-slate-500">{selected.propertyId} · {selected.barangay} · FY {selected.taxYear}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${STATUS_CFG[selected.status].badge}`}>
                {selected.status}
              </span>
              <button onClick={() => setSelected(null)}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-white rounded-lg transition-colors">✕</button>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Property Type",   value: selected.propertyType },
              { label: "Total Tax Due",   value: fmt(selected.totalDue) },
              { label: "Amount Paid",     value: selected.totalPaid > 0 ? fmt(selected.totalPaid) : "—" },
              { label: "Balance",         value: fmt(Math.max(0, selected.totalDue - selected.totalPaid)) },
              { label: "Last Payment",    value: selected.lastPaymentDate || "Not paid" },
              { label: "Tax Year",        value: String(selected.taxYear) },
              { label: "Days Overdue",    value: selected.daysOverdue ? `${selected.daysOverdue} days` : "N/A" },
              { label: "Audit Record",    value: selected.id },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white rounded-lg border border-amber-100 p-3">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">{label}</p>
                <p className="text-sm font-semibold text-slate-900">{value}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs text-amber-700">
            <FileText className="h-3.5 w-3.5" />
            <span>Auditor note: Cross-reference this record with <strong>Audit Support → LOG-9010</strong> and <strong>Payment Management</strong> for verification.</span>
          </div>
        </div>
      )}

    </div>
  );
}