import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppProviders } from "@/components/AppProviders";
import { AppHeader } from "@/components/navigation/AppHeader";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agent Garden | didyoureadthefine.ink",
  description: "Turn important documents into persistent, helpful agents.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-[#f8fbf5] text-[#183126]">
        <AppProviders>
          <div className="flex min-h-screen flex-col">
            <AppHeader />
            <main className="flex flex-1 flex-col">{children}</main>
          </div>
        </AppProviders>
      </body>
    </html>
  );
}
