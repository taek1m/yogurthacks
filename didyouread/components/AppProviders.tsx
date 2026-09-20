"use client";

import { ClerkProvider } from "@clerk/nextjs";
import type { ReactNode } from "react";

export function AppProviders({ children }: { children: ReactNode }) {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) return children;
  return (
    <ClerkProvider
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      afterSignOutUrl="/sign-in"
      // Clerk titles its cards "Sign in to <application name>". The page already
      // says whose garden this is, so the card only needs the verb.
      localization={{
        signIn: { start: { title: "Sign in" } },
        signUp: { start: { title: "Create your account" } },
      }}
    >
      {children}
    </ClerkProvider>
  );
}
