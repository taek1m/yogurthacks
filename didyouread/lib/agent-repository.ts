import type { Collection, Filter } from "mongodb";
import { getDatabase, isMongoConfigured } from "@/lib/mongodb";
import type {
  AgentAnalysis,
  AgentMessage,
  HighlightOverride,
  AgentTask,
  AgentSearchResult,
  DocumentAgent,
  DocumentPage,
  StoredDocumentAgent,
  GardenPosition,
  TaskWithAgent,
} from "@/types/agent";

declare global {
  var __agentGardenMemory: StoredDocumentAgent[] | undefined;
}

const memory = global.__agentGardenMemory ?? [];
global.__agentGardenMemory = memory;

function publicAgent(agent: StoredDocumentAgent): DocumentAgent {
  const { extractedPages, _id, ...result } = agent as StoredDocumentAgent & {
    _id?: unknown;
  };
  void extractedPages;
  void _id;
  return result;
}

async function collection(): Promise<Collection<StoredDocumentAgent>> {
  const database = await getDatabase();
  const agents = database.collection<StoredDocumentAgent>("agents");
  await agents.createIndex({ ownerId: 1, updatedAt: -1 });
  await agents.createIndex({ ownerId: 1, name: "text", documentName: "text" });
  return agents;
}

export async function listAgents(ownerId: string): Promise<DocumentAgent[]> {
  if (!isMongoConfigured()) {
    return memory
      .filter((agent) => agent.ownerId === ownerId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map(publicAgent);
  }

  const records = await (await collection())
    .find({ ownerId })
    .sort({ updatedAt: -1 })
    .toArray();
  return records.map(publicAgent);
}

export async function countAgents(ownerId: string): Promise<number> {
  if (!isMongoConfigured()) {
    return memory.filter((agent) => agent.ownerId === ownerId).length;
  }
  return (await collection()).countDocuments({ ownerId });
}

export async function getStoredAgent(
  ownerId: string,
  id: string,
): Promise<StoredDocumentAgent | null> {
  if (!isMongoConfigured()) {
    return memory.find((agent) => agent.ownerId === ownerId && agent.id === id) ?? null;
  }
  return (await collection()).findOne({ ownerId, id });
}

export async function getAgent(
  ownerId: string,
  id: string,
): Promise<DocumentAgent | null> {
  const agent = await getStoredAgent(ownerId, id);
  return agent ? publicAgent(agent) : null;
}

/**
 * The agent plus its extracted page text, for the highlighted document view.
 * Pages are rebuilt field by field so no Mongo internals reach the client.
 */
export async function getAgentWithPages(
  ownerId: string,
  id: string,
): Promise<{ agent: DocumentAgent; pages: DocumentPage[] } | null> {
  const stored = await getStoredAgent(ownerId, id);
  if (!stored) return null;
  return {
    agent: publicAgent(stored),
    pages: (stored.extractedPages ?? []).map((page) => ({
      page: page.page,
      text: page.text,
      source: page.source ?? stored.documentName,
    })),
  };
}

export async function createAgent(agent: StoredDocumentAgent): Promise<DocumentAgent> {
  if (!isMongoConfigured()) {
    memory.push(agent);
    return publicAgent(agent);
  }
  await (await collection()).insertOne(agent);
  return publicAgent(agent);
}

export async function updateAgent(
  ownerId: string,
  id: string,
  updates: { name?: string; position?: GardenPosition },
): Promise<DocumentAgent | null> {
  const updatedAt = new Date().toISOString();
  if (!isMongoConfigured()) {
    const agent = memory.find((item) => item.ownerId === ownerId && item.id === id);
    if (!agent) return null;
    if (updates.name !== undefined) agent.name = updates.name;
    if (updates.position !== undefined) agent.position = updates.position;
    agent.updatedAt = updatedAt;
    return publicAgent(agent);
  }

  const result = await (await collection()).findOneAndUpdate(
    { ownerId, id },
    { $set: { ...updates, updatedAt } },
    { returnDocument: "after" },
  );
  return result ? publicAgent(result) : null;
}

/**
 * Attaches another PDF to an agent: its pages join the extracted text, the
 * analysis is recomputed over everything, and the agent says so in the chat.
 */
export async function addAgentDocument(
  ownerId: string,
  id: string,
  update: {
    sourceKind?: "pdf" | "topic";
    documentName?: string;
    documentNames: string[];
    extractedPages: DocumentPage[];
    analysis: AgentAnalysis;
    statusLabel: string;
    deadlineCount: number;
    attentionCount: number;
    message: AgentMessage;
  },
): Promise<DocumentAgent | null> {
  const { message, ...fields } = update;
  const updatedAt = new Date().toISOString();

  if (!isMongoConfigured()) {
    const agent = memory.find((item) => item.ownerId === ownerId && item.id === id);
    if (!agent) return null;
    Object.assign(agent, fields);
    agent.messages.push(message);
    agent.updatedAt = updatedAt;
    return publicAgent(agent);
  }

  const result = await (await collection()).findOneAndUpdate(
    { ownerId, id },
    { $set: { ...fields, updatedAt }, $push: { messages: message } },
    { returnDocument: "after" },
  );
  return result ? publicAgent(result) : null;
}

/** Every saved task across the garden, soonest due first, undated last. */
export async function listTasks(ownerId: string): Promise<TaskWithAgent[]> {
  const records = !isMongoConfigured()
    ? memory.filter((agent) => agent.ownerId === ownerId)
    : await (await collection()).find({ ownerId, tasks: { $exists: true, $ne: [] } }).toArray();

  return records
    .flatMap((agent) =>
      (agent.tasks ?? []).map((task) => ({
        ...task,
        agentId: agent.id,
        agentName: agent.name,
        documentName: agent.documentName,
      })),
    )
    .sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return a.createdAt.localeCompare(b.createdAt);
    });
}

export async function addTasks(
  ownerId: string,
  agentId: string,
  tasks: AgentTask[],
): Promise<TaskWithAgent[] | null> {
  if (tasks.length === 0) return [];
  const updatedAt = new Date().toISOString();

  if (!isMongoConfigured()) {
    const agent = memory.find((item) => item.ownerId === ownerId && item.id === agentId);
    if (!agent) return null;
    agent.tasks = [...(agent.tasks ?? []), ...tasks];
    agent.updatedAt = updatedAt;
    return tasks.map((task) => ({ ...task, agentId, agentName: agent.name, documentName: agent.documentName }));
  }

  const result = await (await collection()).findOneAndUpdate(
    { ownerId, id: agentId },
    { $push: { tasks: { $each: tasks } }, $set: { updatedAt } },
    { returnDocument: "after" },
  );
  if (!result) return null;
  return tasks.map((task) => ({
    ...task,
    agentId,
    agentName: result.name,
    documentName: result.documentName,
  }));
}

export async function setTaskDone(
  ownerId: string,
  taskId: string,
  done: boolean,
): Promise<boolean> {
  if (!isMongoConfigured()) {
    for (const agent of memory) {
      if (agent.ownerId !== ownerId) continue;
      const task = agent.tasks?.find((item) => item.id === taskId);
      if (!task) continue;
      task.done = done;
      return true;
    }
    return false;
  }
  const result = await (await collection()).updateOne(
    { ownerId, "tasks.id": taskId },
    { $set: { "tasks.$.done": done } },
  );
  return result.matchedCount === 1;
}

export async function deleteTask(ownerId: string, taskId: string): Promise<boolean> {
  if (!isMongoConfigured()) {
    for (const agent of memory) {
      if (agent.ownerId !== ownerId) continue;
      const before = agent.tasks?.length ?? 0;
      agent.tasks = (agent.tasks ?? []).filter((item) => item.id !== taskId);
      if (agent.tasks.length !== before) return true;
    }
    return false;
  }
  const result = await (await collection()).updateOne(
    { ownerId, "tasks.id": taskId },
    { $pull: { tasks: { id: taskId } } },
  );
  return result.modifiedCount === 1;
}

/** Records one reader edit to a highlight, keyed by the sentence it quotes. */
export async function setHighlightOverride(
  ownerId: string,
  id: string,
  key: string,
  override: HighlightOverride | null,
): Promise<DocumentAgent | null> {
  const updatedAt = new Date().toISOString();
  const field = `highlightOverrides.${key}`;

  if (!isMongoConfigured()) {
    const agent = memory.find((item) => item.ownerId === ownerId && item.id === id);
    if (!agent) return null;
    const all = { ...(agent.highlightOverrides ?? {}) };
    if (override) all[key] = override;
    else delete all[key];
    agent.highlightOverrides = all;
    agent.updatedAt = updatedAt;
    return publicAgent(agent);
  }

  const result = await (await collection()).findOneAndUpdate(
    { ownerId, id },
    override
      ? { $set: { [field]: override, updatedAt } }
      : { $unset: { [field]: "" }, $set: { updatedAt } },
    { returnDocument: "after" },
  );
  return result ? publicAgent(result) : null;
}

export async function deleteAgent(ownerId: string, id: string): Promise<boolean> {
  if (!isMongoConfigured()) {
    const index = memory.findIndex((item) => item.ownerId === ownerId && item.id === id);
    if (index === -1) return false;
    memory.splice(index, 1);
    return true;
  }

  const result = await (await collection()).deleteOne({ ownerId, id });
  return result.deletedCount === 1;
}

export async function appendMessages(
  ownerId: string,
  id: string,
  messages: AgentMessage[],
): Promise<void> {
  const updatedAt = new Date().toISOString();
  if (!isMongoConfigured()) {
    const agent = memory.find((item) => item.ownerId === ownerId && item.id === id);
    if (agent) {
      agent.messages.push(...messages);
      agent.updatedAt = updatedAt;
    }
    return;
  }
  await (await collection()).updateOne(
    { ownerId, id },
    { $push: { messages: { $each: messages } }, $set: { updatedAt } },
  );
}

function excerpt(content: string, query: string): string {
  const lower = content.toLowerCase();
  const index = Math.max(0, lower.indexOf(query.toLowerCase()) - 55);
  const value = content.slice(index, index + 160).replace(/\s+/g, " ").trim();
  return `${index > 0 ? "…" : ""}${value}${index + 160 < content.length ? "…" : ""}`;
}

export async function searchAgents(
  ownerId: string,
  query: string,
): Promise<AgentSearchResult> {
  const normalized = query.trim().slice(0, 100);
  if (normalized.length < 2) return { agents: [], messages: [] };

  let records: StoredDocumentAgent[];
  if (!isMongoConfigured()) {
    records = memory.filter((agent) => agent.ownerId === ownerId);
  } else {
    const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const filter: Filter<StoredDocumentAgent> = {
      ownerId,
      $or: [
        { name: { $regex: escaped, $options: "i" } },
        { documentName: { $regex: escaped, $options: "i" } },
        { "messages.content": { $regex: escaped, $options: "i" } },
      ],
    };
    records = await (await collection()).find(filter).limit(12).toArray();
  }

  const lower = normalized.toLowerCase();
  return {
    agents: records
      .filter(
        (agent) =>
          agent.name.toLowerCase().includes(lower) ||
          agent.documentName.toLowerCase().includes(lower),
      )
      .slice(0, 6)
      .map((agent) => ({
        agentId: agent.id,
        agentName: agent.name,
        documentName: agent.documentName,
        documentType: agent.documentType,
      })),
    messages: records
      .flatMap((agent) =>
        agent.messages
          .filter((message) => message.content.toLowerCase().includes(lower))
          .map((message) => ({
            agentId: agent.id,
            agentName: agent.name,
            messageId: message.id,
            excerpt: excerpt(message.content, normalized),
            createdAt: message.createdAt,
          })),
      )
      .slice(0, 8),
  };
}
