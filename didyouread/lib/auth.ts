import { auth } from "@clerk/nextjs/server";

export const isClerkConfigured = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY,
);

export async function getCurrentUserId(): Promise<string | null> {
  if (!isClerkConfigured) {
    return "local-development-user";
  }

  const session = await auth();
  return session.userId;
}

export async function requireUserId(): Promise<string> {
  const userId = await getCurrentUserId();

  if (!userId) {
    throw new Error("UNAUTHENTICATED");
  }

  return userId;
}

export function authErrorResponse(error: unknown): Response | null {
  if (error instanceof Error && error.message === "UNAUTHENTICATED") {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  return null;
}
