import { useState, useMemo, useEffect } from "react";
import { Plus, Search, Filter, Download, Edit3, Trash2, Home, X, AlertCircle, CheckCircle, Lock, AlertTriangle, Eye, MapPin } from "lucide-react";
import { exportProperties, safeExport } from "../services/exportService";
import { useAuth } from "../context/AuthContext";
import { AccessDenied, ReadOnlyBanner, LimitedAccessBanner } from "../components/RoleGuard";
import Pagination from "../components/Pagination";
import { getCities, getProvinces, searchBarangays, type BarangayOption, type CityMunicipalityOption, type ProvinceOption } from "../services/locationService";
import {
  deleteProperty,
  getApiErrorMessage,
  getProperties,
  registerProperty,
  updateProperty,
  type PropertyDto,
} from "../services/propertyService";

// ─── Types ────────────────────────────────────────────────────────────────────
type PropertyType = "Land" | "Residential" | "Commercial" | "Agricultural" | "Industrial" | "Special";
type PropertyStatus = "Registered" | "Pending Review" | "Delinquent";

type Property = {
  dbId: number;
  id: string;
  pin: string;           // Property Identification Number
  ownerName: string;
  ownerEmail?: string | null;
  ownerPhone?: string | null;
  ownerAddress?: string | null;
  taxIdentificationNumber?: string | null;
  provinceId?: number | null;
  cityMunicipalityId?: number | null;
  barangayId?: number | null;
  barangay: string;
  municipality: string;
  propertyType: PropertyType;
  lotNumber: string;
  areaSqm: number;
  marketValue: number;
  assessmentLevel: number; // percentage e.g. 20 for 20%
  taxRate: number;
  assessedValue: number;
  status: PropertyStatus;
  dateRegistered: string;
  taxDeclarationNumber?: string | null;
  zoningClassification?: string | null;
  remarks?: string | null;
  anomaly?: string;      // ML anomaly flag
};

const INITIAL_PROPERTIES: Property[] = [];

const PROPERTY_TYPES: PropertyType[] = ["Land", "Residential", "Commercial", "Agricultural"];
const PROPERTY_TYPE_FILTERS: PropertyType[] = ["Land", "Residential", "Commercial", "Agricultural", "Industrial", "Special"];
const ASSESSMENT_LEVELS: Record<PropertyType, number> = {
  Land: 20, Residential: 20, Commercial: 50, Agricultural: 40, Industrial: 80, Special: 0,
};

const TAX_RATES: Record<PropertyType, number> = {
  Land: 1, Residential: 1, Commercial: 2, Agricultural: 1, Industrial: 2, Special: 0,
};

type ModalMode = "add" | "edit" | "delete" | "view" | null;
const EMPTY_FORM = {
  ownerName: "",
  ownerEmail: "",
  ownerPhone: "",
  ownerAddress: "",
  taxIdentificationNumber: "",
  provinceId: "",
  cityMunicipalityId: "",
  barangayId: "",
  barangay: "",
  barangaySearch: "",
  propertyType: "Land" as PropertyType,
  lotNumber: "",
  areaSqm: "",
  marketValue: "",
  taxDeclarationNumber: "",
  zoningClassification: "",
  remarks: "",
  status: "Registered" as PropertyStatus,
};

const fmt = (val: number) => `₱ ${val.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;
const fmtShort = (val: number) => val >= 1000000 ? `₱${(val / 1000000).toFixed(2)}M` : `₱${(val / 1000).toFixed(0)}K`;

function normalizeType(value: string): PropertyType {
  return PROPERTY_TYPE_FILTERS.find((type) => type.toLowerCase() === value.trim().toLowerCase()) ?? "Residential";
}

function normalizeStatus(value: string): PropertyStatus {
  return (["Registered", "Pending Review", "Delinquent"] as PropertyStatus[])
    .find((status) => status.toLowerCase() === value.trim().toLowerCase()) ?? "Registered";
}

function toDateInput(value?: string | null) {
  if (!value) return new Date().toISOString().split("T")[0];
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString().split("T")[0] : date.toISOString().split("T")[0];
}

function mapProperty(dto: PropertyDto): Property {
  const propertyType = normalizeType(dto.propertyType);
  const assessmentLevel = Number(dto.assessmentLevel);
  const marketValue = Number(dto.marketValue);

  return {
    dbId: dto.id,
    id: dto.pin,
    pin: dto.pin,
    ownerName: dto.ownerName,
    ownerEmail: dto.ownerEmail,
    ownerPhone: dto.ownerPhone,
    ownerAddress: dto.ownerAddress,
    taxIdentificationNumber: dto.taxIdentificationNumber,
    provinceId: dto.provinceId,
    cityMunicipalityId: dto.cityMunicipalityId,
    barangayId: dto.barangayId,
    barangay: dto.barangay,
    municipality: dto.municipality,
    propertyType,
    lotNumber: dto.lotNumber,
    areaSqm: Number(dto.areaSquareMeters),
    marketValue,
    assessmentLevel,
    taxRate: Number(dto.taxRate),
    assessedValue: marketValue * (assessmentLevel / 100),
    status: normalizeStatus(dto.status),
    dateRegistered: toDateInput(dto.dateRegisteredUtc),
    taxDeclarationNumber: dto.taxDeclarationNumber,
    zoningClassification: dto.zoningClassification,
    remarks: dto.remarks,
  };
}

function buildPin(type: PropertyType) {
  return `01-001-${type.slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-6)}-000-00-000`;
}

function sortProperties(items: Property[]) {
  return [...items].sort((a, b) => b.dateRegistered.localeCompare(a.dateRegistered) || b.dbId - a.dbId);
}

const STATUS_CFG: Record<PropertyStatus, { cls: string; dot: string }> = {
  "Registered":    { cls: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-400" },
  "Pending Review":{ cls: "bg-amber-100 text-amber-700",     dot: "bg-amber-400"   },
  "Delinquent":    { cls: "bg-red-100 text-red-700",         dot: "bg-red-400"     },
};

const TYPE_CFG: Record<PropertyType, { cls: string; icon: string }> = {
  Land:         { cls: "bg-teal-100 text-teal-700",    icon: "▣" },
  Residential:  { cls: "bg-blue-100 text-blue-700",    icon: "🏠" },
  Commercial:   { cls: "bg-purple-100 text-purple-700",icon: "🏢" },
  Agricultural: { cls: "bg-green-100 text-green-700",  icon: "🌾" },
  Industrial:   { cls: "bg-orange-100 text-orange-700",icon: "🏭" },
  Special:      { cls: "bg-slate-100 text-slate-600",  icon: "⛪" },
};

export default function PropertyRegistration() {
  const { can, user } = useAuth();

  const canView = can("property.view");
  const canCreate = can("property.create");
  const canEdit   = can("property.edit");
  const canDelete = can("property.delete");
  const isReadOnly = !canCreate && !canEdit && !canDelete;

  const [properties,  setProperties]  = useState<Property[]>(INITIAL_PROPERTIES);
  const [loading,     setLoading]     = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [search,      setSearch]      = useState("");
  const [typeFilter,  setTypeFilter]  = useState<"All" | PropertyType>("All");
  const [barangayFilter, setBarangayFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState<"All" | PropertyStatus>("All");
  const [modal,       setModal]       = useState<ModalMode>(null);
  const [selected,    setSelected]    = useState<Property | null>(null);
  const [form,        setForm]        = useState(EMPTY_FORM);
  const [provinces,   setProvinces]   = useState<ProvinceOption[]>([]);
  const [cities,      setCities]      = useState<CityMunicipalityOption[]>([]);
  const [barangayResults, setBarangayResults] = useState<BarangayOption[]>([]);
  const [locationLoading, setLocationLoading] = useState({ provinces: false, cities: false, barangays: false });
  const [toast,       setToast]       = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const perPage = 8;

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type }); setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    if (!canView) {
      return;
    }

    let ignore = false;

    async function loadProperties() {
      setLoading(true);

      try {
        const result = await getProperties();

        if (!ignore) {
          setProperties(sortProperties(result.map(mapProperty)));
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

    void loadProperties();

    return () => {
      ignore = true;
    };
  }, [canView]);

  useEffect(() => {
    let ignore = false;

    async function loadProvinces() {
      setLocationLoading((state) => ({ ...state, provinces: true }));

      try {
        const result = await getProvinces();

        if (!ignore) {
          setProvinces(result);
        }
      } catch (error) {
        if (!ignore) {
          showToast(getApiErrorMessage(error), "error");
        }
      } finally {
        if (!ignore) {
          setLocationLoading((state) => ({ ...state, provinces: false }));
        }
      }
    }

    void loadProvinces();

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if ((modal !== "add" && modal !== "edit") || !form.provinceId) {
      return;
    }

    let ignore = false;

    async function loadCities() {
      setLocationLoading((state) => ({ ...state, cities: true }));

      try {
        const result = await getCities(Number(form.provinceId));

        if (!ignore) {
          setCities(result);
        }
      } catch (error) {
        if (!ignore) {
          showToast(getApiErrorMessage(error), "error");
        }
      } finally {
        if (!ignore) {
          setLocationLoading((state) => ({ ...state, cities: false }));
        }
      }
    }

    void loadCities();

    return () => {
      ignore = true;
    };
  }, [modal, form.provinceId]);

  useEffect(() => {
    if ((modal !== "add" && modal !== "edit") || !form.cityMunicipalityId) {
      return;
    }

    let ignore = false;
    const timeoutId = window.setTimeout(() => {
      setLocationLoading((state) => ({ ...state, barangays: true }));

      async function loadBarangays() {
        try {
          const result = await searchBarangays(Number(form.cityMunicipalityId), form.barangaySearch);

          if (!ignore) {
            setBarangayResults(result);
          }
        } catch (error) {
          if (!ignore) {
            showToast(getApiErrorMessage(error), "error");
          }
        } finally {
          if (!ignore) {
            setLocationLoading((state) => ({ ...state, barangays: false }));
          }
        }
      }

      void loadBarangays();
    }, 300);

    return () => {
      ignore = true;
      window.clearTimeout(timeoutId);
    };
  }, [modal, form.cityMunicipalityId, form.barangaySearch]);

  const barangayOptions = useMemo(() => {
    const names = Array.from(new Set(properties.map((property) => property.barangay).filter(Boolean))).sort();
    return ["All", ...names];
  }, [properties]);

  const filtered = useMemo(() =>
    properties.filter((p) => {
      const mSearch = p.ownerName.toLowerCase().includes(search.toLowerCase()) ||
        p.id.toLowerCase().includes(search.toLowerCase()) ||
        p.barangay.toLowerCase().includes(search.toLowerCase()) ||
        p.lotNumber.toLowerCase().includes(search.toLowerCase());
      const mType   = typeFilter === "All" || p.propertyType === typeFilter;
      const mBarangay = barangayFilter === "All" || p.barangay === barangayFilter;
      const mStatus = statusFilter === "All" || p.status === statusFilter;
      return mSearch && mType && mBarangay && mStatus;
    }), [properties, search, typeFilter, barangayFilter, statusFilter]
  );

  const totalPages = Math.ceil(filtered.length / perPage);
  const paginated  = filtered.slice((currentPage - 1) * perPage, currentPage * perPage);

  const summary = useMemo(() => ({
    total: properties.length,
    totalMarket: properties.reduce((s, p) => s + p.marketValue, 0),
    totalAssessed: properties.reduce((s, p) => s + p.assessedValue, 0),
    anomalies: properties.filter((p) => p.anomaly).length,
  }), [properties]);

  const computeAssessed = (marketValue: number, type: PropertyType) => {
    return marketValue * (ASSESSMENT_LEVELS[type] / 100);
  };

  const toOptional = (value: string) => {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  };

  const resetLocationChildren = (provinceId: string) => {
    setForm((state) => ({
      ...state,
      provinceId,
      cityMunicipalityId: "",
      barangayId: "",
      barangay: "",
      barangaySearch: "",
    }));
    setCities([]);
    setBarangayResults([]);
  };

  const resetBarangaySelection = (cityMunicipalityId: string) => {
    setForm((state) => ({
      ...state,
      cityMunicipalityId,
      barangayId: "",
      barangay: "",
      barangaySearch: "",
    }));
    setBarangayResults([]);
  };

  const selectBarangay = (barangay: BarangayOption) => {
    setForm((state) => ({
      ...state,
      barangayId: String(barangay.id),
      barangay: barangay.name,
      barangaySearch: barangay.name,
    }));
    setBarangayResults([]);
  };

  const openAdd    = () => { setForm(EMPTY_FORM); setSelected(null); setCities([]); setBarangayResults([]); setModal("add"); };
  const openEdit   = (p: Property) => {
    setSelected(p);
    setCities([]);
    setBarangayResults([]);
    setForm({
      ...EMPTY_FORM,
      ownerName: p.ownerName,
      ownerEmail: p.ownerEmail ?? "",
      ownerPhone: p.ownerPhone ?? "",
      ownerAddress: p.ownerAddress ?? "",
      taxIdentificationNumber: p.taxIdentificationNumber ?? "",
      provinceId: p.provinceId ? String(p.provinceId) : "",
      cityMunicipalityId: p.cityMunicipalityId ? String(p.cityMunicipalityId) : "",
      barangayId: p.barangayId ? String(p.barangayId) : "",
      barangay: p.barangay,
      barangaySearch: p.barangay,
      propertyType: p.propertyType,
      lotNumber: p.lotNumber,
      areaSqm: String(p.areaSqm),
      marketValue: String(p.marketValue),
      taxDeclarationNumber: p.taxDeclarationNumber ?? "",
      zoningClassification: p.zoningClassification ?? "",
      remarks: p.remarks ?? "",
      status: p.status,
    });
    setModal("edit");
  };
  const openDelete = (p: Property) => { setSelected(p); setModal("delete"); };
  const openView   = (p: Property) => { setSelected(p); setModal("view"); };

  const handleSave = async () => {
    const areaSquareMeters = Number(form.areaSqm);
    const mv = Number(form.marketValue);

    if (modal === "add") {
      if (!form.ownerName.trim() || !form.provinceId || !form.cityMunicipalityId || !form.barangayId || !form.lotNumber.trim() || !Number.isFinite(areaSquareMeters) || areaSquareMeters <= 0 || !Number.isFinite(mv) || mv <= 0) {
        showToast("Please complete all required owner, location, and property fields.", "error"); return;
      }
    } else if (!form.ownerName.trim() || !form.barangay.trim() || !form.lotNumber.trim() || !Number.isFinite(mv) || mv <= 0) {
      showToast("Please fill in all required fields correctly.", "error"); return;
    }

    if (modal === "edit" && selected?.barangayId && (!form.provinceId || !form.cityMunicipalityId || !form.barangayId)) {
      showToast("Please keep a valid province, city/municipality, and barangay selection for this record.", "error"); return;
    }

    setSaving(true);

    try {
      if (modal === "add") {
        const created = await registerProperty({
          ownerName: form.ownerName.trim(),
          ownerEmail: toOptional(form.ownerEmail),
          ownerPhone: toOptional(form.ownerPhone),
          ownerAddress: toOptional(form.ownerAddress),
          taxIdentificationNumber: toOptional(form.taxIdentificationNumber),
          provinceId: Number(form.provinceId),
          cityMunicipalityId: Number(form.cityMunicipalityId),
          barangayId: Number(form.barangayId),
          propertyType: form.propertyType,
          lotNumber: form.lotNumber.trim(),
          areaSquareMeters,
          marketValue: mv,
          taxDeclarationNumber: toOptional(form.taxDeclarationNumber),
          zoningClassification: toOptional(form.zoningClassification),
          remarks: toOptional(form.remarks),
        });
        setProperties((prev) => sortProperties([mapProperty(created), ...prev]));
        showToast("Property registration submitted successfully.");
      } else if (modal === "edit" && selected) {
        const al = ASSESSMENT_LEVELS[form.propertyType];
        const payload = {
          taxpayerId: undefined,
          provinceId: form.provinceId ? Number(form.provinceId) : undefined,
          cityMunicipalityId: form.cityMunicipalityId ? Number(form.cityMunicipalityId) : undefined,
          barangayId: form.barangayId ? Number(form.barangayId) : undefined,
          ownerName: form.ownerName.trim(),
          ownerEmail: toOptional(form.ownerEmail),
          ownerPhone: toOptional(form.ownerPhone),
          ownerAddress: toOptional(form.ownerAddress) ?? form.barangay,
          taxIdentificationNumber: toOptional(form.taxIdentificationNumber),
          pin: selected.pin || buildPin(form.propertyType),
          taxDeclarationNumber: toOptional(form.taxDeclarationNumber),
          barangay: form.barangay.trim(),
          municipality: selected.municipality,
          address: `${form.lotNumber.trim()}, ${form.barangay.trim()}`,
          propertyType: form.propertyType,
          lotNumber: form.lotNumber.trim(),
          areaSquareMeters: Number.isFinite(areaSquareMeters) ? areaSquareMeters : 0,
          marketValue: mv,
          assessmentLevel: al,
          taxRate: TAX_RATES[form.propertyType],
          zoningClassification: toOptional(form.zoningClassification),
          remarks: toOptional(form.remarks),
          status: form.status,
          dateRegisteredUtc: new Date(selected.dateRegistered).toISOString(),
        };
        const updated = await updateProperty(selected.dbId, payload);
        setProperties((prev) => sortProperties(prev.map((p) => p.dbId === selected.dbId ? mapProperty(updated) : p)));
        showToast("Property record updated successfully.");
      }

      setModal(null); setCurrentPage(1);
    } catch (error) {
      showToast(getApiErrorMessage(error), "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    setSaving(true);

    try {
      await deleteProperty(selected.dbId);
      setProperties((p) => p.filter((x) => x.dbId !== selected.dbId));
      showToast("Property record deleted."); setModal(null);
    } catch (error) {
      showToast(getApiErrorMessage(error), "error");
    } finally {
      setSaving(false);
    }
  };

  const marketVal = Number(form.marketValue);
  const previewAssessed = !isNaN(marketVal) && marketVal > 0
    ? computeAssessed(marketVal, form.propertyType) : 0;

  if (!canView) {
    return <AccessDenied requiredRole="System Administrator, Assessment Staff, Treasury Accountant, or Internal Auditor" />;
  }

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
          <h1 className="text-slate-900 tracking-tight">Property Registry</h1>
          <p className="text-sm text-slate-500 mt-1">Manage property records, assessments, and owner information for the LGU jurisdiction.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={async () => {
              try {
                await safeExport(
                  () => exportProperties(),
                  () => ({ data: properties.map(p => ({ id: p.id, pin: p.pin, ownerName: p.ownerName, barangay: p.barangay, marketValue: p.marketValue, assessmentLevel: p.assessmentLevel, taxRate: p.taxRate })), fileName: 'properties.csv' }),
                );
              } catch (err: any) {
                console.error('Export properties failed', err)
                const message = err?.message || 'Unable to export properties. Please try again later.'
                showToast(message, 'error')
              }
            }}
            className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 shadow-sm flex items-center gap-2"
          >
            <Download className="h-4 w-4" /> Export
          </button>
          {canCreate && (
            <button disabled={saving} onClick={openAdd} className="px-4 py-2 text-white rounded-lg text-sm font-medium transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50"
              style={{ backgroundColor: "#0d2137" }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#1e3a5f"}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#0d2137"}>
              <Plus className="h-4 w-4" /> Register Property
            </button>
          )}
        </div>
      </div>

      {/* Banners */}
      {isReadOnly && <ReadOnlyBanner message="Read-Only Mode — Auditors can view and inspect property records but cannot add, edit, or delete any data." />}
      {user?.role === "Staff" && <LimitedAccessBanner message="Assessment Staff Mode — You can register and update properties. Deleting records requires System Administrator access." />}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Properties", value: summary.total.toLocaleString(), sub: "in registry",    color: "border-l-blue-500",    bg: "bg-blue-50 text-blue-600" },
          { label: "Total Market Value", value: fmtShort(summary.totalMarket), sub: "combined",     color: "border-l-emerald-500", bg: "bg-emerald-50 text-emerald-600" },
          { label: "Total Assessed Value",value: fmtShort(summary.totalAssessed), sub: "for taxation", color: "border-l-purple-500", bg: "bg-purple-50 text-purple-600" },
          { label: "Anomalies Detected", value: String(summary.anomalies), sub: "flagged by AI",   color: "border-l-amber-500",   bg: "bg-amber-50 text-amber-600" },
        ].map(({ label, value, sub, color, bg }) => (
          <div key={label} className={`bg-white p-4 rounded-xl border border-slate-200 border-l-4 shadow-sm flex items-center justify-between gap-3 ${color}`}>
            <div className="flex items-center gap-2">
              <div className={`p-2 rounded-lg flex-shrink-0 ${bg}`}>
                <Home className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs text-slate-500">{label}</p>
                <p className="text-[10px] text-slate-400">{sub}</p>
              </div>
            </div>
            <p className="text-xl font-bold text-slate-900">{value}</p>
          </div>
        ))}
      </div>

      {/* Main Table */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden">
        {/* Filter Bar */}
        <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-wrap gap-3 items-center justify-between">
          <div className="relative flex-1 min-w-48 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input type="text" placeholder="Search owner, property ID, barangay..."
              value={search} onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              className="pl-9 pr-4 py-2 w-full border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white" />
          </div>
          <div className="flex gap-2 flex-wrap">
            <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value as any); setCurrentPage(1); }}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white text-slate-600 focus:outline-none">
              <option value="All">All Types</option>
              {PROPERTY_TYPE_FILTERS.map((t) => <option key={t}>{t}</option>)}
            </select>
            <select value={barangayFilter} onChange={(e) => { setBarangayFilter(e.target.value); setCurrentPage(1); }}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white text-slate-600 focus:outline-none">
              {barangayOptions.map((b) => <option key={b}>{b}</option>)}
            </select>
            <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value as any); setCurrentPage(1); }}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white text-slate-600 focus:outline-none">
              <option value="All">All Status</option>
              <option>Registered</option><option>Pending Review</option><option>Delinquent</option>
            </select>
            <button className="p-2 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50"><Filter className="h-4 w-4" /></button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-medium border-b border-slate-200 tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Property ID</th>
                <th className="px-5 py-3.5">Owner Name</th>
                <th className="px-5 py-3.5">Barangay</th>
                <th className="px-5 py-3.5">Type</th>
                <th className="px-5 py-3.5 text-right">Market Value</th>
                <th className="px-5 py-3.5 text-right">Assessed Value</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading ? (
                <tr><td colSpan={8} className="px-5 py-12 text-center text-slate-400 text-sm">Loading property records from database...</td></tr>
              ) : paginated.length === 0 ? (
                <tr><td colSpan={8} className="px-5 py-12 text-center text-slate-400 text-sm">No property records found.</td></tr>
              ) : (
                paginated.map((prop) => (
                  <tr key={prop.id}
                    className={`hover:bg-slate-50 transition-colors group ${prop.anomaly ? "bg-amber-50/30" : ""}`}>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="text-blue-700 text-xs font-mono font-bold">{prop.id}</span>
                        {prop.anomaly && (
                          <span title={prop.anomaly}>
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-slate-900">{prop.ownerName}</p>
                      <p className="text-xs text-slate-400">Lot: {prop.lotNumber}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5 text-xs text-slate-600">
                        <MapPin className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                        {prop.barangay}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${TYPE_CFG[prop.propertyType].cls}`}>
                        {TYPE_CFG[prop.propertyType].icon} {prop.propertyType}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right text-xs text-slate-600">{fmt(prop.marketValue)}</td>
                    <td className="px-5 py-3.5 text-right text-xs font-bold text-slate-900">{fmt(prop.assessedValue)}</td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${STATUS_CFG[prop.status].cls}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${STATUS_CFG[prop.status].dot}`} />
                        {prop.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <div className="flex justify-center gap-1.5">
                        <button onClick={() => openView(prop)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="View Details">
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        {canEdit && (
                          <button onClick={() => openEdit(prop)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Edit">
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {canDelete && (
                          <button onClick={() => openDelete(prop)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Delete">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {/* Auditor sees anomaly flag info only */}
                        {isReadOnly && prop.anomaly && (
                          <span title={`Anomaly: ${prop.anomaly}`}
                            className="p-1.5 text-amber-500 bg-amber-50 rounded border border-amber-200 cursor-default" >
                            <AlertTriangle className="h-3.5 w-3.5" />
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!canEdit && !canDelete && (
          <div className="px-5 py-2.5 border-t border-slate-100 bg-amber-50 flex items-center gap-2 text-xs text-amber-700 border-amber-200">
            <Lock className="h-3.5 w-3.5 text-amber-600 flex-shrink-0" />
            <span className="font-medium">Read-Only Access — No modifications permitted for {user?.role} role</span>
          </div>
        )}

        {/* Anomaly Legend */}
        <div className="px-5 py-2.5 border-t border-amber-100 bg-amber-50/40 flex items-center gap-2 text-xs text-amber-700">
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 text-amber-500" />
          Rows highlighted in amber contain AI-flagged anomalies requiring review.
        </div>

        {/* Pagination */}
        <div className="p-4 border-t border-slate-200 bg-slate-50/50 flex items-center justify-between text-sm text-slate-500">
          <span className="text-xs">Showing {Math.min((currentPage - 1) * perPage + 1, filtered.length)}–{Math.min(currentPage * perPage, filtered.length)} of {filtered.length}</span>
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
        </div>
      </div>

      {/* ── Add / Edit Modal ── */}
      {(modal === "add" || modal === "edit") && (canCreate || canEdit) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 flex-shrink-0">
              <div>
                <h3 className="text-slate-900">{modal === "add" ? "Register New Property" : "Edit Property Record"}</h3>
                <p className="text-xs text-slate-500 mt-0.5">{modal === "add" ? "Add property to the LGU registry" : `Editing: ${selected?.id}`}</p>
              </div>
              <button onClick={() => setModal(null)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1">
            <div className="p-6 space-y-5">
              <div className="space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Owner Information</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-sm text-slate-700 mb-1.5">Owner Name <span className="text-red-500">*</span></label>
                    <input type="text" placeholder="Full legal name" value={form.ownerName}
                      onChange={(e) => setForm((f) => ({ ...f, ownerName: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-700 mb-1.5">Email</label>
                    <input type="email" placeholder="owner@example.com" value={form.ownerEmail}
                      onChange={(e) => setForm((f) => ({ ...f, ownerEmail: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-700 mb-1.5">Contact Number</label>
                    <input type="text" placeholder="09XXXXXXXXX" value={form.ownerPhone}
                      onChange={(e) => setForm((f) => ({ ...f, ownerPhone: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-700 mb-1.5">TIN</label>
                    <input type="text" placeholder="Tax identification number" value={form.taxIdentificationNumber}
                      onChange={(e) => setForm((f) => ({ ...f, taxIdentificationNumber: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-700 mb-1.5">Owner Address</label>
                    <input type="text" placeholder="Mailing address" value={form.ownerAddress}
                      onChange={(e) => setForm((f) => ({ ...f, ownerAddress: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Location</p>
                {(modal === "add" || selected?.barangayId) ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-sm text-slate-700 mb-1.5">Region</label>
                      <input type="text" value="Region XI - Davao Region" disabled
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-600" />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-700 mb-1.5">Province <span className="text-red-500">*</span></label>
                      <select value={form.provinceId} onChange={(e) => resetLocationChildren(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white">
                        <option value="">{locationLoading.provinces ? "Loading..." : "Select province"}</option>
                        {provinces.map((province) => <option key={province.id} value={province.id}>{province.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-slate-700 mb-1.5">City / Municipality <span className="text-red-500">*</span></label>
                      <select value={form.cityMunicipalityId} disabled={!form.provinceId || locationLoading.cities} onChange={(e) => resetBarangaySelection(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white disabled:bg-slate-50 disabled:text-slate-400">
                        <option value="">{locationLoading.cities ? "Loading..." : "Select city or municipality"}</option>
                        {cities.map((city) => <option key={city.id} value={city.id}>{city.name} ({city.lguType})</option>)}
                      </select>
                    </div>
                    <div className="sm:col-span-2 relative">
                      <label className="block text-sm text-slate-700 mb-1.5">Barangay <span className="text-red-500">*</span></label>
                      <input type="text" disabled={!form.cityMunicipalityId} placeholder="Search barangay" value={form.barangaySearch}
                        onChange={(e) => setForm((f) => ({ ...f, barangaySearch: e.target.value, barangayId: "", barangay: "" }))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400" />
                      {locationLoading.barangays && form.cityMunicipalityId && (
                        <p className="mt-1 text-xs text-slate-400">Loading barangays...</p>
                      )}
                      {!locationLoading.barangays && form.cityMunicipalityId && barangayResults.length > 0 && !form.barangayId && (
                        <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                          {barangayResults.map((barangay) => (
                            <button key={barangay.id} type="button" onClick={() => selectBarangay(barangay)}
                              className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50">
                              {barangay.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="block text-sm text-slate-700 mb-1.5">Barangay <span className="text-red-500">*</span></label>
                    <input type="text" value={form.barangay}
                      onChange={(e) => setForm((f) => ({ ...f, barangay: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    <p className="text-xs text-amber-700">Legacy location record: this property does not yet have a normalized barangay mapping. Save a valid Region XI location in a later update to normalize it.</p>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Property Details</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-slate-700 mb-1.5">Property Type <span className="text-red-500">*</span></label>
                    <select value={form.propertyType} onChange={(e) => setForm((f) => ({ ...f, propertyType: e.target.value as PropertyType }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white">
                      {(modal === "add" ? PROPERTY_TYPES : PROPERTY_TYPE_FILTERS).map((t) => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-slate-700 mb-1.5">Lot Number <span className="text-red-500">*</span></label>
                    <input type="text" placeholder="Lot 12, Block 5" value={form.lotNumber}
                      onChange={(e) => setForm((f) => ({ ...f, lotNumber: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-700 mb-1.5">Lot Area (sqm) <span className="text-red-500">*</span></label>
                    <input type="number" min="0" step="0.01" placeholder="0.00" value={form.areaSqm}
                      onChange={(e) => setForm((f) => ({ ...f, areaSqm: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-700 mb-1.5">Market Value (₱) <span className="text-red-500">*</span></label>
                    <input type="number" min="0" step="0.01" placeholder="0.00" value={form.marketValue}
                      onChange={(e) => setForm((f) => ({ ...f, marketValue: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-700 mb-1.5">Tax Declaration Number</label>
                    <input type="text" placeholder="TDN-2026-0001" value={form.taxDeclarationNumber}
                      onChange={(e) => setForm((f) => ({ ...f, taxDeclarationNumber: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-700 mb-1.5">Zoning Classification</label>
                    <input type="text" placeholder="Residential zone" value={form.zoningClassification}
                      onChange={(e) => setForm((f) => ({ ...f, zoningClassification: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm text-slate-700 mb-1.5">Remarks</label>
                    <textarea rows={3} placeholder="Assessment notes" value={form.remarks}
                      onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none" />
                  </div>
                  {modal === "edit" && (
                    <div>
                      <label className="block text-sm text-slate-700 mb-1.5">Status</label>
                      <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as PropertyStatus }))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white">
                        <option>Registered</option><option>Pending Review</option><option>Delinquent</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* Assessment Preview */}
              {marketVal > 0 && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-xs font-semibold text-blue-800 mb-3">Assessment Preview (Auto-Calculated)</p>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-xs text-slate-500">Market Value</p>
                      <p className="text-sm font-bold text-slate-900">{fmt(marketVal)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Assessment Level ({ASSESSMENT_LEVELS[form.propertyType]}%)</p>
                      <p className="text-sm font-bold text-blue-600">×{ASSESSMENT_LEVELS[form.propertyType]}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-blue-600">Assessed Value</p>
                      <p className="text-sm font-bold text-blue-700">{fmt(previewAssessed)}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50 flex-shrink-0">
              <button disabled={saving} onClick={() => setModal(null)} className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-50">Cancel</button>
              <button disabled={saving} onClick={handleSave} className="px-5 py-2 text-white rounded-lg text-sm font-medium shadow-sm transition-colors disabled:opacity-50"
                style={{ backgroundColor: "#0d2137" }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#1e3a5f"}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#0d2137"}>
                {saving ? "Saving..." : modal === "add" ? "Register Property" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── View Details Modal ── */}
      {modal === "view" && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <div>
                <h3 className="text-slate-900">Property Details</h3>
                <p className="text-xs text-slate-400 mt-0.5 font-mono">{selected.id} · PIN: {selected.pin}</p>
              </div>
              <button onClick={() => setModal(null)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-6 space-y-3">
              <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold ${TYPE_CFG[selected.propertyType].cls}`}>
                {TYPE_CFG[selected.propertyType].icon} {selected.propertyType}
              </div>
              {selected.anomaly && (
                <div className="flex items-start gap-2.5 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-amber-800">AI Anomaly Flag</p>
                    <p className="text-xs text-amber-700 mt-0.5">{selected.anomaly} — Review required</p>
                  </div>
                </div>
              )}
              {[
                ["Owner Name", selected.ownerName],
                ["Barangay", selected.barangay],
                ["Lot Number", selected.lotNumber],
                ["Area", `${selected.areaSqm.toLocaleString()} sqm`],
                ["Market Value", fmt(selected.marketValue)],
                ["Assessment Level", `${selected.assessmentLevel}%`],
                ["Assessed Value", fmt(selected.assessedValue)],
                ["Status", selected.status],
                ["Date Registered", selected.dateRegistered],
              ].map(([l, v]) => (
                <div key={l} className="flex justify-between items-start py-2 border-b border-slate-100 last:border-0">
                  <span className="text-xs text-slate-500 w-36 flex-shrink-0">{l}</span>
                  <span className="text-sm font-medium text-slate-800 text-right">{v}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={() => setModal(null)} className="flex-1 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Close</button>
              {canEdit && <button onClick={() => openEdit(selected)} className="flex-1 py-2 text-white rounded-lg text-sm font-medium" style={{ backgroundColor: "#0d2137" }}>Edit Record</button>}
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Modal ── */}
      {modal === "delete" && selected && canDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-slate-900 mb-2">Delete Property Record?</h3>
              <p className="text-sm text-slate-600 mb-2">{selected.ownerName} — <span className="font-mono font-bold">{selected.id}</span></p>
              <p className="text-xs text-red-500">This action cannot be undone. All associated records may be affected.</p>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button disabled={saving} onClick={() => setModal(null)} className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50">Cancel</button>
              <button disabled={saving} onClick={handleDelete} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50">{saving ? "Deleting..." : "Yes, Delete"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}