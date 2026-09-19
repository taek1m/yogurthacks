import { SignIn } from "@clerk/nextjs";
import { Leaf, LogIn } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUserId, isClerkConfigured } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function SignInPage() {
  if (isClerkConfigured && (await getCurrentUserId())) redirect("/");

  return (
    <div className="flex flex-1 items-center justify-center bg-[#e8f3ee] px-4 py-12">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-lg border border-[#d4dfd1] bg-[#fffef9] shadow-xl md:grid-cols-[0.85fr_1.15fr]">
        <section className="flex flex-col justify-between bg-[#245f3c] p-7 text-white sm:p-10">
          <div className="flex items-center gap-2 font-semibold"><Leaf size={22} />didyoureadthefine.ink</div>
          <div className="py-12">
            <p className="text-xs font-bold uppercase text-[#cde7d3]">Welcome back</p>
            <h1 className="mt-2 font-display text-4xl font-semibold">Return to your Agent Garden</h1>
            <p className="mt-4 max-w-sm text-sm leading-6 text-[#dcecdf]">Your topic agents, document analysis, and saved conversations are waiting in one private workspace.</p>
          </div>
          <p className="text-xs text-[#cde7d3]">One account. One garden. Every document conversation.</p>
        </section>
        <section className="flex min-h-[520px] items-center justify-center p-6 sm:p-10">
          {isClerkConfigured ? (
            <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" forceRedirectUrl="/" />
          ) : (
            <div className="max-w-sm text-center">
              <span className="mx-auto grid size-12 place-items-center rounded-full bg-[#e4f0df] text-[#2b6b42]"><LogIn size={22} /></span>
              <h2 className="mt-4 font-display text-2xl font-semibold">Local development mode</h2>
              <p className="mt-2 text-sm leading-6 text-[#607267]">Add Clerk keys to <code className="rounded bg-[#edf2e9] px-1.5 py-0.5">.env.local</code> to enable account login. The app currently uses its local development profile.</p>
              <Link href="/" className="mt-5 inline-flex h-10 items-center rounded-md bg-[#225f3b] px-4 text-sm font-semibold text-white">Continue to garden</Link>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
