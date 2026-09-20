import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";

/** Pages a signed-out visitor is allowed to reach. */
const isPublic = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)"]);

const clerkProxy = clerkMiddleware(async (auth, request) => {
  if (isPublic(request)) return;
  // API routes guard themselves with requireUserId and answer 401 in JSON.
  // Redirecting them would hand a fetch() an HTML sign-in page instead.
  if (request.nextUrl.pathname.startsWith("/api/")) return;
  // A signed-out visitor lands on the sign-in page rather than a bare 404.
  await auth.protect({
    unauthenticatedUrl: new URL("/sign-in", request.url).toString(),
  });
});

export default function proxy(request: NextRequest, event: NextFetchEvent) {
  // Without Clerk keys the app runs as a single local user, so nothing to guard.
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || !process.env.CLERK_SECRET_KEY) {
    return NextResponse.next();
  }

  return clerkProxy(request, event);
}

export const config = {
  matcher: ["/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico)).*)"],
};
