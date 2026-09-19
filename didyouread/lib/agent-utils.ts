import type {
  AgentAnalysis,
  DocumentType,
  Finding,
  FindingSeverity,
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

const CONCERN_RULES: Array<{ pattern: RegExp; title: string; detail: string; severity: FindingSeverity }> = [
  {
    pattern: /waiv(e|es|ed|er)|indemnif|hold harmless|arbitrat|class action|jury trial/i,
    title: "Rights you may be giving up",
    detail: "This language can limit how you resolve a dispute or what you can claim later. Read the full clause before agreeing.",
    severity: "red_flag",
  },
  {
    pattern: /auto(-|\s)?renew|automatically renew|renews? (each|every)|continues? until (you )?cancel/i,
    title: "Automatic renewal",
    detail: "The agreement may continue on its own unless you cancel in time. Confirm the cancellation window.",
    severity: "red_flag",
  },
  {
    pattern: /non-?refundable|no refund|forfeit/i,
    title: "Money you may not get back",
    detail: "An amount here may be kept even if you cancel. Confirm what triggers the forfeiture.",
    severity: "red_flag",
  },
  {
    pattern: /sole discretion|without (prior )?notice|subject to change|may (modify|change|amend)/i,
    title: "Terms the other side can change",
    detail: "This lets the issuer change conditions unilaterally. Ask what notice you would receive.",
    severity: "red_flag",
  },
  {
    pattern: /penalt|late (fee|charge|payment)|interest (rate|charge)|service charge|\bfees?\b/i,
    title: "Fee or penalty",
    detail: "A charge may apply here. Confirm the amount and what triggers it.",
    severity: "important",
  },
  {
    pattern: /terminat|cancel(lation)?|evict|default|breach/i,
    title: "Cancellation or termination term",
    detail: "This describes how the agreement can end. Review the notice and cost of ending it.",
    severity: "important",
  },
  {
    pattern: /not covered|does not cover|exclusion|excluded?|limitation of liability|liable|responsible for/i,
    title: "Coverage limit or liability",
    detail: "This clause may shift cost or risk onto you. Review the full section.",
    severity: "important",
  },
  {
    pattern: /must|shall|required to|obligated|you agree to/i,
    title: "Obligation placed on you",
    detail: "This creates a duty you would take on. Confirm you can meet it.",
    severity: "important",
  },
];

const FAVORABLE_PATTERN = /discount|included|is covered|grace period|refund(able)?|benefit|waived|no (additional )?(charge|cost)|free of charge|at no cost|you may cancel/i;
const DEADLINE_PATTERN = /due (date|on|by)|deadline|renew|expires?|expiration|effective date|within \d+ (calendar |business )?days|no later than|on or before/i;
const FINANCIAL_PATTERN = /\$\s?[\d,]+|\bUSD\b|premium|deductible|deposit|balance|amount due|monthly payment|per month|payment of|total of/i;
const DATE_PATTERN = /\b(\d{1,2}\/\d{1,2}\/\d{2,4}|(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}|\d+\s+(?:calendar |business )?days)\b/i;

const MAX_PER_SECTION = { concerns: 8, deadlines: 5, financial: 6, favorable: 5 } as const;

function quote(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, 220) || "Not found";
}

function makeFinding(
  prefix: string,
  title: string,
  detail: string,
  page: number | null,
  source: string,
  severity: FindingSeverity = "important",
  date?: string,
): Finding {
  return {
    id: `${prefix}-${crypto.randomUUID()}`,
    title,
    detail,
    quote: quote(source),
    page,
    severity,
    date,
  };
}

interface SourceLine {
  page: number;
  text: string;
}

export function splitPagesIntoLines(
  pages: Array<{ page: number; text: string }>,
): SourceLine[] {
  return pages.flatMap(({ page, text }) =>
    text
      .split(/\n|(?<=[.!?])\s+/)
      .map((value) => ({ page, text: value.trim() }))
      .filter((value) => value.text.length > 12),
  );
}

export function analyzePages(
  pages: Array<{ page: number; text: string }>,
): AgentAnalysis {
  const lines = splitPagesIntoLines(pages);
  // A line is highlighted once, under the most serious category that matches it.
  const claimed = new Set<SourceLine>();
  const take = (limit: number, match: (line: SourceLine) => boolean) => {
    const picked: SourceLine[] = [];
    for (const line of lines) {
      if (picked.length >= limit) break;
      if (claimed.has(line) || !match(line)) continue;
      claimed.add(line);
      picked.push(line);
    }
    return picked;
  };

  // Order matters: each sentence is claimed once, by the pass that runs first.
  // Red flags win outright, then dates, then amounts, then softer concerns.
  const concernsFor = (severity: FindingSeverity) =>
    CONCERN_RULES.filter((rule) => rule.severity === severity).flatMap((rule) =>
      take(severity === "red_flag" ? 2 : 1, (line) => rule.pattern.test(line.text)).map((line) =>
        makeFinding("concern", rule.title, rule.detail, line.page, line.text, rule.severity),
      ),
    );

  const redFlagFindings = concernsFor("red_flag");

  const deadlines = take(MAX_PER_SECTION.deadlines, (line) => DEADLINE_PATTERN.test(line.text)).map((line) =>
    makeFinding(
      "deadline",
      "Time-sensitive term",
      "A date or time limit appears here. Confirm the exact deadline with the issuer.",
      line.page,
      line.text,
      "important",
      line.text.match(DATE_PATTERN)?.[0],
    ),
  );

  const financialDetails = take(MAX_PER_SECTION.financial, (line) => FINANCIAL_PATTERN.test(line.text)).map((line) =>
    makeFinding(
      "financial",
      "Money term",
      "A payment, fee, or coverage amount appears in this passage.",
      line.page,
      line.text,
      "important",
    ),
  );

  const concerns = [...redFlagFindings, ...concernsFor("important")].slice(0, MAX_PER_SECTION.concerns);

  const favorableTerms = take(MAX_PER_SECTION.favorable, (line) => FAVORABLE_PATTERN.test(line.text)).map((line) =>
    makeFinding(
      "favorable",
      "Term in your favor",
      "This language may benefit you, but its surrounding conditions should be confirmed.",
      line.page,
      line.text,
      "info",
    ),
  );

  const first = lines[0];
  const redFlags = concerns.filter((finding) => finding.severity === "red_flag").length;
  const summary = first
    ? [
        `Read ${pages.length} page${pages.length === 1 ? "" : "s"} of extracted text and marked ${
          concerns.length + deadlines.length + financialDetails.length + favorableTerms.length
        } passage${concerns.length + deadlines.length + financialDetails.length + favorableTerms.length === 1 ? "" : "s"} worth a second look.`,
        redFlags > 0
          ? `${redFlags} of them read as red flags: clauses that shift cost, risk, or rights onto you.`
          : "Nothing here reads as a hard red flag, but the marked terms still need confirmation.",
        "Every highlight links back to the exact sentence it came from, so check the source before relying on it.",
      ].join(" ")
    : "No readable text was found.";

  return {
    summary,
    favorableTerms,
    concerns,
    deadlines,
    financialDetails,
    suggestedQuestions: [
      makeFinding(
        "question",
        "What should I confirm before agreeing?",
        "Ask the document issuer to confirm all dates, totals, exceptions, and cancellation terms in writing.",
        first?.page ?? null,
        first?.text ?? "Not found",
        "info",
      ),
      ...(concerns[0]
        ? [
            makeFinding(
              "question",
              `Can you explain this in plain language: “${concerns[0].title}”?`,
              "Ask the issuer to restate the clause and give a concrete example of when it would apply to you.",
              concerns[0].page,
              concerns[0].quote,
              "info",
            ),
          ]
        : []),
      ...(deadlines[0]
        ? [
            makeFinding(
              "question",
              "What exactly happens if I miss this deadline?",
              "Ask for the consequence, the grace period, and whether the deadline can be extended in writing.",
              deadlines[0].page,
              deadlines[0].quote,
              "info",
            ),
          ]
        : []),
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
