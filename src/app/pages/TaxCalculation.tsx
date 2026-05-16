import { useState, useMemo, useEffect } from "react";
import { Search, Filter, Download, Calculator, X, CheckCircle, AlertCircle, Lock, Info, Settings } from "lucide-react";
import { exportTaxCalculations, safeExport } from "../services/exportService";
import { useAuth } from "../context/AuthContext";
import { AccessDenied, ReadOnlyBanner, LimitedAccessBanner, PermissionGate } from "../components/RoleGuard";
import Pagination from "../components/Pagination";
import { getProperties, type PropertyDto } from "../services/propertyService";
import { calculateTax, getApiErrorMessage, getTaxAssessments, type TaxDto } from "../services/taxService";

// ─── Types ────────────────────────────────────────────────────────────────────
type PropertyType = "Residential" | "Commercial" | "Agricultural" | "Industrial" | "Special";

type PropertyTaxRecord = {
  id: string;
  ownerName: string;
  barangay: string;
  propertyType: PropertyType;
  assessedValue: number;
  basicRPTRate: number;   // percentage (e.g. 1.0 or 2.0)
  sefRate: number;        // Special Education Fund (usually 1%)
  basicTaxDue: number;
  sefDue: number;
  totalTaxDue: number;
  taxYear: number;
  anomaly?: boolean;
};

// ─── Tax Rates Config ─────────────────────────────────────────────────────────
const DEFAULT_RATES: Record<PropertyType, { basic: number; sef: number }> = {
  Residential:  { basic: 1.0, sef: 1.0 },
  Commercial:   { basic: 2.0, sef: 1.0 },
  Agricultural: { basic: 1.0, sef: 1.0 },
  Industrial:   { basic: 2.0, sef: 1.0 },
  Special:      { basic: 0.0, sef: 0.0 },
};

const fmt     = (val: number) => `₱ ${val.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;
const fmtRate = (v: number) => `${v.toFixed(1)}%`;

const TYPE_CLR: Record<PropertyType, string> = {
  Residential: "bg-blue-100 text-blue-700", Commercial: "bg-purple-100 text-purple-700",
  Agricultural:"bg-green-100 text-green-700", Industrial: "bg-orange-100 text-orange-700",
  Special:     "bg-slate-100 text-slate-600",
};

function normalizeType(value?: string | null): PropertyType {
  return (["Residential", "Commercial", "Agricultural", "Industrial", "Special"] as PropertyType[])
    .find((type) => type.toLowerCase() === (value ?? "").trim().toLowerCase()) ?? "Residential";
}

function buildRecord(assessment: TaxDto, property: PropertyDto | undefined, rates: Record<PropertyType, { basic: number; sef: number }>): PropertyTaxRecord {
  const propertyType = normalizeType(property?.propertyType);
  const basicRPTRate = rates[propertyType].basic;
  const sefRate = rates[propertyType].sef;
  const totalRate = basicRPTRate + sefRate;
  const totalTaxDue = Number(assessment.taxDue);
  const basicTaxDue = totalRate > 0 ? totalTaxDue * (basicRPTRate / totalRate) : 0;
  const sefDue = totalRate > 0 ? totalTaxDue * (sefRate / totalRate) : 0;

  return {
    id: assessment.propertyPin ?? property?.pin ?? String(assessment.propertyId),
    ownerName: assessment.ownerName ?? property?.ownerName ?? "Unknown taxpayer",
    barangay: property?.barangay ?? "Registered Property",
    propertyType,
    assessedValue: Number(assessment.assessedValue),
    basicRPTRate,
    sefRate,
    basicTaxDue,
    sefDue,
    totalTaxDue,
    taxYear: assessment.taxYear,
  };
}

export default function TaxCalculation() {
  const { can, user } = useAuth();

  const canView    = can("tax.view");
  const canCreate  = can("tax.create");
  const canEdit    = can("tax.edit");
  const isReadOnly = !can("tax.create") && !canEdit && !can("tax.delete");

  const [rates,       setRates]       = useState(DEFAULT_RATES);
  const [properties,  setProperties]  = useState<PropertyDto[]>([]);
  const [assessments, setAssessments] = useState<TaxDto[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [search,      setSearch]      = useState("");
  const [typeFilter,  setTypeFilter]  = useState<"All" | PropertyType>("All");
  const [showRates,   setShowRates]   = useState(false);
  const [editRates,   setEditRates]   = useState(rates);
  const [toast,       setToast]       = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const perPage = 7;

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type }); setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    if (!canView) {
      return;
    }

    let ignore = false;

    async function loadTaxData() {
      setLoading(true);

      try {
        const [propertyResult, assessmentResult] = await Promise.all([getProperties(), getTaxAssessments()]);

        if (!ignore) {
          setProperties(propertyResult);
          setAssessments(assessmentResult);
        }
      } catch (error) {
        if (!ignore) {
          showToast(getApiErrorMessage(error), "error");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    void loadTaxData();

    return () => {
      ignore = true;
    };
  }, [canView]);

  const records = useMemo(() => {
    const propertyMap = new Map(properties.map((property) => [property.id, property]));
    return assessments.map((assessment) => buildRecord(assessment, propertyMap.get(assessment.propertyId), rates));
  }, [assessments, properties, rates]);

  const filtered = useMemo(() =>
    records.filter((r) => {
      const mSearch = r.ownerName.toLowerCase().includes(search.toLowerCase()) ||
        r.id.toLowerCase().includes(search.toLowerCase()) ||
        r.barangay.toLowerCase().includes(search.toLowerCase());
      const mType = typeFilter === "All" || r.propertyType === typeFilter;
      return mSearch && mType;
    }), [records, search, typeFilter]
  );

  const totalPages = Math.ceil(filtered.length / perPage);
  const paginated  = filtered.slice((currentPage - 1) * perPage, currentPage * perPage);

  const totals = useMemo(() =>
    filtered.reduce((acc, r) => ({
      assessed: acc.assessed + r.assessedValue,
      basic:    acc.basic + r.basicTaxDue,
      sef:      acc.sef   + r.sefDue,
      total:    acc.total + r.totalTaxDue,
    }), { assessed: 0, basic: 0, sef: 0, total: 0 }),
    [filtered]
  );

  if (!canView) {
    return <AccessDenied requiredRole="System Administrator, Assessment Staff, Treasury Accountant, or Internal Auditor" />;
  }

  const handleSaveRates = () => {
    setRates(editRates);
    showToast("Tax rates updated successfully.");
    setShowRates(false);
  };

  const handleCalculateCurrentProperties = async () => {
    if (properties.length === 0) {
      showToast("Register a property first before calculating tax.", "error");
      return;
    }

    setSaving(true);

    try {
      const currentYear = new Date().getFullYear();
      const updated = await Promise.all(properties.map((property) => {
        const propertyType = normalizeType(property.propertyType);
        return calculateTax({
          propertyId: property.id,
          taxYear: currentYear,
          marketValue: Number(property.marketValue),
          assessmentLevel: Number(property.assessmentLevel),
          taxRate: rates[propertyType].basic + rates[propertyType].sef,
        });
      }));

      setAssessments((current) => {
        const merged = new Map(current.map((assessment) => [`${assessment.propertyId}-${assessment.taxYear}`, assessment]));
        updated.forEach((assessment) => merged.set(`${assessment.propertyId}-${assessment.taxYear}`, assessment));
        return Array.from(merged.values()).sort((a, b) => b.taxYear - a.taxYear || b.id - a.id);
      });
      showToast("Tax assessments saved to database.");
    } catch (error) {
      showToast(getApiErrorMessage(error), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium ${toast.type === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-red-50 border-red-200 text-red-800"}`}>
          {toast.type === "success" ? <CheckCircle className="h-4 w-4 text-emerald-500" /> : <AlertCircle className="h-4 w-4 text-red-500" />}
          {toast.msg}
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-slate-900 tracking-tight">Real Property Tax Calculation</h1>
          <p className="text-sm text-slate-500 mt-1">
            Auto-compute RPT based on assessed value × tax rate. Pursuant to R.A. 7160 (Local Government Code).
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={async () => {
              try {
                await safeExport(
                  () => exportTaxCalculations(),
                  () => ({ data: records.map(r => ({ id: r.id, ownerName: r.ownerName, barangay: r.barangay, propertyType: r.propertyType, assessedValue: r.assessedValue, totalTaxDue: r.totalTaxDue, taxYear: r.taxYear })), fileName: 'tax-calculations.csv' }),
                );
              } catch (err: any) {
                console.error('Export tax calculations failed', err)
                const message = err?.message || 'Unable to export tax calculations. Please try again later.'
                showToast(message, 'error')
              }
            }}
            className="p-2 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 bg-white shadow-sm" title="Download"
          >
            <Download className="h-4 w-4" />
          </button>
          {canCreate && (
            <button disabled={saving} onClick={handleCalculateCurrentProperties}
              className="px-4 py-2 text-white rounded-lg text-sm font-medium transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50"
              style={{ backgroundColor: "#0d2137" }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#1e3a5f"}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#0d2137"}>
              <Calculator className="h-4 w-4" /> {saving ? "Calculating..." : "Calculate Current Properties"}
            </button>
          )}
          {can("tax.edit") ? (
            <button onClick={() => { setEditRates(rates); setShowRates(true); }}
              className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 shadow-sm flex items-center gap-2">
              <Settings className="h-4 w-4" /> Manage Tax Rates
            </button>
          ) : (
            <div className="px-4 py-2 bg-slate-100 text-slate-400 rounded-lg text-sm font-medium flex items-center gap-2 cursor-not-allowed border border-slate-200">
              <Lock className="h-4 w-4" /> Manage Tax Rates
            </div>
          )}
        </div>
      </div>

      {/* Role banners */}
      {isReadOnly && <ReadOnlyBanner message="Read-Only Mode — Auditors can view tax computations and formulas but cannot modify rates or records." />}
      {user?.role === "Staff" && <LimitedAccessBanner message="Staff Mode — You can view tax calculations. Modifying tax rates requires Accountant or Admin access." />}

      {/* Formula Banner — enhanced for Auditor */}
      <div className={`border rounded-xl p-5 flex items-start gap-4 ${isReadOnly ? "bg-amber-50 border-amber-200" : "bg-white border-blue-200"}`}>
        <div className={`p-2.5 rounded-lg flex-shrink-0 ${isReadOnly ? "bg-amber-100" : "bg-blue-50"}`}>
          <Info className={`h-4 w-4 ${isReadOnly ? "text-amber-700" : "text-blue-600"}`} />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-slate-800 mb-2">RPT Computation Formula — R.A. 7160 (Local Government Code)</p>
          <div className="flex items-center gap-3 text-sm text-slate-600 flex-wrap mb-3">
            <span className="px-2.5 py-1 bg-blue-50 border border-blue-100 rounded-lg font-mono text-blue-800">Assessed Value</span>
            <span className="text-slate-400 font-bold">×</span>
            <span className="px-2.5 py-1 bg-indigo-50 border border-indigo-100 rounded-lg font-mono text-indigo-800">Basic RPT Rate</span>
            <span className="text-slate-400 font-bold">=</span>
            <span className="px-2.5 py-1 bg-emerald-50 border border-emerald-100 rounded-lg font-mono text-emerald-800">Basic Tax Due</span>
            <span className="text-slate-400 text-xs font-medium">+ SEF (1% of Assessed Value)</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            {[
              { type: "Residential",  rate: "1.0%", sef: "1.0%", color: "text-blue-700 bg-blue-50"    },
              { type: "Commercial",   rate: "2.0%", sef: "1.0%", color: "text-purple-700 bg-purple-50" },
              { type: "Agricultural", rate: "1.0%", sef: "1.0%", color: "text-green-700 bg-green-50"   },
              { type: "Industrial",   rate: "2.0%", sef: "1.0%", color: "text-orange-700 bg-orange-50" },
            ].map(({ type, rate, sef, color }) => (
              <div key={type} className={`px-2.5 py-2 rounded-lg border ${color.replace("text-","border-").replace("700","100").replace("bg-","border-")}`}>
                <p className={`font-semibold ${color.split(" ")[0]}`}>{type}</p>
                <p className="text-slate-500 mt-0.5">Basic: <span className="font-bold text-slate-700">{rate}</span></p>
                <p className="text-slate-500">SEF: <span className="font-bold text-slate-700">{sef}</span></p>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-slate-400 mt-2">
            Special properties (churches, gov't buildings) may be exempt. Provinces: max 1% · Cities/Municipalities: max 2%.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Main Table */}
        <div className="lg:col-span-3 bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-wrap gap-3 items-center justify-between">
            <div className="relative flex-1 min-w-48 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input type="text" placeholder="Search by owner, ID, or barangay..."
                value={search} onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                className="pl-9 pr-4 py-2 w-full border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white" />
            </div>
            <div className="flex gap-2">
              <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value as any); setCurrentPage(1); }}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white text-slate-600 focus:outline-none">
                <option value="All">All Types</option>
                {(["Residential","Commercial","Agricultural","Industrial","Special"] as PropertyType[]).map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
              <button className="p-2 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50"><Filter className="h-4 w-4" /></button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-medium border-b border-slate-200 tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">Property ID</th>
                  <th className="px-5 py-3.5">Owner / Location</th>
                  <th className="px-5 py-3.5">Type</th>
                  <th className="px-5 py-3.5 text-right">Assessed Value</th>
                  <th className="px-5 py-3.5 text-right">Basic RPT</th>
                  <th className="px-5 py-3.5 text-right">SEF (1%)</th>
                  <th className="px-5 py-3.5 text-right">Total Tax Due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {loading ? (
                  <tr><td colSpan={7} className="px-5 py-10 text-center text-slate-400 text-sm">Loading tax assessments from database...</td></tr>
                ) : paginated.length === 0 ? (
                  <tr><td colSpan={7} className="px-5 py-10 text-center text-slate-400 text-sm">No tax assessments found.</td></tr>
                ) : (
                  paginated.map((rec) => (
                    <tr key={rec.id} className={`hover:bg-slate-50 transition-colors ${rec.anomaly ? "bg-amber-50/40" : ""}`}>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="text-blue-700 text-xs font-mono font-bold">{rec.id}</span>
                          {rec.anomaly && (
                            <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[9px] font-bold rounded uppercase">Flagged</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-slate-900">{rec.ownerName}</p>
                        <p className="text-xs text-slate-400">{rec.barangay}</p>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${TYPE_CLR[rec.propertyType]}`}>
                          {rec.propertyType}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right text-xs text-slate-600">{fmt(rec.assessedValue)}</td>
                      <td className="px-5 py-3.5 text-right">
                        <p className="text-xs font-medium text-slate-900">{fmt(rec.basicTaxDue)}</p>
                        <p className="text-[10px] text-slate-400">{fmtRate(rec.basicRPTRate)}</p>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <p className="text-xs text-slate-700">{fmt(rec.sefDue)}</p>
                        <p className="text-[10px] text-slate-400">{fmtRate(rec.sefRate)}</p>
                      </td>
                      <td className="px-5 py-3.5 text-right text-xs font-bold text-blue-700">{fmt(rec.totalTaxDue)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Totals Row */}
          <div className="px-5 py-3 bg-blue-50/60 border-t border-slate-200 flex items-center justify-between text-xs">
            <span className="text-slate-500">Period totals ({filtered.length} records)</span>
            <div className="flex gap-6">
              <span className="text-slate-500">Assessed: <span className="font-bold text-slate-800">{fmt(totals.assessed)}</span></span>
              <span className="text-slate-600">Basic RPT: <span className="font-bold">{fmt(totals.basic)}</span></span>
              <span className="text-slate-600">SEF: <span className="font-bold">{fmt(totals.sef)}</span></span>
              <span className="text-blue-700 font-bold">Total: {fmt(totals.total)}</span>
            </div>
          </div>

          {/* Pagination */}
          <div className="p-4 border-t border-slate-200 bg-slate-50/50 flex items-center justify-between text-sm text-slate-500">
            <span className="text-xs">Showing {Math.min((currentPage - 1) * perPage + 1, filtered.length)}–{Math.min(currentPage * perPage, filtered.length)} of {filtered.length}</span>
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
          </div>
        </div>

        {/* Computation Summary Panel */}
        <div className="lg:col-span-1 bg-white border border-slate-200 shadow-sm rounded-xl sticky top-6 overflow-hidden">
          <div className="p-5 text-white" style={{ backgroundColor: "#0d2137" }}>
            <h3 className="flex items-center gap-2 text-white">
              <Calculator className="h-5 w-5 opacity-80" /> RPT Summary
            </h3>
            <p className="text-blue-200 text-xs mt-1">FY 2026 · Current Dataset</p>
          </div>

          <div className="p-5 space-y-4">
            <div className="p-3 bg-slate-50 rounded-lg">
              <p className="text-xs text-slate-500">Total Properties</p>
              <p className="text-xl font-bold text-slate-900 mt-0.5">{filtered.length}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Total Assessed Value</p>
              <p className="font-bold text-slate-900">{fmt(totals.assessed)}</p>
            </div>
            <div className="pt-3 border-t border-slate-100">
              <p className="text-xs text-slate-600 font-medium mb-1">Basic RPT Collectible</p>
              <p className="text-2xl font-bold text-blue-700">{fmt(totals.basic)}</p>
            </div>
            <div className="pt-3 border-t border-slate-100">
              <p className="text-xs text-slate-500 mb-1">SEF Levy</p>
              <p className="font-bold text-slate-700">{fmt(totals.sef)}</p>
            </div>
            <div className="pt-3 border-t border-slate-200 bg-slate-50 -mx-5 px-5 py-4">
              <p className="text-xs text-slate-500 mb-1">Total Tax Collectible</p>
              <p className="text-2xl font-black text-slate-900 tracking-tight">{fmt(totals.total)}</p>
            </div>

            <PermissionGate permission="reporting.generate">
              <button className="w-full py-2.5 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
                style={{ backgroundColor: "#0d2137" }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#1e3a5f"}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#0d2137"}>
                Generate Tax Bill
              </button>
            </PermissionGate>
            {isReadOnly && (
              <div className="w-full py-2.5 bg-slate-100 text-slate-400 rounded-lg text-sm font-medium text-center flex items-center justify-center gap-2 cursor-not-allowed">
                <Lock className="h-4 w-4" /> Generate Tax Bill
              </div>
            )}
            <button className="w-full py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">
              Export to Excel
            </button>
          </div>

          <div className="px-5 pb-5 pt-0">
            {/* Current Rates Summary */}
            <div className="p-3 border border-slate-200 rounded-lg space-y-2">
              <p className="text-xs font-semibold text-slate-600 mb-2">Current Tax Rates</p>
              {(Object.entries(rates) as [PropertyType, { basic: number; sef: number }][]).map(([type, r]) => (
                <div key={type} className="flex justify-between text-xs">
                  <span className="text-slate-500">{type}</span>
                  <span className="font-medium text-slate-700">{r.basic}% + {r.sef}% SEF</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Tax Rates Modal (Admin/Accountant only) ── */}
      {showRates && canEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <div>
                <h3 className="text-slate-900">Manage RPT Rates</h3>
                <p className="text-xs text-slate-500 mt-0.5">Update tax rates per property classification</p>
              </div>
              <button onClick={() => setShowRates(false)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">
                  Rate changes apply to all future calculations. Existing assessments are not retroactively modified.
                </p>
              </div>

              <div className="overflow-hidden rounded-lg border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-xs text-slate-600 font-medium">Property Type</th>
                      <th className="px-4 py-2.5 text-center text-xs text-slate-600 font-medium">Basic RPT (%)</th>
                      <th className="px-4 py-2.5 text-center text-xs text-slate-600 font-medium">SEF (%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(Object.entries(editRates) as [PropertyType, { basic: number; sef: number }][]).map(([type, r]) => (
                      <tr key={type}>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${TYPE_CLR[type]}`}>{type}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <input type="number" step="0.1" min="0" max="5" value={r.basic}
                            onChange={(e) => setEditRates((prev) => ({ ...prev, [type]: { ...prev[type], basic: Number(e.target.value) } }))}
                            className="w-20 px-2 py-1 border border-slate-200 rounded text-sm text-center focus:outline-none focus:ring-1 focus:ring-blue-500" />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <input type="number" step="0.1" min="0" max="5" value={r.sef}
                            onChange={(e) => setEditRates((prev) => ({ ...prev, [type]: { ...prev[type], sef: Number(e.target.value) } }))}
                            className="w-20 px-2 py-1 border border-slate-200 rounded text-sm text-center focus:outline-none focus:ring-1 focus:ring-blue-500" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
              <button onClick={() => setShowRates(false)} className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-100">Cancel</button>
              <button onClick={handleSaveRates} className="px-5 py-2 text-white rounded-lg text-sm font-medium shadow-sm"
                style={{ backgroundColor: "#0d2137" }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#1e3a5f"}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#0d2137"}>
                Save Rates
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}