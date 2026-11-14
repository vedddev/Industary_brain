import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRightOnRectangleIcon,
  ArrowLeftOnRectangleIcon,
  ChatBubbleLeftRightIcon,
  CalendarDaysIcon,
  EnvelopeIcon,
  SparklesIcon,
  UserIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useAuth } from "../AuthContext";

const GUEST = {
  name: "Guest User",
  email: "Sign in to save your conversations",
  plan: "Guest",
};

const initials = (name = "") =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("") || "GU";

// "free" -> "Free plan", "pro" -> "Pro plan"; leaves already-formatted labels alone.
const planLabel = (plan) => {
  if (!plan) return "Free plan";
  const text = String(plan);
  return /plan/i.test(text) ? text : `${text[0].toUpperCase()}${text.slice(1)} plan`;
};

// Accepts a year ("2026"), an ISO date, or a timestamp.
const memberSince = (user) => {
  if (user?.memberSince) return String(user.memberSince);
  const created = user?.createdAt || user?.created_at; // the API sends created_at
  if (created) {
    const d = new Date(created);
    if (!Number.isNaN(d.getTime())) return String(d.getFullYear());
  }
  return "—";
};

function StatRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="flex items-center gap-2.5 text-sm text-slate-500">
        <Icon className="h-4 w-4 text-slate-400" />
        {label}
      </span>
      <span className="text-sm font-medium text-slate-900">{value}</span>
    </div>
  );
}

/**
 * Props
 *  - open, onClose   : control visibility
 *  - onSignIn        : called when a guest clicks "Sign in" (e.g. () => navigate("/login"))
 *  - onSignOut       : optional, runs after the session is cleared (e.g. redirect to /login)
 *
 * The user comes from <AuthProvider> via useAuth(); a login page only has to call
 *   login({ name, email, plan, createdAt }, token)
 */
export default function UserProfile({ open, onClose, onSignIn, onSignOut }) {
  const { user, isAuthenticated, loading, logout } = useAuth();
  const closeRef = useRef(null);

  const profile = isAuthenticated
    ? {
        name: user.name || user.email || "Account",
        email: user.email || "",
        plan: planLabel(user.plan),
      }
    : GUEST;

  // Escape to close, lock page scroll while open, focus the close button.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  const handleSignOut = async () => {
    await logout();
    onClose();
    onSignOut?.();
  };

  const handleSignIn = () => {
    onClose();
    onSignIn?.();
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
            aria-hidden="true"
          />

          {/* Dialog */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-title"
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
          >
            {/* Cover */}
            <div className="h-20 bg-gradient-to-br from-emerald-700 via-emerald-600 to-teal-500" />

            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label="Close profile"
              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg text-white/80 transition-colors hover:bg-white/15 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>

            <div className="px-6 pb-6">
              {/* Avatar + identity */}
              <div className="-mt-9 flex flex-col items-center text-center">
                <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-slate-800 text-xl font-semibold text-white ring-4 ring-white">
                  {isAuthenticated ? initials(profile.name) : <UserIcon className="h-8 w-8" />}
                </div>
                <h2 id="profile-title" className="mt-3 text-lg font-semibold tracking-tight text-slate-900">
                  {profile.name}
                </h2>
                <p className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-500">
                  {isAuthenticated && <EnvelopeIcon className="h-4 w-4 text-slate-400" />}
                  {profile.email}
                </p>
                <span
                  className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset ${
                    isAuthenticated
                      ? "bg-emerald-50 text-emerald-700 ring-emerald-600/15"
                      : "bg-slate-100 text-slate-600 ring-slate-300/60"
                  }`}
                >
                  <SparklesIcon className="h-3.5 w-3.5" />
                  {profile.plan}
                </span>
              </div>

              {/* Account details (signed-in only) */}
              {isAuthenticated && (
                <div className="mt-6 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
                  <StatRow
                    icon={ChatBubbleLeftRightIcon}
                    label="Chats this month"
                    value={user.chatsThisMonth ?? "—"}
                  />
                  <StatRow icon={CalendarDaysIcon} label="Member since" value={memberSince(user)} />
                </div>
              )}

              {/* Actions */}
              <div className="mt-5 flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="h-10 flex-1 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40"
                >
                  Close
                </button>
                  {isAuthenticated ? (
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-slate-900 text-sm font-medium text-white transition-colors hover:bg-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50 focus-visible:ring-offset-2"
                  >
                    <ArrowRightOnRectangleIcon className="h-4 w-4" />
                    Sign out
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSignIn}
                    disabled={loading}
                    className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-700 text-sm font-medium text-white transition-colors hover:bg-emerald-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/50 focus-visible:ring-offset-2"
                  >
                    <ArrowLeftOnRectangleIcon className="h-4 w-4" />
                    Sign in
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
