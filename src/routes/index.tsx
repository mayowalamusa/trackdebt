import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
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
  initNotifications,
  reconcileDebtReminders,
  requestPermissions,
  setupNotificationListeners,
  cancelDebtReminders,
  scheduleDebtReminders,
  scheduleDailyReminder,
} from "@/lib/notifications";

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
  | "notifications"
  | "notificationSettings"
  | "backup"
  | "about"
  | "privacy"
  | "terms"
  | "redeem";


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

  useEffect(() => {
    console.log("[TRACK-DEBT-DIAGNOSTIC] Heartbeat started");
    const timer = setInterval(() => {
      const info = {
        width: window.innerWidth,
        height: window.innerHeight,
        active: document.activeElement?.tagName,
        activeId: document.activeElement?.id,
      };
      console.log("[TRACK-DEBT-HEARTBEAT] JS alive " + Date.now() + " " + JSON.stringify(info));
    }, 1000);
    return () => clearInterval(timer);
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

  useEffect(() => {
    if (loaded) {
      initNotifications();
      // Safeguard: Wait for the initial rendering and focus cycle to settle
      // before running heavy reconciliation logic.
      const timer = setTimeout(() => {
        reconcileDebtReminders(customers, notifSettings, profile, inAppNotifs, setInAppNotifs);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [loaded]);

  // Handle notification actions
  useEffect(() => {
    if (loaded) {
      setupNotificationListeners((action) => {
        console.log("[TrackDebt Notifications] Action performed:", action);
        const { debtId, customerId, type } = action.notification.extra;

        if (type === "daily_record_reminder") {
          // Open the list screen and show a tip?
          // The prompt says "open directly to the existing screen/form used to create a new debt record".
          // This requires a customer. Let's see if we can pick the most recent customer or just go to list.
          go("list");
          toast("Tap a customer to record a sale.");
          return;
        }

        if (customerId) {
          setSelectedId(customerId);
          go("detail");
          // Mark as read
          setInAppNotifs((prev) =>
            prev.map((n) =>
              n.debtId === debtId ? { ...n, read: true } : n
            )
          );
        }
      });
    }
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

  const setP = (patch: Partial<BusinessProfile>) => setProfile((p) => ({ ...p, ...patch }));

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
    if (tpl.tier === "pro" && !isPro(sub)) {
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

    // Simulate API call for code validation
    setTimeout(() => {
      const code = promoCode.trim().toUpperCase();
      let newPromo = null;

      if (code === "PLUS30") {
        newPromo = { plan: "plus" as const, expiresAt: addDaysISO(30), code };
      } else if (code === "PREMIUM30") {
        newPromo = { plan: "premium" as const, expiresAt: addDaysISO(30), code };
      }

      if (newPromo) {
        setPromo(newPromo);
        toast.success(`Congratulations! You've unlocked 30 days of Track Debt ${newPromo.plan === "plus" ? "Plus" : "Premium"}.`);
        track("promo_redeemed", { code, plan: newPromo.plan });
        go("settings");
      } else {
        toast.error("Invalid promo code. Please check and try again.");
      }

      setRedeeming(false);
      setPromoCode("");
    }, 1000);
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

              <p className="mono text-[10px] tracking-[0.2em] text-ink-soft mt-6">
                OUTSTANDING BALANCE
              </p>
              <p className="mono text-[2.6rem] leading-none font-bold text-debt mt-2">
                {naira(stats.outstanding)}
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
                  value={naira(stats.collections)}
                  tone="paid"
                />
                <Stat
                  icon={<TrendingDown size={13} />}
                  label="Credit sales (mo.)"
                  value={naira(stats.creditSales)}
                  tone="debt"
                />
              </div>
              <div className="mt-4 p-4 border-2 border-dashed border-debt bg-white/50 rounded-lg z-[100] relative">
                <p className="text-[10px] font-bold text-debt mb-2">DIAGNOSTIC TEST INPUT</p>
                <input
                  type="text"
                  placeholder="Tap here to test input"
                  className="w-full p-3 border-2 border-debt rounded bg-white text-ink text-base"
                  style={{ caretColor: "red" }}
                  onFocus={() => console.log("[TRACK-DEBT-DIAG] Focus")}
                  onBlur={() => console.log("[TRACK-DEBT-DIAG] Blur")}
                  onInput={(e) => console.log("[TRACK-DEBT-DIAG] Input: " + (e.target as HTMLInputElement).value)}
                  onChange={(e) => console.log("[TRACK-DEBT-DIAG] Change: " + e.target.value)}
                  onKeyDown={(e) => console.log("[TRACK-DEBT-DIAG] KeyDown: " + e.key)}
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
                    <input
                      value={query}
                      onPointerDown={() => console.log("[TRACK-DEBT-INPUT] pointerdown")}
                      onFocus={() => console.log("[TRACK-DEBT-INPUT] focus")}
                      onBlur={() => console.log("[TRACK-DEBT-INPUT] blur")}
                      onInput={(e) => console.log("[TRACK-DEBT-INPUT] input", (e.target as HTMLInputElement).value)}
                      onBeforeInput={(e) => console.log("[TRACK-DEBT-INPUT] beforeinput", (e as any).data)}
                      onKeyDown={(e) => console.log("[TRACK-DEBT-INPUT] keydown", e.key)}
                      onChange={(e) => {
                        console.log("SEARCH INPUT onChange:", JSON.stringify(e.target.value));
                        setQuery(e.target.value);
                      }}
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
                  {filtered.map((c) => {
                    const bal = balanceOf(c);
                    return (
                      <button
                        key={c.id}
                        onClick={() => {
                          setSelectedId(c.id);
                          setOnboarding((o) => ({ ...o, tips: { ...o.tips, openCustomer: true } }));
                          go("detail");
                        }}
                        className="ledger-row w-full flex items-center justify-between px-5 py-3.5 text-left gap-3 transition-colors active:bg-muted"
                      >
                        <span className="min-w-0">
                          <span className="block font-semibold text-[15px] text-ink truncate">
                            {c.name}
                          </span>
                          <span className="text-[11px] text-ink-soft mt-1 flex items-center gap-2">
                            <span>last activity {fmtDate(lastActivity(c))}</span>
                            <DueBadge info={dueInfoOf(c)} />
                          </span>
                        </span>
                        <span
                          className={`mono text-sm font-bold shrink-0 ${
                            bal > 0 ? "text-debt" : bal < 0 ? "text-paid" : "text-ink-soft"
                          }`}
                        >
                          {bal === 0 ? "settled" : naira(Math.abs(bal))}
                        </span>
                      </button>
                    );
                  })}
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
              <input
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value)}
                placeholder="e.g. PLUS30"
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
              <input
                value={profile.name}
                onChange={(e) => setP({ name: e.target.value })}
                placeholder="e.g. Amaka Provisions"
                className="input-field w-full rounded px-3 py-2.5 text-sm"
              />
            </Field>
            <Field label="PHONE">
              <input
                value={profile.phone}
                onChange={(e) => setP({ phone: e.target.value })}
                inputMode="tel"
                placeholder="080..."
                className="input-field w-full rounded px-3 py-2.5 text-sm"
              />
            </Field>
            <Field label="EMAIL">
              <input
                value={profile.email}
                onChange={(e) => setP({ email: e.target.value })}
                inputMode="email"
                placeholder="you@business.com"
                className="input-field w-full rounded px-3 py-2.5 text-sm"
              />
            </Field>
            <Field label="ADDRESS">
              <textarea
                value={profile.address}
                onChange={(e) => setP({ address: e.target.value })}
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

            <p className="mono text-[11px] tracking-widest text-ink-soft mt-6 mb-3">
              PAYMENT DETAILS (OPTIONAL)
            </p>
            <Field label="BANK NAME">
              <input
                value={profile.bankName}
                onChange={(e) => setP({ bankName: e.target.value })}
                placeholder="e.g. GTBank"
                className="input-field w-full rounded px-3 py-2.5 text-sm"
              />
            </Field>
            <Field label="ACCOUNT NUMBER">
              <input
                value={profile.accountNumber}
                onChange={(e) => setP({ accountNumber: e.target.value })}
                inputMode="numeric"
                placeholder="0123456789"
                className="input-field w-full rounded px-3 py-2.5 text-sm mono"
              />
            </Field>
            <Field label="ACCOUNT NAME">
              <input
                value={profile.accountName}
                onChange={(e) => setP({ accountName: e.target.value })}
                placeholder="e.g. Chidi Provisions Store"
                className="input-field w-full rounded px-3 py-2.5 text-sm"
              />
            </Field>
            <p className="text-[11px] text-ink-soft leading-relaxed -mt-1 mb-2">
              Included automatically in every reminder so customers know where to pay.
            </p>

            <p className="text-[11px] text-ink-soft leading-relaxed mt-2 mb-6">
              These details appear on your receipts, statements and WhatsApp reminders. Everything
              is saved on this device only.
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
                          onClick={() => setNotifSettings((s) => ({ ...s, [key]: !s[key as keyof typeof s] }))}
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

            <p className="text-[13px] leading-relaxed text-ink-soft mb-5">
              Your Track Debt data is stored on this device. Back up your data regularly so you can
              restore it if you change devices or lose app data.
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

        {/* ===== PRIVACY POLICY ===== */}
        {screen === "privacy" && (
          <div className="p-5 animate-in fade-in slide-in-from-right-2 duration-200">
            <ScreenHeader title="Privacy Policy" onClose={() => go("settings")} />
            <div className="space-y-4 text-[13px] leading-relaxed text-ink-soft pb-8">
              <p>
                {APP_NAME} is built around a simple principle: your business data belongs to you.
              </p>
              <p>
                <strong className="text-ink">Local storage.</strong> Your business profile,
                customers, transactions and reminder history are stored only on this device. None of
                it is uploaded to a server or shared with third parties by default.
              </p>
              <p>
                <strong className="text-ink">AI reminders.</strong> When you use "Generate with AI,"
                a limited set of details for that one message — customer name, amounts, due date and
                payment status — is sent to our AI provider solely to draft the message text. Phone
                numbers are never included in that request.
              </p>
              <p>
                <strong className="text-ink">WhatsApp.</strong> Sending a reminder or receipt opens
                WhatsApp with a pre-filled message. {APP_NAME} does not have access to your WhatsApp
                account and cannot confirm whether a message was actually delivered.
              </p>
              <p>
                <strong className="text-ink">Track Debt Pro.</strong> If you subscribe, payment
                processing is handled by our billing provider (e.g. Google Play or Paystack) —
                {" " + APP_NAME} never sees or stores your card details.
              </p>
              <p>
                <strong className="text-ink">Your control.</strong> Uninstalling the app or clearing
                its storage permanently deletes your local data. We recommend keeping your own
                backups of anything important.
              </p>
              <p>Questions about this policy can be sent to {SUPPORT_EMAIL}.</p>
            </div>
          </div>
        )}

        {/* ===== TERMS OF USE ===== */}
        {screen === "terms" && (
          <div className="p-5 animate-in fade-in slide-in-from-right-2 duration-200">
            <ScreenHeader title="Terms of Use" onClose={() => go("settings")} />
            <div className="space-y-4 text-[13px] leading-relaxed text-ink-soft pb-8">
              <p>By using {APP_NAME}, you agree to the following:</p>
              <p>
                <strong className="text-ink">The app is a record-keeping tool.</strong> {APP_NAME}{" "}
                helps you track credit sales, payments and reminders you choose to send. It does not
                extend credit, collect debts on your behalf, or guarantee that any customer will
                pay.
              </p>
              <p>
                <strong className="text-ink">You're responsible for your data.</strong> Since
                records are stored on your device, you're responsible for keeping your phone secure
                and for backing up information you don't want to lose.
              </p>
              <p>
                <strong className="text-ink">Reminders and receipts.</strong> Messages generated by{" "}
                {APP_NAME}, including AI-drafted reminders, are provided as a convenience. Review
                any message before sending — you are responsible for what you send to your
                customers.
              </p>
              <p>
                <strong className="text-ink">Track Debt Pro.</strong> Subscription pricing, billing
                cycles and cancellation are handled by the billing provider used at checkout. Pro
                features remain available for the period you've paid for; if a subscription lapses,
                your account returns to the Free plan and your local data is left untouched.
              </p>
              <p>
                <strong className="text-ink">No warranty.</strong> {APP_NAME} is provided "as is."
                We work to keep it reliable, but we're not liable for losses arising from its use,
                including data loss, missed payments, or reminders that weren't delivered.
              </p>
              <p>Questions about these terms can be sent to {SUPPORT_EMAIL}.</p>
            </div>
          </div>
        )}

        {/* ===== ADD / EDIT CUSTOMER ===== */}
        {(screen === "addCustomer" || screen === "editCustomer") && (
          <div className="p-5 animate-in fade-in slide-in-from-right-2 duration-200">
            <ScreenHeader
              title={screen === "addCustomer" ? "New customer" : "Edit customer"}
              onClose={() => {
                resetForm();
                go(screen === "addCustomer" ? "list" : "detail");
              }}
            />

            <Field label="NAME">
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Chidi Electronics"
                className="input-field w-full rounded px-3 py-2.5 text-sm"
              />
            </Field>
            <Field label="WHATSAPP NUMBER">
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
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
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={3}
                placeholder="e.g. Pays every Friday · Don't exceed ₦30,000"
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

            <Field label="AMOUNT (₦)">
              <input
                value={form.amount}
                onChange={(e) =>
                  setForm({ ...form, amount: e.target.value.replace(/[^0-9.]/g, "") })
                }
                placeholder="0"
                inputMode="decimal"
                className="input-field mono w-full rounded px-3 py-3 text-2xl font-bold"
              />
            </Field>
            <Field label="NOTE (OPTIONAL)">
              <input
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
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
              Current balance {naira(Math.max(balanceOf(selected), 0))} · balances recalculate
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
                  {naira(Math.abs(balanceOf(selected)))}
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
                      {naira(t.amount)}
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
                {naira(Math.max(balanceOf(selected), 0))}
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
            <p className="text-center text-paper-raised/60">Say something like: "Add a new customer named Chidi" or "Record a sale of 5000 naira for Amaka."</p>
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
                      <span className="font-bold text-debt">{naira(voiceReview.data.amount)}</span>
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

