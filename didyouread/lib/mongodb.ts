import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;

declare global {
  var __agentGardenMongoClient: Promise<MongoClient> | undefined;
}

export function isMongoConfigured(): boolean {
  return Boolean(uri);
}

export async function getMongoClient(): Promise<MongoClient> {
  if (!uri) {
    throw new Error("MONGODB_URI is not configured");
  }

  if (!global.__agentGardenMongoClient) {
    // Never cache a rejected promise: one failed connect (asleep laptop, a
    // network switch, an Atlas hiccup) would otherwise replay the same error on
    // every later request until the server is restarted. Drop it and retry.
    global.__agentGardenMongoClient = new MongoClient(uri)
      .connect()
      .catch((error) => {
        global.__agentGardenMongoClient = undefined;
        throw error;
      });
  }

  return global.__agentGardenMongoClient;
}

export async function getDatabase() {
  const client = await getMongoClient();
  return client.db(process.env.MONGODB_DB_NAME || "didyoureadthefine");
}
