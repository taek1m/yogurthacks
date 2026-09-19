import type {
  AgentAnalysis,
  DocumentType,
  Finding,
  GardenPosition,
} from "@/types/agent";

const positionSlots: GardenPosition[] = [
  { xPercent: 12, yPercent: 40 },
  { xPercent: 35, yPercent: 62 },
  { xPercent: 59, yPercent: 37 },
  { xPercent: 79, yPercent: 61 },
  { xPercent: 22, yPercent: 78 },
  { xPercent: 52, yPercent: 80 },
  { xPercent: 88, yPercent: 80 },
  { xPercent: 72, yPercent: 26 },
];

export function getStablePosition(index: number): GardenPosition {
  const slot = positionSlots[index % positionSlots.length];
  const rowOffset = Math.floor(index / positionSlots.length) * 3;
  return {
    xPercent: Math.min(90, slot.xPercent + (rowOffset % 5)),
    yPercent: Math.min(84, slot.yPercent + (rowOffset % 7)),
  };
}

export function classifyDocument(name: string, text: string): DocumentType {
  const haystack = `${name} ${text.slice(0, 12000)}`.toLowerCase();

  if (/auto|vehicle|automobile|\bcar\b|motor insurance|vin\b/.test(haystack)) {
    return "auto_insurance";
  }
  if (/renters insurance|tenant insurance|personal property coverage/.test(haystack)) {
    return "renters_insurance";
  }
  if (/lease|landlord|tenant|apartment|security deposit/.test(haystack)) {
    return "apartment_lease";
  }
  if (/tuition|school payment|student account|university|college/.test(haystack)) {
    return "school_payment";
  }
  if (/bank|checking account|savings account|routing number|credit union/.test(haystack)) {
    return "bank";
  }
  return "general";
}

export function agentNameFor(type: DocumentType): string {
  const names: Record<DocumentType, string> = {
    auto_insurance: "Auto insurance agent",
    renters_insurance: "Renters insurance agent",
    apartment_lease: "Lease agent",
    school_payment: "School payment agent",
    bank: "Bank document agent",
    general: "Document agent",
  };
  return names[type];
}

function quote(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, 220) || "Not found";
}

function makeFinding(
  prefix: string,
  title: string,
  detail: string,
  page: number | null,
  source: string,
  date?: string,
): Finding {
  return {
    id: `${prefix}-${crypto.randomUUID()}`,
    title,
    detail,
    quote: quote(source),
    page,
    date,
  };
}

export function analyzePages(
  pages: Array<{ page: number; text: string }>,
): AgentAnalysis {
  const lines = pages.flatMap(({ page, text }) =>
    text
      .split(/\n|(?<=[.!?])\s+/)
      .map((value) => ({ page, text: value.trim() }))
      .filter((value) => value.text.length > 12),
  );
  const find = (pattern: RegExp) => lines.find((line) => pattern.test(line.text));
  const concern = find(/fee|penalt|cancel|terminate|exclude|not cover|liable|required/i);
  const favorable = find(/discount|included|covered|grace|refund|benefit|waive/i);
  const financial = find(/\$|payment|premium|deductible|deposit|balance|amount due/i);
  const deadline = find(
    /due|deadline|renew|expires?|effective date|within \d+ days|no later than/i,
  );
  const first = lines[0];

  return {
    summary: first
      ? `This analysis is based on extracted text from ${pages.length} page${pages.length === 1 ? "" : "s"}. Confirm important terms against the quoted source.`
      : "No readable text was found.",
    favorableTerms: favorable
      ? [
          makeFinding(
            "favorable",
            "Potentially favorable term",
            "This language may benefit you, but its surrounding conditions should be confirmed.",
            favorable.page,
            favorable.text,
          ),
        ]
      : [],
    concerns: concern
      ? [
          makeFinding(
            "concern",
            "Term to review",
            "This clause may create an obligation, limitation, or cost. Review the full section.",
            concern.page,
            concern.text,
          ),
        ]
      : [],
    deadlines: deadline
      ? [
          makeFinding(
            "deadline",
            "Possible deadline",
            "A time-sensitive term appears here. The exact date needs confirmation.",
            deadline.page,
            deadline.text,
          ),
        ]
      : [],
    financialDetails: financial
      ? [
          makeFinding(
            "financial",
            "Financial term",
            "A payment, fee, or coverage amount appears in this passage.",
            financial.page,
            financial.text,
          ),
        ]
      : [],
    suggestedQuestions: [
      makeFinding(
        "question",
        "What should I confirm before agreeing?",
        "Ask the document issuer to confirm all dates, totals, exceptions, and cancellation terms in writing.",
        first?.page ?? null,
        first?.text ?? "Not found",
      ),
    ],
  };
}

export function buildGroundedAnswer(
  question: string,
  pages: Array<{ page: number; text: string }>,
): string {
  const terms = question
    .toLowerCase()
    .split(/\W+/)
    .filter((term) => term.length > 3);
  const sentences = pages.flatMap(({ page, text }) =>
    text.split(/\n|(?<=[.!?])\s+/).map((sentence) => ({ page, sentence })),
  );
  const match = sentences
    .map((item) => ({
      ...item,
      score: terms.filter((term) => item.sentence.toLowerCase().includes(term)).length,
    }))
    .sort((a, b) => b.score - a.score)[0];

  if (!match || match.score === 0) {
    return "I could not find enough supporting text to answer that confidently. Needs confirmation from the document issuer.";
  }

  return `The closest supporting text is on page ${match.page}: “${quote(match.sentence)}” Please confirm the surrounding section before relying on it.`;
}
