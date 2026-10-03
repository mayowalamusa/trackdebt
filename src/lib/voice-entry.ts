export type VoiceEntryType = "customer" | "txn";

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  0: { transcript: string };
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

export type VoiceSession = {
  promise: Promise<string>;
  stop: () => void;
};

export type ParsedVoiceCustomer = {
  name: string;
  phone: string;
  notes: string;
};

export type ParsedVoiceTxn = {
  type: "sale" | "payment";
  amount: string;
  note: string;
  termKey: "none" | "today" | "d7" | "d14" | "d30";
};

const NUMBER_WORDS: Record<string, number> = {
  zero: 0,
  oh: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};

function recognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const win = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return win.SpeechRecognition ?? win.webkitSpeechRecognition ?? null;
}

/**
 * Starts the browser's real SpeechRecognition API.
 * Nothing is simulated: the returned transcript comes from the microphone.
 */
export function startVoiceRecognition(language = "en-NG"): VoiceSession {
  const Constructor = recognitionConstructor();
  if (!Constructor) {
    return {
      promise: Promise.reject(
        new Error("Voice input is not supported in this browser. Please use a browser with microphone speech recognition."),
      ),
      stop: () => undefined,
    };
  }

  const recognition = new Constructor();
  recognition.lang = language;
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  let settled = false;
  let resolvePromise: (value: string) => void = () => undefined;
  let rejectPromise: (reason?: unknown) => void = () => undefined;

  const promise = new Promise<string>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });

  const fail = (message: string) => {
    if (settled) return;
    settled = true;
    rejectPromise(new Error(message));
  };

  recognition.onresult = (event) => {
    const transcripts: string[] = [];
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const result = event.results[i];
      if (result?.isFinal && result[0]?.transcript) transcripts.push(result[0].transcript);
    }
    const transcript = transcripts.join(" ").trim();
    if (transcript) {
      settled = true;
      resolvePromise(transcript);
    } else {
      fail("I couldn't hear anything. Please try again.");
    }
  };

  recognition.onerror = (event) => {
    const error = event.error;
    if (error === "not-allowed" || error === "service-not-allowed") {
      fail("Microphone access was blocked. Allow microphone access and try again.");
    } else if (error === "no-speech") {
      fail("I couldn't hear anything. Please try again.");
    } else if (error === "audio-capture") {
      fail("No microphone is available. Check your microphone and try again.");
    } else {
      fail("Voice input failed. Please try again.");
    }
  };

  recognition.onend = () => {
    if (!settled) fail("I couldn't capture a voice command. Please try again.");
  };

  try {
    recognition.start();
  } catch {
    fail("Could not start voice input. Please try again.");
  }

  return {
    promise,
    stop: () => {
      try {
        recognition.stop();
      } catch {
        recognition.abort();
      }
    },
  };
}

function cleanTranscript(value: string): string {
  return value
    .replace(/[“”"]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function spokenDigits(value: string): string {
  const tokens = value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  const digits = tokens
    .map((token) => NUMBER_WORDS[token])
    .filter((value): value is number => value !== undefined)
    .map(String)
    .join("");

  return digits;
}

function extractPhone(transcript: string): string {
  const direct = transcript.match(/(?:\+?\d[\d\s().-]{7,}\d)/)?.[0];
  if (direct) {
    return direct.replace(/\D/g, "");
  }

  const phonePhrase = transcript.match(
    /(?:phone|mobile|number|contact)\s+(?:is\s+)?([a-z0-9\s-]{7,})/i,
  )?.[1];
  if (!phonePhrase) return "";

  return spokenDigits(phonePhrase);
}

function parseNumberWords(value: string): number | null {
  const tokens = value
    .toLowerCase()
    .replace(/[^a-z0-9.\s-]/g, " ")
    .split(/\s+/)
    .filter((token) => token && token !== "and");

  const numeric = tokens.find((token) => /^\d+(?:\.\d+)?$/.test(token));
  if (numeric) return Number(numeric.replace(/,/g, ""));

  let total = 0;
  let current = 0;
  let found = false;

  for (const token of tokens) {
    if (NUMBER_WORDS[token] !== undefined) {
      current += NUMBER_WORDS[token];
      found = true;
      continue;
    }
    if (token === "hundred") {
      current = (current || 1) * 100;
      found = true;
      continue;
    }
    if (token === "thousand") {
      total += (current || 1) * 1000;
      current = 0;
      found = true;
      continue;
    }
    if (token === "million") {
      total += (current || 1) * 1_000_000;
      current = 0;
      found = true;
      continue;
    }
    break;
  }

  if (!found) return null;
  return total + current;
}

function formatAmount(amount: number): string {
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
}

function extractAmount(transcript: string): { amount: number; segment: string } | null {
  const clean = cleanTranscript(transcript).toLowerCase();

  const keywordMatch = clean.match(
    /(?:credit\s+sale|sale|payment|paid|repayment|debt|amount)\s+(?:of\s+)?(.+)/i,
  );
  const candidate = keywordMatch?.[1] ?? clean;

  const stopMatch = candidate.match(
    /^(.*?)(?=\s+(?:due|today|tomorrow|in\s+\d+\s+days?|note|notes?|because|for\s+customer)\b|$)/i,
  );
  const amountSegment = (stopMatch?.[1] ?? candidate).trim();

  const numberMatch = amountSegment.match(/\d[\d,]*(?:\.\d+)?/);
  if (numberMatch) {
    const amount = Number(numberMatch[0].replace(/,/g, ""));
    return Number.isFinite(amount) && amount > 0
      ? { amount, segment: amountSegment }
      : null;
  }

  const words = amountSegment
    .replace(/^(?:the|sum of|amount of)\s+/i, "")
    .split(/\s+/)
    .filter(Boolean);

  for (let end = Math.min(words.length, 8); end >= 1; end -= 1) {
    const candidateWords = words.slice(0, end).join(" ");
    const amount = parseNumberWords(candidateWords);
    if (amount !== null && amount > 0) {
      return { amount, segment: candidateWords };
    }
  }

  return null;
}

function extractTermKey(transcript: string): ParsedVoiceTxn["termKey"] {
  const clean = transcript.toLowerCase();

  if (/\btoday\b/.test(clean)) return "today";
  if (/\b(?:7|seven)\s+days?\b|\bone\s+week\b/.test(clean)) return "d7";
  if (/\b(?:14|fourteen)\s+days?\b|\btwo\s+weeks?\b/.test(clean)) return "d14";
  if (/\b(?:30|thirty)\s+days?\b|\bone\s+month\b/.test(clean)) return "d30";
  return "none";
}

function extractNote(transcript: string, amountSegment: string): string {
  const clean = cleanTranscript(transcript);
  const afterAmount = clean.slice(
    clean.toLowerCase().indexOf(amountSegment.toLowerCase()) + amountSegment.length,
  );

  const noteMatch = afterAmount.match(
    /(?:for|note|notes?|because|description)\s+(?:is\s+)?(.+?)(?=\s+(?:due|today|tomorrow|in\s+\d+\s+days?)\b|$)/i,
  );

  return (noteMatch?.[1] ?? "").trim();
}

export function parseCustomerVoiceTranscript(transcript: string): ParsedVoiceCustomer {
  const clean = cleanTranscript(transcript);
  const phone = extractPhone(clean);

  const nameMatch =
    clean.match(
      /(?:customer\s+)?(?:named|called|name\s+is)\s+(.+?)(?=\s+(?:with|phone|mobile|number|contact)\b|$)/i,
    ) ??
    clean.match(
      /(?:add|create)\s+(?:a\s+)?customer\s+(.+?)(?=\s+(?:with|phone|mobile|number|contact)\b|$)/i,
    );

  const name = nameMatch?.[1]?.trim() ?? "";
  if (!name) {
    throw new Error("I heard the command, but I couldn't identify the customer's name.");
  }
  if (!phone) {
    throw new Error("I heard the customer's name, but I couldn't identify a phone number.");
  }

  const notes = clean.match(/\bnotes?\s+(?:is\s+)?(.+)$/i)?.[1]?.trim() ?? "";
  return { name, phone, notes };
}

export function parseTxnVoiceTranscript(transcript: string): ParsedVoiceTxn {
  const clean = cleanTranscript(transcript);
  const amountResult = extractAmount(clean);
  if (!amountResult) {
    throw new Error("I heard the command, but I couldn't identify the transaction amount.");
  }

  const type: ParsedVoiceTxn["type"] =
    /\b(?:payment|paid|repayment|received)\b/i.test(clean) ? "payment" : "sale";

  return {
    type,
    amount: formatAmount(amountResult.amount),
    note: extractNote(clean, amountResult.segment),
    termKey: type === "sale" ? extractTermKey(clean) : "none",
  };
}
