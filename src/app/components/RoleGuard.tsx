import type { ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth, Permission, ROLE_META, UserRole } from "../context/AuthContext";
import { ShieldOff, Lock, AlertTriangle } from "lucide-react";

interface RoleGuardProps {
  allowedRoles?: UserRole[];
  children?: ReactNode;
}

export default function RoleGuard({ allowedRoles, children }: RoleGuardProps) {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <AccessDenied requiredRole={allowedRoles.join(", ")} />;
  }

  return children ? <>{children}</> : <Outlet />;
}

// ─── AccessDenied full-page block ────────────────────────────────────────────
export function AccessDenied({ requiredRole }: { requiredRole?: string }) {
  const { user } = useAuth();
  const meta = user ? ROLE_META[user.role] : null;

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
      <div className="w-20 h-20 bg-red-50 rounded-2xl flex items-center justify-center mb-6 border border-red-100">
        <ShieldOff className="h-10 w-10 text-red-400" />
      </div>
      <h2 className="text-slate-800 mb-2">Access Restricted</h2>
      <p className="text-slate-500 text-sm max-w-sm mb-4">
        Your current role{" "}
        {meta && (
          <span className={`font-semibold px-2 py-0.5 rounded ${meta.badgeClass}`}>{meta.label}</span>
        )}{" "}
        does not have permission to access this module.
      </p>
      {requiredRole && (
        <p className="text-xs text-slate-400 bg-slate-50 px-4 py-2 rounded-lg border border-slate-200">
          Required role: <span className="font-medium text-slate-600">{requiredRole}</span>
        </p>
      )}
      <p className="text-xs text-slate-400 mt-6">
        Contact your system administrator to request access.
      </p>
    </div>
  );
}

// ─── Read-only banner for Auditor / restricted roles ─────────────────────────
export function ReadOnlyBanner({ message }: { message?: string }) {
  const { user } = useAuth();
  if (!user) return null;
  const meta = ROLE_META[user.role];

  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${meta.bgClass} border-opacity-60 mb-2`}
      style={{ borderColor: meta.color === "amber" ? "#fbbf24" : meta.color === "slate" ? "#cbd5e1" : "#93c5fd" }}>
      <Lock className={`h-4 w-4 flex-shrink-0 ${meta.textClass}`} />
      <div>
        <p className={`text-sm font-medium ${meta.textClass}`}>
          {message || `Read-Only Mode — ${meta.label} accounts cannot modify data in this module.`}
        </p>
      </div>
      <span className={`ml-auto px-2.5 py-1 rounded-full text-xs font-bold border flex-shrink-0 ${meta.badgeClass}`}>
        {meta.label}
      </span>
    </div>
  );
}

// ─── Staff-specific access notice ────────────────────────────────────────────
export function LimitedAccessBanner({ message }: { message?: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-amber-200 bg-amber-50 mb-2">
      <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
      <p className="text-sm font-medium text-amber-700">
        {message || "Limited Access — Some features are restricted for your role."}
      </p>
      <span className="ml-auto px-2.5 py-1 rounded-full text-xs font-bold border bg-slate-100 text-slate-600 border-slate-200 flex-shrink-0">
        Assessment Staff
      </span>
    </div>
  );
}

// ─── Permission-gated wrapper ─────────────────────────────────────────────────
interface PermissionGateProps {
  permission: Permission;
  children: ReactNode;
  fallback?: ReactNode;
}

export function PermissionGate({ permission, children, fallback = null }: PermissionGateProps) {
  const { hasPermission } = useAuth();
  if (hasPermission(permission)) return <>{children}</>;
  return <>{fallback}</>;
}

// ─── Disabled tooltip wrapper ─────────────────────────────────────────────────
interface DisabledButtonProps {
  permission: Permission;
  children: ReactNode;
  tooltip?: string;
}

export function PermissionButton({ permission, children, tooltip }: DisabledButtonProps) {
  const { hasPermission } = useAuth();
  const allowed = hasPermission(permission);

  if (allowed) return <>{children}</>;

  return (
    <div className="relative group/perm inline-block">
      <div className="opacity-40 cursor-not-allowed pointer-events-none select-none">
        {children}
      </div>
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-slate-800 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover/perm:opacity-100 transition-opacity z-50 pointer-events-none">
        <Lock className="h-3 w-3 inline mr-1" />
        {tooltip || "Access restricted for your role"}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
      </div>
    </div>
  );
}
