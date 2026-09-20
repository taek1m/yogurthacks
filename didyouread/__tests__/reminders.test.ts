// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getUserOauthAccessToken = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: async () => ({ users: { getUserOauthAccessToken } }),
}));
vi.mock("@/lib/auth", () => ({ isClerkConfigured: true }));

const { addCalendarReminder, readReminderDate, CALENDAR_SCOPE } = await import("@/lib/google-calendar");

const reminder = { title: "Confirm: first payment", date: "2026-10-15" };

describe("reading a date out of a document", () => {
  it("takes the shapes contracts actually print", () => {
    expect(readReminderDate("2026-10-15")).toBe("2026-10-15");
    expect(readReminderDate("October 15, 2026")).toBe("2026-10-15");
    expect(readReminderDate("10/15/2026")).toBe("2026-10-15");
    expect(readReminderDate("no date here")).toBeNull();
  });
});

describe("writing to the reader's Google Calendar", () => {
  beforeEach(() => getUserOauthAccessToken.mockReset());
  afterEach(() => vi.unstubAllGlobals());

  it("says no_google when the account was never linked", async () => {
    getUserOauthAccessToken.mockResolvedValue({ data: [] });
    expect(await addCalendarReminder("user_1", reminder)).toEqual({ ok: false, reason: "no_google" });
  });

  it("does not call Google when the calendar scope was never granted", async () => {
    getUserOauthAccessToken.mockResolvedValue({
      data: [{ token: "ya29.token", scopes: ["https://www.googleapis.com/auth/userinfo.email"] }],
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    expect(await addCalendarReminder("user_1", reminder)).toEqual({ ok: false, reason: "no_scope" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("books an all-day event on the day the document named", async () => {
    getUserOauthAccessToken.mockResolvedValue({ data: [{ token: "ya29.token", scopes: [CALENDAR_SCOPE] }] });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ htmlLink: "https://calendar.google.com/event?eid=1" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await addCalendarReminder("user_1", reminder);

    expect(result).toEqual({ ok: true, htmlLink: "https://calendar.google.com/event?eid=1" });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.start).toEqual({ date: "2026-10-15" });
    // Google reads the end of an all-day event as exclusive.
    expect(body.end).toEqual({ date: "2026-10-16" });
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer ya29.token");
  });

  it("reports a rejected token as a missing scope, not a crash", async () => {
    getUserOauthAccessToken.mockResolvedValue({ data: [{ token: "stale", scopes: [CALENDAR_SCOPE] }] });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 403, text: async () => "forbidden" }));

    expect(await addCalendarReminder("user_1", reminder)).toEqual({ ok: false, reason: "no_scope" });
  });
});
