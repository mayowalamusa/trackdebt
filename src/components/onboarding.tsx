import { useState, useEffect, type Dispatch, type SetStateAction } from "react";
import { Camera, Check } from "lucide-react";
import {
  APP_NAME,
  BUSINESS_CATEGORIES,
  TERM_OPTIONS,
  termDueDate,
  todayISO,
  type BusinessProfile,
  type Customer,
  type TermKey,
  type Txn,
} from "@/lib/ledger";
import { issueReceiptReference } from "@/lib/use-ledger-storage";
import { Field } from "@/components/ui-kit";

function LocalInput({
  initialValue,
  onBlur,
  ...props
}: {
  initialValue: string;
  onBlur: (val: string) => void;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  const [val, setVal] = useState(initialValue);
  useEffect(() => setVal(initialValue), [initialValue]);

  return (
    <input
      {...props}
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={() => onBlur(val)}
    />
  );
}

type Step = "welcome" | "business" | "customer" | "sale" | "done";

const STEP_TITLES: Record<"business" | "customer" | "sale", string> = {
  business: "Tell us about your business",
  customer: "Add your first customer",
  sale: "Record your first credit sale",
};

export function Onboarding({
  profile,
  setProfile,
  setCustomers,
  onDone,
}: {
  profile: BusinessProfile;
  setProfile: Dispatch<SetStateAction<BusinessProfile>>;
  setCustomers: Dispatch<SetStateAction<Customer[]>>;
  onDone: () => void;
}) {
  const [step, setStep] = useState<Step>("welcome");
  const [biz, setBiz] = useState(profile);

  const [custName, setCustName] = useState("");
  const [custPhone, setCustPhone] = useState("");
  const [custNotes, setCustNotes] = useState("");
  const [newCustomerId, setNewCustomerId] = useState<string | null>(null);

  const [amount, setAmount] = useState("");
  const [desc, setDesc] = useState("");
  const [termKey, setTermKey] = useState<TermKey>("none");
  const [customDueDate, setCustomDueDate] = useState("");

  const onLogo = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setBiz((b) => ({ ...b, logo: String(reader.result) }));
    reader.readAsDataURL(file);
  };

  const skipAll = () => {
    onDone();
  };

  const continueBusiness = () => {
    if (!biz.name.trim()) return;
    setProfile((p) => ({ ...p, ...biz, name: biz.name.trim() }));
    setStep("customer");
  };

  const continueCustomer = () => {
    if (!custName.trim() || !custPhone.trim()) return;
    const id = "c" + Date.now();
    setCustomers((cs) => [
      ...cs,
      {
        id,
        name: custName.trim(),
        phone: custPhone.trim(),
        notes: custNotes.trim(),
        createdAt: todayISO(),
        txns: [],
      },
    ]);
    setNewCustomerId(id);
    setStep("sale");
  };

  const finishSetup = () => {
    const amt = parseFloat(amount);
    if (amt > 0 && newCustomerId) {
      const dueDate = termDueDate(termKey, customDueDate);
      setCustomers((cs) =>
        cs.map((c) => {
          if (c.id !== newCustomerId) return c;
          const t: Txn = {
            id: "t" + Date.now(),
            type: "sale",
            amount: amt,
            date: todayISO(),
            note: desc.trim(),
            reference: issueReceiptReference(),
            ...(dueDate
              ? { term: { key: termKey, dueDate, setAt: new Date().toISOString() } }
              : {}),
          };
          return { ...c, txns: [...c.txns, t] };
        }),
      );
    }
    setStep("done");
  };

  const stepNumber = step === "business" ? 1 : step === "customer" ? 2 : step === "sale" ? 3 : 0;

  return (
    <main className="min-h-screen bg-background flex justify-center">
      <div className="w-full max-w-[430px] min-h-screen bg-paper relative flex flex-col">
        {/* ===== WELCOME ===== */}
        {step === "welcome" && (
          <div className="flex-1 flex flex-col justify-between p-6 pt-16 pb-8 animate-in fade-in duration-300">
            <div className="flex flex-col items-center text-center mt-8">
              <div className="h-20 w-20 rounded-[22px] bg-debt grid place-items-center shadow-sm">
                <svg viewBox="0 0 512 512" className="h-12 w-12" aria-hidden="true">
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
              <h1 className="mt-6 text-2xl font-bold">Welcome to {APP_NAME}</h1>
              <p className="mt-2 text-[15px] font-semibold text-debt">
                Never lose money to customer credit again.
              </p>
              <p className="mt-4 text-sm text-ink-soft leading-relaxed max-w-[320px]">
                Track customer credit sales, send payment reminders, monitor outstanding balances
                and manage your business with confidence.
              </p>
            </div>

            <div className="flex flex-col gap-2.5 mt-10">
              <button
                onClick={() => setStep("business")}
                className="btn-primary w-full rounded py-3.5 text-sm font-semibold transition-transform active:scale-[0.99]"
              >
                Get Started
              </button>
              <button
                onClick={skipAll}
                className="w-full rounded py-3 text-sm font-semibold text-ink-soft"
              >
                Skip Setup
              </button>
            </div>
          </div>
        )}

        {/* ===== STEPS 1-3 ===== */}
        {(step === "business" || step === "customer" || step === "sale") && (
          <div className="flex-1 flex flex-col p-6 pt-10 animate-in fade-in slide-in-from-right-2 duration-200">
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <p className="mono text-[11px] tracking-widest text-ink-soft">
                  STEP {stepNumber} OF 3
                </p>
              </div>
              <div className="h-1.5 w-full rounded-full bg-line overflow-hidden">
                <div
                  className="h-full rounded-full bg-debt transition-all duration-300"
                  style={{ width: `${(stepNumber / 3) * 100}%` }}
                />
              </div>
              <h2 className="mt-5 text-xl font-bold">{STEP_TITLES[step]}</h2>
            </div>

            <div className="flex-1">
              {step === "business" && (
                <>
                  <div className="flex justify-center mb-5">
                    <button
                      type="button"
                      onClick={() => document.getElementById("ob-logo-input")?.click()}
                      className="h-20 w-20 rounded-full perforated grid place-items-center text-ink-soft overflow-hidden"
                    >
                      {biz.logo ? (
                        <img
                          src={biz.logo}
                          alt=""
                          className="h-full w-full object-cover rounded-full"
                        />
                      ) : (
                        <Camera size={22} />
                      )}
                    </button>
                    <input
                      id="ob-logo-input"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => onLogo(e.target.files?.[0])}
                    />
                  </div>

                  <Field label="BUSINESS NAME">
                    <LocalInput
                      initialValue={biz.name}
                      onBlur={(val) => setBiz((b) => ({ ...b, name: val.trim() }))}
                      placeholder="e.g. Chidi Provisions Store"
                      className="input-field w-full rounded px-3 py-2.5 text-sm"
                    />
                  </Field>
                  <Field label="BUSINESS PHONE">
                    <LocalInput
                      initialValue={biz.phone}
                      onBlur={(val) => setBiz((b) => ({ ...b, phone: val.trim() }))}
                      placeholder="080..."
                      inputMode="tel"
                      className="input-field w-full rounded px-3 py-2.5 text-sm"
                    />
                  </Field>
                  <Field label="BUSINESS CATEGORY">
                    <div className="flex flex-wrap gap-1.5">
                      {BUSINESS_CATEGORIES.map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setBiz((b) => ({ ...b, category: cat }))}
                          className={`rounded-full px-3 py-1.5 text-[12px] font-semibold border transition-colors ${
                            biz.category === cat
                              ? "bg-ink text-paper-raised border-ink"
                              : "bg-paper-raised text-ink-soft border-line"
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </Field>
                  <Field label="BUSINESS ADDRESS (OPTIONAL)">
                    <LocalInput
                      initialValue={biz.address}
                      onBlur={(val) => setBiz((b) => ({ ...b, address: val.trim() }))}
                      placeholder="Shop address"
                      className="input-field w-full rounded px-3 py-2.5 text-sm"
                    />
                  </Field>
                  <Field label="BUSINESS EMAIL (OPTIONAL)">
                    <LocalInput
                      initialValue={biz.email}
                      onBlur={(val) => setBiz((b) => ({ ...b, email: val.trim() }))}
                      placeholder="you@business.com"
                      inputMode="email"
                      className="input-field w-full rounded px-3 py-2.5 text-sm"
                    />
                  </Field>
                </>
              )}

              {step === "customer" && (
                <>
                  <Field label="CUSTOMER NAME">
                    <LocalInput
                      initialValue={custName}
                      onBlur={(val) => setCustName(val.trim())}
                      placeholder="e.g. Ngozi Okafor"
                      className="input-field w-full rounded px-3 py-2.5 text-sm"
                    />
                  </Field>
                  <Field label="PHONE NUMBER">
                    <LocalInput
                      initialValue={custPhone}
                      onBlur={(val) => setCustPhone(val.trim())}
                      placeholder="080..."
                      inputMode="tel"
                      className="input-field w-full rounded px-3 py-2.5 text-sm"
                    />
                  </Field>
                  <Field label="CUSTOMER NOTES (OPTIONAL)">
                    <LocalInput
                      initialValue={custNotes}
                      onBlur={(val) => setCustNotes(val.trim())}
                      placeholder="e.g. regular customer"
                      className="input-field w-full rounded px-3 py-2.5 text-sm"
                    />
                  </Field>
                  <p className="text-[12px] text-ink-soft">
                    You can always add more customers later.
                  </p>
                </>
              )}

              {step === "sale" && (
                <>
                  <Field label="AMOUNT">
                    <LocalInput
                      initialValue={amount}
                      onBlur={(val) => setAmount(val.trim())}
                      placeholder="0"
                      inputMode="decimal"
                      className="input-field w-full rounded px-3 py-2.5 text-sm mono"
                    />
                  </Field>
                  <Field label="DESCRIPTION (OPTIONAL)">
                    <LocalInput
                      initialValue={desc}
                      onBlur={(val) => setDesc(val.trim())}
                      placeholder="e.g. 2 bags cement"
                      className="input-field w-full rounded px-3 py-2.5 text-sm"
                    />
                  </Field>
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
                  </Field>
                  <p className="text-[12px] text-ink-soft">
                    This helps you understand how {APP_NAME} works.
                  </p>
                </>
              )}
            </div>

            <div className="flex items-center gap-2.5 pt-8">
              {step === "business" ? (
                <button
                  onClick={() => setStep("welcome")}
                  className="min-h-12 px-5 rounded border border-line bg-paper-raised text-sm font-semibold text-ink-soft"
                >
                  Back
                </button>
              ) : (
                <button
                  onClick={step === "customer" ? () => setStep("done") : finishSetup}
                  className="min-h-12 px-5 rounded border border-line bg-paper-raised text-sm font-semibold text-ink-soft"
                >
                  Skip
                </button>
              )}
              <button
                onClick={
                  step === "business"
                    ? continueBusiness
                    : step === "customer"
                      ? continueCustomer
                      : finishSetup
                }
                disabled={
                  (step === "business" && !biz.name.trim()) ||
                  (step === "customer" && (!custName.trim() || !custPhone.trim()))
                }
                className="btn-primary flex-1 min-h-12 rounded text-sm font-semibold disabled:opacity-40 transition-transform active:scale-[0.99]"
              >
                {step === "sale" ? "Finish Setup" : "Continue"}
              </button>
            </div>
          </div>
        )}

        {/* ===== DONE ===== */}
        {step === "done" && (
          <div className="flex-1 flex flex-col justify-between p-6 pt-16 pb-8 animate-in fade-in duration-300">
            <div className="flex flex-col items-center text-center mt-16">
              <div className="h-16 w-16 rounded-full bg-paid grid place-items-center">
                <Check size={30} className="text-paper" strokeWidth={3} />
              </div>
              <h1 className="mt-6 text-2xl font-bold">You&rsquo;re Ready!</h1>
              <p className="mt-3 text-sm text-ink-soft leading-relaxed max-w-[320px]">
                Your business has been successfully set up. You can now start tracking customer
                debts, recording payments and sending WhatsApp reminders.
              </p>
            </div>
            <button
              onClick={onDone}
              className="btn-primary w-full rounded py-3.5 text-sm font-semibold mt-10 transition-transform active:scale-[0.99]"
            >
              Go to Dashboard
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
