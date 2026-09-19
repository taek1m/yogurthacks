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

export interface Finding {
  id: string;
  title: string;
  detail: string;
  quote: string;
  page: number | null;
  date?: string;
}

export interface AgentAnalysis {
  summary: string;
  favorableTerms: Finding[];
  concerns: Finding[];
  deadlines: Finding[];
  financialDetails: Finding[];
  suggestedQuestions: Finding[];
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
}

export interface StoredDocumentAgent extends DocumentAgent {
  extractedPages: Array<{ page: number; text: string }>;
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
