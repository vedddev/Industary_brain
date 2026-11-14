import { useEffect, useRef, useState } from "react";
import {
  ArrowDownTrayIcon,
  Bars3Icon,
  CheckIcon,
  EnvelopeIcon,
  LinkIcon,
  PlusIcon,
  ShareIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";

const cx = (...classes) => classes.filter(Boolean).join(" ");

function IconButton({ label, onClick, children, danger, className }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cx(
        "inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40",
        danger ? "hover:bg-red-50 hover:text-red-600" : "hover:bg-slate-100 hover:text-slate-900",
        className
      )}
    >
      {children}
    </button>
  );
}

function ShareMenu({ chatTitle, shareUrl, onShareChat }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef(null);

  const url = shareUrl || (typeof window !== "undefined" ? window.location.href : "");
  const title = chatTitle || "Knowledge workspace";
  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Fallback for browsers/contexts without the Clipboard API.
      const input = document.createElement("input");
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
    }
    setCopied(true);
    onShareChat?.({ method: "copy", url });
    setTimeout(() => setCopied(false), 2000);
  };

  const nativeShare = async () => {
    try {
      await navigator.share({ title, text: `${title} — Industrial Intelligence Brain`, url });
      onShareChat?.({ method: "native", url });
      setOpen(false);
    } catch {
      /* user cancelled the share sheet */
    }
  };

  const emailLink = () => {
    const subject = encodeURIComponent(title);
    const body = encodeURIComponent(`I'd like to share this conversation with you:\n\n${url}`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
    onShareChat?.({ method: "email", url });
    setOpen(false);
  };

  const itemClass =
    "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50 focus:bg-slate-50 focus:outline-none";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Share conversation"
        className={cx(
          "inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm transition-colors",
          "hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40",
          open && "bg-slate-50"
        )}
      >
        <ShareIcon className="h-4 w-4" />
        <span className="hidden sm:inline">Share</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-2 w-72 origin-top-right rounded-xl border border-slate-200 bg-white p-2 shadow-lg ring-1 ring-black/5"
        >
          <div className="px-3 pb-2 pt-1.5">
            <p className="text-sm font-semibold text-slate-900">Share conversation</p>
            <p className="mt-0.5 truncate text-xs text-slate-500" title={title}>{title}</p>
          </div>

          <div className="mx-3 mb-2 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5">
            <LinkIcon className="h-4 w-4 shrink-0 text-slate-400" />
            <input
              readOnly
              value={url}
              onFocus={(e) => e.target.select()}
              aria-label="Conversation link"
              className="min-w-0 flex-1 bg-transparent text-xs text-slate-600 focus:outline-none"
            />
          </div>

          <button type="button" role="menuitem" onClick={copyLink} className={itemClass}>
            {copied ? <CheckIcon className="h-4 w-4 text-emerald-600" /> : <LinkIcon className="h-4 w-4 text-slate-400" />}
            <span className={copied ? "font-medium text-emerald-700" : ""}>{copied ? "Link copied" : "Copy link"}</span>
          </button>
          <button type="button" role="menuitem" onClick={emailLink} className={itemClass}>
            <EnvelopeIcon className="h-4 w-4 text-slate-400" />
            Share via email
          </button>
          {canNativeShare && (
            <button type="button" role="menuitem" onClick={nativeShare} className={itemClass}>
              <ShareIcon className="h-4 w-4 text-slate-400" />
              More options…
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function Header({
  chatTitle,
  serviceStatus,
  shareUrl,
  onAddDocuments,
  onClearChat,
  onExportChat,
  onShareChat,
  onOpenSidebar,
  onOpenProfile,
}) {
  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6">
      {/* Left: navigation + title */}
      <div className="flex min-w-0 items-center gap-3">
        <IconButton label="Open navigation" onClick={onOpenSidebar} className="lg:hidden">
          <Bars3Icon className="h-5 w-5" />
        </IconButton>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Workspace</p>
          <h1 className="truncate text-base font-semibold tracking-tight text-slate-900 sm:text-lg">
            {chatTitle || "Knowledge workspace"}
          </h1>
        </div>
      </div>

      {/* Right: status + actions */}
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        {serviceStatus === "healthy" && (
          <span className="mr-1 hidden items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 md:inline-flex">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            Service available
          </span>
        )}

        <button
          type="button"
          onClick={onAddDocuments}
          className="hidden h-9 items-center gap-2 rounded-lg bg-emerald-700 px-3.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/50 focus-visible:ring-offset-2 sm:inline-flex"
        >
          <PlusIcon className="h-4 w-4" />
          Add documents
        </button>

        <ShareMenu chatTitle={chatTitle} shareUrl={shareUrl} onShareChat={onShareChat} />

        <span className="mx-1 hidden h-6 w-px bg-slate-200 sm:block" aria-hidden="true" />

        <IconButton label="Export conversation" onClick={onExportChat}>
          <ArrowDownTrayIcon className="h-5 w-5" />
        </IconButton>
        <IconButton label="Clear conversation" onClick={onClearChat} danger>
          <TrashIcon className="h-5 w-5" />
        </IconButton>

        <button
          type="button"
          onClick={onOpenProfile}
          aria-label="Open profile"
          className="ml-1 flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40"
        >
          GU
        </button>
      </div>
    </header>
  );
}