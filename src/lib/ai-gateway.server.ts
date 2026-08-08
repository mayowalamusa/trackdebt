import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export function createLovableAiGatewayProvider(lovableApiKey: string) {
  return createOpenAICompatible({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: {
      "Lovable-API-Key": lovableApiKey,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
  });
}

export type ReminderInput = {
  customerName: string;
  businessName: string;
  outstanding: string;
  originalAmount: string;
  dueDate: string | null;
  daysOverdue: number;
  status: string;
  tone: string;
};

export function buildReminderPrompt(input: ReminderInput) {
  return [
    `Write a WhatsApp payment reminder for a Nigerian small business.`,
    `Tone: ${input.tone}.`,
    `Business name: ${input.businessName}`,
    `Customer first name: ${input.customerName}`,
    `Outstanding amount: ${input.outstanding}`,
    `Original transaction amount: ${input.originalAmount}`,
    input.dueDate ? `Payment due date: ${input.dueDate}` : `No payment due date was agreed.`,
    input.daysOverdue > 0 ? `The payment is ${input.daysOverdue} days overdue.` : ``,
    `Payment status: ${input.status}`,
    ``,
    `Rules: greet the customer by name, state the amount and (if known) the due date,`,
    `keep it under 80 words, polite and respectful, no emojis, no markdown,`,
    `sign off with the business name on its own line. Return only the message text.`,
  ]
    .filter(Boolean)
    .join("\n");
}
