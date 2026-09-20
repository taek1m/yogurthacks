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

/** A reader's correction to one machine-made highlight. */
export interface HighlightOverride {
  kind?: HighlightKind;
  severity?: FindingSeverity;
  removed?: boolean;
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
