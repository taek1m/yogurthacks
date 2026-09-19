"use client";

import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import { FileUp, Home, Leaf, Settings, UserRound } from "lucide-react";
import Link from "next/link";
import { CreateTopicModal } from "@/components/agents/CreateTopicModal";
import { GlobalSearch } from "@/components/navigation/GlobalSearch";
import { LocalProfileMenu } from "@/components/navigation/LocalProfileMenu";
import { HeaderPanels } from "@/components/navigation/HeaderPanels";
import { UploadModal, openUpload } from "@/components/upload/UploadModal";

export function AppHeader() {
  const clerkConfigured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-[#d9e4d6] bg-[#fffef9]/95 backdrop-blur">
        <div className="mx-auto grid min-h-16 max-w-[1500px] grid-cols-[auto_1fr_auto] items-center gap-2 px-3 sm:gap-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-2 sm:gap-4">
            <Link href="/" aria-label="Agent Garden home" title="Home" className="grid size-10 shrink-0 place-items-center rounded-md border border-[#d5e0d1] bg-white text-[#315d40] transition hover:bg-[#eff7ec] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#327a4a]">
              <Home size={19} aria-hidden="true" />
            </Link>
            <Link href="/" className="flex min-w-0 items-center gap-2 font-semibold text-[#173c28] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#327a4a]">
              <span className="hidden size-8 shrink-0 place-items-center rounded-full bg-[#2f7449] text-white sm:grid"><Leaf size={17} aria-hidden="true" /></span>
              <span className="hidden truncate text-sm lg:block">didyoureadthefine.ink</span>
            </Link>
          </div>
          <GlobalSearch />
          <div className="flex items-center justify-end gap-2">
            <HeaderPanels />
            <button type="button" onClick={openUpload} className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#225f3b] px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#184b2d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#225f3b] sm:px-4">
              <FileUp size={18} aria-hidden="true" /><span className="hidden sm:inline">Upload document</span>
            </button>
            <div className="grid size-10 place-items-center rounded-full border border-[#d5e0d1] bg-white">
              {clerkConfigured ? (
                <>
                  <SignedIn>
                    <UserButton userProfileMode="navigation" userProfileUrl="/settings">
                      <UserButton.MenuItems>
                        <UserButton.Link label="Settings" labelIcon={<Settings size={16} />} href="/settings" />
                        <UserButton.Action label="manageAccount" />
                        <UserButton.Action label="signOut" />
                      </UserButton.MenuItems>
                    </UserButton>
                  </SignedIn>
                  <SignedOut>
                    <SignInButton mode="redirect">
                      <button type="button" aria-label="Log in" title="Log in" className="grid size-10 place-items-center rounded-full text-[#315d40]"><UserRound size={19} /></button>
                    </SignInButton>
                  </SignedOut>
                </>
              ) : <LocalProfileMenu />}
            </div>
          </div>
        </div>
      </header>
      <CreateTopicModal />
      <UploadModal />
    </>
  );
}
