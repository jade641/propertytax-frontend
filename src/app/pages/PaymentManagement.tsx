import { useState, useMemo, useEffect } from "react";
import { Plus, Search, Filter, Download, X, AlertCircle, CheckCircle, Clock, AlertTriangle, Eye, Receipt } from "lucide-react";
import { exportPayments, safeExport } from "../services/exportService";
import { useAuth } from "../context/AuthContext";
import { AccessDenied, ReadOnlyBanner } from "../components/RoleGuard";
import Pagination from "../components/Pagination";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { getProperties, type PropertyDto } from "../services/propertyService";
import {
  getApiErrorMessage,
  getPaymentHistory,
  getPaymentQuote,
  recordPayment,
  type PaymentDto,
  type PaymentQuoteDto,
} from "../services/paymentService";

// ─── Types ────────────────────────────────────────────────────────────────────
type PayStatus = "Paid" | "Unpaid" | "Late";
type ManualPayMethod = "Cash" | "Check" | "Bank Deposit";
type PayMethod = ManualPayMethod | "Online Transfer" | "GCash";

type Payment = {
  dbId: number;
  id: string;
  propertyId: string;
  ownerName: string;
  barangay: string;
  taxYear: number;
  quarter: "Q1" | "Q2" | "Q3" | "Q4" | "Annual";
  amountDue: number;
  amountPaid: number;
  paymentDate: string | null;
  dueDate: string;
  status: PayStatus;
  method: PayMethod | null;
  referenceNumber: string | null;
  bankName: string | null;
  orNumber: string | null;
  penalty: number;
};

type RegisteredProperty = {
  id: number;
  pin: string;
  ownerName: string;
  barangay: string;
  marketValue: number;
  assessmentLevel: number;
  taxRate: number;
};

const INITIAL_PAYMENTS: Payment[] = [];
const MANUAL_PAYMENT_METHODS: ManualPayMethod[] = ["Cash", "Check", "Bank Deposit"];
const DISPLAY_PAYMENT_METHODS: PayMethod[] = ["Cash", "Check", "Bank Deposit", "GCash", "Online Transfer"];

const STATUS_CFG: Record<PayStatus, { cls: string; badge: string; icon: any }> = {
  Paid:   { cls: "text-emerald-600", badge: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: CheckCircle  },
  Unpaid: { cls: "text-amber-600",   badge: "bg-amber-100 text-amber-700 border-amber-200",       icon: Clock        },
  Late:   { cls: "text-red-600",     badge: "bg-red-100 text-red-700 border-red-200",             icon: AlertTriangle},
};

const fmt = (val: number) => `₱ ${val.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

type ModalMode = "add" | "view" | null;
const EMPTY_FORM = {
  propertyId: "", ownerName: "", barangay: "",
  taxYear: "2026", quarter: "Q1" as Payment["quarter"],
  amountDue: "", amountPaid: "", paymentDate: "", method: "Cash" as ManualPayMethod, referenceNumber: "", bankName: "", orNumber: "",
};

function toDateInput(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().split("T")[0];
}

function normalizeStatus(value: string): PayStatus {
  return (["Paid", "Unpaid", "Late"] as PayStatus[]).find((status) => status.toLowerCase() === value.trim().toLowerCase()) ?? "Paid";
}

function normalizeMethod(value: string): PayMethod {
  return (DISPLAY_PAYMENT_METHODS as PayMethod[])
    .find((method) => method.toLowerCase() === value.trim().toLowerCase()) ?? "Cash";
}

function getReferenceLabel(method: ManualPayMethod) {
  return method === "Check" ? "Check Number" : "Deposit Slip / Reference No.";
}

function getReferencePlaceholder(method: ManualPayMethod) {
  return method === "Check" ? "e.g. CHK-000123" : "e.g. DS-2026-0001";
}

function getBankLabel(method: ManualPayMethod) {
  return method === "Check" ? "Drawee Bank" : "Depository Bank";
}

function normalizeQuoteErrorMessage(message: string) {
  const normalized = message.trim();

  if (normalized.toLowerCase().includes("does not have a tax assessment")) {
    return "No tax assessment exists for this property and year yet. Go to Tax Calculation first, then return here to record payment.";
  }

  return normalized;
}

function mapPropertyOption(property: PropertyDto): RegisteredProperty {
  return {
    id: property.id,
    pin: property.pin,
    ownerName: property.ownerName,
    barangay: property.barangay,
    marketValue: Number(property.marketValue),
    assessmentLevel: Number(property.assessmentLevel),
    taxRate: Number(property.taxRate),
  };
}

function mapPayment(payment: PaymentDto): Payment {
  const dueDate = toDateInput(payment.dueDateUtc) ?? `${payment.taxYear}-03-31`;
  const remaining = payment.remainingBalance ?? 0;
  const paymentDate = toDateInput(payment.paymentDateUtc);

  return {
    dbId: payment.id,
    id: `PAY-${String(payment.id).padStart(4, "0")}`,
    propertyId: payment.propertyPin ?? String(payment.propertyId),
    ownerName: payment.ownerName ?? "Unknown taxpayer",
    barangay: payment.barangay ?? "Unknown barangay",
    taxYear: payment.taxYear,
    quarter: payment.quarter as Payment["quarter"],
    amountDue: payment.amountDue,
    amountPaid: payment.amountPaid,
    paymentDate,
    dueDate,
    status: remaining > 0 && payment.status === "Paid" ? "Unpaid" : normalizeStatus(payment.status),
    method: normalizeMethod(payment.paymentMethod),
    referenceNumber: payment.referenceNumber ?? null,
    bankName: payment.bankName ?? null,
    orNumber: payment.officialReceiptNumber ?? null,
    penalty: payment.penalty,
  };
}

function sortPayments(payments: Payment[]) {
  return [...payments].sort((a, b) => (b.paymentDate ?? "").localeCompare(a.paymentDate ?? "") || b.dbId - a.dbId);
}

export default function PaymentManagement() {
  const { can } = useAuth();

  const canView    = can("payment.view");
  const canCreate  = can("payment.create");
  const canEdit    = can("payment.edit");
  const isReadOnly = !canCreate && !canEdit;

  const [payments,    setPayments]    = useState<Payment[]>(INITIAL_PAYMENTS);
  const [properties,  setProperties]  = useState<RegisteredProperty[]>([]);
  const [paymentQuote,setPaymentQuote]= useState<PaymentQuoteDto | null>(null);
  const [loading,     setLoading]     = useState(false);
  const [openingAddModal, setOpeningAddModal] = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [quoteLoading,setQuoteLoading]= useState(false);
  const [quoteError,  setQuoteError]  = useState<string | null>(null);
  const [search,      setSearch]      = useState("");
  const [statusFilter,setStatusFilter]= useState<"All" | PayStatus>("All");
  const [yearFilter,  setYearFilter]  = useState("All");
  const [modal,       setModal]       = useState<ModalMode>(null);
  const [selected,    setSelected]    = useState<Payment | null>(null);
  const [form,        setForm]        = useState(EMPTY_FORM);
  const [toast,       setToast]       = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const perPage = 8;
  const hasSelectedProperty = form.propertyId.trim().length > 0;
  const hasQuote = paymentQuote !== null;
  const quoteHasBalance = paymentQuote !== null && paymentQuote.payableAmount > 0;
  const quoteMessage = quoteError
    ?? (hasQuote && !quoteHasBalance ? "This property has no outstanding balance for the selected tax year." : null);
  const canRecordCurrentQuote = hasQuote && !quoteLoading && !quoteMessage && quoteHasBalance;

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type }); setTimeout(() => setToast(null), 3000);
  };

  const handleCloseModal = () => {
    setModal(null);
    setSelected(null);
    setPaymentQuote(null);
    setQuoteError(null);
    setQuoteLoading(false);
  };

  const handleOpenAddModal = async () => {
    setOpeningAddModal(true);
    setPaymentQuote(null);
    setQuoteError(null);
    setQuoteLoading(false);

    try {
      const propertyResult = await getProperties();
      const propertyOptions = propertyResult.map(mapPropertyOption);
      const today = new Date().toISOString().split("T")[0];

      setProperties(propertyOptions);

      if (propertyOptions.length === 0) {
        setForm({ ...EMPTY_FORM, paymentDate: today });
        showToast("No registered properties available yet. Register a property first before recording a payment.", "error");
        return;
      }

      if (propertyOptions.length === 1) {
        const [property] = propertyOptions;
        setForm({
          ...EMPTY_FORM,
          paymentDate: today,
          propertyId: String(property.id),
          ownerName: property.ownerName,
          barangay: property.barangay,
        });
      } else {
        setForm({ ...EMPTY_FORM, paymentDate: today });
      }

      setModal("add");
    } catch (error) {
      showToast(getApiErrorMessage(error), "error");
    } finally {
      setOpeningAddModal(false);
    }
  };

  useEffect(() => {
    if (!canView) {
      return;
    }

    let ignore = false;

    async function loadPaymentData() {
      setLoading(true);

      try {
        const [propertyResult, paymentResult] = await Promise.all([getProperties(), getPaymentHistory()]);

        if (!ignore) {
          setProperties(propertyResult.map(mapPropertyOption));
          setPayments(sortPayments(paymentResult.map(mapPayment)));
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

    void loadPaymentData();

    return () => {
      ignore = true;
    };
  }, [canView]);

  useEffect(() => {
    if (modal !== "add" || !form.propertyId) {
      return;
    }

    let ignore = false;

    async function loadQuote() {
      setQuoteLoading(true);
      setQuoteError(null);

      try {
        const quote = await getPaymentQuote(
          Number(form.propertyId),
          Number(form.taxYear),
          form.quarter,
          form.paymentDate ? new Date(form.paymentDate).toISOString() : undefined,
        );

        if (!ignore) {
          setPaymentQuote(quote);
          setQuoteError(null);
        }
      } catch (error) {
        if (!ignore) {
          setPaymentQuote(null);
          setQuoteError(normalizeQuoteErrorMessage(getApiErrorMessage(error)));
        }
      } finally {
        if (!ignore) {
          setQuoteLoading(false);
        }
      }
    }

    void loadQuote();

    return () => {
      ignore = true;
    };
  }, [form.paymentDate, form.propertyId, form.quarter, form.taxYear, modal]);

  const filtered = useMemo(() =>
    payments.filter((p) => {
      const mSearch = p.ownerName.toLowerCase().includes(search.toLowerCase()) ||
        p.propertyId.toLowerCase().includes(search.toLowerCase()) ||
        p.barangay.toLowerCase().includes(search.toLowerCase()) ||
        (p.referenceNumber || "").toLowerCase().includes(search.toLowerCase()) ||
        (p.bankName || "").toLowerCase().includes(search.toLowerCase()) ||
        (p.orNumber || "").toLowerCase().includes(search.toLowerCase());
      const mStatus = statusFilter === "All" || p.status === statusFilter;
      const mYear   = yearFilter === "All" || p.taxYear === Number(yearFilter);
      return mSearch && mStatus && mYear;
    }), [payments, search, statusFilter, yearFilter]
  );

  const totalPages = Math.ceil(filtered.length / perPage);
  const paginated  = filtered.slice((currentPage - 1) * perPage, currentPage * perPage);

  const summary = useMemo(() => ({
    totalCollected: payments.filter(p => p.status === "Paid").reduce((s, p) => s + p.amountPaid, 0),
    totalDue:       payments.reduce((s, p) => s + p.amountDue, 0),
    paidCount:      payments.filter(p => p.status === "Paid").length,
    unpaidCount:    payments.filter(p => p.status === "Unpaid").length,
    lateCount:      payments.filter(p => p.status === "Late").length,
    totalPenalty:   payments.reduce((s, p) => s + p.penalty, 0),
  }), [payments]);

  const monthlyData = useMemo(() => {
    const totalsByMonth = new Map<string, number>();

    payments.forEach((payment) => {
      if (!payment.paymentDate || payment.status !== "Paid") return;
      const date = new Date(payment.paymentDate);

      if (Number.isNaN(date.getTime())) return;

      const month = date.toLocaleString("en-US", { month: "short" });
      totalsByMonth.set(month, (totalsByMonth.get(month) ?? 0) + payment.amountPaid);
    });

    return Array.from(totalsByMonth, ([month, collected]) => ({ month, collected }));
  }, [payments]);

  const handleSave = async () => {
    if (!form.propertyId || !form.amountPaid || !form.paymentDate) {
      showToast("Please fill in all required fields.", "error"); return;
    }

    if (!paymentQuote) {
      showToast("Unable to validate the current payment quote.", "error"); return;
    }

    const amtDue  = Number(paymentQuote.outstandingPrincipal);
    const amtPaid = Number(form.amountPaid);
    const paid    = new Date(form.paymentDate);

    if (!Number.isFinite(amtPaid) || amtPaid <= 0) {
      showToast("Payment amount must be greater than zero.", "error"); return;
    }

    if (amtPaid > paymentQuote.payableAmount) {
      showToast(`Payment cannot exceed the current payable amount of ${fmt(paymentQuote.payableAmount)}.`, "error"); return;
    }

    if (form.method !== "Cash" && !form.referenceNumber.trim()) {
      showToast(`${getReferenceLabel(form.method)} is required for ${form.method.toLowerCase()} payments.`, "error"); return;
    }

    if (form.method !== "Cash" && !form.bankName.trim()) {
      showToast(`${getBankLabel(form.method)} is required for ${form.method.toLowerCase()} payments.`, "error"); return;
    }

    setSaving(true);

    try {
      const saved = await recordPayment({
        propertyId: Number(form.propertyId),
        taxYear: Number(form.taxYear),
        quarter: form.quarter,
        amountDue: amtDue,
        amountPaid: amtPaid,
        paymentMethod: form.method,
        referenceNumber: form.method === "Cash" ? undefined : form.referenceNumber.trim(),
        bankName: form.method === "Cash" ? undefined : form.bankName.trim(),
        paymentDateUtc: paid.toISOString(),
        dueDateUtc: paymentQuote.dueDateUtc,
        status: paymentQuote.status,
        penalty: paymentQuote.penalty,
        officialReceiptNumber: form.orNumber.trim() || undefined,
        notes: `Encoded from Payment Management.`,
      });

      setPayments((p) => sortPayments([mapPayment(saved), ...p]));
      setPaymentQuote(null);
      showToast("Payment recorded successfully.");
      handleCloseModal(); setCurrentPage(1);
    } catch (error) {
      showToast(getApiErrorMessage(error), "error");
    } finally {
      setSaving(false);
    }
  };

  if (!canView) {
    return <AccessDenied requiredRole="System Administrator, Treasury Accountant, or Internal Auditor" />;
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
          <h1 className="text-slate-900 tracking-tight">Payment Management</h1>
          <p className="text-sm text-slate-500 mt-1">Record, track, and manage real property tax payments across all barangays.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={async () => {
              try {
                await safeExport(
                  () => exportPayments(),
                  () => ({ data: payments.map(p => ({ id: p.id, propertyId: p.propertyId, ownerName: p.ownerName, barangay: p.barangay, taxYear: p.taxYear, quarter: p.quarter, amountDue: p.amountDue, amountPaid: p.amountPaid, paymentDate: p.paymentDate, status: p.status, method: p.method })), fileName: 'payments.csv' }),
                );
              } catch (err: any) {
                console.error('Export payments failed', err)
                const message = err?.message || 'Unable to export payments. Please try again later.'
                showToast(message, 'error')
              }
            }}
            className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 shadow-sm flex items-center gap-2"
          >
            <Download className="h-4 w-4" /> Export
          </button>
          {canCreate && (
            <button onClick={handleOpenAddModal}
              disabled={saving || openingAddModal}
              className="px-4 py-2 text-white rounded-lg text-sm font-medium transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50"
              style={{ backgroundColor: "#0d2137" }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#1e3a5f"}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#0d2137"}>
              <Plus className="h-4 w-4" /> {openingAddModal ? "Loading Properties..." : "Record Payment"}
            </button>
          )}
        </div>
      </div>

      {/* Banners */}
      {isReadOnly && <ReadOnlyBanner message="Read-Only Mode — Auditors can view and export payment records but cannot record, edit, or delete payments." />}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 border-l-4 border-l-emerald-500 shadow-sm flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-slate-500">Total Collected</p>
            <p className="text-[10px] text-emerald-600 mt-1">{summary.paidCount} payments received</p>
          </div>
          <p className="text-xl font-bold text-slate-900">₱{(summary.totalCollected / 1000000).toFixed(2)}M</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 border-l-4 border-l-amber-500 shadow-sm flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-slate-500">Unpaid</p>
            <p className="text-[10px] text-amber-600 mt-1">Awaiting payment</p>
          </div>
          <p className="text-xl font-bold text-slate-900">{summary.unpaidCount}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 border-l-4 border-l-red-500 shadow-sm flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-slate-500">Late / Delinquent</p>
            <p className="text-[10px] text-red-600 mt-1">Past due date</p>
          </div>
          <p className="text-xl font-bold text-slate-900">{summary.lateCount}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 border-l-4 border-l-orange-500 shadow-sm flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-slate-500">Total Penalties</p>
            <p className="text-[10px] text-orange-600 mt-1">2% surcharge applied</p>
          </div>
          <p className="text-xl font-bold text-slate-900">{fmt(summary.totalPenalty)}</p>
        </div>
      </div>

      {/* Chart + Table Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Payment Table */}
        <div className="lg:col-span-3 bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden">
          {/* Filter Bar */}
          <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-wrap gap-3 items-center justify-between">
            <div className="relative flex-1 min-w-48 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input type="text" placeholder="Search owner, property ID, OR number..."
                value={search} onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                className="pl-9 pr-4 py-2 w-full border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white" />
            </div>
            <div className="flex gap-2">
              <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value as any); setCurrentPage(1); }}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white text-slate-600 focus:outline-none">
                <option value="All">All Status</option>
                <option>Paid</option><option>Unpaid</option><option>Late</option>
              </select>
              <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white text-slate-600 focus:outline-none">
                <option value="All">All Years</option>
                <option>2026</option><option>2025</option><option>2024</option>
              </select>
              <button className="p-2 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50"><Filter className="h-4 w-4" /></button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-medium border-b border-slate-200 tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">OR / Payment ID</th>
                  <th className="px-5 py-3.5">Owner</th>
                  <th className="px-5 py-3.5">Property</th>
                  <th className="px-5 py-3.5">Period</th>
                  <th className="px-5 py-3.5 text-right">Amount Due</th>
                  <th className="px-5 py-3.5 text-right">Amount Paid</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {loading ? (
                  <tr><td colSpan={8} className="px-5 py-12 text-center text-slate-400 text-sm">Loading payment records from database...</td></tr>
                ) : paginated.length === 0 ? (
                  <tr><td colSpan={8} className="px-5 py-12 text-center text-slate-400 text-sm">No payment records found.</td></tr>
                ) : (
                  paginated.map((pay) => {
                    const { icon: StatusIcon, badge } = STATUS_CFG[pay.status];
                    return (
                      <tr key={pay.id} className={`hover:bg-slate-50 transition-colors group ${pay.status === "Late" ? "border-l-2 border-l-red-300" : ""}`}>
                        <td className="px-5 py-3.5">
                          <p className="text-blue-700 text-xs font-mono font-bold">{pay.id}</p>
                          <p className="text-[10px] text-slate-400">{pay.orNumber || "—"}</p>
                        </td>
                        <td className="px-5 py-3.5">
                          <p className="font-medium text-slate-900 text-sm">{pay.ownerName}</p>
                          <p className="text-xs text-slate-400">{pay.barangay}</p>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="font-mono text-xs text-blue-700 font-bold">{pay.propertyId}</span>
                        </td>
                        <td className="px-5 py-3.5 text-xs text-slate-600">
                          <p>{pay.taxYear} · {pay.quarter}</p>
                          <p className="text-slate-400">Due: {pay.dueDate}</p>
                        </td>
                        <td className="px-5 py-3.5 text-right text-xs text-slate-600">{fmt(pay.amountDue)}</td>
                        <td className="px-5 py-3.5 text-right">
                          <p className="text-xs font-bold text-slate-900">{pay.amountPaid > 0 ? fmt(pay.amountPaid) : "—"}</p>
                          {pay.penalty > 0 && <p className="text-[10px] text-red-500">+{fmt(pay.penalty)} penalty</p>}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${badge}`}>
                            <StatusIcon className="h-3 w-3" />
                            {pay.status}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          <div className="flex justify-center gap-1">
                            <button onClick={() => { setSelected(pay); setModal("view"); }}
                              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="View">
                              <Eye className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Read-only footer for Auditor */}
          {isReadOnly && (
            <div className="px-5 py-2.5 border-t border-amber-100 bg-amber-50 flex items-center gap-2 text-xs text-amber-700">
              <Receipt className="h-3.5 w-3.5 text-amber-600 flex-shrink-0" />
              <span className="font-medium">Auditor View: All payment records are read-only. Export permitted.</span>
            </div>
          )}

          {/* Pagination */}
          <div className="p-4 border-t border-slate-200 bg-slate-50/50 flex items-center justify-between text-sm text-slate-500">
            <span className="text-xs">Showing {Math.min((currentPage - 1) * perPage + 1, filtered.length)}–{Math.min(currentPage * perPage, filtered.length)} of {filtered.length}</span>
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
          </div>
        </div>

        {/* Right Panel */}
        <div className="space-y-4">
          {/* Collection Chart */}
          <div className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
              <h3 className="text-sm text-slate-900">Monthly Collection 2026</h3>
            </div>
            <div className="p-4" style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 10 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 10 }} tickFormatter={(v) => `₱${v/1000}K`} />
                  <Tooltip formatter={(v: number) => [`₱${(v/1000).toFixed(0)}K`, "Collected"]} contentStyle={{ fontSize: "11px", borderRadius: "8px", border: "1px solid #e2e8f0" }} />
                  <Bar dataKey="collected" fill="#0d2137" radius={[4, 4, 0, 0]} barSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Status Breakdown */}
          <div className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
              <h3 className="text-sm text-slate-900">Payment Status</h3>
            </div>
            <div className="p-4 space-y-3">
              {([
                { status: "Paid",   count: summary.paidCount,   color: "bg-emerald-500" },
                { status: "Unpaid", count: summary.unpaidCount, color: "bg-amber-400"   },
                { status: "Late",   count: summary.lateCount,   color: "bg-red-500"     },
              ] as const).map(({ status, count, color }) => {
                const total = payments.length;
                const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                return (
                  <div key={status}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-600">{status}</span>
                      <span className="font-bold text-slate-900">{count} ({pct}%)</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Payment Methods */}
          <div className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
              <h3 className="text-sm text-slate-900">Payment Methods</h3>
            </div>
            <div className="p-4 space-y-2">
              {DISPLAY_PAYMENT_METHODS
                .filter((method) => MANUAL_PAYMENT_METHODS.includes(method as ManualPayMethod) || payments.some((payment) => payment.method === method))
                .map((m) => {
                const count = payments.filter(p => p.method === m).length;
                return (
                  <div key={m} className="flex items-center justify-between text-xs">
                    <span className="text-slate-600">{m}</span>
                    <span className={`px-2 py-0.5 rounded-full font-bold ${count > 0 ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-400"}`}>{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Record Payment Modal ── */}
      {modal === "add" && canCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 flex-shrink-0">
              <h3 className="text-slate-900">Record Property Tax Payment</h3>
              <button onClick={handleCloseModal} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1">
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-700 mb-1.5">Property ID <span className="text-red-500">*</span></label>
                  <select value={form.propertyId}
                    onChange={(e) => {
                      setPaymentQuote(null);
                      setQuoteError(null);
                      setQuoteLoading(false);
                      const chosen = properties.find((property) => property.id === Number(e.target.value));
                      setForm((f) => ({
                        ...f,
                        propertyId: e.target.value,
                        ownerName: chosen?.ownerName ?? "",
                        barangay: chosen?.barangay ?? "",
                        amountDue: "",
                        amountPaid: "",
                      }));
                    }}
                    disabled={properties.length === 0}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white">
                    <option value="">{properties.length === 0 ? "No registered properties available" : "Select registered property"}</option>
                    {properties.map((property) => (
                      <option key={property.id} value={property.id}>{property.pin} · {property.ownerName}</option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-slate-500">
                    {properties.length === 0
                      ? "Register a property first so this list can auto-fill the owner, barangay, and outstanding principal."
                      : "Choose a registered property to auto-fill the owner, barangay, and current outstanding principal."}
                  </p>
                </div>
                <div>
                  <label className="block text-sm text-slate-700 mb-1.5">Tax Year <span className="text-red-500">*</span></label>
                  <select value={form.taxYear} onChange={(e) => { setPaymentQuote(null); setQuoteError(null); setQuoteLoading(false); setForm((f) => ({ ...f, taxYear: e.target.value })); }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white">
                    <option>2026</option><option>2025</option><option>2024</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm text-slate-700 mb-1.5">Owner Name <span className="text-slate-500">(auto-filled)</span></label>
                  <input type="text" placeholder="Select a registered property first" value={form.ownerName} disabled
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-600 cursor-not-allowed disabled:opacity-100" />
                </div>
                <div>
                  <label className="block text-sm text-slate-700 mb-1.5">Quarter</label>
                  <select value={form.quarter} onChange={(e) => { setPaymentQuote(null); setQuoteError(null); setQuoteLoading(false); setForm((f) => ({ ...f, quarter: e.target.value as Payment["quarter"] })); }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white">
                    <option>Q1</option><option>Q2</option><option>Q3</option><option>Q4</option><option>Annual</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-700 mb-1.5">Barangay <span className="text-slate-500">(auto-filled)</span></label>
                  <input type="text" placeholder="Select a registered property first" value={form.barangay} disabled
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-600 cursor-not-allowed disabled:opacity-100" />
                </div>
                <div>
                  <label className="block text-sm text-slate-700 mb-1.5">Outstanding Principal (₱) <span className="text-slate-500">(system-computed)</span></label>
                  <input
                    type="text"
                    value={paymentQuote ? paymentQuote.outstandingPrincipal.toFixed(2) : quoteMessage ? "Unavailable" : ""}
                    placeholder={quoteLoading ? "Loading current balance..." : quoteMessage ? "Unable to load outstanding principal" : hasSelectedProperty ? "Fetching outstanding principal..." : "Select a registered property first"}
                    disabled
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-600 cursor-not-allowed disabled:opacity-100"
                  />
                  <p className={`mt-1 text-xs ${quoteMessage ? "text-amber-700" : "text-slate-500"}`}>
                    {quoteLoading
                      ? "Checking the latest tax assessment, prior payments, and penalties for this property."
                      : quoteMessage
                        ? quoteMessage
                        : hasSelectedProperty
                          ? "Current outstanding principal and payable amount come from the backend quote."
                          : "Outstanding principal appears after you choose a registered property."}
                  </p>
                </div>
                <div className="-mt-1">
                  <label className="block min-h-[42px] text-sm text-slate-700 mb-1.5">Amount Paid (₱) <span className="text-red-500">*</span></label>
                  <input type="number" placeholder="0.00" value={form.amountPaid}
                    disabled={!canRecordCurrentQuote}
                    onChange={(e) => setForm((f) => ({ ...f, amountPaid: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed" />
                </div>
                <div>
                  <label className="block text-sm text-slate-700 mb-1.5">Payment Date <span className="text-red-500">*</span></label>
                  <input type="date" value={form.paymentDate}
                    onChange={(e) => { setPaymentQuote(null); setQuoteError(null); setQuoteLoading(false); setForm((f) => ({ ...f, paymentDate: e.target.value })); }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm text-slate-700 mb-1.5">Payment Method</label>
                  <select value={form.method} onChange={(e) => {
                    const nextMethod = e.target.value as ManualPayMethod;
                    setForm((f) => ({
                      ...f,
                      method: nextMethod,
                      referenceNumber: nextMethod === "Cash" ? "" : f.referenceNumber,
                      bankName: nextMethod === "Cash" ? "" : f.bankName,
                    }));
                  }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white">
                    {MANUAL_PAYMENT_METHODS.map((method) => (
                      <option key={method}>{method}</option>
                    ))}
                  </select>
                </div>
                {form.method !== "Cash" && (
                  <>
                    <div>
                      <label className="block text-sm text-slate-700 mb-1.5">{getReferenceLabel(form.method)} <span className="text-red-500">*</span></label>
                      <input type="text" placeholder={getReferencePlaceholder(form.method)} value={form.referenceNumber}
                        onChange={(e) => setForm((f) => ({ ...f, referenceNumber: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-700 mb-1.5">{getBankLabel(form.method)} <span className="text-red-500">*</span></label>
                      <input type="text" placeholder="e.g. Land Bank of the Philippines" value={form.bankName}
                        onChange={(e) => setForm((f) => ({ ...f, bankName: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    </div>
                  </>
                )}
                <div className="col-span-2">
                  <label className="block text-sm text-slate-700 mb-1.5">OR Number (Official Receipt)</label>
                  <input type="text" placeholder="e.g. OR-2026-XXXX" value={form.orNumber}
                    onChange={(e) => setForm((f) => ({ ...f, orNumber: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </div>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <Receipt className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-blue-700 space-y-1">
                    <p>Payment status, due dates, and penalties are computed by the backend based on the selected tax year and quarter.</p>
                    <p>Manual LGU recording only: cash entries need no bank reference, while check and bank deposit entries require a bank name and reference number.</p>
                    {paymentQuote && (
                      <p>
                        Due Date: <span className="font-semibold">{toDateInput(paymentQuote.dueDateUtc) ?? "—"}</span>
                        {" · "}
                        Quarter Due: <span className="font-semibold">{fmt(paymentQuote.quarterDue)}</span>
                        {" · "}
                        Penalty: <span className="font-semibold">{fmt(paymentQuote.penalty)}</span>
                        {" · "}
                        Payable Now: <span className="font-semibold">{fmt(paymentQuote.payableAmount)}</span>
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50 flex-shrink-0">
              <button disabled={saving} onClick={handleCloseModal} className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-50">Cancel</button>
              <button disabled={saving || quoteLoading || !canRecordCurrentQuote} onClick={handleSave} className="px-5 py-2 text-white rounded-lg text-sm font-medium shadow-sm disabled:opacity-50"
                style={{ backgroundColor: "#0d2137" }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#1e3a5f"}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#0d2137"}>
                {saving ? "Recording..." : quoteLoading ? "Waiting for Quote..." : canRecordCurrentQuote ? "Record Payment" : "Resolve Quote First"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── View Payment Modal ── */}
      {modal === "view" && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <div>
                <h3 className="text-slate-900">Payment Details</h3>
                <p className="text-xs text-slate-400 font-mono mt-0.5">{selected.id}</p>
              </div>
              <button onClick={handleCloseModal} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-6 space-y-2.5">
              <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${STATUS_CFG[selected.status].badge}`}>
                {selected.status}
              </div>
              {[
                ["Payment ID",    selected.id],
                ["OR Number",     selected.orNumber || "—"],
                ["Property ID",   selected.propertyId],
                ["Owner",         selected.ownerName],
                ["Barangay",      selected.barangay],
                ["Tax Year",      `${selected.taxYear} · ${selected.quarter}`],
                ["Due Date",      selected.dueDate],
                ["Payment Date",  selected.paymentDate || "Not yet paid"],
                ["Amount Due",    fmt(selected.amountDue)],
                ["Amount Paid",   selected.amountPaid > 0 ? fmt(selected.amountPaid) : "—"],
                ["Penalty",       selected.penalty > 0 ? fmt(selected.penalty) : "None"],
                ["Method",        selected.method || "—"],
                ["Reference No.", selected.referenceNumber || "—"],
                ["Bank",          selected.bankName || "—"],
              ].map(([l, v]) => (
                <div key={l} className="flex justify-between py-1.5 border-b border-slate-100 last:border-0">
                  <span className="text-xs text-slate-500 w-32 flex-shrink-0">{l}</span>
                  <span className="text-sm font-medium text-slate-800 text-right">{v}</span>
                </div>
              ))}
            </div>
            <div className="px-6 pb-6">
              <button onClick={handleCloseModal} className="w-full py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}