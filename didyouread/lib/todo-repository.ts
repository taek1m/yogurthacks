import type { Collection } from "mongodb";
import { getDatabase, isMongoConfigured } from "@/lib/mongodb";
import { byDueDate } from "@/lib/todo-order";
import type { TodoItem } from "@/types/agent";

declare global {
  var __agentGardenTodos: TodoItem[] | undefined;
}

const memory = global.__agentGardenTodos ?? [];
global.__agentGardenTodos = memory;

function publicTodo(todo: TodoItem): TodoItem {
  const { _id, ...result } = todo as TodoItem & { _id?: unknown };
  void _id;
  return result;
}

async function collection(): Promise<Collection<TodoItem>> {
  const database = await getDatabase();
  const todos = database.collection<TodoItem>("todos");
  await todos.createIndex({ ownerId: 1, done: 1, dueDate: 1 });
  return todos;
}

export async function listTodos(ownerId: string): Promise<TodoItem[]> {
  if (!isMongoConfigured()) {
    return memory.filter((todo) => todo.ownerId === ownerId).map(publicTodo).sort(byDueDate);
  }
  const records = await (await collection()).find({ ownerId }).toArray();
  return records.map(publicTodo).sort(byDueDate);
}

export async function createTodos(todos: TodoItem[]): Promise<TodoItem[]> {
  if (todos.length === 0) return [];
  if (!isMongoConfigured()) {
    memory.push(...todos);
    return todos.map(publicTodo);
  }
  await (await collection()).insertMany(todos.map((todo) => ({ ...todo })));
  return todos.map(publicTodo);
}

export async function setTodoDone(
  ownerId: string,
  id: string,
  done: boolean,
): Promise<TodoItem | null> {
  const completedAt = done ? new Date().toISOString() : undefined;
  if (!isMongoConfigured()) {
    const todo = memory.find((item) => item.ownerId === ownerId && item.id === id);
    if (!todo) return null;
    todo.done = done;
    todo.completedAt = completedAt;
    return publicTodo(todo);
  }
  const result = await (await collection()).findOneAndUpdate(
    { ownerId, id },
    done ? { $set: { done, completedAt } } : { $set: { done }, $unset: { completedAt: "" } },
    { returnDocument: "after" },
  );
  return result ? publicTodo(result) : null;
}

export async function deleteTodo(ownerId: string, id: string): Promise<boolean> {
  if (!isMongoConfigured()) {
    const index = memory.findIndex((item) => item.ownerId === ownerId && item.id === id);
    if (index === -1) return false;
    memory.splice(index, 1);
    return true;
  }
  const result = await (await collection()).deleteOne({ ownerId, id });
  return result.deletedCount === 1;
}
