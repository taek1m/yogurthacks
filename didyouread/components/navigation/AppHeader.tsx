"use client";

import { Show, SignInButton, UserButton } from "@clerk/nextjs";
import { Home, Plus, Settings, UserRound, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AGENTS_TOGGLE_EVENT } from "@/components/agent-garden/gardenEvents";
import { CreateTopicModal, openTopicAgent } from "@/components/agents/CreateTopicModal";
import { GlobalSearch } from "@/components/navigation/GlobalSearch";
import { LocalProfileMenu } from "@/components/navigation/LocalProfileMenu";
import { HeaderPanels } from "@/components/navigation/HeaderPanels";

export function AppHeader() {
  const clerkConfigured = Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  );
  // The agent list only exists on the garden, so the toggle only shows there.
  const onGarden = usePathname() === "/";
  const [agentsOpen, setAgentsOpen] = useState(true);

  // One path in and out: the button asks, the event decides, both sides follow.
  useEffect(() => {
    const sync = (event: Event) => setAgentsOpen((event as CustomEvent<boolean>).detail);
    window.addEventListener(AGENTS_TOGGLE_EVENT, sync);
    return () => window.removeEventListener(AGENTS_TOGGLE_EVENT, sync);
  }, []);

  function toggleAgents() {
    window.dispatchEvent(new CustomEvent(AGENTS_TOGGLE_EVENT, { detail: !agentsOpen }));
  }

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-[#d9e4d6] bg-[#fffef9]/95 backdrop-blur">
        <div className="mx-auto grid min-h-16 max-w-[1500px] grid-cols-[auto_1fr_auto] items-center gap-2 px-3 sm:gap-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <Link
              href="/"
              aria-label="Agent Garden home"
              title="Home"
              className="grid size-10 shrink-0 place-items-center rounded-md border border-[#d5e0d1] bg-white text-[#315d40] transition hover:bg-[#eff7ec] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#327a4a]"
            >
              <Home size={19} aria-hidden="true" />
            </Link>

            {onGarden && (
              <button
                type="button"
                data-agents-toggle
                onClick={toggleAgents}
                aria-pressed={agentsOpen}
                aria-label={agentsOpen ? "Hide the agent list" : "Show the agent list"}
                title="Your agents"
                className={`grid size-10 shrink-0 place-items-center rounded-md border transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#327a4a] ${
                  agentsOpen
                    ? "border-[#9dbfa8] bg-[#e7f2e3] text-[#245c39]"
                    : "border-[#d5e0d1] bg-white text-[#315d40] hover:bg-[#eff7ec]"
                }`}
              >
                <Users size={19} aria-hidden="true" />
              </button>
            )}

          </div>

          <GlobalSearch />

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={openTopicAgent}
              title="Create a new agent"
              aria-label="Create a new agent"
              className="grid size-10 shrink-0 place-items-center rounded-md bg-[#225f3b] text-white shadow-sm transition hover:bg-[#184b2d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#225f3b]"
            >
              <Plus size={20} aria-hidden="true" />
            </button>

            <HeaderPanels />

            <div className="grid size-10 place-items-center rounded-full border border-[#d5e0d1] bg-white">
              {clerkConfigured ? (
                <>
                  <Show when="signed-in">
                    <UserButton
                      userProfileMode="navigation"
                      userProfileUrl="/settings"
                    >
                      <UserButton.MenuItems>
                        <UserButton.Link
                          label="Settings"
                          labelIcon={<Settings size={16} />}
                          href="/settings"
                        />
                        <UserButton.Action label="manageAccount" />
                        <UserButton.Action label="signOut" />
                      </UserButton.MenuItems>
                    </UserButton>
                  </Show>

                  <Show when="signed-out">
                    <SignInButton mode="redirect">
                      <button
                        type="button"
                        aria-label="Log in"
                        title="Log in"
                        className="grid size-10 place-items-center rounded-full text-[#315d40]"
                      >
                        <UserRound size={19} />
                      </button>
                    </SignInButton>
                  </Show>
                </>
              ) : (
                <LocalProfileMenu />
              )}
            </div>
          </div>
        </div>
      </header>

      <CreateTopicModal />
    </>
  );
}
