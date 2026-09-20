import { clerkClient } from "@clerk/nextjs/server";
import { isClerkConfigured } from "@/lib/auth";

/** Writing events needs this scope on the Google connection in the Clerk dashboard. */
export const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";

export type ReminderOutcome =
  | { ok: true; htmlLink?: string }
  | { ok: false; reason: "no_google" | "no_scope" | "failed" };

/** Reads a date out of the shapes documents actually print. */
export function readReminderDate(value: string | undefined): string | null {
  if (!value) return null;
  const text = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

  const named = text.match(
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})\b/i,
  );
  if (named) {
    const month = new Date(`${named[1]} 1, 2000`).getMonth() + 1;
    return `${named[3]}-${String(month).padStart(2, "0")}-${named[2].padStart(2, "0")}`;
  }

  const slashed = text.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/);
  if (slashed) {
    const year = slashed[3].length === 2 ? `20${slashed[3]}` : slashed[3];
    return `${year}-${slashed[1].padStart(2, "0")}-${slashed[2].padStart(2, "0")}`;
  }

  // "within 60 days" and friends: count forward from today.
  const days = text.match(/\b(\d{1,3})\s+(?:calendar |business )?days\b/i);
  if (days) {
    const due = new Date(Date.now() + Number(days[1]) * 86400000);
    return due.toISOString().slice(0, 10);
  }
  return null;
}

function nextDay(date: string): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
}

/**
 * Puts an all-day reminder on the reader's own Google Calendar, using the token
 * Clerk holds from their Google sign-in. Callers fall back to a download when
 * this says no: the account may not be Google, or may not have granted calendar
 * access.
 */
export async function addCalendarReminder(
  userId: string,
  reminder: { title: string; detail?: string; date: string },
): Promise<ReminderOutcome> {
  if (!isClerkConfigured) return { ok: false, reason: "no_google" };

  let token: string | undefined;
  try {
    const client = await clerkClient();
    const tokens = await client.users.getUserOauthAccessToken(userId, "google");
    token = tokens.data[0]?.token;
  } catch {
    return { ok: false, reason: "no_google" };
  }
  if (!token) return { ok: false, reason: "no_google" };

  const response = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        summary: reminder.title,
        description: reminder.detail,
        // All-day: Google treats `end` as exclusive, so it is the following day.
        start: { date: reminder.date },
        end: { date: nextDay(reminder.date) },
        reminders: { useDefault: true },
      }),
    },
  );

  if (response.ok) {
    const event = (await response.json()) as { htmlLink?: string };
    return { ok: true, htmlLink: event.htmlLink };
  }
  // 403 here almost always means the calendar scope was never granted.
  if (response.status === 401 || response.status === 403) return { ok: false, reason: "no_scope" };
  console.error("Google Calendar rejected the reminder", response.status, await response.text());
  return { ok: false, reason: "failed" };
}
