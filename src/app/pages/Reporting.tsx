import { useEffect, useMemo, useRef, useState } from "react";
import { FileText, Download, Filter, Eye, RefreshCw, FileCheck, X, Printer, MapPin, TrendingUp, Lock, ExternalLink } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { AccessDenied, ReadOnlyBanner } from "../components/RoleGuard";
import { getApiErrorMessage, getCollectionsReport, getDelinquencyReport, getPropertiesReport, type CollectionsReportResponse, type DelinquencyReportResponse, type PropertiesReportResponse } from "../services/reportService";
import { exportReporting, safeExport } from "../services/exportService";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────
type ReportType   = "barangay" | "monthly" | "annual" | "delinquency";
type ReportStatus = "Draft" | "For Review" | "Approved" | "Published";

type Report = {
  id: string; name: string; type: ReportType;
  period: string; status: ReportStatus;
  dateGenerated: string; totalProperties: number;
  totalAssessed: number; totalTaxDue: number; totalCollected: number;
};

const STATUS_STYLES: Record<ReportStatus, string> = {
  Draft:       "bg-slate-100 text-slate-600",
  "For Review":"bg-amber-100 text-amber-700",
  Approved:    "bg-blue-100 text-blue-700",
  Published:   "bg-emerald-100 text-emerald-700",
};

const TYPE_LABELS: Record<ReportType, string> = {
  barangay:   "Barangay Summary",
  monthly:    "Monthly Report",
  annual:     "Annual Report",
  delinquency:"Delinquency List",
};

const fmt = (val: number) => `₱ ${val.toLocaleString("en-PH", { minimumFractionDigits: 0 })}`;
const fmtM = (val: number) => val >= 1000000 ? `₱${(val/1000000).toFixed(2)}M` : `₱${(val/1000).toFixed(0)}K`;

function buildPeriodLabel(labels: string[]) {
  if (labels.length === 0) {
    return "No payment periods recorded";
  }

  if (labels.length === 1) {
    return labels[0];
  }

  return `${labels[0]} to ${labels[labels.length - 1]}`;
}

function buildLiveReports(
  collectionsReport: CollectionsReportResponse | null,
  delinquencyReport: DelinquencyReportResponse | null,
  propertiesReport: PropertiesReportResponse | null,
): Report[] {
  if (!collectionsReport || !delinquencyReport || !propertiesReport) {
    return [];
  }

  const dateGenerated = new Date().toISOString().split("T")[0];
  const collectionPeriod = buildPeriodLabel(collectionsReport.labels);
  const totalProperties = propertiesReport.summary.totalProperties;
  const totalAssessed = propertiesReport.summary.totalAssessedValue;
  const totalTaxDue = collectionsReport.summary.totalDue;
  const totalCollected = collectionsReport.summary.totalCollected;

  return [
    {
      id: "RPT-COLLECTIONS",
      name: "Collection Performance Report",
      type: "monthly",
      period: collectionPeriod,
      status: "Published",
      dateGenerated,
      totalProperties,
      totalAssessed,
      totalTaxDue,
      totalCollected,
    },
    {
      id: "RPT-PROPERTIES",
      name: "Property Registry Summary",
      type: "barangay",
      period: "Current registry snapshot",
      status: "Published",
      dateGenerated,
      totalProperties,
      totalAssessed,
      totalTaxDue,
      totalCollected,
    },
    {
      id: "RPT-ANNUAL",
      name: "Annual Revenue Overview",
      type: "annual",
      period: collectionPeriod,
      status: "Published",
      dateGenerated,
      totalProperties,
      totalAssessed,
      totalTaxDue,
      totalCollected,
    },
    {
      id: "RPT-DELINQUENCY",
      name: "Delinquency Monitoring Report",
      type: "delinquency",
      period: "All assessed years",
      status: delinquencyReport.summary.outstandingBalance > 0 ? "For Review" : "Published",
      dateGenerated,
      totalProperties,
      totalAssessed,
      totalTaxDue: delinquencyReport.summary.totalDue,
      totalCollected: delinquencyReport.summary.totalPaid,
    },
  ];
}

export default function Reporting() {
  const { can, user } = useAuth();
  const canView = can("reporting.view");

  const [activeTab, setActiveTab] = useState<"all" | ReportType>("all");
  const [previewReport, setPreviewReport] = useState<Report | null>(null);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [highlightedReport, setHighlightedReport] = useState<string | null>(null);
  const [collectionsReport, setCollectionsReport] = useState<CollectionsReportResponse | null>(null);
  const [delinquencyReport, setDelinquencyReport] = useState<DelinquencyReportResponse | null>(null);
  const [propertiesReport, setPropertiesReport] = useState<PropertiesReportResponse | null>(null);
  const reportTableRef = useRef<HTMLDivElement>(null);

  const canGenerate = can("reporting.generate");
  const canSubmit   = can("reporting.submit");
  const canExport   = can("reporting.export");
  const isReadOnly  = !canGenerate && !canSubmit;

  const fetchReports = () => Promise.all([getCollectionsReport(), getDelinquencyReport(), getPropertiesReport()]);

  useEffect(() => {
    if (!canView) {
      return;
    }

    let ignore = false;

    async function loadReports() {
      setLoading(true);
      setErrorMessage(null);

      try {
        const [collections, delinquency, properties] = await fetchReports();

        if (!ignore) {
          setCollectionsReport(collections);
          setDelinquencyReport(delinquency);
          setPropertiesReport(properties);
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

    void loadReports();

    return () => {
      ignore = true;
    };
  }, [canView]);

  const reports = useMemo(
    () => buildLiveReports(collectionsReport, delinquencyReport, propertiesReport),
    [collectionsReport, delinquencyReport, propertiesReport],
  );

  const filtered = reports.filter((r) => activeTab === "all" || r.type === activeTab);

  const barangayData = useMemo(
    () => (collectionsReport?.byBarangay ?? []).map((item) => ({
      name: item.barangay,
      collected: Number(item.totalCollected),
      due: Number(item.totalDue),
    })),
    [collectionsReport],
  );

  const handleGenerate = () => {
    if (!canGenerate) return;

    setGenerating(true);
    setErrorMessage(null);

    void fetchReports()
      .then(([collections, delinquency, properties]) => {
        setCollectionsReport(collections);
        setDelinquencyReport(delinquency);
        setPropertiesReport(properties);
        setHighlightedReport("RPT-ANNUAL");
      })
      .catch((error) => {
        setErrorMessage(getApiErrorMessage(error));
      })
      .finally(() => {
        setGenerating(false);
      });
  };

  const handleViewAnnualReport = () => {
    setActiveTab("annual");
    setPreviewReport(null);
    setHighlightedReport(null);
    setTimeout(() => {
      reportTableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  const summary = {
    forReview: reports.filter(r => r.status === "For Review").length,
    published: reports.filter(r => r.status === "Published").length,
    total:     reports.length,
    totalCollected: collectionsReport?.summary.totalCollected ?? 0,
    outstandingBalance: delinquencyReport?.summary.outstandingBalance ?? 0,
    totalProperties: propertiesReport?.summary.totalProperties ?? 0,
    latestPeriod: buildPeriodLabel(collectionsReport?.labels ?? []),
  };

  if (!canView) {
    return <AccessDenied requiredRole="Accountant, Admin, or Auditor" />;
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-slate-900 tracking-tight">Government Reporting</h1>
          <p className="text-sm text-slate-500 mt-1">Generate, review, and export official LGU property tax reports and barangay summaries.</p>
        </div>
        {canGenerate ? (
          <button onClick={handleGenerate}
            className="px-4 py-2 text-white rounded-lg text-sm font-medium transition-colors shadow-sm flex items-center gap-2"
            style={{ backgroundColor: "#0d2137" }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#1e3a5f"}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#0d2137"}>
            <RefreshCw className={`h-4 w-4 ${generating ? "animate-spin" : ""}`} />
            {generating ? "Generating..." : "Generate New Report"}
          </button>
        ) : (
          <div className="px-4 py-2 bg-slate-100 text-slate-400 rounded-lg text-sm font-medium flex items-center gap-2 cursor-not-allowed border border-slate-200">
            <RefreshCw className="h-4 w-4" /> Generate New Report
          </div>
        )}
      </div>

      {isReadOnly && (
        <ReadOnlyBanner message={`Read-Only Mode — ${user?.role} accounts can view and export reports but cannot generate or publish new filings.`} />
      )}

      {errorMessage && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
          <X className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-800">Unable to load live reports</p>
            <p className="text-xs text-red-600 mt-0.5">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-slate-50 text-slate-600 rounded-lg flex-shrink-0"><FileText className="h-5 w-5" /></div>
            <p className="text-xs text-slate-500">Live Reports</p>
          </div>
          <p className="text-xl font-bold text-slate-900">{summary.total}</p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-lg flex-shrink-0"><Eye className="h-5 w-5" /></div>
            <p className="text-xs text-slate-500">Needs Review</p>
          </div>
          <p className="text-xl font-bold text-slate-900">{summary.forReview}</p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg flex-shrink-0"><FileCheck className="h-5 w-5" /></div>
            <p className="text-xs text-slate-500">Collected</p>
          </div>
          <p className="text-xl font-bold text-slate-900">{fmtM(summary.totalCollected)}</p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 border-l-4 border-l-red-500 shadow-sm">
          <p className="text-xs text-slate-500">Latest Coverage</p>
          <p className="text-sm font-bold text-red-600 mt-1">{summary.latestPeriod}</p>
          <p className="text-xs text-slate-400">{summary.totalProperties.toLocaleString()} registered properties in the live snapshot</p>
          {reports.some((report) => report.type === "annual") && (
            <button
              onClick={handleViewAnnualReport}
              className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 hover:border-slate-400 transition-colors"
            >
              <ExternalLink className="h-3 w-3" /> View Report
            </button>
          )}
        </div>
      </div>

      {/* Barangay Collection Chart */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 mb-5">
          <MapPin className="h-4 w-4 text-blue-600" />
          <h3 className="text-slate-900">Collection by Barangay</h3>
        </div>
        <div style={{ height: 240 }}>
          {loading ? (
            <div className="h-full rounded-xl border border-dashed border-slate-200 bg-slate-50 flex items-center justify-center text-sm text-slate-400">
              Loading live report data...
            </div>
          ) : barangayData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barangayData} margin={{ top: 5, right: 10, left: 0, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 10 }} angle={-20} textAnchor="end" interval={0} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 11 }} tickFormatter={fmtM} />
                <Tooltip formatter={(v: number) => [fmt(v)]} contentStyle={{ fontSize: "11px", borderRadius: "8px", border: "1px solid #e2e8f0" }} />
                <Bar key="bar-due"       dataKey="due"       fill="#e2e8f0" radius={[4,4,0,0]} barSize={24} name="Tax Due" />
                <Bar key="bar-collected" dataKey="collected" fill="#0d2137" radius={[4,4,0,0]} barSize={24} name="Collected" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full rounded-xl border border-dashed border-slate-200 bg-slate-50 flex items-center justify-center text-sm text-slate-400">
              No barangay collection data is available yet.
            </div>
          )}
        </div>
      </div>

      {/* Report Table */}
      <div ref={reportTableRef} className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden">
        <div className="flex border-b border-slate-200 bg-slate-50/50 px-5 pt-4 gap-0.5 overflow-x-auto">
          {([
            { key: "all",        label: "All Reports" },
            { key: "barangay",   label: "Barangay Summary" },
            { key: "monthly",    label: "Monthly" },
            { key: "annual",     label: "Annual" },
            { key: "delinquency",label: "Delinquency" },
          ] as const).map(({ key, label }) => (
            <button key={key} onClick={() => setActiveTab(key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === key ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"}`}>
              {label}
            </button>
          ))}
          <div className="flex-1" />
          <button className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg mb-2 bg-white hover:bg-slate-50 mr-1">
            <Filter className="h-3.5 w-3.5" /> Filter
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-medium border-b border-slate-200 tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Report</th>
                <th className="px-5 py-3.5">Type</th>
                <th className="px-5 py-3.5">Period</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Tax Due</th>
                <th className="px-5 py-3.5 text-right">Collected</th>
                <th className="px-5 py-3.5">Generated</th>
                <th className="px-5 py-3.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading ? (
                <tr><td colSpan={8} className="px-5 py-12 text-center text-slate-400 text-sm">Loading report snapshots from the backend...</td></tr>
              ) : filtered.map((report) => (
                <tr
                  key={report.id}
                  className={`hover:bg-slate-50 transition-colors group ${highlightedReport === report.id ? "ring-2 ring-inset ring-amber-400 bg-amber-50/40" : ""}`}
                  onAnimationEnd={() => {
                    if (highlightedReport === report.id) {
                      setTimeout(() => setHighlightedReport(null), 2500);
                    }
                  }}
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 bg-blue-50 rounded-md flex-shrink-0"><FileText className="h-3.5 w-3.5 text-blue-600" /></div>
                      <div>
                        <p className="font-medium text-slate-900 text-xs max-w-[200px] truncate" title={report.name}>{report.name}</p>
                        <p className="text-[11px] text-slate-400">{report.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full font-medium">{TYPE_LABELS[report.type]}</span>
                  </td>
                  <td className="px-5 py-4 text-xs text-slate-600 font-medium">{report.period}</td>
                  <td className="px-5 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${STATUS_STYLES[report.status]}`}>{report.status}</span>
                  </td>
                  <td className="px-5 py-4 text-right text-xs text-slate-600">{fmt(report.totalTaxDue)}</td>
                  <td className="px-5 py-4 text-right">
                    <p className="text-xs font-bold text-slate-900">{fmt(report.totalCollected)}</p>
                    {report.totalTaxDue > 0 && (
                      <p className="text-[10px] text-emerald-600">{Math.round((report.totalCollected / report.totalTaxDue) * 100)}%</p>
                    )}
                  </td>
                  <td className="px-5 py-4 text-xs text-slate-500">{report.dateGenerated}</td>
                  <td className="px-5 py-4 text-center">
                    <div className="flex justify-center gap-1.5">
                      <button onClick={() => setPreviewReport(report)} className="p-1.5 text-slate-500 hover:text-blue-600 bg-slate-100 hover:bg-blue-50 rounded-md transition-colors" title="Preview">
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      {canExport && (
                        <button
                            onClick={async () => {
                              try {
                                await safeExport(
                                  () => exportReporting(report.id),
                                  () => ({ data: [report], fileName: `report-${report.id}.pdf` }),
                                );
                              } catch (err: any) {
                                console.error('Export report failed', err)
                                const message = err?.message || 'Unable to export report. Please try again later.'
                                alert(message)
                              }
                            }}
                            className="p-1.5 text-slate-500 hover:text-emerald-600 bg-slate-100 hover:bg-emerald-50 rounded-md transition-colors" title="Export PDF">
                            <Download className="h-3.5 w-3.5" />
                          </button>
                      )}
                      {canSubmit && report.status === "Draft" && (
                        <button className="px-2.5 py-1 bg-blue-600 text-white border border-blue-600 text-xs rounded-md font-medium hover:bg-blue-700 transition-colors">
                          Submit
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={8} className="px-5 py-12 text-center text-slate-400 text-sm">No reports found.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {isReadOnly && (
          <div className="px-5 py-2.5 border-t border-amber-100 bg-amber-50/50 flex items-center gap-2 text-xs text-amber-700">
            <Eye className="h-3.5 w-3.5 flex-shrink-0" />
            View and export access only. Generating and submitting reports requires Accountant or Admin access.
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {previewReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 flex-shrink-0">
              <div>
                <h3 className="text-slate-900">Report Preview</h3>
                <p className="text-xs text-slate-500 mt-0.5">{previewReport.id} · {previewReport.period}</p>
              </div>
              <div className="flex items-center gap-2">
                <button className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-100 flex items-center gap-1.5">
                  <Printer className="h-3.5 w-3.5" /> Print
                </button>
                {canExport && (
                  <button
                    onClick={async () => {
                      try {
                        await safeExport(
                          () => exportReporting(previewReport.id),
                          () => ({ data: [previewReport], fileName: `report-${previewReport.id}.pdf` }),
                        );
                      } catch (err: any) {
                        console.error('Export report failed', err)
                        const message = err?.message || 'Unable to export report. Please try again later.'
                        alert(message)
                      }
                    }}
                    className="px-3 py-1.5 text-white rounded-lg text-sm font-medium flex items-center gap-1.5"
                    style={{ backgroundColor: "#0d2137" }}>
                    <Download className="h-3.5 w-3.5" /> Export PDF
                  </button>
                )}
                <button onClick={() => setPreviewReport(null)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto p-6 flex-1">
              <div className="border-2 border-slate-300 rounded-lg overflow-hidden">
                <div className="text-white p-4 text-center" style={{ backgroundColor: "#0d2137" }}>
                  <p className="text-xs tracking-widest uppercase text-blue-300">Republic of the Philippines · Local Government Unit</p>
                  <p className="tracking-widest uppercase font-bold text-white">Office of the Municipal / City Treasurer</p>
                  <h2 className="mt-2 text-white text-sm">{previewReport.name}</h2>
                  <p className="text-blue-300 text-xs mt-1">{previewReport.period}</p>
                </div>
                <div className="p-6 space-y-4 bg-slate-50">
                  <div className="grid grid-cols-2 gap-4 bg-white p-4 rounded-lg border border-slate-200">
                    {[
                      ["Report ID", previewReport.id],
                      ["Report Type", TYPE_LABELS[previewReport.type]],
                      ["Period Covered", previewReport.period],
                      ["Date Generated", previewReport.dateGenerated],
                      ["Status", previewReport.status],
                      ["Total Properties", previewReport.totalProperties.toLocaleString()],
                    ].map(([l, v]) => (
                      <div key={l}><p className="text-xs text-slate-500 uppercase tracking-wider mb-0.5">{l}</p><p className="text-sm font-medium text-slate-900">{v}</p></div>
                    ))}
                  </div>
                  <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-100">
                        <tr>
                          <th className="px-4 py-2.5 text-left text-xs text-slate-600 uppercase">Description</th>
                          <th className="px-4 py-2.5 text-right text-xs text-slate-600 uppercase">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        <tr><td className="px-4 py-2.5 text-slate-700">Total Assessed Value</td><td className="px-4 py-2.5 text-right font-medium">{fmt(previewReport.totalAssessed)}</td></tr>
                        <tr><td className="px-4 py-2.5 text-slate-700">Total Tax Due (Basic RPT + SEF)</td><td className="px-4 py-2.5 text-right font-medium">{fmt(previewReport.totalTaxDue)}</td></tr>
                        <tr><td className="px-4 py-2.5 text-slate-700">Total Collected</td><td className="px-4 py-2.5 text-right font-medium text-emerald-700">{fmt(previewReport.totalCollected)}</td></tr>
                        <tr><td className="px-4 py-2.5 text-slate-700">Uncollected Balance</td><td className="px-4 py-2.5 text-right font-medium text-red-600">{fmt(previewReport.totalTaxDue - previewReport.totalCollected)}</td></tr>
                        <tr className="bg-slate-50">
                          <td className="px-4 py-3 font-bold text-slate-900">Collection Efficiency</td>
                          <td className="px-4 py-3 text-right font-black text-blue-700">
                            {previewReport.totalTaxDue > 0 ? Math.round((previewReport.totalCollected / previewReport.totalTaxDue) * 100) : 0}%
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-slate-200">
                    <div>
                      <p className="text-xs text-slate-500">Filing Status</p>
                      <span className={`inline-block mt-1 px-3 py-1 rounded-full text-xs font-bold ${STATUS_STYLES[previewReport.status]}`}>{previewReport.status}</span>
                    </div>
                    {previewReport.status === "Draft" && canSubmit && (
                      <button className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" /> Approve & Publish
                      </button>
                    )}
                    {previewReport.status === "Draft" && !canSubmit && (
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Lock className="h-3.5 w-3.5" /> Approval requires Accountant access
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}