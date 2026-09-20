export type DocumentType =
  | "auto_insurance"
  | "renters_insurance"
  | "apartment_lease"
  | "school_payment"
  | "bank"
  | "general";

export type AgentStatus = "processing" | "ready" | "error";

export interface GardenPosition {
  xPercent: number;
  yPercent: number;
}

export type FindingSeverity = "red_flag" | "important" | "info";

export interface Finding {
  id: string;
  title: string;
  detail: string;
  quote: string;
  page: number | null;
  severity?: FindingSeverity;
  date?: string;
}

/** Which analysis section a finding came from. Drives its highlight colour. */
export type HighlightKind = "concern" | "deadline" | "financial" | "favorable";

/**
 * A colour outside the five analysis categories, for passages the reader marks
 * for reasons of their own.
 */
export type HighlightColor = "grey" | "purple" | "pink" | "teal" | "indigo" | "brown" | "lime" | "aqua";

/** A reader's correction to one machine-made highlight. */
export interface HighlightOverride {
  kind?: HighlightKind;
  severity?: FindingSeverity;
  removed?: boolean;
  /** A name the reader gave it, replacing the one the analysis wrote. */
  title?: string;
  /** Set when the reader chose a colour of their own over the five categories. */
  color?: HighlightColor;
  /** What that colour means here, shown in place of the category name. */
  label?: string;
  /** When the change was made, so the history can lead with the newest. */
  at?: string;
}

/**
 * A highlight the analysis never made, asked for in the chat. It is located in
 * the document by its quote, exactly as the machine-made ones are.
 */
export interface ReaderHighlight {
  key: string;
  quote: string;
  kind: HighlightKind;
  severity: FindingSeverity;
  title: string;
  detail?: string;
  createdAt: string;
  /** A colour of the reader's own, instead of the kind above. */
  color?: HighlightColor;
  /** What that colour means here, for example "Chapter titles". */
  label?: string;
}

export interface DocumentPage {
  page: number;
  text: string;
  /** File the page came from, once an agent holds more than one document. */
  source?: string;
}

export interface AgentAnalysis {
  summary: string;
  favorableTerms: Finding[];
  concerns: Finding[];
  deadlines: Finding[];
  financialDetails: Finding[];
  suggestedQuestions: Finding[];
}

/** A job the reader asked to keep track of, saved against the agent it came from. */
export interface AgentTask {
  id: string;
  title: string;
  detail?: string;
  /** ISO date (YYYY-MM-DD) when it is due, when the document gives one. */
  dueDate?: string;
  done: boolean;
  createdAt: string;
}

/** A task plus where it came from, for the header list. */
export interface TaskWithAgent extends AgentTask {
  agentId: string;
  agentName: string;
  documentName: string;
}

export interface TodoItem {
  id: string;
  ownerId: string;
  title: string;
  detail?: string;
  /** ISO date (YYYY-MM-DD). Undated tasks sort to the bottom. */
  dueDate?: string;
  agentId?: string;
  agentName?: string;
  done: boolean;
  createdAt: string;
  completedAt?: string;
}

export interface AgentMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface DocumentAgent {
  id: string;
  ownerId: string;
  name: string;
  documentName: string;
  /** Every PDF this agent answers about, in the order they were added. */
  documentNames?: string[];
  /** Reader edits to the highlights, keyed by the quoted sentence. */
  highlightOverrides?: Record<string, HighlightOverride>;
  /** Pages the reader deleted from the marked-up view. Undoable from History. */
  hiddenPages?: number[];
  /** When each of those pages was deleted, keyed by page number. */
  hiddenPageAt?: Record<string, string>;
  /** Highlights the reader asked for in the chat, on top of the analysis. */
  readerHighlights?: ReaderHighlight[];
  sourceKind?: "pdf" | "topic";
  topic?: string;
  documentType: DocumentType;
  status: AgentStatus;
  statusLabel: string;
  deadlineCount: number;
  attentionCount: number;
  position?: GardenPosition;
  analysis: AgentAnalysis;
  messages: AgentMessage[];
  createdAt: string;
  updatedAt: string;
  /** When its chat was last opened, for the "recently visited" shortlist. */
  lastOpenedAt?: string;
}

export interface StoredDocumentAgent extends DocumentAgent {
  extractedPages: DocumentPage[];
  tasks?: AgentTask[];
}

export interface AgentSearchResult {
  agents: Array<{
    agentId: string;
    agentName: string;
    documentName: string;
    documentType: DocumentType;
  }>;
  messages: Array<{
    agentId: string;
    agentName: string;
    messageId: string;
    excerpt: string;
    createdAt: string;
  }>;
}
