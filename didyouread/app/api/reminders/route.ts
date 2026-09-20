import { authErrorResponse, requireUserId } from "@/lib/auth";
import { addCalendarReminder, readReminderDate } from "@/lib/google-calendar";

export async function POST(request: Request) {
  try {
    const userId = await requireUserId();
    const payload = (await request.json()) as { title?: unknown; detail?: unknown; date?: unknown };
    const title = typeof payload.title === "string" ? payload.title.trim().slice(0, 180) : "";
    if (!title) return Response.json({ error: "A reminder needs a title" }, { status: 400 });

    // Fall back to tomorrow when the document never named a date.
    const date =
      readReminderDate(typeof payload.date === "string" ? payload.date : undefined) ??
      new Date(Date.now() + 86400000).toISOString().slice(0, 10);

    const result = await addCalendarReminder(userId, {
      title,
      detail: typeof payload.detail === "string" ? payload.detail.slice(0, 600) : undefined,
      date,
    });

    if (result.ok) return Response.json({ date, link: result.htmlLink });
    return Response.json({ reason: result.reason, date }, { status: result.reason === "failed" ? 502 : 409 });
  } catch (error) {
    return authErrorResponse(error) ?? Response.json({ error: "Could not add the reminder" }, { status: 500 });
  }
}
