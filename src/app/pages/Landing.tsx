import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { motion } from "motion/react";
import {
  Home, ShieldCheck, LayoutDashboard,
  Calculator, CreditCard, FolderOpen, FileText, History,
  Users, ArrowRight, ChevronDown, Shield, CheckCircle,
  Building2, TrendingUp, Globe, Lock, Menu, X,
  Star, Zap, Award, BarChart2,
} from "lucide-react";
import BrandLogo from "../components/BrandLogo";

// ─── Helpers ─────────────────────────────────────────────────────────────────
function GridPattern({ opacity = "0.05" }: { opacity?: string }) {
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity }} aria-hidden>
      <defs>
        <pattern id="lg" width="48" height="48" patternUnits="userSpaceOnUse">
          <path d="M 48 0 L 0 0 0 48" fill="none" stroke="white" strokeWidth="0.8" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#lg)" />
    </svg>
  );
}

// ─── Animated counter ─────────────────────────────────────────────────────────
function Counter({ to, prefix = "", suffix = "" }: { to: number; prefix?: string; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true;
        const duration = 1600;
        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min((now - start) / duration, 1);
          const ease = 1 - Math.pow(1 - t, 3);
          setCount(Math.round(ease * to));
          if (t < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }
    }, { threshold: 0.3 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [to]);

  return <span ref={ref}>{prefix}{count.toLocaleString()}{suffix}</span>;
}

// ─── Data ─────────────────────────────────────────────────────────────────────
const MODULES = [
  { icon: LayoutDashboard, name: "Executive Dashboard",     desc: "Real-time KPIs, compliance gauge, revenue charts, and AI anomaly alerts.", color: "blue"    },
  { icon: Home,            name: "Property Registry",       desc: "Register and manage all real properties by barangay, type, and assessed value.", color: "indigo"  },
  { icon: Calculator,      name: "Tax Calculation",         desc: "Auto-compute RPT using assessed value, tax rates, surcharges, and penalties.", color: "violet"  },
  { icon: CreditCard,      name: "Payment Management",      desc: "Record payments, generate receipts, and track collection per property.", color: "emerald" },
  { icon: ShieldCheck,     name: "Compliance Monitoring",   desc: "Track taxpayer compliance status, delinquencies, and deadline calendars.", color: "teal"    },
  { icon: FolderOpen,      name: "Filing & Documentation",  desc: "Upload and manage TD, TCT, declarations, and all official property documents.", color: "amber"   },
  { icon: FileText,        name: "Government Reporting",    desc: "Generate barangay summaries, monthly collections, and annual LGU filings.", color: "orange"  },
  { icon: History,         name: "Audit Support",           desc: "Full system activity trail with severity filters and exportable audit logs.", color: "red"     },
  { icon: Users,           name: "User Management",         desc: "Manage accounts, assign roles, and set access levels.", color: "purple"  },
];

const COLOR_MAP: Record<string, { bg: string; text: string; border: string; badge: string }> = {
  blue:    { bg: "bg-blue-50",    text: "text-blue-600",    border: "border-blue-200",    badge: "bg-blue-100 text-blue-700"    },
  indigo:  { bg: "bg-indigo-50",  text: "text-indigo-600",  border: "border-indigo-200",  badge: "bg-indigo-100 text-indigo-700"  },
  violet:  { bg: "bg-violet-50",  text: "text-violet-600",  border: "border-violet-200",  badge: "bg-violet-100 text-violet-700"  },
  emerald: { bg: "bg-emerald-50", text: "text-emerald-600", border: "border-emerald-200", badge: "bg-emerald-100 text-emerald-700" },
  teal:    { bg: "bg-teal-50",    text: "text-teal-600",    border: "border-teal-200",    badge: "bg-teal-100 text-teal-700"    },
  amber:   { bg: "bg-amber-50",   text: "text-amber-600",   border: "border-amber-200",   badge: "bg-amber-100 text-amber-700"   },
  orange:  { bg: "bg-orange-50",  text: "text-orange-600",  border: "border-orange-200",  badge: "bg-orange-100 text-orange-700"  },
  red:     { bg: "bg-red-50",     text: "text-red-600",     border: "border-red-200",     badge: "bg-red-100 text-red-700"      },
  purple:  { bg: "bg-purple-50",  text: "text-purple-600",  border: "border-purple-200",  badge: "bg-purple-100 text-purple-700"  },
};

const ROLES = [
  { name: "Admin",          level: 4, modules: 9, desc: "Full system access — all 9 modules including user management and settings.", badge: "bg-purple-100 text-purple-700 border-purple-200", bar: "bg-purple-500" },
  { name: "Accountant",     level: 3, modules: 7, desc: "Tax computation, payments, compliance, reporting, and document filing access.", badge: "bg-blue-100 text-blue-700 border-blue-200",       bar: "bg-blue-500"   },
  { name: "Staff (Encoder)",level: 2, modules: 6, desc: "Property registration entry, payment recording, and basic filing access.", badge: "bg-slate-100 text-slate-700 border-slate-200",     bar: "bg-slate-500"  },
  { name: "Auditor",        level: 1, modules: 7, desc: "Read-only access across all data modules. Compliance verification and audit log review.", badge: "bg-amber-100 text-amber-700 border-amber-200",  bar: "bg-amber-500"  },
];

const STATS = [
  { value: 0,    suffix: "",   label: "Properties Registered",  icon: Home,       color: "text-blue-300"    },
  { value: 0,    suffix: "",   label: "Tax Collected YTD",      icon: TrendingUp, color: "text-emerald-300", prefix: "₱" },
  { value: 0,    suffix: "%",  label: "Compliance Rate",        icon: ShieldCheck,color: "text-amber-300"   },
  { value: 9,    suffix: "",    label: "Core Modules",          icon: LayoutDashboard, color: "text-violet-300" },
];

// ─── Nav ─────────────────────────────────────────────────────────────────────
function Navbar({ onSignIn }: { onSignIn: () => void }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? "bg-white/95 backdrop-blur-md shadow-sm border-b border-slate-200" : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 h-16 grid grid-cols-3 items-center">
        {/* Logo — left col */}
        <div className="flex items-center gap-3">
          <BrandLogo
            variant="mark"
            className={`w-12 h-12 flex-shrink-0 ring-1 shadow-sm ${scrolled ? "ring-slate-200" : "ring-white/10"}`}
          />
          <div>
            <p className={`text-base font-bold tracking-tight leading-none ${scrolled ? "text-slate-900" : "text-white"}`}>
              TaxSync
            </p>
            <p className={`text-[11px] leading-tight ${scrolled ? "text-slate-500" : "text-blue-300"}`}>
              Property Tax System
            </p>
          </div>
        </div>

        {/* Desktop links — center col, truly centered */}
        <nav className="hidden md:flex items-center justify-center gap-6 -translate-x-2">
          {["Features", "Modules", "Roles", "About"].map((link) => (
            <a
              key={link}
              href={`#${link.toLowerCase()}`}
              className="text-sm font-medium transition-opacity hover:opacity-70"
              style={{ color: scrolled ? "#475569" : "#ffffff" }}
            >
              {link}
            </a>
          ))}
        </nav>
        {/* Mobile — empty center col */}
        <div className="md:hidden" />

        {/* CTA — right col */}
        <div className="hidden md:flex items-center justify-end gap-3">
          <button
            onClick={onSignIn}
            className="px-5 py-2 rounded-lg text-sm font-semibold transition-all hover:opacity-90"
            style={scrolled
              ? { backgroundColor: "#0f172a", color: "#ffffff" }
              : { backgroundColor: "rgba(255,255,255,0.15)", color: "#ffffff", border: "1px solid rgba(255,255,255,0.25)", backdropFilter: "blur(8px)" }}
          >
            Sign In to Portal
          </button>
        </div>

        {/* Mobile hamburger — right col */}
        <div className="md:hidden flex justify-end">
        <button
          className={`p-2 rounded-lg ${scrolled ? "text-slate-600" : "text-white"}`}
          onClick={() => setOpen(!open)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden bg-white border-t border-slate-200 px-6 py-4 space-y-3">
          {["Features", "Modules", "Roles", "About"].map((link) => (
            <a key={link} href={`#${link.toLowerCase()}`} onClick={() => setOpen(false)}
              className="block text-sm font-medium text-slate-600 hover:text-slate-900 py-1">
              {link}
            </a>
          ))}
          <div className="pt-2 border-t border-slate-100">
            <button onClick={onSignIn}
              className="w-full py-2.5 rounded-lg text-sm font-semibold bg-slate-900 text-white hover:bg-slate-700 transition-colors">
              Sign In to Portal
            </button>
          </div>
        </div>
      )}
    </header>
  );
}

// ─── Hero Section ─────────────────────────────────────────────────────────────
function Hero() {
  return (
    <section
      className="relative min-h-screen flex flex-col justify-center overflow-hidden"
      style={{ background: "linear-gradient(135deg, #0d1b2a 0%, #0d2137 45%, #0f2d4a 75%, #112040 100%)" }}
    >
      <GridPattern opacity="0.06" />

      {/* Decorative circles */}
      <div className="absolute top-1/4 right-0 w-[600px] h-[600px] rounded-full opacity-[0.04]"
        style={{ background: "radial-gradient(circle, #3b82f6 0%, transparent 70%)", transform: "translateX(30%)" }} />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full opacity-[0.03]"
        style={{ background: "radial-gradient(circle, #60a5fa 0%, transparent 70%)", transform: "translate(-30%, 30%)" }} />

      {/* Blue top accent */}
      <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: "#2563eb" }} />

      <div className="relative z-10 max-w-7xl mx-auto px-6 pt-28 pb-20">
        <div className="grid lg:grid-cols-2 gap-16 items-center">

          {/* Left — text */}
          <motion.div
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            {/* Government badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-6"
              style={{ backgroundColor: "rgba(37,99,235,0.18)", border: "1px solid rgba(96,165,250,0.25)" }}>
              <Globe className="h-3.5 w-3.5 text-blue-400" />
              <span className="text-blue-300 text-[11px] font-semibold uppercase tracking-widest">
                Republic of the Philippines · LGU Digital Platform
              </span>
            </div>

            <h1 className="text-white leading-tight mb-5"
              style={{ fontSize: "clamp(2rem, 4vw, 3.2rem)", fontWeight: 800, letterSpacing: "-0.02em" }}>
              Property Taxation &<br />
              <span style={{ color: "#60a5fa" }}>Compliance Reporting</span><br />
              System
            </h1>

            <p className="text-lg leading-relaxed mb-8" style={{ color: "#93b8d8", maxWidth: "52ch" }}>
              A comprehensive enterprise ERP platform for local government units — streamlining real property tax administration,
              compliance monitoring, and official government reporting under R.A. 7160.
            </p>

            <div className="flex flex-wrap gap-3 mb-10">
              <a
                href="#modules"
                className="inline-flex items-center gap-2.5 px-6 py-3 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90"
                style={{ backgroundColor: "#2563eb", boxShadow: "0 4px 20px rgba(37,99,235,0.35)" }}
              >
                Explore Modules
                <ChevronDown className="h-4 w-4" />
              </a>
            </div>

            {/* Quick role pills */}
            <div className="flex flex-wrap gap-2">
              <span className="text-xs text-slate-400 mr-1 self-center">4 Role Types:</span>
              {["Admin", "Accountant", "Staff Encoder", "Auditor"].map((r) => (
                <span key={r} className="px-2.5 py-1 text-[11px] font-medium rounded-full"
                  style={{ backgroundColor: "rgba(255,255,255,0.08)", color: "#94a3b8", border: "1px solid rgba(255,255,255,0.1)" }}>
                  {r}
                </span>
              ))}
            </div>
          </motion.div>

          {/* Right — dashboard preview card */}
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.15, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="hidden lg:block"
          >
            <div className="rounded-2xl overflow-hidden shadow-2xl"
              style={{ border: "1px solid rgba(255,255,255,0.1)", backgroundColor: "rgba(255,255,255,0.04)" }}>
              {/* Fake browser chrome */}
              <div className="flex items-center gap-2 px-4 py-3" style={{ backgroundColor: "rgba(0,0,0,0.3)" }}>
                <div className="w-3 h-3 rounded-full bg-red-500/60" />
                <div className="w-3 h-3 rounded-full bg-amber-500/60" />
                <div className="w-3 h-3 rounded-full bg-emerald-500/60" />
                <div className="flex-1 mx-4 h-6 rounded-md flex items-center px-3"
                  style={{ backgroundColor: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <span className="text-[11px]" style={{ color: "#64748b" }}>app.taxsync.gov.ph/dashboard</span>
                </div>
              </div>

              {/* Dashboard preview */}
              <div className="p-5" style={{ backgroundColor: "#f8fafc" }}>
                {/* KPI row */}
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {[
                    { label: "Properties", value: "0",   sub: "Awaiting sync",       color: "text-blue-600",    bg: "bg-blue-50"    },
                    { label: "Tax YTD",    value: "₱0",  sub: "Awaiting sync",       color: "text-emerald-600", bg: "bg-emerald-50" },
                    { label: "Pending",    value: "0",   sub: "No live balances",    color: "text-amber-600",   bg: "bg-amber-50"   },
                    { label: "Compliance", value: "0%",  sub: "Policy-based target", color: "text-blue-600",    bg: "bg-blue-50"    },
                  ].map((k) => (
                    <div key={k.label} className={`${k.bg} rounded-lg p-2.5`}>
                      <p className="text-[9px] text-slate-500 uppercase tracking-wider font-medium">{k.label}</p>
                      <p className={`text-sm font-bold mt-0.5 ${k.color}`}>{k.value}</p>
                      <p className="text-[9px] text-slate-400 mt-0.5">{k.sub}</p>
                    </div>
                  ))}
                </div>

                {/* Collection preview */}
                <div className="bg-white rounded-lg p-3 mb-2 border border-slate-200">
                  <p className="text-[10px] font-semibold text-slate-600 mb-2">Monthly Tax Collection</p>
                  <div className="h-16 rounded-md border border-dashed border-slate-200 bg-slate-50 flex items-center justify-center">
                    <span className="text-[10px] text-slate-400">Live dashboard metrics appear after backend synchronization.</span>
                  </div>
                </div>

                {/* Status row */}
                <div className="flex gap-2">
                  <div className="flex-1 bg-emerald-50 border border-emerald-200 rounded-lg p-2 text-center">
                    <p className="text-[9px] text-emerald-600 font-semibold">COMPLIANT</p>
                    <p className="text-sm font-bold text-emerald-700">0</p>
                  </div>
                  <div className="flex-1 bg-amber-50 border border-amber-200 rounded-lg p-2 text-center">
                    <p className="text-[9px] text-amber-600 font-semibold">LATE</p>
                    <p className="text-sm font-bold text-amber-700">0</p>
                  </div>
                  <div className="flex-1 bg-red-50 border border-red-200 rounded-lg p-2 text-center">
                    <p className="text-[9px] text-red-600 font-semibold">UNPAID</p>
                    <p className="text-sm font-bold text-red-700">0</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          className="flex justify-center mt-16"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.6 }}
        >
          <a href="#features" className="flex flex-col items-center gap-2 opacity-40 hover:opacity-70 transition-opacity">
            <span className="text-[11px] text-white uppercase tracking-widest">Scroll to explore</span>
            <motion.div
              animate={{ y: [0, 6, 0] }}
              transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}
            >
              <ChevronDown className="h-5 w-5 text-white" />
            </motion.div>
          </a>
        </motion.div>
      </div>
    </section>
  );
}

// ─── Stats Section ────────────────────────────────────────────────────────────
function StatsSection() {
  return (
    <section className="py-16 border-b border-slate-200" style={{ backgroundColor: "#0d2137" }}>
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {STATS.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="text-center">
                <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl mb-3 ${s.color}`}
                  style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <Icon className="h-5 w-5" />
                </div>
                <p className="text-white mb-1" style={{ fontSize: "1.85rem", fontWeight: 800, letterSpacing: "-0.02em" }}>
                  <Counter to={s.value} prefix={s.prefix} suffix={s.suffix} />
                </p>
                <p className="text-sm" style={{ color: "#6b93b8" }}>{s.label}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ─── Features Section ─────────────────────────────────────────────────────────
function FeaturesSection() {
  const highlights = [
    { icon: Shield,   title: "Role-Based Access Control",   desc: "4 distinct roles with granular permission mapping — Admin, Accountant, Staff Encoder, and Auditor — each with precise module-level access.",         color: "blue"    },
    { icon: Zap,      title: "AI Anomaly Detection",        desc: "Machine learning model trained on 3,847+ property records flags assessed values outside normal range for immediate audit review.",                    color: "violet"  },
    { icon: BarChart2,title: "Live KPI Dashboard",          desc: "Executive dashboard with real-time tax collection charts, SVG compliance arc gauge, and 30-day revenue forecast powered by ML predictions.",        color: "emerald" },
    { icon: Award,    title: "Audit-Ready Compliance",      desc: "Full read-only audit trail, severity-filtered logs, exportable reports, and a dedicated Auditor role for government COA compliance.",              color: "amber"   },
    { icon: Star,     title: "LGC-Compliant Computations",  desc: "RPT auto-calculation follows R.A. 7160 schedules — basic tax, SEF levy, surcharges, penalties, and early payment discounts built in.",             color: "teal"    },
    { icon: Building2, title: "Multi-Barangay Support",     desc: "Manage properties across all barangays with breakdown charts, compliance summaries, and collection efficiency reports per district.",              color: "orange"  },
  ];

  return (
    <section id="features" className="py-24 bg-slate-50">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-full mb-4">
            <Zap className="h-3.5 w-3.5 text-blue-600" />
            <span className="text-xs font-semibold text-blue-700 uppercase tracking-wider">Platform Features</span>
          </div>
          <h2 className="text-slate-900 mb-4" style={{ fontSize: "clamp(1.6rem, 3vw, 2.4rem)", fontWeight: 800 }}>
            Built for Philippine LGU<br />Property Tax Administration
          </h2>
          <p className="text-slate-500 max-w-2xl mx-auto leading-relaxed">
            Every feature is designed around the workflows of treasurers, assessors, accountants, and internal auditors
            operating under the Local Government Code of 1991.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {highlights.map((f) => {
            const Icon = f.icon;
            const c = COLOR_MAP[f.color];
            return (
              <motion.div
                key={f.title}
                whileHover={{ y: -4 }}
                transition={{ duration: 0.22 }}
                className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className={`inline-flex p-3 rounded-xl mb-4 ${c.bg} ${c.border} border`}>
                  <Icon className={`h-5 w-5 ${c.text}`} />
                </div>
                <h3 className="text-slate-900 mb-2" style={{ fontSize: "0.95rem", fontWeight: 700 }}>{f.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ─── Modules Grid ─────────────────────────────────────────────────────────────
function ModulesSection() {
  return (
    <section id="modules" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-full mb-4">
            <LayoutDashboard className="h-3.5 w-3.5 text-slate-600" />
            <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">9 Core Modules</span>
          </div>
          <h2 className="text-slate-900 mb-4" style={{ fontSize: "clamp(1.6rem, 3vw, 2.4rem)", fontWeight: 800 }}>
            Everything in One Unified Platform
          </h2>
          <p className="text-slate-500 max-w-xl mx-auto leading-relaxed">
            From property registration to final audit submission — TaxSync covers the full lifecycle of real property tax administration.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {MODULES.map((m, i) => {
            const Icon = m.icon;
            const c = COLOR_MAP[m.color];
            return (
              <motion.div
                key={m.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.45, delay: (i % 3) * 0.08 }}
                className="group flex items-start gap-4 p-5 rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all bg-white"
              >
                <div className={`flex-shrink-0 p-2.5 rounded-xl ${c.bg} ${c.border} border group-hover:scale-105 transition-transform`}>
                  <Icon className={`h-5 w-5 ${c.text}`} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <h4 className="text-sm font-bold text-slate-900 leading-tight">{m.name}</h4>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${c.badge} flex-shrink-0`}>
                      M{i + 1}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">{m.desc}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ─── Roles Section ────────────────────────────────────────────────────────────
function RolesSection() {
  return (
    <section id="roles" className="py-24" style={{ backgroundColor: "#f1f5f9" }}>
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-purple-50 border border-purple-200 rounded-full mb-4">
            <Users className="h-3.5 w-3.5 text-purple-600" />
            <span className="text-xs font-semibold text-purple-700 uppercase tracking-wider">Role-Based Access Control</span>
          </div>
          <h2 className="text-slate-900 mb-4" style={{ fontSize: "clamp(1.6rem, 3vw, 2.4rem)", fontWeight: 800 }}>
            4 User Roles, Precisely Configured
          </h2>
          <p className="text-slate-500 max-w-xl mx-auto leading-relaxed">
            Each role has a distinct access level — from full administrative control down to read-only auditor visibility — ensuring data integrity and accountability.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {ROLES.map((role, i) => (
            <motion.div
              key={role.name}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col"
            >
              <div className="flex items-center justify-between mb-4">
                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${role.badge}`}>{role.name}</span>
                <span className="text-xs text-slate-400 font-medium">L{role.level}</span>
              </div>

              <div className="mb-4">
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-slate-500">Access Level</span>
                  <span className="font-semibold text-slate-700">{role.level}/4</span>
                </div>
                <div className="flex gap-1">
                  {[1, 2, 3, 4].map((n) => (
                    <div key={n} className={`flex-1 h-2 rounded-full ${n <= role.level ? role.bar : "bg-slate-100"}`} />
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-1.5 mb-3">
                <LayoutDashboard className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                <span className="text-xs text-slate-600 font-medium">{role.modules} modules accessible</span>
              </div>

              <p className="text-xs text-slate-500 leading-relaxed flex-1">{role.desc}</p>

              <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-2">
                {role.name === "Auditor" ? (
                  <div className="flex items-center gap-1.5 text-xs text-amber-700 font-medium">
                    <Lock className="h-3 w-3" /> Read-Only Mode
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-medium">
                    <CheckCircle className="h-3 w-3" /> Data Entry Enabled
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── About / Legal Section ─────────────────────────────────────────────────────
function AboutSection() {
  return (
    <section id="about" className="py-24 bg-white border-t border-slate-200">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-full mb-5">
              <Shield className="h-3.5 w-3.5 text-emerald-600" />
              <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Legal Framework</span>
            </div>
            <h2 className="text-slate-900 mb-5" style={{ fontSize: "clamp(1.5rem, 2.5vw, 2rem)", fontWeight: 800 }}>
              Built on the Local<br />Government Code of 1991
            </h2>
            <p className="text-slate-500 leading-relaxed mb-6">
              TaxSync is designed in full compliance with Republic Act 7160 (Local Government Code), DILG Memorandum Circulars on RPT administration, and COA audit standards for LGU financial systems.
            </p>
            <div className="space-y-3">
              {[
                "R.A. 7160 — Local Government Code of 1991",
                "BLGF Circulars on Real Property Tax Rates",
                "COA-compliant audit trail & reporting",
                "DICT Data Privacy Act compliance (R.A. 10173)",
              ].map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
                    <CheckCircle className="h-3 w-3 text-emerald-600" />
                  </div>
                  <span className="text-sm text-slate-700">{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Security info card */}
          <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm" style={{ backgroundColor: "#0d2137" }}>
            <GridPattern opacity="0.05" />
            <div className="relative z-10 p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 rounded-xl" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
                  <Lock className="h-5 w-5 text-blue-300" />
                </div>
                <h3 className="text-white" style={{ fontWeight: 700 }}>Secure Government Portal</h3>
              </div>

              <div className="space-y-4">
                {[
                  { label: "Encryption",    value: "256-bit TLS (HTTPS)",        icon: Shield },
                  { label: "Access",        value: "Authorized LGU Personnel Only", icon: Users  },
                  { label: "Audit Trail",   value: "Full tamper-evident logs",   icon: History },
                  { label: "Availability",  value: "99.9% uptime SLA",           icon: Zap     },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.label} className="flex items-center gap-3 p-3 rounded-xl"
                      style={{ backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }}>
                      <div className="p-1.5 rounded-lg flex-shrink-0" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
                        <Icon className="h-3.5 w-3.5 text-blue-300" />
                      </div>
                      <div className="flex-1 flex justify-between items-center">
                        <span className="text-xs font-medium" style={{ color: "#6b93b8" }}>{item.label}</span>
                        <span className="text-xs font-semibold text-white">{item.value}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 p-4 rounded-xl" style={{ backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <p className="text-xs leading-relaxed" style={{ color: "#4a7fa5" }}>
                  Unauthorized access is strictly prohibited under R.A. 7160 and applicable DILG security regulations. All access attempts are logged and monitored.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── CTA Banner ───────────────────────────────────────────────────────────────
function CtaBanner({ onSignIn }: { onSignIn: () => void }) {
  return (
    <section
      className="relative py-20 overflow-hidden"
      style={{ background: "linear-gradient(135deg, #0d1b2a 0%, #0d2137 60%, #112040 100%)" }}
    >
      <GridPattern opacity="0.05" />
      <div className="absolute top-0 left-0 right-0 h-px" style={{ backgroundColor: "rgba(255,255,255,0.08)" }} />
      <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-6"
          style={{ backgroundColor: "rgba(37,99,235,0.2)", border: "1px solid rgba(96,165,250,0.2)" }}>
          <Zap className="h-3.5 w-3.5 text-blue-400" />
          <span className="text-blue-300 text-xs font-semibold uppercase tracking-widest">Ready to Get Started?</span>
        </div>
        <h2 className="text-white mb-4" style={{ fontSize: "clamp(1.6rem, 3vw, 2.4rem)", fontWeight: 800 }}>
          Access the TaxSync Portal
        </h2>
        <p className="mb-8 leading-relaxed" style={{ color: "#93b8d8", fontSize: "1.0625rem" }}>
          Use your authorized LGU credentials to sign in. Contact your system administrator if you require account provisioning.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <button
            onClick={onSignIn}
            className="inline-flex items-center gap-2.5 px-8 py-3.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90"
            style={{ backgroundColor: "#2563eb", boxShadow: "0 4px 24px rgba(37,99,235,0.4)" }}
          >
            <Lock className="h-4 w-4" />
            Sign In to Portal
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-6 text-xs" style={{ color: "#4a7fa5" }}>
          For authorized LGU personnel only · v3.1.0 Enterprise · © 2026 TaxSync
        </p>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="bg-white border-t border-slate-200 py-10">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-3 items-center gap-6">
          {/* Left col — logo (matches navbar logo col) */}
          <div className="flex items-center gap-3">
            <BrandLogo variant="mark" className="w-8 h-8 rounded-lg ring-1 ring-slate-200 shadow-sm" />
            <div>
              <p className="text-sm font-bold text-slate-900 leading-none">TaxSync</p>
              <p className="text-[10px] text-slate-500">Property Tax & Compliance Reporting System</p>
            </div>
          </div>
          {/* Center col — links (matches navbar nav col, same -translate-x-2 shift) */}
          <div className="flex items-center justify-center gap-6 -translate-x-2">
            <a href="#features" className="text-xs text-slate-400 hover:text-slate-600 transition-colors">Features</a>
            <a href="#modules"  className="text-xs text-slate-400 hover:text-slate-600 transition-colors">Modules</a>
            <a href="#roles"    className="text-xs text-slate-400 hover:text-slate-600 transition-colors">Roles</a>
            <a href="#about"    className="text-xs text-slate-400 hover:text-slate-600 transition-colors">Legal</a>
          </div>
          {/* Right col — copyright (matches navbar CTA col) */}
          <p className="text-xs text-slate-400 text-right">
            © 2026 Republic of the Philippines · Department of Finance · LGU Division
          </p>
        </div>
      </div>
    </footer>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function Landing() {
  const navigate = useNavigate();
  const handleSignIn = () => navigate("/login");

  return (
    <div className="min-h-screen">
      <Navbar onSignIn={handleSignIn} />
      <Hero />
      <StatsSection />
      <FeaturesSection />
      <ModulesSection />
      <RolesSection />
      <AboutSection />
      <CtaBanner onSignIn={handleSignIn} />
      <Footer />
    </div>
  );
}
