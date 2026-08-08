import trackDebtLogo from "@/assets/track-debt-logo.png.asset.json";
import {
  balanceOf,
  fmtDateLong,
  naira,
  todayISO,
  type BusinessProfile,
  type Customer,
  type Txn,
} from "./ledger";
import { dueInfoOf, dueInfoFromDate, openSales } from "./due-dates";
import { APP_NAME } from "./ledger";

export type ReceiptKind = "sale" | "payment" | "statement";

export type ReceiptDoc = {
  filename: string;
  blob: Blob;
};

const INK = [40, 34, 28] as const;
const SOFT = [110, 102, 92] as const;
const LINE = [200, 192, 180] as const;
const DEBT = [176, 45, 32] as const;

async function toDataUrl(src: string): Promise<string | null> {
  try {
    if (src.startsWith("data:")) return src;
    const res = await fetch(src);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export function receiptTitle(kind: ReceiptKind) {
  return kind === "sale"
    ? "CREDIT SALE RECEIPT"
    : kind === "payment"
      ? "PAYMENT RECEIPT"
      : "CUSTOMER STATEMENT";
}

/** Plain-text summary for users who prefer to copy/paste. */
export function receiptSummary(
  kind: ReceiptKind,
  c: Customer,
  p: BusinessProfile,
  t?: Txn,
): string {
  const biz = p.name || APP_NAME;
  const lines: string[] = [`*${biz.toUpperCase()}*`, receiptTitle(kind), ""];
  if (t) {
    lines.push(
      `Reference: ${t.reference ?? "—"}`,
      `Date: ${fmtDateLong(t.date)}`,
      `Customer: ${c.name}${c.phone ? ` (${c.phone})` : ""}`,
      t.note ? `Description: ${t.note}` : "",
      kind === "payment" ? `Amount paid: ${naira(t.amount)}` : `Amount: ${naira(t.amount)}`,
      t.term?.dueDate ? `Payment due: ${fmtDateLong(t.term.dueDate)}` : "",
    );
  } else {
    lines.push(`Customer: ${c.name}${c.phone ? ` (${c.phone})` : ""}`, "");
    for (const x of c.txns) {
      lines.push(
        `${fmtDateLong(x.date)}  ${x.type === "sale" ? "+" : "−"}${naira(x.amount)}${x.note ? `  (${x.note})` : ""}`,
      );
    }
  }
  lines.push(
    "",
    `Outstanding balance: ${naira(Math.max(balanceOf(c), 0))}`,
    `Status: ${dueInfoOf(c).label}`,
    `Generated: ${fmtDateLong(todayISO())} · ${APP_NAME}`,
  );
  return lines.filter((l) => l !== "").join("\n");
}

export async function generateReceiptPdf(
  kind: ReceiptKind,
  c: Customer,
  p: BusinessProfile,
  t?: Txn,
): Promise<ReceiptDoc> {
  try {
    return await buildReceiptPdf(kind, c, p, t);
  } catch (err) {
    console.error("[receipts] PDF generation failed", err);
    throw new Error("Could not generate the PDF. Please try again.");
  }
}

async function buildReceiptPdf(
  kind: ReceiptKind,
  c: Customer,
  p: BusinessProfile,
  t?: Txn,
): Promise<ReceiptDoc> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const M = 48;
  let y = M;

  const [bizLogo, appLogo] = await Promise.all([
    p.logo ? toDataUrl(p.logo) : Promise.resolve(null),
    toDataUrl(trackDebtLogo.url),
  ]);

  /* ---- header ---- */
  if (bizLogo) {
    try {
      doc.addImage(bizLogo, "PNG", M, y, 46, 46);
    } catch {
      /* unsupported image, skip */
    }
  }
  const textX = bizLogo ? M + 60 : M;
  doc
    .setTextColor(...INK)
    .setFont("helvetica", "bold")
    .setFontSize(16);
  doc.text(p.name || APP_NAME, textX, y + 16);
  doc
    .setFont("helvetica", "normal")
    .setFontSize(9)
    .setTextColor(...SOFT);
  const bizLines = [p.category, p.phone, p.email, p.address].filter(Boolean) as string[];
  bizLines.forEach((line, i) => doc.text(line, textX, y + 30 + i * 11));

  if (appLogo) {
    try {
      doc.addImage(appLogo, "PNG", W - M - 34, y, 34, 34);
    } catch {
      /* skip */
    }
  }
  doc.setFontSize(7).setTextColor(...SOFT);
  doc.text(APP_NAME, W - M - 34, y + 44, { maxWidth: 40 });

  y += Math.max(52, 30 + bizLines.length * 11) + 14;
  doc
    .setDrawColor(...LINE)
    .setLineWidth(1)
    .line(M, y, W - M, y);
  y += 26;

  /* ---- title ---- */
  doc
    .setFont("helvetica", "bold")
    .setFontSize(13)
    .setTextColor(...INK);
  doc.text(receiptTitle(kind), M, y);
  doc
    .setFont("helvetica", "normal")
    .setFontSize(9)
    .setTextColor(...SOFT);
  if (t?.reference) doc.text(t.reference, W - M, y, { align: "right" });
  y += 22;

  /* ---- parties ---- */
  const row = (label: string, value: string, yy: number) => {
    doc
      .setFontSize(8)
      .setTextColor(...SOFT)
      .text(label.toUpperCase(), M, yy);
    doc
      .setFontSize(10)
      .setTextColor(...INK)
      .text(value, M + 150, yy);
  };

  row("Customer", c.name, y);
  y += 16;
  if (c.phone) {
    row("Customer phone", c.phone, y);
    y += 16;
  }
  if (t) {
    row("Transaction date", fmtDateLong(t.date), y);
    y += 16;
    if (t.note) {
      row("Description", t.note, y);
      y += 16;
    }
  }
  y += 8;
  doc.setDrawColor(...LINE).line(M, y, W - M, y);
  y += 22;

  /* ---- body ---- */
  const bal = Math.max(balanceOf(c), 0);
  if (kind === "statement") {
    doc.setFontSize(8).setTextColor(...SOFT);
    doc.text("DATE", M, y);
    doc.text("DESCRIPTION", M + 90, y);
    doc.text("AMOUNT", W - M, y, { align: "right" });
    y += 6;
    doc.setDrawColor(...LINE).line(M, y, W - M, y);
    y += 16;

    let running = 0;
    doc.setFontSize(9).setTextColor(...INK);
    if (c.txns.length === 0) {
      doc.setTextColor(...SOFT).text("No transactions recorded yet.", M, y);
      y += 16;
    }
    for (const x of c.txns) {
      running += x.type === "sale" ? x.amount : -x.amount;
      doc.setTextColor(...INK).setFontSize(9);
      doc.text(fmtDateLong(x.date), M, y);
      doc.text(
        `${x.type === "sale" ? "Credit sale" : "Payment"}${x.note ? ` — ${x.note}` : ""}`,
        M + 90,
        y,
        { maxWidth: W - M - 90 - 110 },
      );
      doc.text(`${x.type === "sale" ? "+" : "-"}${naira(x.amount)}`, W - M, y, {
        align: "right",
      });
      y += 15;
      if (y > doc.internal.pageSize.getHeight() - 120) {
        doc.addPage();
        y = M;
      }
    }
    y += 6;
    doc.setDrawColor(...LINE).line(M, y, W - M, y);
    y += 20;
    doc
      .setFontSize(9)
      .setTextColor(...SOFT)
      .text("Running balance", M, y);
    doc
      .setFont("helvetica", "bold")
      .setFontSize(11)
      .setTextColor(...INK);
    doc.text(naira(Math.max(running, 0)), W - M, y, { align: "right" });
    y += 24;
  } else {
    const amountLabel = kind === "payment" ? "Amount paid" : "Original amount";
    const amount = t?.amount ?? 0;
    const paid = kind === "payment" ? amount : 0;

    const money = (label: string, value: string, bold = false) => {
      doc
        .setFont("helvetica", "normal")
        .setFontSize(9)
        .setTextColor(...SOFT)
        .text(label, M, y);
      doc
        .setFont("helvetica", bold ? "bold" : "normal")
        .setFontSize(bold ? 13 : 10)
        .setTextColor(...INK)
        .text(value, W - M, y, { align: "right" });
      y += bold ? 24 : 17;
    };

    money(amountLabel, naira(amount));
    if (kind === "sale") money("Amount paid", naira(paid));
    money("Remaining balance", naira(bal), true);
  }

  /* ---- status block ---- */
  const info = t?.term?.dueDate ? dueInfoFromDate(t.term.dueDate, bal > 0) : dueInfoOf(c);
  doc
    .setDrawColor(...LINE)
    .setLineWidth(1)
    .rect(M, y, W - M * 2, 52);
  doc
    .setFontSize(8)
    .setTextColor(...SOFT)
    .text("PAYMENT DUE DATE", M + 14, y + 18);
  doc
    .setFontSize(10)
    .setTextColor(...INK)
    .text(info.dueDate ? fmtDateLong(info.dueDate) : "Not set", M + 14, y + 34);
  doc
    .setFontSize(8)
    .setTextColor(...SOFT)
    .text("STATUS", W / 2 + 14, y + 18);
  const statusColor: readonly [number, number, number] = info.tone === "debt" ? DEBT : INK;
  doc
    .setFontSize(10)
    .setTextColor(statusColor[0], statusColor[1], statusColor[2])
    .text(info.label, W / 2 + 14, y + 34);

  y += 74;

  if (kind !== "statement") {
    doc.setFontSize(9).setTextColor(...SOFT);
    doc.text(`Outstanding balance: ${naira(bal)}`, M, y);
    y += 20;
  }

  /* ---- footer ---- */
  const footerY = doc.internal.pageSize.getHeight() - 46;
  doc.setDrawColor(...LINE).line(M, footerY - 16, W - M, footerY - 16);
  doc.setFontSize(8).setTextColor(...SOFT);
  doc.text(`Generated ${fmtDateLong(todayISO())} with ${APP_NAME}`, M, footerY);
  doc.text("Thank you for your patronage.", W - M, footerY, { align: "right" });

  const blob = doc.output("blob") as Blob;
  const safeName = c.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  const filename = `${kind === "statement" ? "statement" : "receipt"}-${safeName}-${t?.reference ?? Date.now()}.pdf`;
  return { filename, blob };
}

/** Only used to decide whether the statement can show an opening balance. */
export const hasOpeningBalance = (c: Customer) => openSales(c).length > 0;
