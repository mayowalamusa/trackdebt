import { createFileRoute, Link } from "@tanstack/react-router";
import React, { useEffect, useMemo, useRef, useState, memo, type ReactNode } from "react";
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
  Bell,
  BellRing,
  Trash,
  CheckCheck,
  Mic,
  Ticket,
  Zap,
  TicketPercent,
  Eye,
  EyeOff,
} from "lucide-react";
import {
  APP_NAME,
  APP_VERSION,
  BUSINESS_CATEGORIES,
  TERM_OPTIONS,
  balanceOf,
  fmtDate,
  lastActivity,
  money,
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
import { redeemPromoCode } from "@/lib/promo-redeem";
import { generateReceiptPdf, receiptSummary } from "@/lib/receipts";
import { downloadFile } from "@/lib/download";
import { isProbablyValidPhone, normalizeForStorage } from "@/lib/phone";
import { paymentService, stateLabel, planLabel } from "@/lib/subscription";
import { currentSession } from "@/lib/subscription-api";
import { supabase } from "@/lib/supabase";
import { DEVELOPER, SUPPORT_EMAIL, WEBSITE_URL } from "@/lib/app-config";
import { SUPPORTED_CURRENCIES, getCurrency } from "@/lib/currency/currencies";
import { getExchangeRate } from "@/lib/currency/rates";
import { track } from "@/lib/analytics";
import {
  defaultOnboarding,
  issueReceiptReference,
  useOnboardingState,
  useReminderHistory,
  useSubscription,
  usePersistentCustomers,
  usePersistentProfile,
  useNotificationSettings,
  useInAppNotifications,
  useEntitlements,
  usePromoEntitlements,
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
  NotificationItem,
} from "@/components/ui-kit";
import {
  backupFilename,
  createBackup,
  getLastBackupAt,
  parseBackupFile,
  restoreBackup,
  type BackupFile,
} from "@/lib/backup";
import {
  checkPermissions,
  connectNotificationStore,
  initNotifications,
  reconcileDebtReminders,
  requestPermissions,
  setNotificationSoundEnabled,
  setupNotificationListeners,
  startNotificationPolling,
  cancelDebtReminders,
  scheduleDebtReminders,
  scheduleDailyReminder,
} from "@/lib/notifications";

/* ---------------- helpers ---------------- */

function LocalInput({
  initialValue,
  onBlur,
  transform,
  ...props
}: {
  initialValue: string;
  onBlur: (val: string) => void;
  transform?: (val: string) => string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onBlur">) {
  const [val, setVal] = useState(initialValue);
  const isFocused = useRef(false);

  useEffect(() => {
    if (!isFocused.current && initialValue !== val) setVal(initialValue);
  }, [initialValue, val]);

  return (
    <input
      {...props}
      style={{ ...props.style, userSelect: "text", WebkitUserSelect: "text" }}
      value={val}
      onFocus={(e) => {
        isFocused.current = true;
        props.onFocus?.(e);
      }}
      onChange={(e) => {
        const next = transform ? transform(e.target.value) : e.target.value;
        setVal(next);
      }}
      onBlur={(_e) => {
        isFocused.current = false;
        onBlur(val);
      }}
    />
  );
}

function LocalTextarea({
  initialValue,
  onBlur,
  ...props
}: {
  initialValue: string;
  onBlur: (val: string) => void;
} & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "onBlur">) {
  const [val, setVal] = useState(initialValue);
  const isFocused = useRef(false);

  useEffect(() => {
    if (!isFocused.current && initialValue !== val) setVal(initialValue);
  }, [initialValue, val]);

  return (
    <textarea
      {...props}
      style={{ ...props.style, userSelect: "text", WebkitUserSelect: "text" }}
      value={val}
      onFocus={(e) => {
        isFocused.current = true;
        props.onFocus?.(e);
      }}
      onChange={(e) => setVal(e.target.value)}
      onBlur={(_e) => {
        isFocused.current = false;
        onBlur(val);
      }}
    />
  );
}

const CustomerItem = memo(function CustomerItem({
  customer,
  onClick,
}: {
  customer: Customer;
  onClick: (id: string) => void;
}) {
  const bal = balanceOf(customer);
  return (
    <button
      onClick={() => onClick(customer.id)}
      className="ledger-row w-full flex items-center justify-between px-5 py-3.5 text-left gap-3 transition-colors active:bg-muted"
    >
      <span className="min-w-0">
        <span className="block font-semibold text-[15px] text-ink truncate">
          {customer.name}
        </span>
        <span className="text-[11px] text-ink-soft mt-1 flex items-center gap-2">
          <span>last activity {fmtDate(lastActivity(customer))}</span>
          <DueBadge info={dueInfoOf(customer)} />
        </span>
      </span>
      <span
        className={`mono text-sm font-bold shrink-0 ${
          bal > 0 ? "text-debt" : bal < 0 ? "text-paid" : "text-ink-soft"
        }`}
      >
        {bal === 0 ? "settled" : money(Math.abs(bal))}
      </span>
    </button>
  );
});

function DebouncedInput({
  initialValue,
  onChange,
  delay = 300,
  ...props
}: {
  initialValue: string;
  onChange: (val: string) => void;
  delay?: number;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange">) {
  const [val, setVal] = useState(initialValue);
  const isFocused = useRef(false);

  useEffect(() => {
    if (!isFocused.current && initialValue !== val) setVal(initialValue);
  }, [initialValue, val]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (val !== initialValue) onChange(val);
    }, delay);
    return () => clearTimeout(timer);
  }, [val, delay, onChange, initialValue]);

  return (
    <input
      {...props}
      value={val}
      onFocus={(e) => {
        isFocused.current = true;
        props.onFocus?.(e);
      }}
      onChange={(e) => setVal(e.target.value)}
      onBlur={(e) => {
        isFocused.current = false;
        props.onBlur?.(e);
      }}
    />
  );
}

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Track Debt — Customer Credit Ledger for Small Businesses" },
      {
        name: "description",
        content:
          "Record credit sales and payments, track who owes you, filter overdue customers and send WhatsApp reminders and receipts.",
      },
      { property: "og:title", content: "Track Debt — Customer Credit Ledger for Small Businesses" },
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
  | "notifications"
  | "notificationSettings"
  | "backup"
  | "about"
  | "privacy"
  | "terms"
  | "redeem"
  | "account";


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

function AccountScreen({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState<"sign-up" | "sign-in">("sign-up");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [registrationEnabled, setRegistrationEnabled] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    void supabase?.from("app_feature_flags").select("enabled").eq("key", "registration").maybeSingle()
      .then(({ data }) => setRegistrationEnabled(Boolean(data?.enabled)));
    void currentSession().then((session) => setUserEmail(session?.user.email ?? null));
  }, []);

  const authenticate = async () => {
    if (!supabase) {
      setMessage("Account access is not configured yet.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      if (mode === "sign-up") {
        if (!registrationEnabled) {
          setMessage("New account registration is currently closed.");
          return;
        }
        if (password.length < 6 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
          setMessage("Password must be at least 6 characters and contain both letters and numbers.");
          return;
        }
        const result = await supabase.auth.signUp({ email: email.trim(), password });
        if (result.error) throw result.error;
        if (result.data.user?.identities?.length === 0) {
          setMode("sign-in");
          setMessage("An account with this email already exists. Please sign in instead.");
          return;
        }
        setMessage(result.data.session
          ? "Your free account is ready."
          : "Check your email to confirm your account.");
      } else {
        const result = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (result.error) throw result.error;
        setUserEmail(result.data.user?.email ?? email.trim());
        setMessage("Signed in.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not complete account access.");
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    await supabase?.auth.signOut();
    setUserEmail(null);
    setMessage("Signed out.");
  };

  return (
    <div className="p-5 animate-in fade-in slide-in-from-right-2 duration-200">
      <ScreenHeader title="Track Debt Account" onClose={onClose} />
      {userEmail ? (
        <div className="rounded-xl border border-line bg-paper-raised p-5">
          <p className="mono text-[10px] tracking-widest text-ink-soft">SIGNED IN</p>
          <p className="text-sm font-semibold mt-2 break-all">{userEmail}</p>
          <p className="text-[12px] text-ink-soft mt-3 leading-relaxed">
            Your Free account keeps your records backed up to the cloud and lets you access them across devices.
          </p>
          <button type="button" onClick={() => void signOut()} className="w-full mt-5 rounded-lg border border-line py-3 text-sm font-semibold">
            Sign out
          </button>
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-line bg-paper-raised p-5 mb-5">
            <h2 className="text-lg font-bold">{mode === "sign-up" ? "Create your free account" : "Sign in to your account"}</h2>
            <p className="text-[12px] text-ink-soft mt-2 leading-relaxed">
              {mode === "sign-up"
                ? "Save your Track Debt records to your account and access them across devices. No payment is required."
                : "Access your saved Track Debt records and account."}
            </p>
            {mode === "sign-up" && !registrationEnabled && (
              <p className="mt-4 rounded-lg border border-line px-3 py-2 text-xs text-ink-soft">
                Registration is currently closed. An admin can enable it from Management → App Settings.
              </p>
            )}
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              required
              placeholder="Email address"
              className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-sm mt-5"
            />
            <div className="relative mt-2">
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type={showPassword ? "text" : "password"}
                required
                minLength={6}
                placeholder="Password (at least 6 characters)"
                className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 pr-11 text-sm"
                aria-label="Password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-ink-soft hover:text-ink"
                aria-label={showPassword ? "Hide password" : "Show password"}
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
            {mode === "sign-up" && (
              <p className="mt-1.5 text-[11px] text-ink-soft">
                Password must contain at least 6 characters, including both letters and numbers.
              </p>
            )}
            <button
              type="button"
              onClick={() => void authenticate()}
              disabled={busy || (mode === "sign-up" && !registrationEnabled)}
              className="btn-primary w-full rounded-lg py-3 text-sm font-semibold mt-3 disabled:opacity-50"
            >
              {busy ? "Please wait…" : mode === "sign-up" ? "Create free account" : "Sign in"}
            </button>
            {message && <p className="mt-3 text-xs text-ink-soft">{message}</p>}
          </div>
          <button
            type="button"
            onClick={() => { setMode(mode === "sign-up" ? "sign-in" : "sign-up"); setMessage(null); }}
            className="w-full py-2 text-xs text-ink-soft"
          >
            {mode === "sign-up" ? "Already have an account? Sign in" : "Need an account? Create one"}
          </button>
        </>
      )}
    </div>
  );
}

function DebtTracker() {

  const [profile, setProfile, profileLoaded] = usePersistentProfile();
  const [customers, setCustomers, customersLoaded] = usePersistentCustomers();
  const loaded = profileLoaded && customersLoaded;

  // Keep account-dependent UI in sync with Supabase auth.
  // This controls the dashboard account banner and Settings status.
  const [authUser, setAuthUser] = useState<{ email?: string | null } | null>(null);
  const [authResolved, setAuthResolved] = useState(false);
  useEffect(() => {
    if (!supabase) {
      setAuthUser(null);
      setAuthResolved(true);
      return;
    }
    const client = supabase;
    let active = true;
    void client.auth.getSession().then(({ data }) => {
      if (!active) return;
      setAuthUser(data.session?.user ?? null);
      setAuthResolved(true);
    });
    const { data: listener } = client.auth.onAuthStateChange((_event, session) => {
      if (active) {
        setAuthUser(session?.user ?? null);
        setAuthResolved(true);
      }
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

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
  const [notifSettings, setNotifSettings] = useNotificationSettings();
  const [inAppNotifs, setInAppNotifs] = useInAppNotifications();
  const inAppNotifsRef = useRef(inAppNotifs);
  useEffect(() => { inAppNotifsRef.current = inAppNotifs; }, [inAppNotifs]);
  const { entitlements, loaded: entitlementsLoaded } = useEntitlements();
  const [promo, setPromo] = usePromoEntitlements();
  const [promoCode, setPromoCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);


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

  // backup & restore
  const backupInput = useRef<HTMLInputElement>(null);
  const [pendingBackup, setPendingBackup] = useState<BackupFile | null>(null);
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  useEffect(() => {
    if (screen === "backup") setLastBackup(getLastBackupAt());
  }, [screen]);

  const notifInit = useRef(false);
  useEffect(() => {
    if (!loaded || notifInit.current) return;
    notifInit.current = true;

    // 1. Give the notification module access to our React state so it can
    //    read and update records without going through React hooks.
    connectNotificationStore(
      () => inAppNotifsRef.current,
      setInAppNotifs
    );

    // 2. Register the service worker and request permission if notifications
    //    are enabled. initNotifications() handles SW registration.
    if (notifSettings.enabled) {
      void initNotifications();
    }

    // 3. Start the polling loop — fires any past-due reminders every 60s
    //    and on visibility change (tab switch, phone wake).
    startNotificationPolling();

    // 4. Handle notification taps (from SW or plain Notification API).
    setupNotificationListeners((action) => {
      console.log("[TrackDebt Notifications] Action performed:", action);
      const { debtId, customerId, type } = action.notification.extra ?? {};

      if (type === "daily_record_reminder") {
        go("list");
        toast("Tap a customer to record a sale.");
        return;
      }

      if (customerId) {
        setSelectedId(customerId);
        go("detail");
        setInAppNotifs((prev) =>
          prev.map((n) =>
            n.debtId === debtId ? { ...n, read: true } : n
          )
        );
      }
    });

    // 5. Reconcile scheduled reminders against the current ledger state.
    const timer = setTimeout(() => {
      void reconcileDebtReminders(customers, notifSettings, profile, inAppNotifs, setInAppNotifs);
    }, 1000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

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

  const deleteCustomer = () => {
    if (!selectedId || !selected) return;
    // Cancel all notifications for this customer's debts
    selected.txns.forEach(t => cancelDebtReminders(t.id));

    setCustomers((cs) => cs.filter((c) => c.id !== selectedId));
    setSelectedId(null);
    toast.success("Customer deleted.");

    resetForm();
    go("list");
  };

  const addTxn = () => {
    const amt = parseFloat(form.amount);
    if (!amt || amt <= 0 || !selectedId || !selected) return;
    const bal = balanceOf(selected);
    const dueDate = txnType === "sale" ? termDueDate(termKey, customDueDate) : undefined;
    const t: Txn = {
      id: "t" + Date.now(),
      type: txnType,
      amount: amt,
      date: todayISO(),
      note: form.note.trim(),
      currency: profile.currency,
      originalAmount: amt,
      originalCurrency: profile.currency,
      ...(txnType === "payment" ? { kind: amt >= bal ? "full" : "partial" } : {}),
      ...(txnType === "sale"
        ? {
            reference: issueReceiptReference(),
            ...(dueDate
              ? { term: { key: termKey, dueDate, setAt: new Date().toISOString() } }
              : {}),
          }
        : {}),
    };
    setCustomers((cs) => cs.map((c) => (c.id === selectedId ? { ...c, txns: [...c.txns, t] } : c)));
    track(txnType === "sale" ? "transaction_created" : "payment_recorded");
    toast.success(txnType === "sale" ? "Credit sale recorded." : "Payment recorded.");

    if (txnType === "sale" && t.term?.dueDate) {
      scheduleDebtReminders({ ...selected, txns: [...selected.txns, t] }, notifSettings, profile, inAppNotifs, setInAppNotifs);
    } else if (txnType === "payment") {
      // Re-schedule everything for this customer since payment might have cleared debts
      scheduleDebtReminders({ ...selected, txns: [...selected.txns, t] }, notifSettings, profile, inAppNotifs, setInAppNotifs);
    }

    // Trigger daily reminder rescheduling
    scheduleDailyReminder([...customers.map(c => c.id === selectedId ? { ...c, txns: [...c.txns, t] } : c)], notifSettings);

    resetForm();
    setTermKey("none");
    setCustomDueDate("");
    go("detail");
  };

  const saveTxnEdit = () => {
    const amt = parseFloat(form.amount);
    if (!amt || amt <= 0 || !selectedId || !editingTxnId) return;
    const dueDate = txnType === "sale" ? termDueDate(termKey, customDueDate) : undefined;
    setCustomers((cs) =>
      cs.map((c) => {
        if (c.id !== selectedId) return c;
        const others = c.txns
          .filter((t) => t.id !== editingTxnId)
          .reduce((s, t) => s + (t.type === "sale" ? t.amount : -t.amount), 0);
        return {
          ...c,
          txns: c.txns.map((t): Txn => {
            if (t.id !== editingTxnId) return t;
            const base: Txn = {
              id: t.id,
              date: t.date,
              type: txnType,
              amount: amt,
              currency: t.currency ?? profile.currency,
              // Editing an entry means the new amount is entered in the current business currency.
              originalAmount: amt,
              originalCurrency: profile.currency,
              note: form.note.trim(),
              ...(txnType === "sale" ? { reference: t.reference ?? issueReceiptReference() } : {}),
            };
            if (txnType === "payment") base.kind = amt >= others ? "full" : "partial";
            if (txnType === "sale" && dueDate)
              base.term = { key: termKey, dueDate, setAt: new Date().toISOString() };
            return base;
          }),
        };
      }),
    );
    setEditingTxnId(null);
    toast.success("Transaction updated.");

    // Update reminders for this customer
    const updatedCustomer = customers.find(c => c.id === selectedId);
    if (updatedCustomer) {
      scheduleDebtReminders(updatedCustomer, notifSettings, profile, inAppNotifs, setInAppNotifs);
    }

    resetForm();
    setTermKey("none");
    setCustomDueDate("");
    go("detail");
  };

  const deleteTxn = (txnId: string) => {
    if (!selectedId) return;
    setCustomers((cs) =>
      cs.map((c) =>
        c.id === selectedId ? { ...c, txns: c.txns.filter((t) => t.id !== txnId) } : c,
      ),
    );
    setConfirmDelete(null);
    toast.success("Transaction deleted.");

    cancelDebtReminders(txnId);
    // Also re-schedule in case it was a payment deletion
    const updatedCustomer = customers.find(c => c.id === selectedId);
    if (updatedCustomer) {
      scheduleDebtReminders(updatedCustomer, notifSettings, profile, inAppNotifs, setInAppNotifs);
    }
  };

  const openEditTxn = (t: Txn) => {
    setEditingTxnId(t.id);
    setTxnType(t.type);
    setPayKind(t.kind ?? "partial");
    setForm({ ...emptyForm, amount: String(t.amount), note: t.note });
    setTermKey(t.term?.key ?? "none");
    setCustomDueDate(t.term?.key === "custom" ? (t.term.dueDate ?? "") : "");
    go("editTxn");
  };

  const onLogo = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setProfile((p) => ({ ...p, logo: String(reader.result) }));
    reader.readAsDataURL(file);
  };

  const setP = (patch: Partial<BusinessProfile>) => {
    if (!patch.currency || patch.currency === profile.currency) {
      setProfile((p) => ({ ...p, ...patch }));
      return;
    }

    const targetCurrency = patch.currency;
    const run = async () => {
      try {
        // Keep each transaction's original amount/currency as the source of truth.
        // This prevents FX drift when the business switches currencies more than once.
        const currentCustomers = customers;
        const sourceCurrencies = Array.from(
          new Set(
            currentCustomers.flatMap((customer) =>
              customer.txns.map((txn) => txn.originalCurrency ?? txn.currency ?? profile.currency),
            ),
          ),
        );

        const rates = new Map<string, number>();
        await Promise.all(
          sourceCurrencies.map(async (sourceCurrency) => {
            if (sourceCurrency === targetCurrency) {
              rates.set(sourceCurrency, 1);
              return;
            }
            const { rate } = await getExchangeRate(sourceCurrency, targetCurrency);
            rates.set(sourceCurrency, rate);
          }),
        );

        setCustomers((current) =>
          current.map((customer) => ({
            ...customer,
            txns: customer.txns.map((txn) => {
              const originalCurrency = txn.originalCurrency ?? txn.currency ?? profile.currency;
              const originalAmount = txn.originalAmount ?? txn.amount;
              const rate = rates.get(originalCurrency);

              if (rate == null) {
                throw new Error(`Missing exchange rate for ${originalCurrency} to ${targetCurrency}`);
              }

              return {
                ...txn,
                amount: Math.round(originalAmount * rate * 100) / 100,
                currency: targetCurrency,
                originalAmount,
                originalCurrency,
              };
            }),
          })),
        );
        setProfile((p) => ({ ...p, ...patch }));
        toast.success(`Amounts converted to ${targetCurrency} using the latest daily reference rate.`);
      } catch {
        toast.error("Currency conversion is unavailable right now. Your currency was not changed.");
      }
    };
    void run();
  };

  const bizLabel = (profile.name || "Your business").toUpperCase();

  /* ---------- reminder preview ---------- */
  const openReminder = () => {
    if (!selected) return;
    setReminderTemplate("friendly");
    setReminderSource("friendly");
    setReminderTone("friendly");
    setReminderMessage(buildReminder(selected, profile, "friendly"));
    setAiError(null);
    track("reminder_prepared");
    go("reminder");
  };

  const selectTemplate = (tpl: ReminderTemplate) => {
    if (!selected) return;
    if (tpl.tier === "pro" && entitlements.plan === "free") {
      setGateFeature({
        title: tpl.name,
        description: `Unlock ${tpl.name.toLowerCase()} and the rest of the premium reminder library with Track Debt Pro.`,
      });
      return;
    }
    setReminderTemplate(tpl.id);
    setReminderSource(tpl.id);
    setReminderTone(TEMPLATE_TONE[tpl.id]);
    setReminderMessage(buildReminder(selected, profile, tpl.id));
  };

  const generateWithAI = async () => {
    if (!selected) return;
    if (!entitlements.aiReminders) {
      setGateFeature({
        title: "AI Reminders",
        description: "AI-generated payment reminders are available on Track Debt Plus and Premium.",
      });
      return;
    }
    setAiLoading(true);

    setAiError(null);
    try {
      const ctx = buildContext(selected, profile);
      const session = await currentSession();
      const res = await generateReminder({
        data: {
          customerName: ctx.customerName,
          businessName: ctx.businessName,
          outstanding: ctx.outstanding,
          originalAmount: ctx.originalAmount,
          dueDate: ctx.dueDateLong ?? null,
          daysOverdue: ctx.daysOverdue,
          status: ctx.status,
          tone: reminderTone,
          ...(session?.access_token ? { accessToken: session.access_token } : {}),
        },
      });
      if (res.ok) {
        const payment = paymentDetailsLine(profile);
        setReminderMessage(payment ? `${res.message}\n\n${payment}` : res.message);
        setReminderSource("ai");
        track("ai_reminder_generated", { tone: reminderTone });
      } else {
        setAiError(res.error);
      }
    } catch {
      setAiError("Could not generate a message. Please try again.");
    } finally {
      setAiLoading(false);
    }
  };

  const sendReminder = () => {
    if (!selected || !reminderMessage.trim()) return;
    const record: ReminderRecord = {
      id: "r" + Date.now(),
      customerId: selected.id,
      customerName: selected.name,
      at: new Date().toISOString(),
      templateId: reminderSource,
      ...(reminderSource === "ai" ? { tone: reminderTone } : {}),
      message: reminderMessage,
      status: "sent",
    };
    setReminderHistory((rs) => [record, ...rs].slice(0, 200));
    track("reminder_sent", { source: reminderSource });
    const win = window.open(waLink(selected.phone, reminderMessage), "_blank", "noreferrer");
    if (win) {
      toast.success("Reminder opened in WhatsApp.");
    } else {
      toast.error("Couldn't open WhatsApp. Please allow pop-ups and try again.");
    }
    go("detail");
  };

  /* ---------- receipts ---------- */
  const downloadReceipt = async (kind: "sale" | "payment" | "statement", t?: Txn) => {
    if (!selected) return;
    if (!entitlements.pdfReceipts) {
      setGateFeature({
        title: "PDF Receipts",
        description: "Professional PDF receipts and statements are available on Track Debt Plus.",
      });
      return;
    }
    try {
      const doc = await generateReceiptPdf(kind, selected, profile, t);

      const result = await downloadFile(doc.filename, doc.blob, "application/pdf");
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("PDF generated.");
      track("receipt_generated", { kind });
    } catch {
      toast.error("Could not generate the PDF. Please try again.");
    }
  };

  const copySummary = async (kind: "sale" | "payment" | "statement", t?: Txn) => {
    if (!selected) return;
    try {
      await navigator.clipboard.writeText(receiptSummary(kind, selected, profile, t));
      toast.success("Receipt summary copied.");
    } catch {
      toast.error("Could not copy. Please try again.");
    }
  };

  /* ---------- settings ---------- */
  const [restoring, setRestoring] = useState(false);
  const restorePurchase = async () => {
    setRestoring(true);
    try {
      const restored = await paymentService.restore();
      setSub(restored);
      if (restored.state === "plus_active" || restored.state === "premium_active") {
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

  /* ---------- backup & restore ---------- */
  const exportBackup = async () => {
    try {
      const file = createBackup();
      const res = await downloadFile(
        backupFilename(file),
        JSON.stringify(file, null, 2),
        "application/json",
      );
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setLastBackup(getLastBackupAt());
      toast.success("Backup created successfully.");
      track("backup_created");
    } catch {
      toast.error("Could not create the backup. Please try again.");
    }
  };

  const pickBackupFile = async (file?: File) => {
    if (!file) return;
    try {
      const parsed = parseBackupFile(await file.text());
      if (!parsed) {
        toast.error("This file is not a valid Track Debt backup.");
        return;
      }
      setPendingBackup(parsed);
    } catch {
      toast.error("This file is not a valid Track Debt backup.");
    }
  };

  const confirmRestore = () => {
    if (!pendingBackup) return;
    try {
      restoreBackup(pendingBackup);
      setPendingBackup(null);
      toast.success("Backup restored successfully.");
      track("backup_restored");
      // Reload so every persisted hook re-hydrates from the restored storage.
      setTimeout(() => window.location.reload(), 400);
    } catch {
      setPendingBackup(null);
      toast.error("Could not restore the backup. Your existing data was not changed.");
    }
  };

  /* ---------- promo redemption ---------- */
  const redeemPromo = async () => {
    if (!promoCode.trim()) return;
    setRedeeming(true);

    // Codes are validated on the server: neither the valid codes nor the
    // matching rules exist in this bundle, and the entitlement we store is a
    // server-signed token that privileged endpoints re-verify.
    const res = await redeemPromoCode(promoCode.trim());

    if (res.ok) {
      setPromo({ plan: res.plan, expiresAt: res.expiresAt, code: res.code, token: res.token });
      toast.success(
        `Congratulations! You've unlocked Track Debt ${res.plan === "plus" ? "Plus" : "Premium"}.`,
      );
      track("promo_redeemed", { code: res.code, plan: res.plan });
      go("settings");
    } else {
      toast.error(res.error);
    }

    setRedeeming(false);
    setPromoCode("");
  };

  /* ---------- voice assistance ---------- */
  const [voiceActive, setVoiceOverlay] = useState(false);
  const [voiceReview, setVoiceReview] = useState<{ type: "customer" | "txn", data: any } | null>(null);

  const startVoice = (type: "customer" | "txn") => {
    if (!entitlements.voiceEntry) {
      setGateFeature({
        title: "Voice Entry",
        description: "Voice-assisted customer and transaction entry is available on Track Debt Plus.",
      });
      return;
    }
    setVoiceOverlay(true);
    // Simulate processing after 3 seconds
    setTimeout(() => {
      setVoiceOverlay(false);
      if (type === "customer") {
        setVoiceReview({
          type: "customer",
          data: { name: "Ngozi Okafor", phone: "08031234567", notes: "Extracted from voice" }
        });
      } else {
        setVoiceReview({
          type: "txn",
          data: { amount: "85000", note: "2 bags cement", termKey: "d14" }
        });
      }
    }, 3000);
  };

  const applyVoiceCustomer = () => {
    if (!voiceReview) return;
    setForm({ ...emptyForm, name: voiceReview.data.name, phone: voiceReview.data.phone, notes: voiceReview.data.notes });
    setVoiceReview(null);
    go("addCustomer");
  };

  const applyVoiceTxn = () => {
    if (!voiceReview) return;
    setForm({ ...emptyForm, amount: voiceReview.data.amount, note: voiceReview.data.note });
    setTermKey(voiceReview.data.termKey);
    setVoiceReview(null);
    go("addTxn");
  };

  /* ---------- render ---------- */


  if (!onboardingLoaded) {
    return <main className="min-h-screen bg-background" />;
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
        {/* ===== ACCOUNT ===== */}
        {screen === "account" && (
          <AccountScreen onClose={() => go("settings")} />
        )}

        {/* ===== LIST / DASHBOARD ===== */}
        {screen === "list" && (
          <div className="animate-in fade-in duration-200">
            <header className="px-5 pt-9 pb-6 border-b border-line bg-paper-raised">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  {profile.logo ? (
                    <img
                      src={profile.logo}
                      alt={`${profile.name || "Business"} logo`}
                      className="h-9 w-9 rounded object-cover border border-line"
                    />
                  ) : (
                    <span className="h-9 w-9 rounded border border-line grid place-items-center text-ink-soft">
                      <Store size={16} />
                    </span>
                  )}
                  <h1 className="mono text-[11px] tracking-[0.18em] text-ink-soft font-semibold truncate">
                    {bizLabel}
                  </h1>
                </div>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => go("notifications")}
                    aria-label="Notifications"
                    className="text-ink-soft transition-opacity active:opacity-60 relative"
                  >
                    {inAppNotifs.some((n) => !n.read && new Date(n.scheduledFor) <= new Date()) ? (
                      <>
                        <BellRing size={20} className="text-debt" />
                        <span className="absolute -top-1 -right-1 h-4 w-4 bg-debt text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                          {inAppNotifs.filter((n) => !n.read && new Date(n.scheduledFor) <= new Date()).length > 9
                            ? "9+"
                            : inAppNotifs.filter((n) => !n.read && new Date(n.scheduledFor) <= new Date()).length}
                        </span>
                      </>
                    ) : (
                      <Bell size={20} />
                    )}
                  </button>
                  <button
                    onClick={() => go("settings")}
                    aria-label="Settings"
                    className="text-ink-soft transition-opacity active:opacity-60"
                  >
                    <SettingsIcon size={18} />
                  </button>
                </div>
              </div>

              {authResolved && !authUser && (
                <button
                  type="button"
                  onClick={() => go("account")}
                  className="mt-5 w-full rounded-lg border border-line bg-paper px-3 py-3 text-left flex items-center justify-between"
                >
                  <span>
                    <span className="block text-sm font-semibold">Create a free account</span>
                    <span className="block text-[11px] text-ink-soft mt-0.5">Back up your records and access them across devices.</span>
                  </span>
                  <ChevronRight size={16} className="text-ink-soft shrink-0" />
                </button>
              )}

              <p className="mono text-[10px] tracking-[0.2em] text-ink-soft mt-6">
                OUTSTANDING BALANCE
              </p>
              <p className="mono text-[2.6rem] leading-none font-bold text-debt mt-2">
                {money(stats.outstanding)}
              </p>

              <div className="grid grid-cols-3 gap-2 mt-6">
                <Stat
                  icon={<Users size={13} />}
                  label="Customers"
                  value={String(customers.length)}
                />
                <Stat
                  icon={<CalendarClock size={13} />}
                  label="Due today"
                  value={String(stats.dueToday)}
                  tone={stats.dueToday ? "warn" : undefined}
                />
                <Stat
                  icon={<CalendarDays size={13} />}
                  label="Due this week"
                  value={String(stats.dueWeek)}
                  tone={stats.dueWeek ? "warn" : undefined}
                />
                <Stat
                  icon={<AlertTriangle size={13} />}
                  label="Overdue"
                  value={String(stats.overdue)}
                  tone={stats.overdue ? "debt" : undefined}
                />
                <Stat
                  icon={<TrendingUp size={13} />}
                  label="Collected (mo.)"
                  value={money(stats.collections)}
                  tone="paid"
                />
                <Stat
                  icon={<TrendingDown size={13} />}
                  label="Credit sales (mo.)"
                  value={money(stats.creditSales)}
                  tone="debt"
                />
              </div>
            </header>

            {!loaded ? (
              <div className="p-5 space-y-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-14 rounded bg-muted/70 animate-pulse" />
                ))}
              </div>
            ) : (
              <>
                <div className="px-5 pt-5 pb-3 space-y-3">
                  <div className="flex items-center gap-2 input-field rounded px-3 py-2.5">
                    <Search size={15} className="text-ink-soft" />
                    <DebouncedInput
                      initialValue={query}
                      onChange={setQuery}
                      placeholder="Search name, phone or note"
                      className="bg-transparent w-full text-sm outline-none text-ink"
                    />
                    {query && (
                      <button onClick={() => setQuery("")} aria-label="Clear search">
                        <X size={14} className="text-ink-soft" />
                      </button>
                    )}
                  </div>

                  <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">

                    {(
                      [
                        ["all", "All"],
                        ["outstanding", "Outstanding"],
                        ["dueToday", "Due today"],
                        ["dueWeek", "Due this week"],
                        ["overdue", "Overdue"],
                        ["settled", "Settled"],
                      ] as const
                    ).map(([key, label]) => (
                      <Chip
                        key={key}
                        active={filter === key}
                        onClick={() => setFilter(key)}
                        label={label}
                      />
                    ))}
                    <span className="w-px bg-line shrink-0 mx-0.5" />
                    <Chip
                      active={sort === "newest"}
                      onClick={() => setSort("newest")}
                      label="Newest"
                    />
                    <Chip
                      active={sort === "highest"}
                      onClick={() => setSort("highest")}
                      label="Highest debt"
                    />
                  </div>
                </div>

                <section>
                  {filtered.length === 0 && customers.length === 0 && (
                    <div className="px-8 py-14 text-center animate-in fade-in duration-300">
                      <span className="mx-auto h-14 w-14 rounded-full perforated grid place-items-center text-ink-soft">
                        <Users size={22} />
                      </span>
                      <p className="text-base font-bold mt-4">You&rsquo;re all set!</p>
                      <p className="text-[13px] text-ink-soft mt-1.5 leading-relaxed max-w-[260px] mx-auto">
                        Add your first customer to begin tracking credit sales.
                      </p>
                      <button
                        onClick={() => {
                          resetForm();
                          setOnboarding((o) => ({ ...o, tips: { ...o.tips, addCustomer: true } }));
                          go("addCustomer");
                        }}
                        className="btn-primary rounded px-5 py-3 text-sm font-semibold mt-5 inline-flex items-center gap-2 transition-transform active:scale-[0.99]"
                      >
                        <Plus size={16} /> Add Customer
                      </button>
                    </div>
                  )}
                  {filtered.length === 0 && customers.length > 0 && (
                    <div className="px-8 py-14 text-center animate-in fade-in duration-300">
                      <span className="mx-auto h-12 w-12 rounded-full perforated grid place-items-center text-ink-soft">
                        <Search size={20} />
                      </span>
                      <p className="text-sm font-semibold mt-4">Nothing matches this view</p>
                      <p className="text-[12px] text-ink-soft mt-1.5 leading-relaxed">
                        Try a different filter or clear your search.
                      </p>
                    </div>
                  )}
                  {onboarding.tips.addCustomer &&
                    !onboarding.tips.openCustomer &&
                    filtered.length > 0 && (
                      <div className="px-5 pb-2 pt-1">
                        <TipCallout
                          onDismiss={() =>
                            setOnboarding((o) => ({
                              ...o,
                              tips: { ...o.tips, openCustomer: true },
                            }))
                          }
                        >
                          Tap a customer to record sales and payments.
                        </TipCallout>
                      </div>
                    )}
                  {filtered.map((c) => (
                    <CustomerItem
                      key={c.id}
                      customer={c}
                      onClick={(id) => {
                        setSelectedId(id);
                        setOnboarding((o) => ({ ...o, tips: { ...o.tips, openCustomer: true } }));
                        go("detail");
                      }}
                    />
                  ))}
                </section>
              </>
            )}

            {!onboarding.tips.addCustomer && customers.length > 0 && (
              <TipCallout
                className="fixed bottom-24 right-[max(1.25rem,calc(50%-215px+1.25rem))]"
                onDismiss={() =>
                  setOnboarding((o) => ({ ...o, tips: { ...o.tips, addCustomer: true } }))
                }
              >
                Tap the + button to add new customers.
              </TipCallout>
            )}

            <div className="fixed bottom-6 right-[max(1.25rem,calc(50%-215px+1.25rem))] flex flex-col gap-3">
              <button
                onClick={() => startVoice("customer")}
                aria-label="Voice add customer"
                className="bg-paper-raised border border-line text-ink rounded-full flex items-center justify-center shadow-lg h-12 w-12 transition-transform active:scale-95"
              >
                <Mic size={20} />
              </button>
              <button
                onClick={() => {
                  resetForm();
                  setOnboarding((o) => ({ ...o, tips: { ...o.tips, addCustomer: true } }));
                  go("addCustomer");
                }}
                aria-label="Add customer"
                className="btn-primary rounded-full flex items-center justify-center shadow-lg h-14 w-14 transition-transform active:scale-95"
              >
                <Plus size={24} />
              </button>
            </div>
          </div>
        )}


        {/* ===== PROMO REDEMPTION ===== */}
        {screen === "redeem" && (
          <div className="p-5 animate-in fade-in slide-in-from-right-2 duration-200">
            <ScreenHeader title="Redeem Promo Code" onClose={() => go("settings")} />

            <p className="text-[13px] leading-relaxed text-ink-soft mb-6">
              Enter your code below to unlock Track Debt Plus or Premium features temporarily.
            </p>

            <Field label="PROMO CODE">
              <LocalInput
                initialValue={promoCode}
                onBlur={(val) => setPromoCode(val.trim().toUpperCase())}
                placeholder="Enter your promo code"
                className="input-field w-full rounded px-3 py-2.5 text-sm mono uppercase"
              />
            </Field>

            <button
              onClick={redeemPromo}
              disabled={!promoCode.trim() || redeeming}
              className="btn-primary w-full rounded py-3 text-sm font-semibold mt-4 disabled:opacity-40 transition-transform active:scale-[0.99]"
            >
              {redeeming ? "Verifying code..." : "Redeem Code"}
            </button>

            {promo && (
              <div className="mt-10 p-4 rounded-lg border border-paid bg-paid/5">
                <p className="text-[11px] font-bold text-paid uppercase tracking-widest">Active Promo</p>
                <div className="flex justify-between items-center mt-2">
                  <p className="text-sm font-semibold">{promo.code}</p>
                  <p className="text-[11px] text-ink-soft">Expires {fmtDate(promo.expiresAt)}</p>
                </div>
                <p className="text-xs text-ink-soft mt-1">Unlocked {planLabel(promo.plan)} features.</p>
              </div>
            )}
          </div>
        )}

        {/* ===== BUSINESS PROFILE ===== */}

        {screen === "profile" && (
          <div className="p-5 animate-in fade-in slide-in-from-right-2 duration-200">
            <ScreenHeader title="Business profile" onClose={() => go("settings")} />

            <div className="flex items-center gap-4 mb-7">
              {profile.logo ? (
                <img
                  src={profile.logo}
                  alt="Business logo"
                  className="h-16 w-16 rounded object-cover border border-line"
                />
              ) : (
                <span className="h-16 w-16 rounded perforated grid place-items-center text-ink-soft">
                  <Store size={22} />
                </span>
              )}
              <div className="space-y-1.5">
                <button
                  onClick={() => logoInput.current?.click()}
                  className="flex items-center gap-2 text-sm font-semibold text-ink"
                >
                  <Camera size={15} /> {profile.logo ? "Change logo" : "Upload logo"}
                </button>
                {profile.logo && (
                  <button
                    onClick={() => setP({ logo: "" })}
                    className="text-[12px] text-ink-soft block"
                  >
                    Remove
                  </button>
                )}
              </div>
              <input
                ref={logoInput}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onLogo(e.target.files?.[0])}
              />
            </div>

            <Field label="BUSINESS NAME">
              <LocalInput
                initialValue={profile.name}
                onBlur={(val) => setP({ name: val.trim() })}
                placeholder="e.g. Amaka Provisions"
                className="input-field w-full rounded px-3 py-2.5 text-sm"
              />
            </Field>
            <Field label="PHONE">
              <LocalInput
                initialValue={profile.phone}
                onBlur={(val) => setP({ phone: val.trim() })}
                inputMode="tel"
                placeholder="080..."
                className="input-field w-full rounded px-3 py-2.5 text-sm"
              />
            </Field>
            <Field label="EMAIL">
              <LocalInput
                initialValue={profile.email}
                onBlur={(val) => setP({ email: val.trim() })}
                inputMode="email"
                placeholder="you@business.com"
                className="input-field w-full rounded px-3 py-2.5 text-sm"
              />
            </Field>
            <Field label="ADDRESS">
              <LocalTextarea
                initialValue={profile.address}
                onBlur={(val) => setP({ address: val.trim() })}
                rows={2}
                placeholder="Shop 12, Main Market..."
                className="input-field w-full rounded px-3 py-2.5 text-sm resize-none"
              />
            </Field>
            <Field label="CATEGORY">
              <select
                value={profile.category}
                onChange={(e) => setP({ category: e.target.value })}
                className="input-field w-full rounded px-3 py-2.5 text-sm"
              >
                <option value="">Select a category</option>
                {BUSINESS_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="CURRENCY">
              <select
                value={profile.currency}
                onChange={(e) => setP({ currency: e.target.value as BusinessProfile["currency"] })}
                className="input-field w-full rounded px-3 py-2.5 text-sm"
              >
                {SUPPORTED_CURRENCIES.map((currency) => (
                  <option key={currency.code} value={currency.code}>
                    {currency.code} — {currency.name} ({currency.symbol})
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-ink-soft mt-1.5 leading-relaxed">
                Existing amounts will be converted using the latest available daily reference rate when you change the business currency.
              </p>
            </Field>

            <p className="mono text-[11px] tracking-widest text-ink-soft mt-6 mb-3">
              PAYMENT DETAILS (OPTIONAL)
            </p>
            <Field label="BANK NAME">
              <LocalInput
                initialValue={profile.bankName}
                onBlur={(val) => setP({ bankName: val.trim() })}
                placeholder="e.g. GTBank"
                className="input-field w-full rounded px-3 py-2.5 text-sm"
              />
            </Field>
            <Field label="ACCOUNT NUMBER">
              <LocalInput
                initialValue={profile.accountNumber}
                onBlur={(val) => setP({ accountNumber: val.trim() })}
                inputMode="numeric"
                placeholder="0123456789"
                className="input-field w-full rounded px-3 py-2.5 text-sm mono"
              />
            </Field>
            <Field label="ACCOUNT NAME">
              <LocalInput
                initialValue={profile.accountName}
                onBlur={(val) => setP({ accountName: val.trim() })}
                placeholder="e.g. Chidi Provisions Store"
                className="input-field w-full rounded px-3 py-2.5 text-sm"
              />
            </Field>
            <p className="text-[11px] text-ink-soft leading-relaxed -mt-1 mb-2">
              Included automatically in every reminder so customers know where to pay.
            </p>

            <p className="text-[11px] text-ink-soft leading-relaxed mt-2 mb-6">
              These details appear on your receipts, statements and WhatsApp reminders. Registered accounts sync
              business data to the cloud; visitor data stays on this device.
            </p>

            <button
              onClick={() => go("settings")}
              className="btn-primary w-full rounded py-3 text-sm font-semibold transition-transform active:scale-[0.99]"
            >
              Done
            </button>
          </div>
        )}

        {/* ===== NOTIFICATION CENTER ===== */}
        {screen === "notifications" && (
          <div className="animate-in fade-in slide-in-from-right-2 duration-200">
            <div className="px-5">
              <ScreenHeader title="Notifications" onClose={() => go("list")} />
            </div>

            <div className="flex items-center justify-between px-5 pb-4">
              <p className="mono text-[10px] tracking-widest text-ink-soft">
                {inAppNotifs.filter(n => new Date(n.scheduledFor) <= new Date()).length} {inAppNotifs.filter(n => new Date(n.scheduledFor) <= new Date()).length === 1 ? "NOTIFICATION" : "NOTIFICATIONS"}
              </p>
              {inAppNotifs.length > 0 && (
                <div className="flex gap-4">
                  <button
                    onClick={() => setInAppNotifs((prev) => prev.map((n) => ({ ...n, read: true })))}
                    className="text-[11px] font-semibold text-ink-soft flex items-center gap-1"
                  >
                    <CheckCheck size={13} /> Mark all read
                  </button>
                  <button
                    onClick={() => setInAppNotifs([])}
                    className="text-[11px] font-semibold text-debt flex items-center gap-1"
                  >
                    <Trash size={13} /> Clear all
                  </button>
                </div>
              )}
            </div>

            <section className="pb-8">
              {inAppNotifs.filter(n => new Date(n.scheduledFor) <= new Date()).length === 0 ? (
                <div className="px-8 py-20 text-center">
                  <span className="mx-auto h-14 w-14 rounded-full perforated grid place-items-center text-ink-soft">
                    <Bell size={24} />
                  </span>
                  <p className="text-sm font-semibold mt-4">No notifications yet</p>
                  <p className="text-[12px] text-ink-soft mt-1.5 leading-relaxed">
                    We&rsquo;ll notify you here when payments are coming up or overdue.
                  </p>
                </div>
              ) : (
                inAppNotifs
                  .filter(n => new Date(n.scheduledFor) <= new Date())
                  .sort((a, b) => b.scheduledFor.localeCompare(a.scheduledFor))
                  .map((n) => (
                    <NotificationItem
                      key={n.id}
                      notification={n}
                      onClick={() => {
                        setInAppNotifs((prev) =>
                          prev.map((item) => (item.id === n.id ? { ...item, read: true } : item))
                        );
                        if (n.type === "admin_broadcast") {
                          if (n.link) window.location.assign(n.link);
                          return;
                        }
                        setSelectedId(n.customerId);
                        go("detail");
                      }}
                    />
                  ))
              )}
            </section>

          </div>
        )}

        {/* ===== NOTIFICATION SETTINGS ===== */}
        {screen === "notificationSettings" && (
          <div className="p-5 animate-in fade-in slide-in-from-right-2 duration-200">
            <ScreenHeader title="Payment Reminders" onClose={() => go("settings")} />

            <p className="text-[13px] leading-relaxed text-ink-soft mb-6">
              Automatically get notified about upcoming and overdue payments from your customers.
            </p>

            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">Enable Reminders</p>
                  <p className="text-[12px] text-ink-soft">Master switch for all notifications</p>
                </div>
                <button
                  onClick={async () => {
                    if (!notifSettings.enabled) {
                      const status = await requestPermissions();
                      if (status !== "granted") {
                        toast.error("Notification permission is required to enable reminders.");
                        return;
                      }
                    }
                    setNotifSettings((s) => ({ ...s, enabled: !s.enabled }));
                  }}
                  className={`w-11 h-6 rounded-full transition-colors relative ${
                    notifSettings.enabled ? "bg-debt" : "bg-line"
                  }`}
                >
                  <span
                    className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                      notifSettings.enabled ? "translate-x-5" : ""
                    }`}
                  />
                </button>
              </div>

              <div className={`space-y-6 transition-opacity ${notifSettings.enabled ? "" : "opacity-40 pointer-events-none"}`}>
                <div className="pt-2">
                  <p className="mono text-[10px] tracking-widest text-ink-soft mb-4">UPCOMING PAYMENTS</p>
                  <div className="space-y-4">
                    {[
                      ["remind7DaysBefore", "7 days before"],
                      ["remind3DaysBefore", "3 days before"],
                      ["remind1DayBefore", "1 day before"],
                      ["remindOnDueDate", "On the due date"],
                    ].map(([key, label]) => (
                      <div key={key} className="flex items-center justify-between">
                        <p className="text-sm">{label}</p>
                        <button
                          onClick={() => setNotifSettings((s) => ({ ...s, [key as keyof typeof s]: !s[key as keyof typeof s] }))}
                          className={`w-11 h-6 rounded-full transition-colors relative ${
                            notifSettings[key as keyof typeof notifSettings] ? "bg-debt" : "bg-line"
                          }`}
                        >
                          <span
                            className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                              notifSettings[key as keyof typeof notifSettings] ? "translate-x-5" : ""
                            }`}
                          />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-2">
                  <p className="mono text-[10px] tracking-widest text-ink-soft mb-4">OVERDUE PAYMENTS</p>
                  <div className="flex items-center justify-between">
                    <p className="text-sm">Remind me about overdue payments</p>
                    <button
                      onClick={() => setNotifSettings((s) => ({ ...s, remindOverdue: !s.remindOverdue }))}
                      className={`w-11 h-6 rounded-full transition-colors relative ${
                        notifSettings.remindOverdue ? "bg-debt" : "bg-line"
                      }`}
                    >
                      <span
                        className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                          notifSettings.remindOverdue ? "translate-x-5" : ""
                        }`}
                      />
                    </button>
                  </div>
                  {notifSettings.remindOverdue && (
                    <div className="mt-4 flex items-center justify-between">
                      <p className="text-sm text-ink-soft">Remind every</p>
                      <select
                        value={notifSettings.overdueIntervalDays}
                        onChange={(e) => setNotifSettings((s) => ({ ...s, overdueIntervalDays: Number(e.target.value) }))}
                        className="input-field rounded px-2 py-1 text-sm"
                      >
                        {[1, 2, 3, 5, 7].map((d) => (
                          <option key={d} value={d}>{d} {d === 1 ? "day" : "days"}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="pt-2">
                  <p className="mono text-[10px] tracking-widest text-ink-soft mb-4">TIME</p>
                  <div className="flex items-center justify-between">
                    <p className="text-sm">Reminder time</p>
                    <input
                      type="time"
                      value={notifSettings.reminderTime}
                      onChange={(e) => setNotifSettings((s) => ({ ...s, reminderTime: e.target.value }))}
                      className="input-field rounded px-3 py-1.5 text-sm"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-line mt-6 pt-6">
                  <p className="mono text-[10px] tracking-widest text-ink-soft mb-4">SOUND</p>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium">Play notification sound</p>
                      <p className="text-[12px] text-ink-soft mt-0.5">A short tone when a reminder arrives.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const next = !notifSettings.soundEnabled;
                        setNotifSettings((s) => ({ ...s, soundEnabled: next }));
                        setNotificationSoundEnabled(next);
                      }}
                      className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${
                        notifSettings.soundEnabled ? "bg-debt" : "bg-line"
                      }`}
                    >
                      <span
                        className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                          notifSettings.soundEnabled ? "translate-x-5" : ""
                        }`}
                      />
                    </button>
                  </div>
                </div>

                <div className="pt-2 border-t border-line mt-6 pt-6">
                  <p className="mono text-[10px] tracking-widest text-ink-soft mb-4">DAILY RECORD REMINDER</p>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">Remind me to record today&rsquo;s credit sales</p>
                      <p className="text-[12px] text-ink-soft mt-0.5">Track every credit sale while you still remember it.</p>
                    </div>
                    <button
                      onClick={() => setNotifSettings((s) => ({ ...s, dailyReminderEnabled: !s.dailyReminderEnabled }))}
                      className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ml-4 ${
                        notifSettings.dailyReminderEnabled ? "bg-debt" : "bg-line"
                      }`}
                    >
                      <span
                        className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                          notifSettings.dailyReminderEnabled ? "translate-x-5" : ""
                        }`}
                      />
                    </button>
                  </div>
                  {notifSettings.dailyReminderEnabled && (
                    <div className="mt-4 flex items-center justify-between">
                      <p className="text-sm text-ink-soft">Reminder time</p>
                      <input
                        type="time"
                        value={notifSettings.dailyReminderTime}
                        onChange={(e) => setNotifSettings((s) => ({ ...s, dailyReminderTime: e.target.value }))}
                        className="input-field rounded px-3 py-1.5 text-sm"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                reconcileDebtReminders(customers, notifSettings, profile, inAppNotifs, setInAppNotifs);
                go("settings");
              }}
              className="btn-primary w-full rounded py-3 text-sm font-semibold mt-10 transition-transform active:scale-[0.99]"
            >
              Done
            </button>
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
            <SettingsRow
              icon={<ShieldCheck size={17} />}
              label="Track Debt Account"
              value={authResolved ? (authUser ? "Logged in" : "Create account") : "Checking…"}
              tone={authResolved && authUser ? "paid" : undefined}
              onClick={() => go("account")}
            />


            <p className="mono text-[10px] tracking-widest text-ink-soft px-5 pb-2 pt-5">
              SUBSCRIPTION
            </p>
            <SettingsRow
              icon={<Crown size={17} />}
              label="Current Plan"
              value={stateLabel(sub)}
              tone={entitlements.plan !== "free" ? "paid" : undefined}
              onClick={() => {}}
            />
            {entitlements.plan === "free" && (
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

            <p className="mono text-[10px] tracking-widest text-ink-soft px-5 pb-2 pt-5">
              PREFERENCES
            </p>
            <SettingsRow
              icon={<TicketPercent size={17} />}
              label="Promo Code"
              onClick={() => go("redeem")}
            />
            <SettingsRow
              icon={<Bell size={17} />}
              label="Payment Reminders"
              onClick={() => go("notificationSettings")}
            />


            <p className="mono text-[10px] tracking-widest text-ink-soft px-5 pb-2 pt-5">
              SUPPORT
            </p>
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

            <p className="mono text-[10px] tracking-widest text-ink-soft px-5 pb-2 pt-5">DATA</p>
            <SettingsRow
              icon={<Download size={17} />}
              label="Backup & Restore"
              onClick={() => go("backup")}
            />

            <p className="mono text-[10px] tracking-widest text-ink-soft px-5 pb-2 pt-5">
              ADVANCED
            </p>
            <SettingsRow
              icon={<Mail size={17} />}
              label="Feedback"
              href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Track Debt Feedback")}`}
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

            <p className="text-[13px] leading-relaxed text-ink-soft mb-5">
              Visitor data is stored on this device. Registered accounts can sync business records to the cloud. You can also export a backup for safekeeping.
            </p>

            <div className="rounded border border-line bg-paper-raised px-4 py-3 mb-5">
              <p className="mono text-[10px] tracking-widest text-ink-soft">LAST BACKUP</p>
              <p className="text-sm mt-1">
                {lastBackup ? new Date(lastBackup).toLocaleString() : "Never"}
              </p>
            </div>

            <div className="space-y-3">
              <button
                onClick={exportBackup}
                className="btn-primary w-full min-h-[48px] rounded py-3 text-sm font-semibold"
              >
                Export Backup
              </button>
              <input
                ref={backupInput}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  void pickBackupFile(f);
                }}
              />
              <button
                onClick={() => backupInput.current?.click()}
                className="w-full min-h-[48px] rounded border border-line bg-paper-raised py-3 text-sm font-semibold text-ink"
              >
                Import Backup
              </button>
            </div>

            {pendingBackup && (
              <div className="fixed inset-0 z-50 grid place-items-center bg-ink/50 p-5">
                <div className="w-full max-w-sm rounded border border-line bg-paper p-5 shadow-lg">
                  <h3 className="text-base font-semibold mb-2">Restore Backup?</h3>
                  <p className="text-[13px] text-ink-soft mb-5">
                    Restoring this backup will replace the current Track Debt data on this device.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setPendingBackup(null)}
                      className="flex-1 min-h-[44px] rounded border border-line bg-paper-raised text-sm font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={confirmRestore}
                      className="btn-primary flex-1 min-h-[44px] rounded text-sm font-semibold"
                    >
                      Restore
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
                  <path d="M 110,300 A 146,146 0 0 1 402,300" fill="none" stroke="#ffffff" strokeWidth="30" strokeLinecap="round" />
                  <path d="M 241,304 L 256,176 L 271,304 Z" fill="#ffffff" />
                  <circle cx="256" cy="304" r="20" fill="#ffffff" />
                  <rect x="196" y="330" width="120" height="32" rx="16" fill="#ffffff" />
                  <rect x="166" y="370" width="180" height="32" rx="16" fill="#ffffff" />
                  <rect x="136" y="410" width="240" height="32" rx="16" fill="#ffffff" />
                </svg>
              </div>
              <p className="mt-3 text-lg font-bold">{APP_NAME}</p>
              <p className="mono text-[11px] text-ink-soft mt-0.5">Version {APP_VERSION}</p>
              <p className="mt-4 text-sm text-ink-soft leading-relaxed max-w-[320px]">
                Track Debt is a simple credit-sales and customer debt management tool for small businesses.
                Record credit sales and payments, monitor outstanding balances, set due dates, prepare
                payment reminders and keep business records organised in one place.
              </p>
            </div>

            <div className="space-y-3 text-[13px] leading-relaxed text-ink-soft mb-6">
              <p><strong className="text-ink">Local or cloud storage.</strong> Visitors can use Track Debt locally on their device. Registered users can move their records to a Track Debt account and sync them across supported devices.</p>
              <p><strong className="text-ink">Multiple currencies.</strong> Business records can be managed in supported currencies including NGN, GHS, KES, TZS, UGX, ZMW and RWF. Currency conversion uses daily reference rates when a business changes its operating currency.</p>
              <p><strong className="text-ink">Built for practical business use.</strong> Track Debt does not lend money or collect debts on your behalf. It gives you tools to keep clearer records and communicate with your customers.</p>
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

        {screen === "privacy" && (
          <div className="p-5 animate-in fade-in slide-in-from-right-2 duration-200">
            <ScreenHeader title="Privacy Policy" onClose={() => go("settings")} />
            <div className="space-y-4 text-[13px] leading-relaxed text-ink-soft pb-8">
              <p><strong className="text-ink">Last updated:</strong> 28 September 2026</p>
              <p>{APP_NAME} is provided by {DEVELOPER}. We respect your privacy and aim to collect only information needed to provide, secure and improve the service.</p>

              <p><strong className="text-ink">Information you provide.</strong> Depending on how you use Track Debt, this may include your email address and account credentials, business profile details, customer names and phone numbers, transaction records, payment reminders, notification preferences and subscription information.</p>

              <p><strong className="text-ink">Visitor and registered accounts.</strong> If you use Track Debt without an account, your business records are stored locally on your device. If you create an account, your records can be moved to cloud storage so they can sync across supported devices. Track Debt shows a migration prompt before local business records are transferred or wiped.</p>

              <p><strong className="text-ink">Why we process data.</strong> We use account and business data to provide the ledger, cloud sync, backups, reminders, receipts, account management, support, security, analytics and subscription features you choose to use.</p>

              <p><strong className="text-ink">AI reminders.</strong> When you request an AI-generated reminder, limited information needed to draft that message may be sent to the AI service used by Track Debt. Phone numbers are not required for that request. You should review AI-generated text before sending it.</p>

              <p><strong className="text-ink">Currency conversion.</strong> When you change the operating currency, Track Debt requests a currency-pair exchange rate from its exchange-rate provider. The request contains currency information needed for the rate lookup, not your customer records.</p>

              <p><strong className="text-ink">Contacts.</strong> If you choose Import from Contacts and your browser supports contact selection, Track Debt uses the contact you select to fill the customer form. Track Debt does not need access to your entire contact list.</p>

              <p><strong className="text-ink">WhatsApp.</strong> When you choose to send a reminder or receipt, Track Debt opens WhatsApp with a prepared message. Track Debt does not control your WhatsApp account or confirm delivery.</p>

              <p><strong className="text-ink">Payments and advertising.</strong> When paid features are enabled, payment processing is handled by the payment provider shown at checkout. Track Debt does not store your full card details. Free users may see advertising from advertising partners, which may use cookies or similar technologies according to their own policies.</p>

              <p><strong className="text-ink">Security and retention.</strong> We use reasonable technical measures and access controls to protect account data. You are also responsible for protecting your device, password and exported backups. Account deletion and restoration periods are described in the account controls available in Track Debt.</p>

              <p><strong className="text-ink">Your choices.</strong> You can use Track Debt locally without registering, create or sign in to an account, export local backups, and request account support through {SUPPORT_EMAIL}. You may also request help with your personal data where applicable under relevant data-protection law.</p>

              <p>Questions or privacy requests can be sent to {SUPPORT_EMAIL}.</p>
            </div>
          </div>
        )}

        {screen === "terms" && (
          <div className="p-5 animate-in fade-in slide-in-from-right-2 duration-200">
            <ScreenHeader title="Terms of Use" onClose={() => go("settings")} />
            <div className="space-y-4 text-[13px] leading-relaxed text-ink-soft pb-8">
              <p><strong className="text-ink">Last updated:</strong> 28 September 2026</p>
              <p>By accessing or using {APP_NAME}, you agree to these Terms of Use.</p>

              <p><strong className="text-ink">1. The service.</strong> Track Debt is a business record-keeping tool for tracking customer credit sales, payments, balances, due dates, reminders and related records. It does not provide credit, guarantee repayment, act as a debt collector, or provide accounting, legal or financial advice.</p>

              <p><strong className="text-ink">2. Accounts and data.</strong> You may use local mode without an account. Registered users can use cloud storage and supported cross-device sync. You are responsible for providing accurate information, protecting your login credentials and reviewing your records.</p>

              <p><strong className="text-ink">3. Currency and conversion.</strong> Track Debt supports multiple operating currencies. Currency conversion is provided for record-display purposes using available reference rates and may differ from rates offered by banks, payment providers or money-transfer services. Do not rely on Track Debt conversion figures as a guaranteed settlement, tax or accounting rate.</p>

              <p><strong className="text-ink">4. Reminders, receipts and AI.</strong> Messages, reminders, receipts and AI-generated content are tools for your convenience. You are responsible for checking the accuracy and appropriateness of anything before sending it to a customer.</p>

              <p><strong className="text-ink">5. WhatsApp and third-party services.</strong> Track Debt may open or connect to third-party services such as WhatsApp, payment providers, advertising services, cloud infrastructure and exchange-rate services. Their own terms and privacy policies apply to your use of those services.</p>

              <p><strong className="text-ink">6. Subscriptions.</strong> Free features are available subject to the service configuration. Paid plans, including Track Debt Plus, may have their own price, billing period and feature limits. Where Plus is billed through Paystack, its current billing currency is NGN. Subscription terms shown at checkout take precedence for that purchase.</p>

              <p><strong className="text-ink">7. Acceptable use.</strong> You must not use Track Debt to violate applicable laws, misuse another person's information, attempt unauthorised access, interfere with the service, or use the service to send unlawful, abusive or deceptive communications.</p>

              <p><strong className="text-ink">8. Data and backups.</strong> We work to keep the service available, but no software or storage system is guaranteed to be uninterrupted or loss-free. Keep appropriate backups of important records. If you choose to wipe local data or delete an account, information may become permanently unavailable after the applicable recovery period.</p>

              <p><strong className="text-ink">9. Availability and changes.</strong> Features, supported currencies, integrations, pricing and limits may change as Track Debt develops. We may suspend or restrict access where necessary for security, legal compliance, maintenance or misuse.</p>

              <p><strong className="text-ink">10. Disclaimer.</strong> Track Debt is provided on an "as available" basis to the extent permitted by law. We are not responsible for losses caused by inaccurate records entered by you, customer non-payment, failed third-party delivery, exchange-rate differences, device loss, or circumstances outside our reasonable control.</p>

              <p><strong className="text-ink">11. Contact.</strong> Questions about these terms can be sent to {SUPPORT_EMAIL}.</p>
            </div>
          </div>
        )}

        {(screen === "addCustomer" || screen === "editCustomer") && (
          <div className="p-5 animate-in fade-in slide-in-from-right-2 duration-200">
            <ScreenHeader
              title={screen === "addCustomer" ? "New customer" : "Edit customer"}
              onClose={() => {
                resetForm();
                go(screen === "addCustomer" ? "list" : "detail");
              }}
            />

            {screen === "addCustomer" && (
              <button
                type="button"
                onClick={async () => {
                  try {
                    type ContactPickerNavigator = Navigator & {
                      contacts?: {
                        select: (
                          properties: string[],
                          options?: { multiple?: boolean },
                        ) => Promise<Array<{ name?: string[]; tel?: string[] }>>;
                      };
                    };

                    const contactNavigator = navigator as ContactPickerNavigator;
                    const selectContacts = contactNavigator.contacts?.select;

                    if (!window.isSecureContext || !selectContacts) {
                      const inPreview =
                        window.self !== window.top;

                      toast.error(
                        inPreview
                          ? "Contact import is not available inside the Lovable preview. Open Track Debt directly in Chrome on Android to use it."
                          : "Contact import is not supported by this browser. Try Chrome on Android or enter the details manually.",
                      );
                      return;
                    }

                    const contacts = await selectContacts.call(
                      contactNavigator.contacts,
                      ["name", "tel"],
                      { multiple: false },
                    );

                    const contact = contacts?.[0];
                    if (!contact) return;

                    const name = contact.name?.find(Boolean)?.trim() ?? "";
                    const phone = contact.tel?.find(Boolean)?.trim() ?? "";

                    setForm((current) => ({
                      ...current,
                      name: name || current.name,
                      phone: phone
                        ? normalizeForStorage(phone)
                        : current.phone,
                    }));
                  } catch (error) {
                    // Closing the native picker is not an error.
                    if (
                      error instanceof DOMException &&
                      (error.name === "AbortError" || error.name === "NotAllowedError")
                    ) {
                      return;
                    }

                    toast.error(
                      "Could not open contacts. Try entering the details manually.",
                    );
                  }
                }}
                className="w-full flex items-center justify-center gap-2 rounded border border-line bg-paper-raised py-2.5 text-sm font-semibold text-ink mb-5 transition-transform active:scale-[0.99]"
              >
                <Users size={15} /> Import from Contacts
              </button>
            )}

            <Field label="NAME">
              <LocalInput
                initialValue={form.name}
                onBlur={(val) => setForm({ ...form, name: val.trim() })}
                placeholder="e.g. Chidi Electronics"
                className="input-field w-full rounded px-3 py-2.5 text-sm"
              />
            </Field>
            <Field label="WHATSAPP NUMBER">
              <LocalInput
                initialValue={form.phone}
                onBlur={(val) => setForm({ ...form, phone: val.trim() })}
                placeholder="080..."
                inputMode="tel"
                className="input-field w-full rounded px-3 py-2.5 text-sm"
              />
              {form.phone.trim() && !isProbablyValidPhone(form.phone) && (
                <p className="text-[11px] text-debt mt-1.5">
                  That doesn&rsquo;t look like a valid phone number.
                </p>
              )}
            </Field>
            <Field label="NOTES (OPTIONAL)">
              <LocalTextarea
                initialValue={form.notes}
                onBlur={(val) => setForm({ ...form, notes: val.trim() })}
                rows={3}
                placeholder="e.g. Pays every Friday · Don't exceed 30,000"
                className="input-field w-full rounded px-3 py-2.5 text-sm resize-none"
              />
            </Field>

            <button
              onClick={screen === "addCustomer" ? addCustomer : saveCustomerEdit}
              disabled={
                !form.name.trim() || !form.phone.trim() || !isProbablyValidPhone(form.phone)
              }
              className="btn-primary w-full rounded py-3 text-sm font-semibold mt-2 disabled:opacity-40 transition-transform active:scale-[0.99]"
            >
              {screen === "addCustomer" ? "Save customer" : "Save changes"}
            </button>

            {screen === "editCustomer" && selected && (
              <div className="perforated rounded mt-8 p-4">
                {confirmDelete === "customer" ? (
                  <div className="animate-in fade-in duration-150">
                    <p className="text-sm text-ink leading-relaxed">
                      Delete {selected.name} and all {selected.txns.length} transactions? This
                      cannot be undone.
                    </p>
                    <div className="grid grid-cols-2 gap-2 mt-3">
                      <button
                        onClick={() => setConfirmDelete(null)}
                        className="rounded py-2 text-sm font-semibold border border-line bg-paper-raised"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={deleteCustomer}
                        className="rounded py-2 text-sm font-semibold bg-destructive text-destructive-foreground"
                      >
                        Yes, delete
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDelete("customer")}
                    className="w-full flex items-center justify-center gap-2 text-sm font-semibold text-debt py-1"
                  >
                    <Trash2 size={15} /> Delete customer
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ===== ADD / EDIT TRANSACTION ===== */}
        {(screen === "addTxn" || screen === "editTxn") && selected && (
          <div className="p-5 animate-in fade-in slide-in-from-right-2 duration-200">
            <ScreenHeader
              title={`${screen === "editTxn" ? "Edit entry · " : ""}${selected.name}`}
              onClose={() => {
                resetForm();
                setEditingTxnId(null);
                go("detail");
              }}
            />

            <div className="flex rounded overflow-hidden border border-line mb-4">
              {(["sale", "payment"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTxnType(t)}
                  className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${
                    txnType === t ? "bg-ink text-paper-raised" : "bg-paper-raised text-ink-soft"
                  }`}
                >
                  {t === "sale" ? "Credit sale" : "Payment"}
                </button>
              ))}
            </div>

            {txnType === "payment" && (
              <div className="grid grid-cols-2 gap-2 mb-4 animate-in fade-in duration-150">
                {(
                  [
                    ["full", "Full payment"],
                    ["partial", "Partial payment"],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    onClick={() => {
                      setPayKind(k);
                      if (k === "full")
                        setForm((f) => ({
                          ...f,
                          amount: String(Math.max(balanceOf(selected), 0)),
                        }));
                    }}
                    className={`rounded py-2 text-[13px] font-semibold border transition-colors ${
                      payKind === k
                        ? "border-paid text-paid bg-paper-raised"
                        : "border-line text-ink-soft bg-paper-raised"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            <Field label={`AMOUNT (${getCurrency(profile.currency).symbol})`}>
              <LocalInput
                initialValue={form.amount}
                onBlur={(val) => setForm({ ...form, amount: val })}
                transform={(val) => val.replace(/[^0-9.]/g, "")}
                placeholder="0"
                inputMode="decimal"
                className="input-field mono w-full rounded px-3 py-3 text-2xl font-bold"
              />
            </Field>
            <Field label="NOTE (OPTIONAL)">
              <LocalInput
                initialValue={form.note}
                onBlur={(val) => setForm({ ...form, note: val.trim() })}
                placeholder={txnType === "sale" ? "e.g. 2 bags cement" : "e.g. part payment"}
                className="input-field w-full rounded px-3 py-2.5 text-sm"
              />
            </Field>

            {txnType === "sale" && (
              <Field label="PAYMENT TERMS">
                <div className="flex flex-wrap gap-1.5">
                  {TERM_OPTIONS.map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setTermKey(opt.key)}
                      className={`rounded-full px-3 py-1.5 text-[12px] font-semibold border transition-colors ${
                        termKey === opt.key
                          ? "bg-ink text-paper-raised border-ink"
                          : "bg-paper-raised text-ink-soft border-line"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {termKey === "custom" && (
                  <input
                    type="date"
                    value={customDueDate}
                    min={todayISO()}
                    onChange={(e) => setCustomDueDate(e.target.value)}
                    className="input-field w-full rounded px-3 py-2.5 text-sm mt-2.5"
                  />
                )}
                {termKey !== "none" && (
                  <p className="text-[11px] text-ink-soft mt-2">
                    {(() => {
                      const d = termDueDate(termKey, customDueDate);
                      return d ? `Due ${fmtDate(d)}` : "Pick a custom date above.";
                    })()}
                  </p>
                )}
              </Field>
            )}

            <p className="text-[11px] text-ink-soft mb-5">
              Current balance {money(Math.max(balanceOf(selected), 0))} · balances recalculate
              automatically.
            </p>

            <button
              onClick={screen === "editTxn" ? saveTxnEdit : addTxn}
              disabled={!parseFloat(form.amount)}
              className="btn-primary w-full rounded py-3 text-sm font-semibold disabled:opacity-40 transition-transform active:scale-[0.99]"
            >
              {screen === "editTxn" ? "Save changes" : "Save entry"}
            </button>

            {screen === "editTxn" && editingTxnId && (
              <div className="perforated rounded mt-6 p-4">
                {confirmDelete === editingTxnId ? (
                  <div className="animate-in fade-in duration-150">
                    <p className="text-sm text-ink">Delete this entry permanently?</p>
                    <div className="grid grid-cols-2 gap-2 mt-3">
                      <button
                        onClick={() => setConfirmDelete(null)}
                        className="rounded py-2 text-sm font-semibold border border-line bg-paper-raised"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => {
                          deleteTxn(editingTxnId);
                          setEditingTxnId(null);
                          resetForm();
                          go("detail");
                        }}
                        className="rounded py-2 text-sm font-semibold bg-destructive text-destructive-foreground"
                      >
                        Yes, delete
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDelete(editingTxnId)}
                    className="w-full flex items-center justify-center gap-2 text-sm font-semibold text-debt py-1"
                  >
                    <Trash2 size={15} /> Delete entry
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ===== DETAIL ===== */}
        {screen === "detail" && selected && (
          <div className="animate-in fade-in duration-200">
            <header className="px-5 pt-9 pb-6 border-b border-line bg-paper-raised">
              <div className="flex items-center gap-3">
                <button onClick={() => go("list")} aria-label="Back">
                  <ArrowLeft size={20} />
                </button>
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold text-lg leading-tight truncate">{selected.name}</h2>
                  <p className="mono text-[11px] text-ink-soft mt-0.5">{selected.phone}</p>
                </div>
                <button
                  onClick={() => {
                    setForm({
                      ...emptyForm,
                      name: selected.name,
                      phone: selected.phone,
                      notes: selected.notes,
                    });
                    go("editCustomer");
                  }}
                  aria-label="Edit customer"
                  className="text-ink-soft"
                >
                  <Pencil size={16} />
                </button>
              </div>

              {selected.notes && (
                <p className="mt-4 flex gap-2 text-[12px] text-ink-soft leading-relaxed">
                  <StickyNote size={14} className="shrink-0 mt-0.5" />
                  <span className="whitespace-pre-line">{selected.notes}</span>
                </p>
              )}

              <div className="perforated rounded mt-5 p-4 text-center">
                <p className="mono text-[10px] tracking-widest text-ink-soft">BALANCE</p>
                <p
                  className={`mono text-3xl font-bold mt-1.5 ${
                    balanceOf(selected) > 0 ? "text-debt" : "text-paid"
                  }`}
                >
                  {money(Math.abs(balanceOf(selected)))}
                </p>
                <p className="text-[11px] text-ink-soft mt-1.5">
                  {balanceOf(selected) > 0 ? "owed to you" : "settled"}
                </p>
                {balanceOf(selected) > 0 && (
                  <div className="flex items-center justify-center gap-2 mt-2.5">
                    <DueBadge info={dueInfoOf(selected)} />
                  </div>
                )}
                {balanceOf(selected) > 0 && dueInfoOf(selected).dueDate && (
                  <p className="mono text-[11px] text-ink-soft mt-1.5">
                    Due {dueDateLong(selected)}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 mt-4">
                <button
                  onClick={() => {
                    setTxnType("sale");
                    resetForm();
                    go("addTxn");
                  }}
                  className="btn-primary rounded py-2.5 text-sm font-semibold transition-transform active:scale-[0.98]"
                >
                  + Credit sale
                </button>
                <button
                  onClick={() => {
                    setTxnType("payment");
                    setPayKind("partial");
                    resetForm();
                    go("addTxn");
                  }}
                  className="rounded py-2.5 text-sm font-semibold perforated bg-paper-raised text-paid transition-transform active:scale-[0.98]"
                >
                  + Payment
                </button>
              </div>

              <button
                onClick={() => startVoice("txn")}
                className="w-full mt-2 rounded py-2.5 text-sm font-semibold flex items-center justify-center gap-2 border border-line bg-paper-raised text-ink transition-transform active:scale-[0.98]"
              >
                <Mic size={16} /> Record with Voice
              </button>


              {balanceOf(selected) > 0 && (
                <button
                  onClick={openReminder}
                  className="btn-wa mt-2 rounded py-2.5 text-sm font-semibold flex items-center justify-center gap-2 w-full transition-transform active:scale-[0.99]"
                >
                  <MessageCircle size={16} /> Send reminder on WhatsApp
                </button>
              )}
              {selected.txns.length > 0 && (
                <div className="mt-3">
                  <p className="mono text-[10px] tracking-widest text-ink-soft mb-1.5 flex items-center gap-1.5">
                    <FileText size={11} /> CUSTOMER STATEMENT
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    <a
                      href={waLink(selected.phone, statementMessage(selected, profile))}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded py-2.5 text-[12px] font-semibold flex items-center justify-center gap-1.5 border border-line bg-paper-raised text-ink"
                    >
                      <Receipt size={14} /> WhatsApp
                    </a>
                    <button
                      onClick={() => downloadReceipt("statement")}
                      className="rounded py-2.5 text-[12px] font-semibold flex items-center justify-center gap-1.5 border border-line bg-paper-raised text-ink"
                    >
                      <Download size={14} /> PDF
                    </button>
                    <button
                      onClick={() => copySummary("statement")}
                      className="rounded py-2.5 text-[12px] font-semibold flex items-center justify-center gap-1.5 border border-line bg-paper-raised text-ink"
                    >
                      <Copy size={14} /> Copy
                    </button>
                  </div>
                </div>
              )}
            </header>

            <section>
              <p className="mono text-[10px] tracking-widest text-ink-soft px-5 pt-5 pb-2">
                HISTORY
              </p>
              {selected.txns.length === 0 && (
                <div className="px-8 py-12 text-center">
                  <span className="mx-auto h-12 w-12 rounded-full perforated grid place-items-center text-ink-soft">
                    <Receipt size={20} />
                  </span>
                  <p className="text-sm font-semibold mt-4">No entries yet</p>
                  <p className="text-[12px] text-ink-soft mt-1.5">
                    Record a credit sale or a payment to start this customer's ledger.
                  </p>
                </div>
              )}
              {[...selected.txns].reverse().map((t) => (
                <div
                  key={t.id}
                  className="ledger-row flex items-start justify-between px-5 py-3.5 gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium flex items-center gap-2">
                      {t.type === "sale"
                        ? "Credit sale"
                        : t.kind === "partial"
                          ? "Partial payment"
                          : "Full payment"}
                      {t.type === "sale" && t.term?.dueDate && (
                        <DueBadge
                          info={dueInfoOfTxn(
                            t,
                            openSales(selected).find((o) => o.txn.id === t.id)?.outstanding ?? 0,
                          )}
                        />
                      )}
                    </p>
                    <p className="text-[11px] text-ink-soft mt-1 truncate">
                      {fmtDate(t.date)}
                      {t.note ? ` · ${t.note}` : ""}
                    </p>
                    <span className="flex items-center gap-3 mt-1.5">
                      <a
                        href={waLink(selected.phone, receiptMessage(selected, t, profile))}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] font-semibold text-wa inline-flex items-center gap-1"
                      >
                        <Receipt size={12} /> Receipt
                      </a>
                      <button
                        onClick={() => downloadReceipt(t.type, t)}
                        className="text-[11px] font-semibold text-ink-soft inline-flex items-center gap-1"
                      >
                        <Download size={12} /> PDF
                      </button>
                    </span>
                    {confirmDelete === t.id && (
                      <span className="flex items-center gap-2 mt-2 animate-in fade-in duration-150">
                        <button
                          onClick={() => deleteTxn(t.id)}
                          className="rounded px-2.5 py-1 text-[11px] font-semibold bg-destructive text-destructive-foreground"
                        >
                          Delete
                        </button>
                        <button
                          onClick={() => setConfirmDelete(null)}
                          className="rounded px-2.5 py-1 text-[11px] font-semibold border border-line"
                        >
                          Cancel
                        </button>
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <p
                      className={`mono text-sm font-bold ${
                        t.type === "sale" ? "text-debt" : "text-paid"
                      }`}
                    >
                      {t.type === "sale" ? "+" : "−"}
                      {money(t.amount)}
                    </p>
                    <button
                      onClick={() => openEditTxn(t)}
                      aria-label="Edit entry"
                      className="text-ink-soft"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => setConfirmDelete(t.id)}
                      aria-label="Delete entry"
                      className="text-ink-soft"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </section>
          </div>
        )}

        {/* ===== REMINDER PREVIEW ===== */}
        {screen === "reminder" && selected && (
          <div className="p-5 animate-in fade-in slide-in-from-right-2 duration-200">
            <ScreenHeader title="Reminder preview" onClose={() => go("detail")} />

            <div className="rounded border border-line bg-paper-raised p-4 mb-5">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-[15px] truncate">{selected.name}</p>
                <DueBadge info={dueInfoOf(selected)} />
              </div>
              <p className="mono text-xl font-bold text-debt mt-1.5">
                {money(Math.max(balanceOf(selected), 0))}
              </p>
              <p className="text-[11px] text-ink-soft mt-0.5">{dueDateLong(selected)}</p>
            </div>

            <p className="mono text-[11px] tracking-widest text-ink-soft mb-2">TEMPLATE</p>
            <select
              value={reminderTemplate}
              onChange={(e) => selectTemplate(templateById(e.target.value as TemplateId))}
              className="input-field w-full rounded px-3 py-2.5 text-sm mb-5"
            >
              {REMINDER_TEMPLATES.map((tpl) => (
                <option key={tpl.id} value={tpl.id}>
                  {tpl.name}
                  {tpl.tier === "pro" ? " (Pro)" : ""}
                </option>
              ))}
            </select>

            <button
              onClick={generateWithAI}
              disabled={aiLoading}
              className="w-full flex items-center justify-center gap-2 rounded py-2.5 text-sm font-semibold border border-line bg-paper-raised text-ink mb-1 disabled:opacity-50 transition-transform active:scale-[0.99]"
            >
              <Sparkles size={15} /> {aiLoading ? "Generating…" : "Generate with AI"}
            </button>
            {aiError && <p className="text-[11px] text-debt mt-1 mb-2">{aiError}</p>}

            <p className="mono text-[11px] tracking-widest text-ink-soft mb-2 mt-5">MESSAGE</p>
            <textarea
              value={reminderMessage}
              onChange={(e) => setReminderMessage(e.target.value)}
              rows={8}
              className="input-field w-full rounded px-3 py-2.5 text-sm resize-none mb-5 leading-relaxed"
            />

            <button
              onClick={sendReminder}
              disabled={!reminderMessage.trim()}
              className="btn-wa w-full rounded py-3 text-sm font-semibold flex items-center justify-center gap-2 mb-2 disabled:opacity-40 transition-transform active:scale-[0.99]"
            >
              <MessageCircle size={16} /> Send via WhatsApp
            </button>
            <button
              onClick={() => go("detail")}
              className="w-full rounded py-2.5 text-sm font-semibold border border-line bg-paper-raised text-ink-soft"
            >
              Cancel
            </button>
          </div>
        )}

        {gateFeature && (
          <PremiumGate
            title={gateFeature.title}
            description={gateFeature.description}
            onClose={() => setGateFeature(null)}
          />
        )}

        {/* ===== VOICE ASSISTANCE OVERLAYS ===== */}
        {voiceActive && (
          <div className="fixed inset-0 z-[60] bg-ink/90 flex flex-col items-center justify-center text-paper-raised p-8">
            <div className="h-24 w-24 rounded-full bg-debt flex items-center justify-center animate-pulse mb-8">
              <Mic size={40} />
            </div>
            <h3 className="text-xl font-bold mb-2">Listening...</h3>
            <p className="text-center text-paper-raised/60">Say something like: "Add a new customer named Chidi" or "Record a sale of 5000 money for Amaka."</p>
            <button
              onClick={() => setVoiceOverlay(false)}
              className="mt-12 text-sm font-semibold underline opacity-70"
            >
              Cancel
            </button>
          </div>
        )}

        {voiceReview && (
          <div className="fixed inset-0 z-[60] bg-ink/40 flex items-end justify-center p-4">
            <div className="w-full max-w-[430px] rounded-xl bg-paper-raised border border-line p-6 shadow-2xl animate-in slide-in-from-bottom-8">
              <div className="flex justify-between items-start mb-6">
                <h3 className="text-lg font-bold">Review {voiceReview.type === "customer" ? "Customer" : "Transaction"}</h3>
                <button onClick={() => setVoiceReview(null)}><X size={20} /></button>
              </div>

              <div className="space-y-4 mb-8 bg-paper p-4 rounded-lg border border-line">
                {voiceReview.type === "customer" ? (
                  <>
                    <div className="flex justify-between border-b border-line pb-2">
                      <span className="text-[11px] font-bold text-ink-soft uppercase">Name</span>
                      <span className="font-semibold">{voiceReview.data.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[11px] font-bold text-ink-soft uppercase">Phone</span>
                      <span className="font-semibold mono">{voiceReview.data.phone}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between border-b border-line pb-2">
                      <span className="text-[11px] font-bold text-ink-soft uppercase">Amount</span>
                      <span className="font-bold text-debt">{money(voiceReview.data.amount)}</span>
                    </div>
                    <div className="flex justify-between border-b border-line pb-2">
                      <span className="text-[11px] font-bold text-ink-soft uppercase">Note</span>
                      <span className="font-semibold">{voiceReview.data.note}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[11px] font-bold text-ink-soft uppercase">Terms</span>
                      <span className="font-semibold">
                        {TERM_OPTIONS.find(o => o.key === voiceReview.data.termKey)?.label}
                      </span>
                    </div>
                  </>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    if (voiceReview.type === "customer") {
                      setForm({ ...emptyForm, name: voiceReview.data.name, phone: voiceReview.data.phone, notes: voiceReview.data.notes });
                      go("addCustomer");
                    } else {
                      setForm({ ...emptyForm, amount: voiceReview.data.amount, note: voiceReview.data.note });
                      setTermKey(voiceReview.data.termKey);
                      go("addTxn");
                    }
                    setVoiceReview(null);
                  }}
                  className="rounded-lg py-3 text-sm font-semibold border border-line bg-paper"
                >
                  Edit Details
                </button>
                <button
                  onClick={() => {
                    if (voiceReview.type === "customer") applyVoiceCustomer();
                    else applyVoiceTxn();
                  }}
                  className="btn-primary rounded-lg py-3 text-sm font-semibold"
                >
                  Save {voiceReview.type === "customer" ? "Customer" : "Debt"}
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    </AppShell>
  );
}
