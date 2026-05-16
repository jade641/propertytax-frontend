import { useState } from "react";
import {
  Settings, User, Lock, Bell, Calculator, Map,
  Save, Eye, EyeOff, CheckCircle, AlertTriangle,
  Shield, Sliders, Building2, Globe, Percent, Info,
  ChevronRight, RefreshCw, Database,
} from "lucide-react";
import { useAuth, ROLE_META } from "../context/AuthContext";
import { AccessDenied } from "../components/RoleGuard";
import { changePasswordRequest, getAuthApiErrorMessage } from "../services/authService";

// ─── Section Tab types ────────────────────────────────────────────────────────
type Tab = "profile" | "security" | "taxrates" | "system" | "notifications" | "barangay";

const TABS: { id: Tab; label: string; icon: any; adminOnly?: boolean }[] = [
  { id: "profile",       label: "My Profile",         icon: User         },
  { id: "security",      label: "Password & Security", icon: Lock         },
  { id: "notifications", label: "Notifications",       icon: Bell         },
  { id: "taxrates",      label: "Tax Rate Config",     icon: Calculator,  adminOnly: true },
  { id: "barangay",      label: "Barangay & LGU Mgmt", icon: Map,         adminOnly: true },
  { id: "system",        label: "System Configuration",icon: Sliders,     adminOnly: true },
];

// ─── Default tax rates ────────────────────────────────────────────────────────
type PropertyType = "Residential" | "Commercial" | "Agricultural" | "Industrial" | "Special";
const PROPERTY_TYPES: PropertyType[] = ["Residential", "Commercial", "Agricultural", "Industrial", "Special"];

type RateRow = { basic: number; sef: number; assessmentLevel: number };
const DEFAULT_RATES: Record<PropertyType, RateRow> = {
  Residential:  { basic: 1.0, sef: 1.0, assessmentLevel: 20 },
  Commercial:   { basic: 2.0, sef: 1.0, assessmentLevel: 50 },
  Agricultural: { basic: 1.0, sef: 1.0, assessmentLevel: 40 },
  Industrial:   { basic: 2.0, sef: 1.0, assessmentLevel: 80 },
  Special:      { basic: 0.0, sef: 0.0, assessmentLevel:  0 },
};

// ─── Davao Region LGU data ────────────────────────────────────────────────────
const MUNICIPALITIES: Array<{ name: string; province: string; barangays: number | null; properties: number | null }> = [
  { name: "Davao City", province: "Davao City (HUC)", barangays: null, properties: null },
  { name: "Digos City", province: "Davao del Sur", barangays: null, properties: null },
  { name: "Tagum City", province: "Davao del Norte", barangays: null, properties: null },
  { name: "Nabunturan", province: "Davao de Oro", barangays: null, properties: null },
  { name: "Mati City", province: "Davao Oriental", barangays: null, properties: null },
  { name: "Malita", province: "Davao Occidental", barangays: null, properties: null },
  { name: "Panabo City", province: "Davao del Norte", barangays: null, properties: null },
  { name: "Island Garden City of Samal", province: "Davao del Norte", barangays: null, properties: null },
];

function SaveBanner({ onDismiss, message = "Settings saved successfully." }: { onDismiss: () => void; message?: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl">
      <CheckCircle className="h-4 w-4 text-emerald-600 flex-shrink-0" />
      <p className="text-sm font-medium text-emerald-700">{message}</p>
      <button onClick={onDismiss} className="ml-auto text-xs text-emerald-600 hover:underline">Dismiss</button>
    </div>
  );
}

// ─── Profile Tab ──────────────────────────────────────────────────────────────
function ProfileTab() {
  const { user } = useAuth();
  const meta = ROLE_META[user!.role];
  const [form, setForm] = useState({
    name: user!.name,
    email: user!.email,
    phone: "",
    position: user!.role === "Admin" ? "System Administrator" :
              user!.role === "Accountant" ? "Revenue Collection Officer" :
              user!.role === "Staff" ? "Data Entry Specialist" : "Internal Auditor",
    municipality: "Davao City",
  });
  const [saved, setSaved] = useState(false);

  return (
    <div className="space-y-6">
      {saved && <SaveBanner onDismiss={() => setSaved(false)} />}

      {/* Avatar & Role card */}
      <div className={`flex items-center gap-5 p-5 rounded-xl border ${meta.bgClass}`}>
        <div className={`w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold flex-shrink-0 ${meta.badgeClass}`}>
          {user!.initials}
        </div>
        <div>
          <p className="text-lg font-bold text-slate-900">{user!.name}</p>
          <p className="text-sm text-slate-500">{user!.email}</p>
          <div className="flex items-center gap-2 mt-1.5">
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${meta.badgeClass}`}>
              <Shield className="h-2.5 w-2.5 inline mr-1" />{meta.label}
            </span>
            <span className="text-xs text-slate-400">· Level {meta.accessLevel} of 4</span>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
          <h3 className="text-sm font-semibold text-slate-900">Personal Information</h3>
        </div>
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { label: "Full Name",   key: "name",         type: "text",  placeholder: "Enter full name" },
            { label: "Email",       key: "email",        type: "email", placeholder: "Enter email address" },
            { label: "Phone",       key: "phone",        type: "text",  placeholder: "Enter phone number" },
            { label: "Position",    key: "position",     type: "text",  placeholder: "Enter position/designation" },
          ].map(({ label, key, type, placeholder }) => (
            <div key={key}>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">{label}</label>
              <input
                type={type}
                value={(form as any)[key]}
                onChange={(e) => setForm(f => ({ ...f, [key]: e.target.value }))}
                placeholder={placeholder}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          ))}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">Municipality / LGU</label>
            <select
              value={form.municipality}
              onChange={(e) => setForm(f => ({ ...f, municipality: e.target.value }))}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {MUNICIPALITIES.map(m => <option key={m.name}>{m.name}</option>)}
            </select>
          </div>
        </div>
        <div className="px-5 py-4 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button
            onClick={() => setSaved(true)}
            className="px-5 py-2 text-white rounded-lg text-sm font-medium shadow-sm flex items-center gap-2"
            style={{ backgroundColor: "#0d2137" }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#1e3a5f")}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = "#0d2137")}
          >
            <Save className="h-4 w-4" /> Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Security Tab ─────────────────────────────────────────────────────────────
function SecurityTab() {
  const [show, setShow]   = useState({ current: false, new: false, confirm: false });
  const [pw, setPw]       = useState({ current: "", new: "", confirm: "" });
  const [successMessage, setSuccessMessage] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setError("");
    setSuccessMessage("");
    if (!pw.current) { setError("Enter your current password."); return; }
    if (pw.new.length < 8) { setError("New password must be at least 8 characters."); return; }
    if (!/[a-z]/.test(pw.new)) { setError("New password must include a lowercase letter."); return; }
    if (!/[A-Z]/.test(pw.new)) { setError("New password must include an uppercase letter."); return; }
    if (!/[0-9]/.test(pw.new)) { setError("New password must include a number."); return; }
    if (!/[^A-Za-z0-9]/.test(pw.new)) { setError("New password must include a special character."); return; }
    if (pw.current === pw.new) { setError("New password must be different from the current password."); return; }
    if (pw.new !== pw.confirm) { setError("Passwords do not match."); return; }

    setIsSaving(true);

    try {
      const message = await changePasswordRequest({
        currentPassword: pw.current,
        newPassword: pw.new,
        confirmPassword: pw.confirm,
      });

      setSuccessMessage(message);
      setPw({ current: "", new: "", confirm: "" });
    } catch (caughtError) {
      setError(getAuthApiErrorMessage(caughtError));
    } finally {
      setIsSaving(false);
    }
  };

  const strengthScore = pw.new.length === 0 ? 0 :
    [pw.new.length >= 8, /[a-z]/.test(pw.new), /[A-Z]/.test(pw.new), /[0-9]/.test(pw.new), /[^A-Za-z0-9]/.test(pw.new)].filter(Boolean).length;
  const strengthLabels = ["", "Weak", "Weak", "Fair", "Good", "Strong"];
  const strengthColors = ["", "bg-red-400", "bg-red-400", "bg-amber-400", "bg-blue-400", "bg-emerald-400"];

  return (
    <div className="space-y-6">
      {successMessage && <SaveBanner message={successMessage} onDismiss={() => setSuccessMessage("")} />}
      {error && (
        <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
          <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
          <h3 className="text-sm font-semibold text-slate-900">Change Password</h3>
        </div>
        <div className="p-5 space-y-4 max-w-md">
          {(["current", "new", "confirm"] as const).map((field) => (
            <div key={field}>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">
                {field === "current" ? "Current Password" : field === "new" ? "New Password" : "Confirm New Password"}
              </label>
              <div className="relative">
                <input
                  type={show[field] ? "text" : "password"}
                  value={pw[field]}
                  disabled={isSaving}
                  onChange={e => setPw(p => ({ ...p, [field]: e.target.value }))}
                  placeholder={field === "current" ? "Enter current password" : "Enter password"}
                  autoComplete={field === "current" ? "current-password" : "new-password"}
                  className="w-full px-3 py-2.5 pr-10 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
                />
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => setShow(s => ({ ...s, [field]: !s[field] }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {show[field] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {field === "new" && pw.new.length > 0 && (
                <div className="mt-2">
                  <div className="flex gap-1 mb-1">
                    {[1, 2, 3, 4, 5].map(i => (
                      <div key={i} className={`flex-1 h-1.5 rounded-full ${i <= strengthScore ? strengthColors[strengthScore] : "bg-slate-100"}`} />
                    ))}
                  </div>
                  <p className="text-xs text-slate-500">Strength: <span className="font-medium">{strengthLabels[strengthScore]}</span></p>
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="px-5 py-4 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-5 py-2 text-white rounded-lg text-sm font-medium shadow-sm flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-70"
            style={{ backgroundColor: "#0d2137" }}
            onMouseEnter={e => { if (!isSaving) e.currentTarget.style.backgroundColor = "#1e3a5f"; }}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = "#0d2137")}
          >
            <Save className="h-4 w-4" /> {isSaving ? "Updating..." : "Update Password"}
          </button>
        </div>
      </div>

      {/* Session info */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
          <h3 className="text-sm font-semibold text-slate-900">Active Sessions</h3>
        </div>
        <div className="p-8 text-center text-sm text-slate-400">Active session details will appear once device telemetry is enabled.</div>
      </div>
    </div>
  );
}

// ─── Notifications Tab ────────────────────────────────────────────────────────
function NotificationsTab() {
  const [prefs, setPrefs] = useState({
    paymentDue:        true,
    delinquencyAlert:  true,
    reportGenerated:   true,
    auditActivity:     false,
    systemUpdates:     true,
    emailNotifications:true,
    smsNotifications:  false,
    weeklyDigest:      true,
  });
  const [saved, setSaved] = useState(false);

  const toggle = (key: keyof typeof prefs) => setPrefs(p => ({ ...p, [key]: !p[key] }));

  const groups = [
    {
      title: "Tax & Payment Alerts",
      items: [
        { key: "paymentDue",        label: "Payment Due Reminders",    desc: "Notify 7 days before RPT payment deadlines"      },
        { key: "delinquencyAlert",  label: "Delinquency Notifications",desc: "Alert when properties become delinquent"          },
      ],
    },
    {
      title: "System Activity",
      items: [
        { key: "reportGenerated",   label: "Report Generation",       desc: "When new reports are generated or approved"        },
        { key: "auditActivity",     label: "Audit Log Alerts",        desc: "Notify on critical or warning severity events"     },
        { key: "systemUpdates",     label: "System Updates",          desc: "Platform updates and maintenance notices"          },
      ],
    },
    {
      title: "Delivery Preferences",
      items: [
        { key: "emailNotifications",label: "Email Notifications",     desc: "Send alerts to your registered email address"      },
        { key: "smsNotifications",  label: "SMS Notifications",       desc: "Send urgent alerts via SMS"                        },
        { key: "weeklyDigest",      label: "Weekly Digest",           desc: "Weekly summary of system activity every Monday"    },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      {saved && <SaveBanner onDismiss={() => setSaved(false)} />}
      {groups.map(g => (
        <div key={g.title} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
            <h3 className="text-sm font-semibold text-slate-900">{g.title}</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {g.items.map(({ key, label, desc }) => (
              <div key={key} className="flex items-center justify-between px-5 py-4">
                <div>
                  <p className="text-sm font-medium text-slate-800">{label}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
                </div>
                <button
                  onClick={() => toggle(key as keyof typeof prefs)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none flex-shrink-0 ${(prefs as any)[key] ? "bg-blue-600" : "bg-slate-200"}`}
                >
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${(prefs as any)[key] ? "translate-x-4" : "translate-x-0.5"}`} />
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
      <div className="flex justify-end">
        <button
          onClick={() => setSaved(true)}
          className="px-5 py-2 text-white rounded-lg text-sm font-medium shadow-sm flex items-center gap-2"
          style={{ backgroundColor: "#0d2137" }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#1e3a5f")}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = "#0d2137")}
        >
          <Save className="h-4 w-4" /> Save Preferences
        </button>
      </div>
    </div>
  );
}

// ─── Tax Rate Tab ─────────────────────────────────────────────────────────────
function TaxRatesTab() {
  const [rates, setRates] = useState({ ...DEFAULT_RATES });
  const [saved, setSaved] = useState(false);

  const update = (type: PropertyType, field: keyof RateRow, value: string) => {
    const num = parseFloat(value) || 0;
    setRates(r => ({ ...r, [type]: { ...r[type], [field]: num } }));
  };

  const colorMap: Record<PropertyType, string> = {
    Residential: "bg-blue-50 border-blue-200 text-blue-700",
    Commercial:  "bg-purple-50 border-purple-200 text-purple-700",
    Agricultural:"bg-green-50 border-green-200 text-green-700",
    Industrial:  "bg-orange-50 border-orange-200 text-orange-700",
    Special:     "bg-slate-50 border-slate-200 text-slate-600",
  };

  return (
    <div className="space-y-6">
      {saved && <SaveBanner onDismiss={() => setSaved(false)} />}

      <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
        <Info className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-amber-700">
          Tax rates must comply with <strong>R.A. 7160 (Local Government Code of 1991)</strong> and applicable BLGF circulars.
          Changes require proper authorization and must be documented in the audit log.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">RPT & SEF Rates by Property Type</h3>
          <button
            onClick={() => setRates({ ...DEFAULT_RATES })}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-50"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Reset to Default
          </button>
        </div>
        <div className="p-5 space-y-4">
          {PROPERTY_TYPES.map(type => (
            <div key={type} className={`p-4 rounded-xl border ${colorMap[type]}`}>
              <div className="flex items-center justify-between mb-3">
                <span className={`text-sm font-semibold ${colorMap[type].split(" ")[2]}`}>{type} Property</span>
                {type === "Special" && (
                  <span className="text-[10px] px-2 py-0.5 bg-white border border-slate-200 rounded-full text-slate-500">Tax Exempt</span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Basic RPT Rate (%)", key: "basic" },
                  { label: "SEF Rate (%)",        key: "sef" },
                  { label: "Assessment Level (%)",key: "assessmentLevel" },
                ].map(({ label, key }) => (
                  <div key={key}>
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">{label}</label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        value={(rates[type] as any)[key]}
                        onChange={e => update(type, key as keyof RateRow, e.target.value)}
                        disabled={type === "Special"}
                        className="w-full px-3 py-2 pr-7 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
                      />
                      <Percent className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="px-5 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
          <button
            onClick={() => setSaved(true)}
            className="px-5 py-2 text-white rounded-lg text-sm font-medium shadow-sm flex items-center gap-2"
            style={{ backgroundColor: "#0d2137" }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#1e3a5f")}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = "#0d2137")}
          >
            <Save className="h-4 w-4" /> Save Tax Rates
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Barangay/LGU Tab ─────────────────────────────────────────────────────────
function BarangayTab() {
  const [search, setSearch] = useState("");
  const filtered = MUNICIPALITIES.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.province.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Davao Region LGU Configuration</h3>
            <p className="text-xs text-slate-400 mt-0.5">Manage municipalities and barangays within the Davao Region</p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg">
            <Globe className="h-3.5 w-3.5 text-blue-600" />
            <span className="text-xs font-semibold text-blue-700">Davao Region (XI)</span>
          </div>
        </div>

        <div className="p-4 border-b border-slate-100">
          <input
            type="text"
            placeholder="Search municipality or province..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full max-w-sm px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-5 py-3 text-left">Municipality / City</th>
                <th className="px-5 py-3 text-left">Province</th>
                <th className="px-5 py-3 text-right">Barangays</th>
                <th className="px-5 py-3 text-right">Registered Properties</th>
                <th className="px-5 py-3 text-center">Status</th>
                <th className="px-5 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(m => (
                <tr key={m.name} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-slate-400 flex-shrink-0" />
                      <span className="font-medium text-slate-800">{m.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-slate-500">{m.province}</td>
                  <td className="px-5 py-3.5 text-right font-medium text-slate-700">{m.barangays ?? "—"}</td>
                  <td className="px-5 py-3.5 text-right font-medium text-slate-700">{m.properties != null ? m.properties.toLocaleString() : "—"}</td>
                  <td className="px-5 py-3.5 text-center">
                    <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-medium">Configured</span>
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <button className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                      <Settings className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── System Tab ───────────────────────────────────────────────────────────────
function SystemTab() {
  const [config, setConfig] = useState({
    systemName: "Davao Region Property Taxation Management System",
    shortName: "DR-PTMS",
    fiscalYear: "2026",
    defaultCurrency: "PHP",
    dateFormat: "MM/DD/YYYY",
    autoLogout: "30",
    maxLoginAttempts: "5",
    auditRetention: "7",
    backupFrequency: "Daily",
    reportFormat: "PDF",
  });
  const [saved, setSaved] = useState(false);

  return (
    <div className="space-y-6">
      {saved && <SaveBanner onDismiss={() => setSaved(false)} />}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
          <h3 className="text-sm font-semibold text-slate-900">General System Configuration</h3>
        </div>
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">System Name</label>
            <input
              type="text"
              value={config.systemName}
              onChange={e => setConfig(c => ({ ...c, systemName: e.target.value }))}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          {[
            { label: "Short Name / Code",    key: "shortName",        type: "text",   opts: null },
            { label: "Current Fiscal Year",  key: "fiscalYear",       type: "text",   opts: null },
            { label: "Date Format",          key: "dateFormat",       type: "select", opts: ["MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"] },
            { label: "Session Timeout (min)",key: "autoLogout",       type: "text",   opts: null },
            { label: "Max Login Attempts",   key: "maxLoginAttempts", type: "text",   opts: null },
            { label: "Audit Log Retention (yrs)", key: "auditRetention", type: "text", opts: null },
            { label: "Backup Frequency",     key: "backupFrequency",  type: "select", opts: ["Daily", "Weekly", "Monthly"] },
            { label: "Default Report Format",key: "reportFormat",     type: "select", opts: ["PDF", "Excel", "Both"] },
          ].map(({ label, key, type, opts }) => (
            <div key={key}>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">{label}</label>
              {type === "select" ? (
                <select
                  value={(config as any)[key]}
                  onChange={e => setConfig(c => ({ ...c, [key]: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {opts!.map(o => <option key={o}>{o}</option>)}
                </select>
              ) : (
                <input
                  type="text"
                  value={(config as any)[key]}
                  onChange={e => setConfig(c => ({ ...c, [key]: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              )}
            </div>
          ))}
        </div>
        <div className="px-5 py-4 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button
            onClick={() => setSaved(true)}
            className="px-5 py-2 text-white rounded-lg text-sm font-medium shadow-sm flex items-center gap-2"
            style={{ backgroundColor: "#0d2137" }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#1e3a5f")}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = "#0d2137")}
          >
            <Save className="h-4 w-4" /> Save Configuration
          </button>
        </div>
      </div>

      {/* System info */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
          <h3 className="text-sm font-semibold text-slate-900">System Information</h3>
        </div>
        <div className="divide-y divide-slate-100">
          {[
            { label: "Platform Version",      value: "Not available" },
            { label: "Database Engine",       value: "Not connected" },
            { label: "Environment",           value: "Not available" },
            { label: "Last Backup",           value: "Not available" },
            { label: "Total Records",         value: "No live metrics available" },
            { label: "Legal Basis",           value: "R.A. 7160 (Local Government Code, 1991)" },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between px-5 py-3.5">
              <span className="text-xs text-slate-500 uppercase tracking-wider font-medium">{label}</span>
              <span className="text-sm font-medium text-slate-700">{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main Settings Page ───────────────────────────────────────────────────────
export default function SettingsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "Admin";
  const [activeTab, setActiveTab] = useState<Tab>("profile");

  const availableTabs = TABS.filter(t => !t.adminOnly || isAdmin);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-slate-900 tracking-tight">Settings</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage your account, security preferences, and system configuration.
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-lg">
          <Database className="h-3.5 w-3.5 text-slate-500" />
          <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">DR-PTMS v3.1.0</span>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar tabs */}
        <nav className="lg:w-56 flex-shrink-0">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Settings Menu</p>
            </div>
            <div className="p-2">
              {availableTabs.map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left ${
                      isActive ? "text-white shadow-sm" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                    style={isActive ? { backgroundColor: "#0d2137" } : {}}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    <span className="leading-tight">{tab.label}</span>
                    {isActive && <ChevronRight className="h-3.5 w-3.5 ml-auto flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        </nav>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {activeTab === "profile"       && <ProfileTab />}
          {activeTab === "security"      && <SecurityTab />}
          {activeTab === "notifications" && <NotificationsTab />}
          {activeTab === "taxrates"      && (isAdmin ? <TaxRatesTab /> : <AccessDenied requiredRole="Admin" />)}
          {activeTab === "barangay"      && (isAdmin ? <BarangayTab /> : <AccessDenied requiredRole="Admin" />)}
          {activeTab === "system"        && (isAdmin ? <SystemTab /> : <AccessDenied requiredRole="Admin" />)}
        </div>
      </div>
    </div>
  );
}
