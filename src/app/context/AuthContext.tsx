import React, { createContext, useContext, useState } from "react";
import {
  clearStoredAuth,
  decodeUserFromToken,
  loginRequest,
  persistAuth,
  readStoredAuth,
} from "../services/authService";

export type UserRole = "Admin" | "Accountant" | "Staff" | "Auditor";

// ─── Permission Types ────────────────────────────────────────────────────────
export type Permission =
  | "dashboard.view"
  | "property.view"   | "property.create" | "property.edit"  | "property.delete"
  | "tax.view"        | "tax.create"      | "tax.edit"       | "tax.delete"
  | "payment.view"    | "payment.create"  | "payment.edit"
  | "reporting.view"  | "reporting.generate" | "reporting.submit" | "reporting.export"
  | "compliance.view" | "compliance.update"
  | "filing.view"     | "filing.upload"   | "filing.delete"
  | "audit.view"
  | "users.view"      | "users.manage"
  | "settings.manage";

// ─── Role → Permissions Map ──────────────────────────────────────────────────
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  Admin: [
    "dashboard.view",
    "property.view", "property.create", "property.edit", "property.delete",
    "tax.view", "tax.create", "tax.edit", "tax.delete",
    "payment.view", "payment.create", "payment.edit",
    "reporting.view", "reporting.generate", "reporting.submit", "reporting.export",
    "compliance.view", "compliance.update",
    "filing.view", "filing.upload", "filing.delete",
    "audit.view",
    "users.view", "users.manage",
    "settings.manage",
  ],
  Accountant: [
    "dashboard.view",
    "property.view",
    "tax.view",
    "payment.view", "payment.create", "payment.edit",
    "reporting.view", "reporting.generate", "reporting.submit", "reporting.export",
    "compliance.view", "compliance.update",
    "filing.view", "filing.upload", "filing.delete",
  ],
  Staff: [
    "dashboard.view",
    "property.view", "property.create", "property.edit",
    "tax.view", "tax.create", "tax.edit",
    "filing.view", "filing.upload",
  ],
  Auditor: [
    "dashboard.view",
    "property.view",                       // read-only property registry
    "tax.view",                            // read-only tax computation records
    "payment.view",                        // read-only payment history
    "compliance.view",                     // compliance monitoring (read-only)
    "audit.view",                          // primary audit log tool
    "reporting.view", "reporting.export",  // view and export govt reports (read-only)
  ],
};

// ─── Role Metadata ───────────────────────────────────────────────────────────
export const ROLE_META: Record<UserRole, {
  label: string;
  description: string;
  color: string;
  badgeClass: string;
  borderClass: string;
  bgClass: string;
  textClass: string;
  accessLevel: number;
}> = {
  Admin: {
    label: "System Administrator",
    description: "Full system access · User management · System settings · Audit visibility · Reports oversight",
    color: "purple",
    badgeClass: "bg-purple-100 text-purple-700 border border-purple-200",
    borderClass: "border-l-purple-500",
    bgClass: "bg-purple-50",
    textClass: "text-purple-700",
    accessLevel: 4,
  },
  Accountant: {
    label: "Treasury Accountant",
    description: "Payment processing · Official receipts · Revenue reporting · Collection monitoring · Read-only registry access",
    color: "blue",
    badgeClass: "bg-blue-100 text-blue-700 border border-blue-200",
    borderClass: "border-l-blue-500",
    bgClass: "bg-blue-50",
    textClass: "text-blue-700",
    accessLevel: 3,
  },
  Staff: {
    label: "Assessment Staff",
    description: "Taxpayer intake · Property registration and editing · Tax assessments · Assessment workflow support",
    color: "slate",
    badgeClass: "bg-slate-100 text-slate-600 border border-slate-200",
    borderClass: "border-l-slate-400",
    bgClass: "bg-slate-50",
    textClass: "text-slate-600",
    accessLevel: 2,
  },
  Auditor: {
    label: "Internal Auditor",
    description: "Read-only audit visibility · Compliance monitoring · Financial review support · No data modification allowed",
    color: "amber",
    badgeClass: "bg-amber-100 text-amber-700 border border-amber-200",
    borderClass: "border-l-amber-500",
    bgClass: "bg-amber-50",
    textClass: "text-amber-700",
    accessLevel: 1,
  },
};

// ─── Auth User Interface ─────────────────────────────────────────────────────
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  initials: string;
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  hasPermission: (permission: Permission) => boolean;
  can: (permission: Permission) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function buildInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((segment) => segment[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function mapStoredUserToAuthUser(storedUser: { username: string; displayName: string; email: string; role: UserRole }): AuthUser {
  return {
    id: storedUser.username,
    name: storedUser.displayName,
    email: storedUser.email,
    role: storedUser.role,
    initials: buildInitials(storedUser.displayName),
  };
}

// ─── Provider ────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const storedSession = readStoredAuth();
    return storedSession ? mapStoredUserToAuthUser(storedSession.user) : null;
  });

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const token = await loginRequest({ username: email, password });
      const authenticatedUser = decodeUserFromToken(token);
      persistAuth(token, authenticatedUser);
      setUser(mapStoredUserToAuthUser(authenticatedUser));
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error
          ? error.message
          : "Authentication failed. Please verify your credentials.",
      };
    }
  };

  const logout = () => {
    setUser(null);
    clearStoredAuth();
    localStorage.removeItem("taxflow_user");
  };

  const hasPermission = (permission: Permission): boolean => {
    if (!user) return false;
    return ROLE_PERMISSIONS[user.role].includes(permission);
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      login,
      logout,
      hasPermission,
      can: hasPermission,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────────────────────
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

// ─── Utility ─────────────────────────────────────────────────────────────────
export function getPermissionsForRole(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role];
}