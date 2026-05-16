import { useState, useRef, useEffect } from "react";
import { Link, Outlet, useLocation, Navigate, useNavigate } from "react-router";
import {
  LayoutDashboard, Home, Calculator, CreditCard,
  FileText, ShieldCheck, FolderOpen, History, Users,
  Bell, Search, ChevronDown, LogOut, Settings, User,
  X, AlertTriangle, CalendarDays, Clock, Menu,
  Shield, Info, Eye,
} from "lucide-react";
import { useAuth, ROLE_META, Permission } from "../context/AuthContext";
import BrandLogo from "./BrandLogo";

// ─── Nav item definitions ────────────────────────────────────────────────────
const NAV_ITEMS = [
  {
    name: "Dashboard",
    path: "/app",
    icon: LayoutDashboard,
    permission: "dashboard.view" as Permission,
    description: "Overview & KPIs",
  },
  {
    name: "Property Registry",
    path: "/app/property-registration",
    icon: Home,
    permission: "property.view" as Permission,
    description: "Register & manage properties",
  },
  {
    name: "Tax Calculation",
    path: "/app/tax-calculation",
    icon: Calculator,
    permission: "tax.view" as Permission,
    description: "RPT computation & rates",
  },
  {
    name: "Payment Management",
    path: "/app/payment-management",
    icon: CreditCard,
    permission: "payment.view" as Permission,
    description: "Record & track payments",
  },
  {
    name: "Compliance",
    path: "/app/compliance",
    icon: ShieldCheck,
    permission: "compliance.view" as Permission,
    description: "Deadlines & compliance status",
  },
  {
    name: "Filing & Docs",
    path: "/app/filing",
    icon: FolderOpen,
    permission: "filing.view" as Permission,
    description: "Document repository",
  },
  {
    name: "Govt Reporting",
    path: "/app/reporting",
    icon: FileText,
    permission: "reporting.view" as Permission,
    description: "Barangay & LGU reports",
  },
  {
    name: "Audit Support",
    path: "/app/audit",
    icon: History,
    permission: "audit.view" as Permission,
    description: "System activity logs",
  },
  {
    name: "User Management",
    path: "/app/users",
    icon: Users,
    permission: "users.view" as Permission,
    description: "Accounts & roles",
  },
];

const NOTIFICATIONS: Array<{ id: number; title: string; desc: string; type: "deadline" | "overdue" | "info"; time: string }> = [];

function AccessLevelBar({ level }: { level: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= level ? "bg-current opacity-60" : "bg-current opacity-10"}`} />
      ))}
    </div>
  );
}

export default function AppLayout() {
  const { user, isAuthenticated, logout, hasPermission } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu]   = useState(false);
  const [showRoleInfo, setShowRoleInfo]   = useState(false);
  const [sidebarOpen, setSidebarOpen]     = useState(false);
  const notifRef    = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (notifRef.current    && !notifRef.current.contains(e.target as Node))    setShowNotifications(false);
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setShowUserMenu(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const meta        = ROLE_META[user!.role];
  const urgentCount = NOTIFICATIONS.filter((n) => n.type === "overdue").length;

  const accessibleNav = NAV_ITEMS.filter((item) => hasPermission(item.permission));

  const handleLogout = () => { logout(); navigate("/"); };

  return (
    <div className="flex h-screen w-full bg-slate-50 font-sans text-slate-900 overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Sidebar ──────────────────────────────────────────────────────────── */}
      <aside className={`fixed lg:relative inset-y-0 left-0 z-40 w-64 flex-shrink-0 bg-white border-r border-slate-200 flex flex-col transition-transform duration-300 ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>

        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b flex-shrink-0"
          style={{ backgroundColor: "#0d2137", borderColor: "rgba(99,179,255,0.12)" }}>
          <div className="flex items-center gap-3 min-w-0">
            {/* PNG badge — white rounded card on dark navy */}
            <BrandLogo
              variant="mark"
              className="flex-shrink-0 h-11 w-11 shadow-lg shadow-slate-950/50 ring-1 ring-white/20"
            />
            <div className="min-w-0">
              <p className="text-sm font-extrabold text-white tracking-tight leading-none">TaxSync</p>
              <p className="text-[10px] font-medium leading-tight mt-0.5" style={{ color: "rgba(147,197,253,0.7)" }}>Property Tax System</p>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1.5 rounded-lg text-blue-300/70 hover:text-white hover:bg-white/10 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Role card */}
        <div className={`px-4 py-3 border-b border-slate-100 ${meta.bgClass}`}>
          <div className="flex items-center gap-2.5">
            <div className={`h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${meta.badgeClass}`}>
              {user!.initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900 truncate">{user!.name}</p>
              <span className={`inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full mt-0.5 ${meta.badgeClass}`}>
                {meta.label}
              </span>
            </div>
            <button onClick={() => setShowRoleInfo(!showRoleInfo)}
              className={`p-1 rounded-full ${meta.textClass} hover:opacity-70 transition-opacity flex-shrink-0`}
              title="View role permissions">
              <Info className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className={`mt-2.5 ${meta.textClass}`}>
            <AccessLevelBar level={meta.accessLevel} />
            <p className="text-[10px] mt-1 opacity-60">Access Level {meta.accessLevel} of 4</p>
          </div>

          {/* Auditor Read-Only indicator */}
          {user!.role === "Auditor" && (
            <div className="mt-2.5 flex items-center gap-2 px-2.5 py-2 bg-amber-100 border border-amber-300 rounded-lg">
              <Eye className="h-3.5 w-3.5 text-amber-700 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">Read-Only Mode</p>
                <p className="text-[9px] text-amber-600 leading-tight mt-0.5">View & export only · No modifications</p>
              </div>
            </div>
          )}

          {showRoleInfo && (
            <div className="mt-3 p-3 bg-white rounded-lg border border-slate-200 shadow-sm text-xs text-slate-600 space-y-1">
              <p className="font-semibold text-slate-800 mb-1.5">{meta.label} Permissions:</p>
              {meta.description.split(" · ").map((line, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full mt-1 flex-shrink-0 ${meta.textClass} bg-current`} />
                  <span>{line}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-3">
          <p className="text-[10px] text-slate-400 uppercase tracking-widest px-3 py-2 font-semibold">
            My Modules ({accessibleNav.length})
          </p>
          <div className="space-y-0.5">
            {accessibleNav.map((item) => {
              const isActive = location.pathname === item.path;
              const Icon = item.icon;
              return (
                <Link key={item.path} to={item.path} onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive ? "shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                  style={isActive ? { backgroundColor: "#0d2137", color: "white" } : {}}>
                  <Icon className="flex-shrink-0" style={{ width: 16, height: 16 }} />
                  <div className="min-w-0 flex-1">
                    <p className="leading-tight" style={isActive ? { color: "white" } : {}}>{item.name}</p>
                    <p className={`text-[10px] leading-tight mt-0.5 ${isActive ? "text-blue-300" : "text-slate-400"}`}>
                      {item.description}
                    </p>
                  </div>
                  {isActive && <div className="w-1.5 h-1.5 rounded-full bg-blue-300 flex-shrink-0" />}
                </Link>
              );
            })}
          </div>

          {/* Restricted items removed per request; staff modules won't show locked entries. */}
        </nav>

        {/* Bottom — Copyright */}
        <div className="p-3 border-t border-slate-200 flex-shrink-0">
          <p className="px-3 mt-1.5 text-[10px] text-slate-300">© 2026 TaxSync LGU System · v3.1.0</p>
        </div>
      </aside>

      {/* ── Main Content ─────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Top Header */}
        <header className="h-16 flex-shrink-0 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-6 z-20">
          <div className="flex items-center gap-3 flex-1">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-md transition-colors">
              <Menu className="h-5 w-5" />
            </button>
            <div className="relative w-full max-w-md hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input type="text" placeholder="Search properties, taxpayers, payments..."
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors focus:bg-white" />
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Notifications */}
            <div className="relative" ref={notifRef}>
              <button onClick={() => { setShowNotifications(!showNotifications); setShowUserMenu(false); }}
                className="relative p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors">
                <Bell className="h-5 w-5" />
                {urgentCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden z-50">
                  <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                    <h3 className="text-sm font-semibold text-slate-900">Notifications</h3>
                    {urgentCount > 0 ? (
                      <span className="text-[10px] text-white bg-red-500 px-2 py-0.5 rounded-full font-bold">{urgentCount} urgent</span>
                    ) : (
                      <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full font-bold">All clear</span>
                    )}
                  </div>
                  <div className="divide-y divide-slate-50 max-h-80 overflow-y-auto">
                    {NOTIFICATIONS.length > 0 ? (
                      NOTIFICATIONS.map((n) => (
                        <div key={n.id} className={`p-3.5 hover:bg-slate-50 transition-colors ${n.type === "overdue" ? "border-l-2 border-l-red-400" : ""}`}>
                          <div className="flex gap-3">
                            <div className={`mt-0.5 p-1.5 rounded-full flex-shrink-0 ${n.type === "overdue" ? "bg-red-100 text-red-600" : n.type === "deadline" ? "bg-amber-100 text-amber-600" : "bg-blue-100 text-blue-600"}`}>
                              {n.type === "overdue"  ? <AlertTriangle className="h-3.5 w-3.5" /> :
                               n.type === "deadline" ? <CalendarDays  className="h-3.5 w-3.5" /> :
                                                       <Clock         className="h-3.5 w-3.5" />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-slate-900 leading-tight">{n.title}</p>
                              <p className="text-xs text-slate-500 mt-0.5">{n.desc}</p>
                              <p className={`text-xs mt-1 font-medium ${n.type === "overdue" ? "text-red-600" : "text-slate-400"}`}>{n.time}</p>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-6 text-center text-sm text-slate-400">No notifications available yet.</div>
                    )}
                  </div>
                  <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50 text-center">
                    <button className="text-xs text-blue-600 hover:text-blue-700 font-medium">View all notifications →</button>
                  </div>
                </div>
              )}
            </div>

            {/* Role badge */}
            <div className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border ${meta.badgeClass}`}>
              <Shield className="h-3 w-3" />
              {meta.label}
            </div>

            {/* User Menu */}
            <div className="relative" ref={userMenuRef}>
              <button onClick={() => { setShowUserMenu(!showUserMenu); setShowNotifications(false); }}
                className="flex items-center gap-2.5 px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${meta.badgeClass}`}>
                  {user!.initials}
                </div>
                <div className="hidden md:block text-left">
                  <p className="text-sm font-medium text-slate-700 leading-tight">{user!.name}</p>
                  <p className="text-[10px] text-slate-400">{meta.label}</p>
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-slate-400 hidden md:block" />
              </button>

              {showUserMenu && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden z-50">
                  <div className={`p-4 border-b border-slate-100 ${meta.bgClass}`}>
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold ${meta.badgeClass}`}>
                        {user!.initials}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{user!.name}</p>
                        <p className="text-xs text-slate-500">{user!.email}</p>
                        <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${meta.badgeClass}`}>
                          {meta.label}
                        </span>
                      </div>
                    </div>
                    <div className={`mt-3 ${meta.textClass}`}>
                      <div className="flex justify-between text-[10px] mb-1 opacity-70">
                        <span>Access Level</span><span>{meta.accessLevel}/4</span>
                      </div>
                      <AccessLevelBar level={meta.accessLevel} />
                    </div>
                  </div>
                  <div className="p-2">
                    <Link
                      to="/app/settings"
                      onClick={() => setShowUserMenu(false)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
                    >
                      <User className="h-4 w-4 text-slate-400" /> My Profile
                    </Link>
                    <Link
                      to="/app/settings"
                      onClick={() => setShowUserMenu(false)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
                    >
                      <Settings className="h-4 w-4 text-slate-400" /> {hasPermission("settings.manage") ? "System Settings" : "Account Settings"}
                    </Link>
                    <div className="mx-2 my-2 p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                      <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-1.5">Your Access</p>
                      <p className="text-xs text-slate-600 leading-snug">{meta.description}</p>
                    </div>
                    <div className="border-t border-slate-100 my-1" />
                    <button onClick={handleLogout}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium">
                      <LogOut className="h-4 w-4" /> Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto bg-slate-50 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}