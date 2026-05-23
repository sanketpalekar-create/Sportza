/**
 * RoleContext — Global role-switching state
 *
 * Design:
 *  - `dbRole`      = role stored in DB (source of truth for backend access)
 *  - `activeRole`  = role the user is currently "acting as" (local, persisted to localStorage)
 *  - `availableRoles` = roles the user can switch into (derived from dbRole)
 *
 * Switching roles is instant (no logout, no API call).
 * "Applying" for a new role calls PATCH /auth/me/role and updates the DB.
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { useLocation } from "react-router-dom";
import { useCurrentUser, useSwitchRole } from "@sportza/api-client";

// ─── Types ────────────────────────────────────────────────────────────────────
export type AppRole = "player" | "coach" | "venue_owner" | "admin";

export interface RoleContextValue {
  /** Role the user is viewing the app as right now */
  activeRole: AppRole;
  /** Role stored in the database (max privilege level) */
  dbRole: AppRole;
  /** All roles this user may switch into */
  availableRoles: AppRole[];
  /** Whether a role is still loading from the API */
  isLoading: boolean;
  /** Switch the active UI role (instant, no API call) */
  switchRole: (role: AppRole) => void;
  /** Upgrade the user's DB role (calls API, persists permanently). Returns API response. */
  applyForRole: (role: AppRole) => Promise<any>;
  /** Is the user currently in coach view? */
  isCoach: boolean;
  /** Is the user currently in venue owner view? */
  isVenueOwner: boolean;
  /** Is the user currently in player view? */
  isPlayer: boolean;
  /** Is the user admin? */
  isAdmin: boolean;
}

const RoleContext = createContext<RoleContextValue | null>(null);

// ─── Helpers ──────────────────────────────────────────────────────────────────
const STORAGE_KEY = "sportza_active_role";

/** Normalise DB role string (handles legacy "trainer" → "coach") */
function normaliseRole(raw: string | undefined | null): AppRole {
  if (!raw) return "player";
  const r = raw.toLowerCase();
  if (r === "trainer") return "coach";
  if (r === "venue_owner" || r === "venueowner") return "venue_owner";
  if (r === "admin") return "admin";
  if (r === "coach") return "coach";
  return "player";
}

/** Roles a user may switch into, given their DB role */
function computeAvailable(dbRole: AppRole): AppRole[] {
  if (dbRole === "admin") return ["player", "coach", "venue_owner", "admin"];
  if (dbRole === "venue_owner") return ["player", "venue_owner"];
  if (dbRole === "coach") return ["player", "coach"];
  return ["player"];
}

// ─── Provider ─────────────────────────────────────────────────────────────────
export function RoleProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { data: userData, isLoading } = useCurrentUser({ retry: false });
  const switchRoleMutation = useSwitchRole();

  const rawDbRole: string = (userData as any)?.user?.role ?? (userData as any)?.role ?? "player";
  const dbRole = normaliseRole(rawDbRole);
  const availableRoles = computeAvailable(dbRole);

  // Initialise activeRole from localStorage, falling back to dbRole
  const [activeRole, setActiveRoleState] = useState<AppRole>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as AppRole | null;
      if (saved && ["player", "coach", "venue_owner", "admin"].includes(saved)) {
        return saved;
      }
    } catch { /* ignore */ }
    return "player";
  });

  // When DB role loads, ensure activeRole is still valid
  useEffect(() => {
    if (!isLoading) {
      const available = computeAvailable(dbRole);
      if (!available.includes(activeRole)) {
        // Demote to player if saved role is no longer allowed
        setActiveRoleState("player");
        localStorage.setItem(STORAGE_KEY, "player");
      }
    }
  }, [dbRole, isLoading, activeRole]);

  // Auto-switch to admin UI mode when visiting /admin/* with DB admin role
  useEffect(() => {
    if (!isLoading && dbRole === "admin" && location.pathname.startsWith("/admin")) {
      setActiveRoleState((prev) => {
        if (prev === "admin") return prev;
        try { localStorage.setItem(STORAGE_KEY, "admin"); } catch { /* ignore */ }
        return "admin";
      });
    }
  }, [dbRole, isLoading, location.pathname]);

  const switchRole = useCallback((role: AppRole) => {
    setActiveRoleState(role);
    try { localStorage.setItem(STORAGE_KEY, role); } catch { /* ignore */ }
  }, []);

  const applyForRole = useCallback(
    async (role: AppRole) => {
      const dbRoleValue = role === "coach" ? "coach" : role;
      const result = await switchRoleMutation.mutateAsync(dbRoleValue);
      // Only activate the role locally if the backend actually changed it
      // (not when it returned queued:true for a pending admin review)
      if (!(result as any)?.queued) {
        switchRole(role);
      }
      return result;
    },
    [switchRoleMutation, switchRole]
  );

  const value: RoleContextValue = {
    activeRole,
    dbRole,
    availableRoles,
    isLoading,
    switchRole,
    applyForRole,
    isCoach:       activeRole === "coach",
    isVenueOwner:  activeRole === "venue_owner",
    isPlayer:      activeRole === "player",
    isAdmin:       activeRole === "admin",
  };

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useRole(): RoleContextValue {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used inside <RoleProvider>");
  return ctx;
}
