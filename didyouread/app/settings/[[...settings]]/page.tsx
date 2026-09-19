import { UserProfile } from "@clerk/nextjs";
import { Database, KeyRound, Settings } from "lucide-react";
import { redirect } from "next/navigation";
import { getCurrentUserId, isClerkConfigured } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const userId = await getCurrentUserId();
  if (isClerkConfigured && !userId) redirect("/sign-in");

  return (
    <div className="flex-1 bg-[#f3f7ef] px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-7 flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-md bg-[#dcebd8] text-[#2e6c43]"><Settings size={20} /></span>
          <div><p className="text-xs font-bold uppercase text-[#4c765a]">Profile</p><h1 className="font-display text-3xl font-semibold">Settings</h1></div>
        </div>

        {isClerkConfigured ? (
          <UserProfile routing="path" path="/settings" />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <section className="rounded-md border border-[#d4dfd1] bg-white p-5">
              <KeyRound className="text-[#347049]" size={22} />
              <h2 className="mt-3 font-semibold">Authentication</h2>
              <p className="mt-1 text-sm leading-6 text-[#607267]">Local profile active. Configure Clerk keys to manage a personal account, password, and active sessions.</p>
            </section>
            <section className="rounded-md border border-[#d4dfd1] bg-white p-5">
              <Database className="text-[#347049]" size={22} />
              <h2 className="mt-3 font-semibold">Agent storage</h2>
              <p className="mt-1 text-sm leading-6 text-[#607267]">{process.env.MONGODB_URI ? "MongoDB persistence is connected." : "Process-memory storage is active. Configure MongoDB for persistence across server restarts."}</p>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
