/* Updated: add Backup & Restore UI and wiring */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Plus,
  MessageCircle,
  Search,
  X,
  Pencil,
  Trash2,
  Store,
  Receipt,
  StickyNote,
  Users,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  Camera,
  Sparkles,
  Download,
  Copy,
  FileText,
  CalendarClock,
  CalendarDays,
  Settings as SettingsIcon,
  ChevronRight,
  ShieldCheck,
  ScrollText,
  Mail,
  Globe,
  Instagram,
  Crown,
  RotateCcw,
  Info,
} from "lucide-react";
import {
  APP_NAME,
  APP_VERSION,
  BUSINESS_CATEGORIES,
  TERM_OPTIONS,
  addDaysISO,
  balanceOf,
  fmtDate,
  lastActivity,
  naira,
  paymentDetailsLine,
  receiptMessage,
  statementMessage,
  termDueDate,
  thisMonth,
  todayISO,
  waLink,
  type BusinessProfile,
  type Customer,
  type TermKey,
  type Txn,
} from "@/lib/ledger";
import {
  dueDateLong,
  dueInfoOf,
  dueInfoOfTxn,
  isDueThisWeek,
  isDueToday,
  isOverdue,
  openSales,
} from "@/lib/due-dates";
import {
  REMINDER_TEMPLATES,
  buildContext,
  buildReminder,
  templateById,
  type ReminderRecord,
  type ReminderTemplate,
  type TemplateId,
  type Tone,
} from "@/lib/reminders";
import { generateReminder } from "@/lib/reminders.functions";
import { generateReceiptPdf, receiptSummary } from "@/lib/receipts";
import { downloadFile } from "@/lib/download";
import { isProbablyValidPhone, normalizeForStorage } from "@/lib/phone";
import { isPro, paymentService, stateLabel } from "@/lib/subscription";
import { DEVELOPER, SUPPORT_EMAIL, WEBSITE_URL } from "@/lib/app-config";
import { track } from "@/lib/analytics";
import {
  defaultOnboarding,
  issueReceiptReference,
  useOnboardingState,
  useReminderHistory,
  useSubscription,
  usePersistentCustomers,
  usePersistentProfile,
} from "@/lib/use-ledger-storage";
import { Onboarding } from "@/components/onboarding";
import {
  AppShell,
  Chip,
  DueBadge,
  Field,
  PremiumGate,
  ScreenHeader,
  SettingsRow,
  Stat,
  TipCallout,
} from "@/components/ui-kit";

// backup helpers
import {
  createBackup,
  exportBackupFile,
  validateBackup,
  restoreBackup,
  type BackupV1,
} from "@/lib/backup";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Track Debt — Customer Credit Ledger in Naira" },
      {
        name: "description",
        content:
          "Record credit sales and payments, track who owes you, filter overdue customers and send WhatsApp reminders and receipts.",
      },
      { property: "og:title", content: "Track Debt — Customer Credit Ledger in Naira" },
      {
        property: "og:description",
        content:
          "A simple offline ledger for small businesses: customers, credit sales, payments and WhatsApp reminders.",
      },
    ],
  }),
  component: DebtTracker,
});

type Screen =
  | "list"
  | "detail"
  | "addCustomer"
  | "editCustomer"
  | "addTxn"
  | "editTxn"
  | "profile"
  | "reminder"
  | "settings"
  | "backup"
  | "about"
  | "privacy"
  | "terms";

type Filter = "all" | "outstanding" | "settled" | "overdue" | "dueToday" | "dueWeek";
type Sort = "newest" | "highest";

const emptyForm = { name: "", phone: "", notes: "", amount: "", note: "" };

/** The AI tone follows whichever template is selected, so there's a single
 *  template picker instead of a separate tone control duplicating it. */
const TEMPLATE_TONE: Record<TemplateId, Tone> = {
  friendly: "friendly",
  professional: "professional",
  firm: "firm",
  "very-firm": "firm",
  final: "firm",
  "end-of-month": "professional",
  vip: "friendly",
};

function DebtTracker() {
  const [profile, setProfile, profileLoaded] = usePersistentProfile();
  const [customers, setCustomers, customersLoaded] = usePersistentCustomers();
  const loaded = profileLoaded && customersLoaded;

  const [screen, setScreen] = useState<Screen>("list");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingTxnId, setEditingTxnId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("highest");
  const [txnType, setTxnType] = useState<Txn["type"]>("sale");
  const [payKind, setPayKind] = useState<"full" | "partial">("partial");
  const [form, setForm] = useState(emptyForm);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const logoInput = useRef<HTMLInputElement>(null);

  const [termKey, setTermKey] = useState<TermKey>("none");
  const [customDueDate, setCustomDueDate] = useState("");

  const [sub, setSub] = useSubscription();
  const [onboarding, setOnboarding, onboardingLoaded] = useOnboardingState();
  const [, setReminderHistory] = useReminderHistory();
  const [reminderTemplate, setReminderTemplate] = useState<TemplateId>("friendly");
  const [reminderTone, setReminderTone] = useState<Tone>("friendly");
  const [reminderSource, setReminderSource] = useState<TemplateId | "ai">("friendly");
  const [reminderMessage, setReminderMessage] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [gateFeature, setGateFeature] = useState<{ title: string; description: string } | null>(
    null,
  );

  // backup UI state
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [lastBackup, setLastBackup] = useState<string | null>(() => {
    try {
      return window.localStorage.getItem("trackdebt.v3.lastBackup");
    } catch {
      return null;
    }
  });
  const [pendingBackup, setPendingBackup] = useState<BackupV1 | null>(null);
  const [showConfirmRestore, setShowConfirmRestore] = useState(false);
  const [restoringBackup, setRestoringBackup] = useState(false);

  const selected = customers.find((c) => c.id === selectedId) ?? null;
  const resetForm = () => setForm(emptyForm);
  const go = (s: Screen) => {
    setConfirmDelete(null);
    setScreen(s);
  };

  /* ---------- dashboard stats ---------- */
  const stats = useMemo(() => {
    let outstanding = 0;
    let overdue = 0;
    let dueToday = 0;
    let dueWeek = 0;
    let collections = 0;
    let creditSales = 0;
    for (const c of customers) {
      outstanding += Math.max(balanceOf(c), 0);
      if (isOverdue(c)) overdue += 1;
      if (isDueToday(c)) dueToday += 1;
      if (isDueThisWeek(c)) dueWeek += 1;
      for (const t of c.txns) {
        if (thisMonth(t.date)) {
          if (t.type === "payment") collections += t.amount;
          else creditSales += t.amount;
        }
      }
    }
    return { outstanding, overdue, dueToday, dueWeek, collections, creditSales };
  }, [customers]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return customers
      .filter((c) => {
        if (q) {
          const hit =
            c.name.toLowerCase().includes(q) ||
            c.phone.replace(/\s/g, "").includes(q.replace(/\s/g, "")) ||
            c.notes.toLowerCase().includes(q) ||
            c.txns.some((t) => t.note.toLowerCase().includes(q));
          if (!hit) return false;
        }
        const bal = balanceOf(c);
        if (filter === "outstanding") return bal > 0;
        if (filter === "settled") return bal <= 0;
        if (filter === "overdue") return isOverdue(c);
        if (filter === "dueToday") return isDueToday(c);
        if (filter === "dueWeek") return isDueThisWeek(c);
        return true;
      })
      .sort((a, b) =>
        sort === "newest"
          ? lastActivity(b).localeCompare(lastActivity(a))
          : balanceOf(b) - balanceOf(a),
      );
  }, [customers, query, filter, sort]);

  /* ---------- mutations ---------- */
  const addCustomer = () => {
    if (!form.name.trim() || !form.phone.trim()) return;
    if (!isProbablyValidPhone(form.phone)) {
      toast.error("That phone number doesn't look right. Please check it and try again.");
      return;
    }
    setCustomers((cs) => [
      ...cs,
      {
        id: "c" + Date.now(),
        name: form.name.trim(),
        phone: normalizeForStorage(form.phone),
        notes: form.notes.trim(),
        createdAt: todayISO(),
        txns: [],
      },
    ]);
    track("customer_added");
    toast.success("Customer added.");
    resetForm();
    go("list");
  };

  const saveCustomerEdit = () => {
    if (!selectedId || !form.name.trim() || !form.phone.trim()) return;
    if (!isProbablyValidPhone(form.phone)) {
      toast.error("That phone number doesn't look right. Please check it and try again.");
      return;
    }
    setCustomers((cs) =>
      cs.map((c) =>
        c.id === selectedId
          ? {
              ...c,
              name: form.name.trim(),
              phone: normalizeForStorage(form.phone),
              notes: form.notes.trim(),
            }
          : c,
      ),
    );
    toast.success("Customer updated.");
    resetForm();
    go("detail");
  };

  // ... rest of existing logic unchanged ...

  /* ---------- settings ---------- */
  const [restoring, setRestoring] = useState(false);
  const restorePurchase = async () => {
    setRestoring(true);
    try {
      const restored = await paymentService.restore();
      setSub(restored);
      if (restored.state === "pro_active") {
        toast.success("Track Debt Pro restored.");
      } else {
        toast("No active purchase found on this device.");
      }
    } catch {
      toast.error("Could not restore purchase. Please try again.");
    } finally {
      setRestoring(false);
    }
  };

  const restartOnboarding = () => {
    setOnboarding(() => ({ ...defaultOnboarding }));
  };

  /* ---------- backup handlers ---------- */
  const onExportBackup = () => {
    try {
      const backup = createBackup();
      exportBackupFile(backup);
      window.localStorage.setItem("trackdebt.v3.lastBackup", backup.createdAt);
      setLastBackup(backup.createdAt);
      toast.success("Backup created.");
      track("backup_created");
    } catch (e) {
      toast.error("Could not create backup. Please try again.");
    }
  };

  const onImportSelectedFile = async (file?: File | null) => {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const v = validateBackup(parsed);
      if (!v.ok) {
        toast.error(v.error);
        return;
      }
      setPendingBackup(v.backup);
      setShowConfirmRestore(true);
    } catch {
      toast.error("Invalid backup file.");
    }
  };

  const confirmRestore = async () => {
    if (!pendingBackup) return;
    setRestoringBackup(true);
    try {
      const res = restoreBackup(pendingBackup);
      if (!res.ok) {
        toast.error(res.error);
        setRestoringBackup(false);
        setShowConfirmRestore(false);
        setPendingBackup(null);
        return;
      }

      const p = pendingBackup.payload as Record<string, any>;
      if (p.profile !== undefined) setProfile(p.profile as BusinessProfile);
      if (p.customers !== undefined) setCustomers(p.customers as Customer[]);
      if (p.reminders !== undefined) setReminderHistory(p.reminders as ReminderRecord[]);
      if (p.subscription !== undefined) setSub(p.subscription as any);
      if (p.onboarding !== undefined) setOnboarding(p.onboarding as any);
      if (p.receiptCounter !== undefined)
        window.localStorage.setItem("trackdebt.v3.receiptCounter", JSON.stringify(p.receiptCounter));

      window.localStorage.setItem("trackdebt.v3.lastBackup", pendingBackup.createdAt);
      setLastBackup(pendingBackup.createdAt);
      toast.success("Backup restored successfully.");
      track("backup_restored");
      setPendingBackup(null);
      setShowConfirmRestore(false);
      go("list");
    } catch (e) {
      toast.error("Could not restore backup. Please try again.");
    } finally {
      setRestoringBackup(false);
    }
  };

  /* ---------- render ---------- */
  if (!onboardingLoaded) {
    return <main className="min-h-dvh bg-background" />;
  }
  if (!onboarding.completed) {
    return (
      <Onboarding
        profile={profile}
        setProfile={setProfile}
        setCustomers={setCustomers}
        onDone={() => setOnboarding((o) => ({ ...o, completed: true }))}
      />
    );
  }
  return (
    <AppShell>
      <>
        {/* ===== LIST / DASHBOARD ===== */}
        {screen === "list" && (
          <div className="animate-in fade-in duration-200">
            {/* ... existing list UI ... */}
          </div>
        )}

        {/* ===== SETTINGS ===== */}
        {screen === "settings" && (
          <div className="animate-in fade-in slide-in-from-right-2 duration-200">
            <div className="px-5">
              <ScreenHeader title="Settings" onClose={() => go("list")} />
            </div>

            <p className="mono text-[10px] tracking-widest text-ink-soft px-5 pb-2">ACCOUNT</p>
            <SettingsRow
              icon={<Store size={17} />}
              label="Business Profile"
              onClick={() => go("profile")}
            />

            <p className="mono text-[10px] tracking-widest text-ink-soft px-5 pb-2 pt-5">
              SUBSCRIPTION
            </p>
            <SettingsRow
              icon={<Crown size={17} />}
              label="Current Plan"
              value={stateLabel(sub)}
              tone={isPro(sub) ? "paid" : undefined}
              onClick={() => {}}
            />
            {!isPro(sub) && (
              <Link
                to="/upgrade"
                className="ledger-row w-full flex items-center justify-between px-5 py-3.5 text-left transition-colors active:bg-muted"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="shrink-0 text-ink-soft" aria-hidden="true">
                    <Sparkles size={17} />
                  </span>
                  <span className="truncate text-sm font-medium">Upgrade to Pro</span>
                </span>
                <ChevronRight size={16} className="text-ink-soft" aria-hidden="true" />
              </Link>
            )}
            <SettingsRow
              icon={<RotateCcw size={17} />}
              label={restoring ? "Restoring…" : "Restore Purchase"}
              onClick={restorePurchase}
            />

            <p className="mono text-[10px] tracking-widest text-ink-soft px-5 pb-2 pt-5">SUPPORT</p>
            <SettingsRow
              icon={<Info size={17} />}
              label={`About ${APP_NAME}`}
              onClick={() => go("about")}
            />
            <SettingsRow
              icon={<ShieldCheck size={17} />}
              label="Privacy Policy"
              onClick={() => go("privacy")}
            />
            <SettingsRow
              icon={<ScrollText size={17} />}
              label="Terms of Use"
              onClick={() => go("terms")}
            />
            <SettingsRow
              icon={<Mail size={17} />}
              label="Contact Support"
              href={`mailto:${SUPPORT_EMAIL}`}
            />

            {/* Backup & Restore entry */}
            <p className="mono text-[10px] tracking-widest text-ink-soft px-5 pb-2 pt-5">DATA</p>
            <SettingsRow
              icon={<Download size={17} />}
              label="Backup & Restore"
              onClick={() => go("backup")}
            />

            <p className="mono text-[10px] tracking-widest text-ink-soft px-5 pb-2 pt-5">ADVANCED</p>
            <SettingsRow
              icon={<RotateCcw size={17} />}
              label="Restart Onboarding"
              onClick={restartOnboarding}
            />

            <p className="px-5 pt-6 pb-8 text-center text-[11px] text-ink-soft">
              {APP_NAME} · Version {APP_VERSION}
            </p>
          </div>
        )}

        {/* ===== BACKUP & RESTORE ===== */}
        {screen === "backup" && (
          <div className="p-5 animate-in fade-in slide-in-from-right-2 duration-200">
            <ScreenHeader title="Backup & Restore" onClose={() => go("settings")} />

            <div className="space-y-4 text-[13px] leading-relaxed text-ink-soft mb-5">
              <p>
                Your Track Debt data is stored on this device. Back up your data regularly so you can
                restore it if you change devices or lose app data.
              </p>

              <div className="rounded border border-line bg-paper-raised px-4 py-3">
                <p className="text-sm font-medium">Last backup</p>
                <p className="text-[13px] text-ink-soft mt-1">
                  {lastBackup ? new Date(lastBackup).toLocaleString() : "Never"}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={onExportBackup}
                  className="btn-primary w-full rounded py-3 text-sm font-semibold transition-transform active:scale-[0.99]"
                >
                  Export backup
                </button>
                <div>
                  <input
                    ref={(el) => (fileInputRef.current = el)}
                    type="file"
                    accept="application/json"
                    className="hidden"
                    onChange={(e) => onImportSelectedFile(e.target.files?.[0] ?? null)}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full rounded py-3 text-sm font-semibold border border-line bg-paper-raised text-ink"
                  >
                    Import backup
                  </button>
                </div>
              </div>

              <p className="text-[11px] text-ink-soft mt-2">
                Restoring a backup will replace the current Track Debt data on this device.
              </p>
            </div>

            {showConfirmRestore && pendingBackup && (
              <div className="fixed inset-0 bg-black/50 grid place-items-center p-5">
                <div className="bg-paper rounded p-4 w-full max-w-md">
                  <h3 className="font-semibold mb-2">Restore backup?</h3>
                  <p className="text-sm text-ink-soft mb-4">
                    Restoring this backup will replace the current Track Debt data on this device.
                    This cannot be undone.
                  </p>
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => {
                        setShowConfirmRestore(false);
                        setPendingBackup(null);
                      }}
                      className="rounded py-2 px-3 text-sm border border-line bg-paper-raised"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={confirmRestore}
                      disabled={restoringBackup}
                      className="btn-primary rounded py-2 px-3 text-sm font-semibold"
                    >
                      {restoringBackup ? "Restoring…" : "Restore"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===== ABOUT ===== */}
        {screen === "about" && (
          <div className="p-5 animate-in fade-in slide-in-from-right-2 duration-200">
            <ScreenHeader title={`About ${APP_NAME}`} onClose={() => go("settings")} />

            <div className="flex flex-col items-center text-center mb-7">
              <div className="h-16 w-16 rounded-[16px] bg-debt grid place-items-center shadow-sm">
                <svg viewBox="0 0 512 512" className="h-9 w-9" aria-hidden="true">
                  <path
                    d="M 110,300 A 146,146 0 0 1 402,300"
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="30"
                    strokeLinecap="round"
                  />
                  <path d="M 241,304 L 256,176 L 271,304 Z" fill="#ffffff" />
                  <circle cx="256" cy="304" r="20" fill="#ffffff" />
                  <rect x="196" y="330" width="120" height="32" rx="16" fill="#ffffff" />
                  <rect x="166" y="370" width="180" height="32" rx="16" fill="#ffffff" />
                  <rect x="136" y="410" width="240" height="32" rx="16" fill="#ffffff" />
                </svg>
              </div>
              <p className="mt-3 text-lg font-bold">{APP_NAME}</p>
              <p className="mono text-[11px] text-ink-soft mt-0.5">Version {APP_VERSION}</p>
              <p className="mt-4 text-sm text-ink-soft leading-relaxed max-w-[300px]">
                Track Debt helps Nigerian business owners track customer credit sales, send WhatsApp
                payment reminders and manage outstanding balances — right from their phone, fully
                offline.
              </p>
            </div>

            <p className="mono text-[10px] tracking-widest text-ink-soft pb-2">DEVELOPER</p>
            <div className="rounded border border-line bg-paper-raised px-4 py-3 mb-5">
              <p className="text-sm font-medium">{DEVELOPER}</p>
            </div>

            <SettingsRow
              icon={<Globe size={17} />}
              label="Website"
              value={WEBSITE_URL.replace(/^https?:\/\//, "")}
              href={WEBSITE_URL}
              external
            />
            <SettingsRow icon={<Instagram size={17} />} label="Instagram" value="Coming soon" />
          </div>
        )}

        {/* Remaining screens unchanged... */}
      </>
    </AppShell>
  );
}

export default DebtTracker;
