import { useEffect, useMemo, useState } from "react";
import {
  Home, TrendingUp, AlertCircle, CheckCircle2, ArrowRight,
  CalendarDays, CreditCard, ArrowUpRight, AlertTriangle,
  Building2, Zap, Brain, TrendingDown, Lock, ClipboardList, FileDown,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area,
  PieChart, Pie, Cell,
} from "recharts";
import { useAuth } from "../context/AuthContext";
import { LimitedAccessBanner } from "../components/RoleGuard";
import { useNavigate } from "react-router";
import { getCollectionsReport, getDelinquencyReport, getPropertiesReport, type CollectionsReportResponse, type DelinquencyReportResponse, type PropertiesReportResponse } from "../services/reportService";
import { getComplianceStatus, type ComplianceStatusItem } from "../services/complianceService";
import { getPaymentHistory, type PaymentDto } from "../services/paymentService";
import { getAuditLogs, type AuditLogDto } from "../services/auditService";
import { getProperties, type PropertyDto } from "../services/propertyService";
import { getTaxAssessments, type TaxDto } from "../services/taxService";

type DashboardPaymentStatus = { name: "Paid" | "Unpaid" | "Late"; value: number; color: string };
type DashboardPrediction = { name: string; predicted: number };
type DashboardAlert = { id: number; title: string; desc: string; type: "critical" | "deadline" | "info"; time: string };
type DashboardRecentPayment = { id: string; owner: string; property: string; amount: number; date: string };
type DashboardRecentAssessment = { id: string; owner: string; property: string; amount: number; date: string; taxYear: number };
type DashboardRiskEvent = { id: string; user: string; action: string; detail: string; timestamp: string };

const fmt     = (val: number) => `₱ ${val.toLocaleString("en-PH", { minimumFractionDigits: 0 })}`;
const fmtM    = (val: number) => val >= 1000000 ? `₱${(val / 1000000).toFixed(1)}M` : `₱${(val / 1000).toFixed(0)}K`;

function formatMonthLabel(label: string) {
  const date = new Date(`${label}-01T00:00:00`);
  return Number.isNaN(date.getTime()) ? label : date.toLocaleString("en-PH", { month: "short" });
}

function formatDate(value?: string | null) {
  if (!value) return "N/A";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-PH", { month: "short", day: "2-digit", year: "numeric" });
}

function normalizeComplianceStatus(value: string): "Paid" | "Unpaid" | "Late" {
  const normalized = value.trim().toLowerCase();

  if (normalized === "compliant") {
    return "Paid";
  }

  if (normalized === "late") {
    return "Late";
  }

  return "Unpaid";
}

function inferAuditSeverity(log: AuditLogDto): "critical" | "warning" | "info" {
  const normalizedAction = log.action.trim().toLowerCase();

  if (!log.succeeded) {
    return "critical";
  }

  if (normalizedAction.includes("delete") || normalizedAction.includes("role")) {
    return "warning";
  }

  return "info";
}

function buildProjection(monthlyCollection: Array<{ name: string; collected: number }>): DashboardPrediction[] {
  if (monthlyCollection.length === 0) {
    return [];
  }

  const recent = monthlyCollection.slice(-3);
  const average = recent.reduce((sum, item) => sum + item.collected, 0) / recent.length;
  const lastMonth = new Date();

  return Array.from({ length: 4 }, (_, index) => {
    const projectedMonth = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + index + 1, 1);
    return {
      name: projectedMonth.toLocaleString("en-PH", { month: "short" }),
      predicted: Math.round(average),
    };
  });
}

// ─── Compliance Arc Gauge ─────────────────────────────────────────────────────
function ComplianceArc({ value, target }: { value: number; target: number }) {
  const cx = 70, cy = 56, r = 44, sw = 10;

  // Convert angle (standard math, CCW from right) to SVG coords (y-down)
  const toXY = (deg: number) => ({
    x: +(cx + r * Math.cos((deg * Math.PI) / 180)).toFixed(2),
    y: +(cy - r * Math.sin((deg * Math.PI) / 180)).toFixed(2),
  });

  // Background arc: from left (≈180°) through top (90°) to right (≈0°)
  // Split into two quarter-arcs to avoid the 180° degenerate ambiguity
  const s   = toXY(179.9);   // left endpoint
  const mid = toXY(90);      // topmost point
  const e   = toXY(0.1);     // right endpoint
  const bgPath = `M ${s.x} ${s.y} A ${r} ${r} 0 0 0 ${mid.x} ${mid.y} A ${r} ${r} 0 0 0 ${e.x} ${e.y}`;

  // Value arc: from left to value angle, counterclockwise (sweep-flag=0)
  // Angle decreases as value% increases: 180° → 0° maps to 0% → 100%
  const vDeg  = 180 - 180 * (Math.min(value, 99.5) / 100);
  const vPt   = toXY(vDeg);
  const vPath = value > 0.5
    ? `M ${s.x} ${s.y} A ${r} ${r} 0 0 0 ${vPt.x} ${vPt.y}`
    : "";

  // Target marker position
  const tPt = toXY(180 - 180 * (target / 100));
  const gap = (target - value).toFixed(1);

  return (
    <svg viewBox="0 0 140 72" className="w-full" aria-label={`Compliance gauge: ${value}% of ${target}% target`}>
      {/* Track */}
      <path d={bgPath} fill="none" stroke="#e2e8f0" strokeWidth={sw} strokeLinecap="butt" />
      {/* Value fill */}
      {vPath && <path d={vPath} fill="none" stroke="#1e40af" strokeWidth={sw} strokeLinecap="butt" />}

      {/* Target marker — red dot */}
      <circle cx={tPt.x} cy={tPt.y} r={5} fill="#ef4444" />
      {/* Small target label near the dot */}
      <text
        x={tPt.x + (tPt.x > cx ? 7 : -7)}
        y={tPt.y - 5}
        textAnchor={tPt.x > cx ? "start" : "end"}
        fontSize="7"
        fontWeight="700"
        fill="#ef4444"
      >
        {target}%
      </text>

      {/* Centre: large percentage */}
      <text x={cx} y={cy - 9} textAnchor="middle" fontSize="19" fontWeight="800" fill="#0f172a">
        {value}%
      </text>
      {/* Gap note */}
      <text x={cx} y={cy + 5} textAnchor="middle" fontSize="7.5" fill="#ef4444">
        {gap}% below target
      </text>

      {/* Axis labels */}
      <text x={s.x + 3} y={cy + 14} fontSize="7.5" fill="#94a3b8" textAnchor="start">0%</text>
      <text x={e.x - 3} y={cy + 14} fontSize="7.5" fill="#94a3b8" textAnchor="end">100%</text>
    </svg>
  );
}

// ─── Bar chart custom tooltip ─────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-xs">
        <p className="font-semibold text-slate-700 mb-1">{label}</p>
        {payload.map((p: any) => (
          <p key={p.name} style={{ color: p.color ?? p.fill }}>
            {p.name}: {fmt(p.value)}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

// ─── Locked AI banner (for Staff & Auditor) ───────────────────────────────────
function LockedAIBanner() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-3" style={{ backgroundColor: "#1e293b" }}>
        <div className="p-2 rounded-lg bg-slate-700">
          <Brain className="h-4 w-4 text-slate-400" />
        </div>
        <div>
          <h3 className="text-slate-400">Insights Module</h3>
          <p className="text-slate-500 text-xs mt-0.5">Revenue pace projections and risk monitoring</p>
        </div>
        <span className="ml-auto px-2.5 py-1 bg-slate-700 text-slate-400 text-xs font-bold rounded-full border border-slate-600">
          RESTRICTED
        </span>
      </div>
      <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
        <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-4">
          <Lock className="h-6 w-6 text-slate-400" />
        </div>
        <p className="text-sm font-semibold text-slate-700 mb-1">
          Insights & Risk Monitoring — Restricted Access
        </p>
        <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
          Forecasting and risk-monitoring panels are available to{" "}
          <span className="font-medium text-slate-600">Accountant level and above</span>.
          Contact your system administrator to request access.
        </p>
        <div className="mt-4 flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg">
          <div className="flex gap-0.5">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className={`h-1.5 w-6 rounded-full ${i <= 1 ? "bg-slate-300" : "bg-slate-100"}`} />
            ))}
          </div>
          <span className="text-[10px] text-slate-400">Access Level 2+ required</span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { user, can } = useAuth();
  const navigate = useNavigate();
  const [collectionsReport, setCollectionsReport] = useState<CollectionsReportResponse | null>(null);
  const [delinquencyReport, setDelinquencyReport] = useState<DelinquencyReportResponse | null>(null);
  const [propertiesReport, setPropertiesReport] = useState<PropertiesReportResponse | null>(null);
  const [complianceItems, setComplianceItems] = useState<ComplianceStatusItem[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<PaymentDto[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogDto[]>([]);
  const [properties, setProperties] = useState<PropertyDto[]>([]);
  const [taxAssessments, setTaxAssessments] = useState<TaxDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const canViewProperties = can("property.view");
  const canViewTax = can("tax.view");
  const canViewPayments = can("payment.view");
  const canViewCompliance = can("compliance.view");
  const canViewReporting = can("reporting.view");
  const canViewAudit = can("audit.view");
  const canViewFiling = can("filing.view");
  const canCreatePayments = can("payment.create");
  const today = new Date().toLocaleDateString("en-PH", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  useEffect(() => {
    let ignore = false;

    async function loadDashboard() {
      setLoading(true);
      setErrorMessage(null);

      if (!ignore) {
        setCollectionsReport(null);
        setDelinquencyReport(null);
        setPropertiesReport(null);
        setComplianceItems([]);
        setPaymentHistory([]);
        setAuditLogs([]);
        setProperties([]);
        setTaxAssessments([]);
      }

      const loaders: Array<{ label: string; load: () => Promise<void> }> = [];

      if (canViewReporting) {
        loaders.push(
          {
            label: "collections analytics",
            load: async () => {
              const collections = await getCollectionsReport();

              if (!ignore) {
                setCollectionsReport(collections);
              }
            },
          },
          {
            label: "delinquency analytics",
            load: async () => {
              const delinquency = await getDelinquencyReport();

              if (!ignore) {
                setDelinquencyReport(delinquency);
              }
            },
          },
          {
            label: "property reporting summary",
            load: async () => {
              const report = await getPropertiesReport();

              if (!ignore) {
                setPropertiesReport(report);
              }
            },
          },
        );
      } else if (canViewProperties) {
        loaders.push({
          label: "property registry summary",
          load: async () => {
            const propertyData = await getProperties();

            if (!ignore) {
              setProperties(propertyData);
            }
          },
        });
      }

      if (canViewCompliance) {
        loaders.push({
          label: "compliance status",
          load: async () => {
            const compliance = await getComplianceStatus();

            if (!ignore) {
              setComplianceItems(compliance);
            }
          },
        });
      } else if (canViewTax) {
        loaders.push({
          label: "tax assessment activity",
          load: async () => {
            const assessments = await getTaxAssessments();

            if (!ignore) {
              setTaxAssessments(assessments);
            }
          },
        });
      }

      if (canViewPayments) {
        loaders.push({
          label: "payment activity",
          load: async () => {
            const payments = await getPaymentHistory();

            if (!ignore) {
              setPaymentHistory(payments);
            }
          },
        });
      }

      if (canViewAudit) {
        loaders.push({
          label: "audit risk signals",
          load: async () => {
            const audits = await getAuditLogs();

            if (!ignore) {
              setAuditLogs(audits);
            }
          },
        });
      }

      const results = await Promise.allSettled(loaders.map((item) => item.load()));
      const failedLoads = results.flatMap((result, index) => {
        if (result.status === "fulfilled") {
          return [];
        }

        const message = result.reason instanceof Error
          ? result.reason.message
          : "Request failed.";

        return [`${loaders[index].label}: ${message}`];
      });

      if (!ignore) {
        if (failedLoads.length > 0) {
          setErrorMessage(`Some dashboard sections could not be loaded. ${failedLoads.join(" ")}`);
        }

        setLoading(false);
      }
    }

    void loadDashboard();

    return () => {
      ignore = true;
    };
  }, [canViewAudit, canViewCompliance, canViewPayments, canViewProperties, canViewReporting, canViewTax]);

  const monthlyCollection = useMemo(
    () => collectionsReport?.labels.map((label, index) => ({
      name: formatMonthLabel(label),
      collected: Number(collectionsReport.datasets[0]?.data[index] ?? 0),
    })) ?? [],
    [collectionsReport],
  );

  const paymentStatus = useMemo<DashboardPaymentStatus[]>(() => {
    const counts = complianceItems.reduce<Record<"Paid" | "Unpaid" | "Late", number>>((acc, item) => {
      const status = normalizeComplianceStatus(item.status);
      acc[status] += 1;
      return acc;
    }, { Paid: 0, Unpaid: 0, Late: 0 });

    return [
      { name: "Paid", value: counts.Paid, color: "#10b981" },
      { name: "Unpaid", value: counts.Unpaid, color: "#f59e0b" },
      { name: "Late", value: counts.Late, color: "#ef4444" },
    ];
  }, [complianceItems]);

  const mlPrediction = useMemo(() => buildProjection(monthlyCollection), [monthlyCollection]);

  const recentAssessments = useMemo<DashboardRecentAssessment[]>(() =>
    [...taxAssessments]
      .sort((left, right) => (right.createdAtUtc ?? "").localeCompare(left.createdAtUtc ?? ""))
      .slice(0, 5)
      .map((assessment) => ({
        id: `ASM-${String(assessment.id).padStart(4, "0")}`,
        owner: assessment.ownerName ?? "Unknown taxpayer",
        property: assessment.propertyPin ?? String(assessment.propertyId),
        amount: Number(assessment.taxDue),
        date: formatDate(assessment.createdAtUtc),
        taxYear: assessment.taxYear,
      })),
    [taxAssessments],
  );

  const recentPayments = useMemo<DashboardRecentPayment[]>(() =>
    [...paymentHistory]
      .sort((left, right) => (right.paymentDateUtc ?? "").localeCompare(left.paymentDateUtc ?? ""))
      .slice(0, 5)
      .map((payment) => ({
        id: `PAY-${String(payment.id).padStart(4, "0")}`,
        owner: payment.ownerName ?? "Unknown taxpayer",
        property: payment.propertyPin ?? String(payment.propertyId),
        amount: Number(payment.amountPaid),
        date: formatDate(payment.paymentDateUtc),
      })),
    [paymentHistory],
  );

  const riskEvents = useMemo<DashboardRiskEvent[]>(() =>
    auditLogs
      .filter((log) => {
        const severity = inferAuditSeverity(log);
        return severity === "critical" || severity === "warning";
      })
      .slice(0, 4)
      .map((log) => ({
        id: `LOG-${String(log.id).padStart(4, "0")}`,
        user: log.performedByUsername?.trim() || "System",
        action: log.action,
        detail: log.description?.trim() || `${log.entityName ?? "System"}${log.entityId ? ` ${log.entityId}` : ""}`.trim() || "No additional details provided.",
        timestamp: formatDate(log.createdAtUtc),
      })),
    [auditLogs],
  );

  const totalProperties = propertiesReport?.summary.totalProperties ?? properties.length;
  const totalAssessedRecords = taxAssessments.length;
  const assessedRegistryCount = useMemo(() => new Set(taxAssessments.map((assessment) => assessment.propertyId)).size, [taxAssessments]);
  const latestAssessmentYear = useMemo(() => {
    if (taxAssessments.length === 0) {
      return null;
    }

    return Math.max(...taxAssessments.map((assessment) => assessment.taxYear));
  }, [taxAssessments]);

  const alerts = useMemo<DashboardAlert[]>(() => {
    const items: DashboardAlert[] = [];

    if (canViewCompliance && (delinquencyReport?.summary.outstandingBalance ?? 0) > 0) {
      items.push({
        id: 1,
        title: "Outstanding balances detected",
        desc: `${fmt(delinquencyReport!.summary.outstandingBalance)} remains unpaid across assessed properties.`,
        type: "critical",
        time: "Live",
      });
    }

    if (canViewAudit && riskEvents.length > 0) {
      items.push({
        id: 2,
        title: "Audit risk events need review",
        desc: `${riskEvents.length} recent warning or critical log entries were detected in the audit trail.`,
        type: "deadline",
        time: riskEvents[0].timestamp,
      });
    }

    if (canViewReporting && collectionsReport?.labels.length) {
      const latestLabel = collectionsReport.labels[collectionsReport.labels.length - 1];
      const latestValue = Number(collectionsReport.datasets[0]?.data[collectionsReport.datasets[0].data.length - 1] ?? 0);
      items.push({
        id: 3,
        title: "Latest collections synced",
        desc: `${latestLabel} posted ${fmt(latestValue)} in recorded collections.`,
        type: "info",
        time: latestLabel,
      });
    }

    if (!canViewReporting && totalProperties > 0) {
      items.push({
        id: 4,
        title: "Property registry data available",
        desc: `${totalProperties.toLocaleString()} property record(s) are ready for intake and assessment work.`,
        type: "info",
        time: "Live",
      });
    }

    if (!canViewCompliance && canViewTax && totalAssessedRecords > 0) {
      items.push({
        id: 5,
        title: "Assessment activity synced",
        desc: `${totalAssessedRecords.toLocaleString()} tax assessment record(s) are available${latestAssessmentYear ? ` for tax year ${latestAssessmentYear}` : ""}.`,
        type: "info",
        time: latestAssessmentYear?.toString() ?? "Live",
      });
    }

    if (items.length === 0) {
      items.push({
        id: 6,
        title: "Dashboard ready",
        desc: "Authorized dashboard modules will populate automatically as records become available.",
        type: "info",
        time: "Live",
      });
    }

    return items;
  }, [canViewAudit, canViewCompliance, canViewReporting, canViewTax, collectionsReport, delinquencyReport, latestAssessmentYear, riskEvents, totalAssessedRecords, totalProperties]);

  const assessedProperties = paymentStatus.reduce((s, d) => s + d.value, 0);
  const paidCount = paymentStatus.find((item) => item.name === "Paid")?.value ?? 0;
  const unpaidCount = paymentStatus.find((item) => item.name === "Unpaid")?.value ?? 0;
  const lateCount = paymentStatus.find((item) => item.name === "Late")?.value ?? 0;
  const pendingCount = unpaidCount + lateCount;
  const totalCollected = monthlyCollection.reduce((sum, item) => sum + item.collected, 0);
  const collectionProgress = monthlyCollection.length > 0 ? 100 : 0;
  const pendingSegments = totalProperties > 0 ? Math.round((pendingCount / totalProperties) * 10) : 0;
  const complianceTarget = 85;
  const complianceRate = assessedProperties > 0 ? Number(((paidCount / assessedProperties) * 100).toFixed(1)) : 0;
  const predictedAnnualTotal = mlPrediction.reduce((sum, item) => sum + item.predicted, totalCollected);

  // ── Role-based gates ────────────────────────────────────────────────────────
  // Dashboard now fetches only the data slices that each role is authorized to access.
  const canViewAI = user?.role === "Admin" || user?.role === "Accountant";
  const isAuditor = user?.role === "Auditor";
  const isStaff = user?.role === "Staff";

  const canRegisterProperty = can("property.create");
  const quickActions = [
    { label: "Register New Property", icon: Home, color: "text-blue-600 bg-blue-50", path: "/app/property-registration", visible: canRegisterProperty },
    { label: "Open Tax Calculation", icon: ClipboardList, color: "text-sky-600 bg-sky-50", path: "/app/tax-calculation", visible: canViewTax },
    { label: "Record Tax Payment", icon: CreditCard, color: "text-emerald-600 bg-emerald-50", path: "/app/payment-management", visible: canCreatePayments },
    { label: "Review Compliance Status", icon: TrendingDown, color: "text-red-600 bg-red-50", path: "/app/compliance", visible: canViewCompliance },
    { label: "Open Filing Repository", icon: FileDown, color: "text-amber-600 bg-amber-50", path: "/app/filing", visible: canViewFiling },
    { label: "Generate Barangay Summary", icon: Building2, color: "text-purple-600 bg-purple-50", path: "/app/reporting", visible: canViewReporting },
  ].filter((action) => action.visible).slice(0, 4);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">

      {isStaff && (
        <LimitedAccessBanner message="Limited Dashboard — Assessment Staff can monitor property registry and assessment activity here. Collections, compliance, payments, and audit analytics are reserved for Accountant, Auditor, or Admin roles." />
      )}

      {errorMessage && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
          <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-800">Unable to load part of the dashboard</p>
            <p className="text-xs text-red-600 mt-0.5">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* ── Page Header ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-slate-900 tracking-tight">Executive Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">
            Welcome back, <span className="font-medium text-slate-700">{user?.name}</span> · {today}
          </p>
        </div>
        <div className="flex gap-2">
          {canRegisterProperty && (
            <button
              onClick={() => navigate("/app/property-registration")}
              className="px-4 py-2 text-white rounded-lg text-sm font-medium transition-colors shadow-sm flex items-center gap-2"
              style={{ backgroundColor: "#0d2137" }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#1e3a5f")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#0d2137")}
            >
              Register Property <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* ── KPI Cards ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

        {/* Total Properties */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow group">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-50 rounded-xl text-blue-600 group-hover:bg-blue-100 transition-colors flex-shrink-0">
              <Home className="h-5 w-5" />
            </div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Properties</p>
          </div>
          <h3 className="text-2xl font-bold text-slate-900 mt-3 truncate">{totalProperties.toLocaleString()}</h3>
          <p className="text-xs text-emerald-600 font-medium mt-1 flex items-center gap-1">
            <ArrowUpRight className="h-3 w-3" /> {totalProperties > 0 ? "Registry records synced" : "Awaiting live property records"}
          </p>
          <div className="mt-3 h-1 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${totalProperties > 0 ? 100 : 0}%` }} />
          </div>
          <p className="text-[10px] text-slate-400 mt-1">{totalProperties > 0 ? "Live registry data available" : "No registry data loaded yet"}</p>
        </div>

        {canViewReporting && (
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow group border-l-4 border-l-emerald-400">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600 group-hover:bg-emerald-100 transition-colors flex-shrink-0">
                <TrendingUp className="h-5 w-5" />
              </div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Tax Collected</p>
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mt-3 truncate">{fmt(totalCollected)}</h3>
            <p className="text-xs text-emerald-600 font-medium mt-1 flex items-center gap-1">
              <ArrowUpRight className="h-3 w-3" /> {totalCollected > 0 ? "Live collections synced" : "No collection totals available yet"}
            </p>
            <div className="mt-3 h-1 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${collectionProgress}%` }} />
            </div>
            <p className="text-[10px] text-slate-400 mt-1">{monthlyCollection.length > 0 ? `${monthlyCollection.length} recorded collection period(s)` : "Collection periods will appear when payments are recorded"}</p>
          </div>
        )}

        {canViewCompliance ? (
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow border-l-4 border-l-amber-400 group">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-50 rounded-xl text-amber-600 group-hover:bg-amber-100 transition-colors flex-shrink-0">
                <AlertCircle className="h-5 w-5" />
              </div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Pending Payments</p>
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mt-3 truncate">{pendingCount.toLocaleString()}</h3>
            <p className="text-xs text-amber-600 font-medium mt-1 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> {lateCount > 0 ? `${lateCount} past due date` : "No overdue balances recorded"}
            </p>
            <div className="mt-3 flex gap-1">
              {Array.from({ length: 10 }, (_, i) => (
                <div key={i} className={`flex-1 h-1.5 rounded-full ${i < pendingSegments ? "bg-amber-400" : "bg-slate-100"}`} />
              ))}
            </div>
            <p className="text-[10px] text-slate-400 mt-1">{pendingCount > 0 ? `${unpaidCount} unpaid + ${lateCount} late` : "No pending payment balances"}</p>
          </div>
        ) : canViewTax && (
          <>
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow border-l-4 border-l-sky-400 group">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-sky-50 rounded-xl text-sky-600 group-hover:bg-sky-100 transition-colors flex-shrink-0">
                  <ClipboardList className="h-5 w-5" />
                </div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Assessment Records</p>
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mt-3 truncate">{totalAssessedRecords.toLocaleString()}</h3>
              <p className="text-xs text-sky-600 font-medium mt-1 flex items-center gap-1">
                <ArrowUpRight className="h-3 w-3" /> {assessedRegistryCount > 0 ? `${assessedRegistryCount.toLocaleString()} properties assessed` : "No assessed properties yet"}
              </p>
              <div className="mt-3 h-1 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-sky-500 rounded-full" style={{ width: `${totalAssessedRecords > 0 ? 100 : 0}%` }} />
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Assessment activity is sourced from authorized tax assessment records.</p>
            </div>

            <div className="bg-white px-5 pt-4 pb-3 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow border-l-4 border-l-blue-400 group">
              <div className="flex justify-between items-start">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Latest Assessment Year</p>
                <div className="p-2.5 bg-blue-50 rounded-xl text-blue-600 group-hover:bg-blue-100 transition-colors flex-shrink-0">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-5">
                <p className="text-3xl font-bold text-slate-900">{latestAssessmentYear ?? "N/A"}</p>
                <p className="text-xs text-slate-500 mt-2">{latestAssessmentYear ? "Most recent tax year loaded for assessment review" : "No assessment year has been recorded yet."}</p>
              </div>
            </div>
          </>
        )}

        {canViewCompliance && (
          <div className="bg-white px-5 pt-4 pb-3 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow border-l-4 border-l-blue-400 group">
            <div className="flex justify-between items-start">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Compliance Rate</p>
              <div className="p-2.5 bg-blue-50 rounded-xl text-blue-600 group-hover:bg-blue-100 transition-colors flex-shrink-0">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </div>

            <div className="mt-1">
              <ComplianceArc value={complianceRate} target={complianceTarget} />
            </div>

            <div className="flex items-center justify-between text-[10px] mt-0.5">
              <span className="text-slate-400">{assessedProperties > 0 ? `${paidCount.toLocaleString()} / ${assessedProperties.toLocaleString()} assessed properties settled` : "No compliance data yet"}</span>
              <span className="text-red-500 font-semibold">Threshold: {complianceTarget}%</span>
            </div>
          </div>
        )}
      </div>

      {(canViewReporting || canViewCompliance) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {canViewReporting && (
            <div className={`${canViewCompliance ? "lg:col-span-2" : "lg:col-span-3"} bg-white p-6 rounded-xl border border-slate-200 shadow-sm`}>
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-slate-900">Monthly Tax Collection</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {monthlyCollection.length > 0 ? "Recorded collections by posting period" : "No monthly collection data available yet."}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {monthlyCollection.length > 0 && (
                    <div className="flex items-center gap-4 text-xs text-slate-500">
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: "#0d2137" }} />
                        Collected
                      </span>
                    </div>
                  )}
                  {loading && <span className="text-xs text-slate-400">Refreshing...</span>}
                </div>
              </div>
              <div style={{ height: 260 }}>
                {monthlyCollection.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyCollection} margin={{ top: 16, right: 10, left: 0, bottom: 0 }} barCategoryGap="30%">
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 11 }} dy={8} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 11 }} tickFormatter={fmtM} />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(248,250,252,0.8)" }} />
                      <Bar
                        dataKey="collected"
                        fill="#0d2137"
                        radius={[4, 4, 0, 0]}
                        barSize={36}
                        name="Collected"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full rounded-xl border border-dashed border-slate-200 bg-slate-50 flex items-center justify-center text-sm text-slate-400">
                    Monthly collection data will appear here once records are synced.
                  </div>
                )}
              </div>
              {monthlyCollection.length > 0 && <p className="text-[10px] text-slate-400 mt-2 text-center">Values are sourced from the live collections report endpoint.</p>}
            </div>
          )}

          {canViewCompliance && (
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <div className="mb-5">
                <h3 className="text-slate-900">Payment Status</h3>
                <p className="text-xs text-slate-400 mt-0.5">Property distribution by payment status</p>
              </div>
              <div style={{ height: 180 }}>
                {paymentStatus.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={paymentStatus} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={3}>
                        {paymentStatus.map((entry) => (
                          <Cell key={`cell-${entry.name}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number, name) => [`${value.toLocaleString()} properties`, name]}
                        contentStyle={{ fontSize: "11px", borderRadius: "8px", border: "1px solid #e2e8f0" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full rounded-xl border border-dashed border-slate-200 bg-slate-50 flex items-center justify-center text-sm text-slate-400">
                    No payment distribution data available.
                  </div>
                )}
              </div>
              <div className="space-y-2 mt-2">
                {paymentStatus.length > 0 ? (
                  paymentStatus.map((item) => (
                    <div key={item.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-xs text-slate-600">{item.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-bold text-slate-900">{item.value.toLocaleString()}</span>
                        <span className="text-xs text-slate-400 ml-1">({totalProperties > 0 ? ((item.value / totalProperties) * 100).toFixed(1) : "0.0"}%)</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-400 text-center">Status breakdown updates after payment records are loaded.</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── AI / Intelligence Panel — gated by role and data availability ─────── */}
      {canViewAI ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-3" style={{ backgroundColor: "#0d2137" }}>
            <div className="p-2 rounded-lg bg-blue-600/30">
              <Brain className="h-4 w-4 text-blue-300" />
            </div>
            <div>
              <h3 className="text-white">Insights & Risk Monitoring</h3>
              <p className="text-blue-300 text-xs mt-0.5">Live revenue pacing and audit-derived risk signals</p>
            </div>
            <span className="ml-auto px-2.5 py-1 bg-blue-600/30 text-blue-300 text-xs font-bold rounded-full border border-blue-400/30">
              LIVE
            </span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
            {/* Predicted Revenue */}
            <div className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="h-4 w-4 text-blue-600" />
                <h4 className="text-sm font-semibold text-slate-800">Collections Pace Projection</h4>
              </div>
              <div style={{ height: 180 }}>
                {mlPrediction.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={mlPrediction} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="predGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 11 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 11 }} tickFormatter={fmtM} />
                      <Tooltip
                        formatter={(value: number) => [fmtM(value), "Projected"]}
                        contentStyle={{ fontSize: "11px", borderRadius: "8px", border: "1px solid #e2e8f0" }}
                      />
                      <Area type="monotone" dataKey="predicted" stroke="#3b82f6" strokeWidth={2.5}
                        strokeDasharray="6 3" fill="url(#predGrad)"
                        dot={{ r: 4, fill: "#3b82f6" }} name="Projected Collections" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full rounded-xl border border-dashed border-slate-200 bg-slate-50 flex items-center justify-center text-sm text-slate-400">
                    Projection output will appear once enough monthly collection history is available.
                  </div>
                )}
              </div>
              <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                <div className="flex items-center gap-2">
                  <Zap className="h-3.5 w-3.5 text-blue-600 flex-shrink-0" />
                  <p className="text-xs text-blue-700 font-medium">
                    {mlPrediction.length > 0 ? `Projected collections pace: ${fmtM(predictedAnnualTotal)}` : "Projected pace is not available yet."}
                  </p>
                </div>
              </div>
            </div>

            {/* Risk alerts */}
            <div className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <h4 className="text-sm font-semibold text-slate-800">Audit Risk Alerts</h4>
                {canViewAudit && (
                  <span className="ml-auto px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-full">
                    {riskEvents.length} flagged
                  </span>
                )}
              </div>
              {canViewAudit ? (
                <>
                  <div className="space-y-3">
                    {riskEvents.length > 0 ? (
                      riskEvents.map((event) => (
                        <div key={event.id} className="flex items-start gap-3 p-3 rounded-lg border border-amber-200 bg-amber-50/50">
                          <div className="p-1.5 bg-amber-100 rounded-md flex-shrink-0">
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold text-amber-800 font-mono">{event.id}</span>
                              <span className="text-[10px] bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded font-medium">{event.action}</span>
                            </div>
                            <p className="text-xs text-slate-600 mt-0.5">{event.user} · {event.timestamp}</p>
                            <p className="text-xs font-semibold text-slate-800 mt-0.5">{event.detail}</p>
                          </div>
                          <button onClick={() => navigate("/app/audit")} className="flex-shrink-0 px-2 py-1 text-[10px] font-medium text-amber-700 border border-amber-300 rounded-lg hover:bg-amber-100 transition-colors">
                            Review
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50/40 p-6 text-center text-sm text-amber-700">
                        No audit-derived risk flags are available yet.
                      </div>
                    )}
                  </div>
                  <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <p className="text-xs text-slate-500 flex items-center gap-1.5">
                      <Brain className="h-3.5 w-3.5 text-slate-400" />
                      Derived from the live audit trail and recorded collections.
                    </p>
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                    Audit-derived risk monitoring is reserved for Admin and Auditor accounts.
                  </div>
                  <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                    <p className="text-xs text-amber-700 flex items-center gap-1.5">
                      <Lock className="h-3.5 w-3.5 flex-shrink-0" />
                      Collections forecasting remains available, but review of audit trail anomalies requires elevated audit access.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : isAuditor ? (
        /* Auditor sees risk events only */
        <div className="bg-white rounded-xl border border-amber-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-amber-200 flex items-center gap-3 bg-amber-50">
            <div className="p-2 rounded-lg bg-amber-100">
              <AlertTriangle className="h-4 w-4 text-amber-700" />
            </div>
            <div>
              <h3 className="text-amber-900">Audit Risk Flags</h3>
              <p className="text-amber-600 text-xs mt-0.5">Live warning and critical events requiring audit verification</p>
            </div>
            <span className="ml-auto px-2.5 py-1 bg-amber-100 text-amber-700 text-xs font-bold rounded-full border border-amber-300">
              AUDITOR VIEW
            </span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-amber-100">
            {riskEvents.length > 0 ? (
              riskEvents.map((event) => (
                <div key={event.id} className="p-5 flex items-start gap-3">
                  <div className="p-2 bg-amber-100 rounded-lg flex-shrink-0 mt-0.5">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-xs font-bold text-amber-800 font-mono">{event.id}</span>
                      <span className="text-[10px] bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded font-semibold">{event.action}</span>
                    </div>
                    <p className="text-sm font-semibold text-slate-800">{event.user}</p>
                    <p className="text-xs text-slate-500">{event.timestamp}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <p className="text-xs text-slate-600">Detail: <span className="font-bold text-slate-800">{event.detail}</span></p>
                      <span className="text-[10px] text-amber-600 font-medium border border-amber-300 bg-amber-50 px-1.5 py-0.5 rounded">Pending Review</span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="lg:col-span-3 p-8 text-center text-sm text-amber-700 bg-amber-50/40">
                No live risk records are currently available for audit review.
              </div>
            )}
          </div>
          <div className="px-5 py-3 border-t border-amber-100 bg-amber-50/50 flex items-center gap-2">
            <Lock className="h-3.5 w-3.5 text-amber-600" />
            <p className="text-xs text-amber-700">
              Read-only view · Cross-reference with <span className="font-semibold">Audit Support</span> and <span className="font-semibold">Property Registry</span> for full validation
            </p>
          </div>
        </div>
      ) : (
        /* Staff sees locked banner */
        <LockedAIBanner />
      )}

      {/* ── Bottom: Alerts + Recent Payments + Quick Actions ─────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Alerts */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/50 flex justify-between items-center">
            <h3 className="text-slate-900 flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-blue-600" /> Deadlines & Alerts
            </h3>
            <button className="text-xs text-blue-600 font-medium hover:text-blue-700">View All →</button>
          </div>
          <div className="divide-y divide-slate-100">
            {alerts.length > 0 ? (
              alerts.map((alert) => (
                <div key={alert.id} className={`p-4 hover:bg-slate-50 transition-colors flex items-start gap-4 group ${alert.type === "critical" ? "border-l-2 border-l-red-500" : ""}`}>
                  <div className={`mt-0.5 p-2 rounded-full flex-shrink-0 ${alert.type === "critical" ? "bg-red-100 text-red-600" : alert.type === "deadline" ? "bg-amber-100 text-amber-600" : "bg-blue-100 text-blue-600"}`}>
                    {alert.type === "critical" ? <AlertTriangle className="h-4 w-4" /> :
                     alert.type === "deadline" ? <CalendarDays  className="h-4 w-4" /> :
                                                 <Brain         className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className={`text-sm font-medium ${alert.type === "critical" ? "text-red-700" : "text-slate-900"}`}>
                      {alert.title}
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">{alert.desc}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-xs font-medium ${alert.type === "critical" ? "text-red-600" : alert.time === "Today" ? "text-blue-600" : "text-slate-500"}`}>
                      {alert.time}
                    </span>
                    <button className="px-2.5 py-1 text-xs border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-100 opacity-0 group-hover:opacity-100 transition-opacity font-medium">
                      Action
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-10 text-center text-sm text-slate-400">No deadlines or alerts available yet.</div>
            )}
          </div>
        </div>

        {/* Recent Activity + Quick Actions */}
        <div className="space-y-4">
          {canViewPayments ? (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/50 flex justify-between items-center">
                <h3 className="text-sm text-slate-900 flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-blue-600" /> Recent Payments
                </h3>
              </div>
              <div className="divide-y divide-slate-100">
                {recentPayments.length > 0 ? (
                  recentPayments.map((pay) => (
                    <div key={pay.id} className="px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{pay.owner}</p>
                        <p className="text-xs text-slate-400">{pay.property} · {pay.date}</p>
                      </div>
                      <div className="text-right flex-shrink-0 ml-3">
                        <p className="text-xs font-bold text-emerald-700">{fmt(pay.amount)}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{pay.id}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center text-sm text-slate-400">No recent payments recorded yet.</div>
                )}
              </div>
            </div>
          ) : canViewTax ? (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/50 flex justify-between items-center">
                <h3 className="text-sm text-slate-900 flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-blue-600" /> Recent Assessments
                </h3>
              </div>
              <div className="divide-y divide-slate-100">
                {recentAssessments.length > 0 ? (
                  recentAssessments.map((assessment) => (
                    <div key={assessment.id} className="px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{assessment.owner}</p>
                        <p className="text-xs text-slate-400">{assessment.property} · TY {assessment.taxYear} · {assessment.date}</p>
                      </div>
                      <div className="text-right flex-shrink-0 ml-3">
                        <p className="text-xs font-bold text-sky-700">{fmt(assessment.amount)}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{assessment.id}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center text-sm text-slate-400">No recent assessment activity recorded yet.</div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/50 flex justify-between items-center">
                <h3 className="text-sm text-slate-900 flex items-center gap-2">
                  <Lock className="h-4 w-4 text-slate-500" /> Restricted Activity Feed
                </h3>
              </div>
              <div className="p-8 text-center text-sm text-slate-400">Activity feeds for this dashboard are limited to the modules available for your role.</div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/50">
              <h3 className="text-sm text-slate-900">Quick Actions</h3>
            </div>
            <div className="p-4 space-y-2">
              {isAuditor ? (
                // Auditor-specific quick actions — read-only, outlined style
                <>
                  <button
                    onClick={() => navigate("/app/audit")}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-amber-50 transition-colors text-left border border-amber-200 hover:border-amber-300 bg-white"
                  >
                    <div className="p-1.5 rounded-md text-amber-600 bg-amber-50">
                      <ClipboardList className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-sm text-slate-700 font-medium">View Audit Trail</span>
                    <ArrowRight className="h-3.5 w-3.5 text-amber-400 ml-auto" />
                  </button>
                  <button
                    onClick={() => navigate("/app/reporting")}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-amber-50 transition-colors text-left border border-amber-200 hover:border-amber-300 bg-white"
                  >
                    <div className="p-1.5 rounded-md text-amber-600 bg-amber-50">
                      <FileDown className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-sm text-slate-700 font-medium">Export Report</span>
                    <ArrowRight className="h-3.5 w-3.5 text-amber-400 ml-auto" />
                  </button>
                  <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 transition-colors text-left border border-slate-100 hover:border-slate-200">
                    <div className="p-1.5 rounded-md text-red-600 bg-red-50">
                      <TrendingDown className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-sm text-slate-700 font-medium">View Delinquency Report</span>
                    <ArrowRight className="h-3.5 w-3.5 text-slate-300 ml-auto" />
                  </button>
                  <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 transition-colors text-left border border-slate-100 hover:border-slate-200">
                    <div className="p-1.5 rounded-md text-purple-600 bg-purple-50">
                      <Building2 className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-sm text-slate-700 font-medium">Generate Barangay Summary</span>
                    <ArrowRight className="h-3.5 w-3.5 text-slate-300 ml-auto" />
                  </button>
                </>
              ) : (
                quickActions.length > 0 ? (
                  quickActions.map((action) => {
                    const Icon = action.icon;
                    return (
                      <button key={action.label} onClick={() => navigate(action.path)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 transition-colors text-left border border-slate-100 hover:border-slate-200">
                        <div className={`p-1.5 rounded-md ${action.color}`}>
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <span className="text-sm text-slate-700 font-medium">{action.label}</span>
                        <ArrowRight className="h-3.5 w-3.5 text-slate-300 ml-auto" />
                      </button>
                    );
                  })
                ) : (
                  <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-400">
                    No quick actions are available for your current access level.
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}