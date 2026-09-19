"use client";

import { CircleAlert, RotateCcw } from "lucide-react";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-[#f3f7ef] px-5 text-center">
      <div>
        <CircleAlert size={36} className="mx-auto text-[#a34a39]" />
        <h1 className="mt-4 font-display text-3xl font-semibold">The garden could not load</h1>
        <p className="mt-2 text-sm text-[#607267]">Your agents are still safe. Try loading this view again.</p>
        <button type="button" onClick={reset} className="mt-5 inline-flex h-10 items-center gap-2 rounded-md bg-[#225f3b] px-4 text-sm font-semibold text-white hover:bg-[#184b2d]"><RotateCcw size={17} />Try again</button>
      </div>
    </div>
  );
}
