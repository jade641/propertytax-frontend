import { useState } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import {
  Eye, EyeOff, AlertCircle, Mail, Lock,
  Home, Receipt,
  ShieldCheck, ClipboardList,
  CheckCircle, Send, ArrowLeft,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import BrandLogo from "../components/BrandLogo";

// ── Types ────────────────────────────────────────────────────────────────────
type AuthState = "login" | "forgot" | "sent";

// ── Subtle grid background ────────────────────────────────────────────────────
function GridPattern() {
  return (
    <svg className="absolute inset-0 w-full h-full opacity-[0.06]" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.8" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid)" />
    </svg>
  );
}

function DiagonalAccent() {
  return (
    <svg className="absolute bottom-0 right-0 w-80 h-80 opacity-[0.04]" viewBox="0 0 320 320" xmlns="http://www.w3.org/2000/svg">
      {Array.from({ length: 12 }, (_, i) => (
        <line key={i} x1={i * 30} y1="320" x2="320" y2={i * 30} stroke="white" strokeWidth="1.5" />
      ))}
    </svg>
  );
}

// ── Feature list ─────────────────────────────────────────────────────────────
const FEATURES = [
  {
    Icon: Home,
    label: "Property Registration & Assessment",
    desc: "Register properties and track market & assessed values per LGU guidelines.",
  },
  {
    Icon: Receipt,
    label: "Real Property Tax Computation",
    desc: "Auto-calculate RPT based on assessed value and applicable tax rates.",
  },
  {
    Icon: ShieldCheck,
    label: "Payment & Compliance Tracking",
    desc: "Monitor payment status, delinquencies, and compliance across barangays.",
  },
  {
    Icon: ClipboardList,
    label: "Audit-Ready Reporting",
    desc: "Generate official LGU reports, barangay summaries, and audit trail.",
  },
];

// ── Input field focus helpers ─────────────────────────────────────────────────
const onFocusStyle = (e: React.FocusEvent<HTMLInputElement>) => {
  e.currentTarget.style.borderColor = "#1e40af";
  e.currentTarget.style.boxShadow = "0 0 0 2px rgba(30,64,175,0.12)";
};
const onBlurStyle = (e: React.FocusEvent<HTMLInputElement>) => {
  e.currentTarget.style.borderColor = "#cbd5e1";
  e.currentTarget.style.boxShadow = "none";
};

const inputCls =
  "w-full pl-10 pr-4 py-3 text-sm border border-slate-300 rounded bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white transition-colors";

const navyBtn =
  "w-full py-3 rounded text-white text-sm font-semibold tracking-wide transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2.5";

const panelVariants = {
  enter: (dir: number) => ({ opacity: 0, x: dir > 0 ? 24 : -24 }),
  center: { opacity: 1, x: 0, transition: { duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] as const } },
  exit: (dir: number) => ({ opacity: 0, x: dir > 0 ? -24 : 24, transition: { duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] as const } }),
};

// ─────────────────────────────────────────────────────────────────────────────
// STATE 1 — Login Form
// ─────────────────────────────────────────────────────────────────────────────
function LoginForm({ onForgot }: { onForgot: () => void }) {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await login(email, password);
    setLoading(false);
    if (result.success) {
      navigate("/app");
    } else {
      setError(result.error || "Authentication failed. Please verify your credentials.");
    }
  };

  return (
    <div className="w-full max-w-sm mx-auto">
      <div className="mb-8">
        <p className="text-[10px] uppercase tracking-[0.2em] font-semibold mb-2" style={{ color: "#2563eb" }}>
          Secure Government Portal
        </p>
        <h2 className="text-slate-900 mb-1.5" style={{ fontSize: "1.5rem" }}>Welcome Back</h2>
        <p className="text-slate-500 text-sm">Sign in to continue to TaxSync</p>
      </div>

      {error && (
        <div className="mb-6 p-3.5 border rounded flex items-start gap-3" style={{ backgroundColor: "#fef2f2", borderColor: "#fecaca" }}>
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: "#dc2626" }} />
          <div>
            <p className="text-sm font-medium" style={{ color: "#991b1b" }}>Authentication Failed</p>
            <p className="text-xs mt-0.5" style={{ color: "#b91c1c" }}>{error}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5" autoComplete="off">
        <div>
          <label htmlFor="email" className="block text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wider">
            Email / Username
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <Mail className="h-4 w-4 text-slate-400" />
            </div>
            <input
              id="email" type="text" value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your registered email address"
              required autoComplete="username"
              className={inputCls} onFocus={onFocusStyle} onBlur={onBlurStyle}
            />
          </div>
        </div>

        <div>
          <label htmlFor="password" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
            Password
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <Lock className="h-4 w-4 text-slate-400" />
            </div>
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required autoComplete="current-password"
              className="w-full pl-10 pr-11 py-3 text-sm border border-slate-300 rounded bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white transition-colors"
              onFocus={onFocusStyle} onBlur={onBlurStyle}
            />
            <button type="button" onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors" tabIndex={-1}>
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <div className="mt-2">
            <button type="button" onClick={onForgot}
              className="text-xs font-medium transition-colors hover:underline focus:outline-none"
              style={{ color: "#1d4ed8" }}>
              Forgot Password?
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <input type="checkbox" id="rememberMe" checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="h-4 w-4 rounded-sm border-slate-300 cursor-pointer"
            style={{ accentColor: "#1e40af" }} />
          <label htmlFor="rememberMe" className="text-sm text-slate-600 cursor-pointer select-none">
            Remember me on this device
          </label>
        </div>

        <button type="submit" disabled={loading}
          className={navyBtn + " mt-2"}
          style={{ backgroundColor: loading ? "#374151" : "#0d2137", letterSpacing: "0.04em" }}
          onMouseEnter={(e) => { if (!loading) e.currentTarget.style.backgroundColor = "#1e3a5f"; }}
          onMouseLeave={(e) => { if (!loading) e.currentTarget.style.backgroundColor = "#0d2137"; }}>
          {loading ? (
            <>
              <svg className="animate-spin h-4 w-4 text-white/70" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Authenticating...
            </>
          ) : (
            <>
              <Lock className="h-4 w-4 opacity-70" />
              Sign In
            </>
          )}
        </button>
      </form>

      <p className="mt-5 text-center text-xs text-slate-400 leading-snug">
        Contact your system administrator if you have trouble signing in or require account access.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STATE 2 — Forgot Password Form
// ─────────────────────────────────────────────────────────────────────────────
function ForgotForm({ onBack, onSent }: { onBack: () => void; onSent: (email: string) => void }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await new Promise((r) => setTimeout(r, 1400));
    setLoading(false);
    onSent(email);
  };

  return (
    <div className="w-full max-w-sm mx-auto">
      <div className="mb-8">
        <p className="text-[10px] uppercase tracking-[0.2em] font-semibold mb-2" style={{ color: "#2563eb" }}>
          Secure Government Portal
        </p>
        <h2 className="text-slate-900 mb-1.5" style={{ fontSize: "1.5rem" }}>Forgot Password</h2>
        <p className="text-slate-500 text-sm leading-relaxed">
          Enter your registered email address and we'll send you a password reset link.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="reset-email" className="block text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wider">
            Email Address
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <Mail className="h-4 w-4 text-slate-400" />
            </div>
            <input id="reset-email" type="email" value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter registered email address"
              required className={inputCls} onFocus={onFocusStyle} onBlur={onBlurStyle}
            />
          </div>
        </div>

        <button type="submit" disabled={loading}
          className={navyBtn + " mt-2"}
          style={{ backgroundColor: loading ? "#374151" : "#0d2137", letterSpacing: "0.04em" }}
          onMouseEnter={(e) => { if (!loading) e.currentTarget.style.backgroundColor = "#1e3a5f"; }}
          onMouseLeave={(e) => { if (!loading) e.currentTarget.style.backgroundColor = "#0d2137"; }}>
          {loading ? (
            <>
              <svg className="animate-spin h-4 w-4 text-white/70" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Sending Reset Link...
            </>
          ) : (
            <><Send className="h-4 w-4 opacity-70" />Send Reset Link</>
          )}
        </button>
      </form>

      <div className="mt-5 text-center">
        <button type="button" onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm font-medium transition-colors hover:underline focus:outline-none"
          style={{ color: "#1d4ed8" }}>
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Sign In
        </button>
      </div>
      <p className="mt-4 text-center text-xs text-slate-400 leading-snug">
        If your email is registered in the system, you will receive a reset link within a few minutes.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STATE 3 — Email Sent Confirmation
// ─────────────────────────────────────────────────────────────────────────────
function SentConfirm({ email, onBack }: { email: string; onBack: () => void }) {
  return (
    <div className="w-full max-w-sm mx-auto text-center">
      <p className="text-[10px] uppercase tracking-[0.2em] font-semibold mb-8" style={{ color: "#2563eb" }}>
        Secure Government Portal
      </p>
      <div className="flex justify-center mb-6">
        <div className="w-20 h-20 rounded-full flex items-center justify-center"
          style={{ backgroundColor: "#f0fdf4", border: "2px solid #bbf7d0" }}>
          <CheckCircle className="h-10 w-10" style={{ color: "#16a34a" }} />
        </div>
      </div>
      <h2 className="text-slate-900 mb-3" style={{ fontSize: "1.5rem" }}>Reset Link Sent!</h2>
      <p className="text-slate-500 text-sm leading-relaxed mb-2">
        A password reset link has been sent to your registered email address. Please check your inbox or spam folder.
      </p>
      {email && (
        <p className="text-sm font-medium px-4 py-2 rounded inline-block mb-6"
          style={{ color: "#1d4ed8", backgroundColor: "#eff6ff" }}>{email}</p>
      )}
      <button type="button" onClick={onBack}
        className={navyBtn + " mt-2"}
        style={{ backgroundColor: "#0d2137", letterSpacing: "0.04em" }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#1e3a5f")}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#0d2137")}>
        <ArrowLeft className="h-4 w-4 opacity-70" /> Back to Sign In
      </button>
      <p className="mt-5 text-xs text-slate-400 leading-snug">
        Didn't receive an email? Contact your system administrator.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RIGHT SHELL
// ─────────────────────────────────────────────────────────────────────────────
function RightShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 bg-white flex flex-col">
      <div className="lg:hidden h-1 w-full" style={{ backgroundColor: "#1e40af" }} />
      <div className="flex-1 flex flex-col justify-center px-8 sm:px-12 py-12 overflow-y-auto">
        <div className="w-full max-w-sm mx-auto mb-6">
          <a href="/" className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Home
          </a>
        </div>
        {children}
        <div className="w-full max-w-sm mx-auto mt-8 pt-6 border-t border-slate-200">
          <div className="flex items-start gap-2.5 p-3 rounded border"
            style={{ backgroundColor: "#f8fafc", borderColor: "#e2e8f0" }}>
            <ShieldCheck className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: "#1d4ed8" }} />
            <div>
              <p className="text-xs font-semibold text-slate-700 mb-0.5">Secure Government Connection</p>
              <p className="text-xs text-slate-500 leading-snug">
                Your session is protected by 256-bit TLS encryption. Authorized LGU personnel only.
              </p>
            </div>
          </div>
        </div>
      </div>
      <div className="px-8 sm:px-12 py-4 border-t border-slate-200 bg-slate-50">
        <p className="text-center text-[11px] text-slate-400 leading-relaxed">
          © 2026 TaxSync: Property Taxation &amp; Compliance Reporting System. All rights reserved.
          <span className="mx-1.5 text-slate-300">·</span>
          For authorized LGU personnel only.
          <span className="mx-1.5 text-slate-300">·</span>
          v3.1.0 (Enterprise)
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LEFT PANEL
// ─────────────────────────────────────────────────────────────────────────────
function LeftPanel() {
  return (
    <div className="hidden lg:flex lg:w-[44%] flex-col justify-between relative overflow-hidden"
      style={{ backgroundColor: "#0D1B2A" }}>
      <GridPattern />
      <DiagonalAccent />
      <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: "#2563eb" }} />

      <div className="relative z-10 px-10 pt-12 pb-10 flex flex-col h-full">
        {/* Logo + org */}
        <div className="mb-10">
          <div className="flex items-center gap-4 mb-8">
            {/* PNG badge — white card with strong shadow on dark navy */}
            <BrandLogo
              variant="mark"
              className="flex-shrink-0 w-14 h-14 shadow-2xl shadow-slate-950/60 ring-1 ring-white/20"
            />
            <div>
              <p className="text-blue-200 text-[10px] uppercase tracking-[0.18em] font-medium leading-none mb-1">
                Republic of the Philippines
              </p>
              <p className="text-white text-xs font-semibold leading-tight">
                Department of Finance · Treasury Office
              </p>
            </div>
          </div>

          <div className="h-px bg-white/10 mb-8" />

          <h1 className="text-white leading-snug mb-4" style={{ fontSize: "1.35rem" }}>
            Property Taxation &amp;<br />Compliance Reporting<br />System
          </h1>
          <p className="text-sm leading-relaxed" style={{ color: "#93b8d8" }}>
            Secure LGU platform for real property tax administration, compliance monitoring, and government reporting.
          </p>
        </div>

        {/* Feature list */}
        <div className="space-y-5 flex-1">
          {FEATURES.map(({ Icon, label, desc }) => (
            <div key={label} className="flex items-start gap-3.5">
              <div className="flex-shrink-0 mt-0.5 w-8 h-8 rounded flex items-center justify-center border border-blue-400/20"
                style={{ backgroundColor: "#1a3352" }}>
                <Icon className="h-3.5 w-3.5 text-blue-300" />
              </div>
              <div>
                <p className="text-white text-sm font-medium leading-tight">{label}</p>
                <p className="text-xs mt-0.5 leading-snug" style={{ color: "#6b93b8" }}>{desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom notice */}
        <div className="mt-10 pt-6 border-t border-white/10">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "#4ade80" }} />
            <p className="text-xs font-medium" style={{ color: "#4ade80" }}>Authorized LGU Access Only</p>
          </div>
          <p className="text-xs leading-relaxed" style={{ color: "#4a7fa5" }}>
            This system is restricted to authorized local government unit personnel. Unauthorized access is prohibited under R.A. 7160 (Local Government Code) and applicable DILG regulations.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function Login() {
  const [authState, setAuthState] = useState<AuthState>("login");
  const [sentEmail, setSentEmail] = useState("");
  const [direction, setDirection] = useState(1);

  const goTo = (next: AuthState, dir: number) => { setDirection(dir); setAuthState(next); };
  const handleForgot = () => goTo("forgot", 1);
  const handleSent = (email: string) => { setSentEmail(email); goTo("sent", 1); };
  const handleBack = () => goTo("login", -1);

  const panels: Record<AuthState, React.ReactNode> = {
    login: <LoginForm onForgot={handleForgot} />,
    forgot: <ForgotForm onBack={handleBack} onSent={handleSent} />,
    sent: <SentConfirm email={sentEmail} onBack={handleBack} />,
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 lg:p-8" style={{ backgroundColor: "#f1f5f9" }}>
      <div className="w-full max-w-5xl flex rounded-none lg:rounded-xl overflow-hidden shadow-2xl" style={{ minHeight: 620 }}>
        <LeftPanel />
        <RightShell>
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div key={authState} custom={direction} variants={panelVariants} initial="enter" animate="center" exit="exit">
              {panels[authState]}
            </motion.div>
          </AnimatePresence>
        </RightShell>
      </div>
    </div>
  );
}