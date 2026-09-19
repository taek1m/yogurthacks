"use client";

import { LogIn, Settings, UserRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export function LocalProfileMenu() {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  return (
    <div ref={container} className="relative">
      <button type="button" aria-label="Open profile menu" aria-expanded={open} onClick={() => setOpen((value) => !value)} className="grid size-10 place-items-center rounded-full text-[#315d40] hover:bg-[#edf4ea] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#327a4a]">
        <UserRound size={19} />
      </button>
      {open && (
        <div className="absolute right-0 top-[calc(100%+0.6rem)] w-48 rounded-md border border-[#d5e0d1] bg-white p-1.5 shadow-xl">
          <p className="px-3 py-2 text-xs font-bold uppercase text-[#708477]">Local profile</p>
          <Link href="/sign-in" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded px-3 py-2 text-sm font-semibold hover:bg-[#eef6ec]"><LogIn size={16} />Log in</Link>
          <Link href="/settings" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded px-3 py-2 text-sm font-semibold hover:bg-[#eef6ec]"><Settings size={16} />Settings</Link>
        </div>
      )}
    </div>
  );
}
