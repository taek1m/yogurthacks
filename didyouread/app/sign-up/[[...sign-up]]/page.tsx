import { SignUp } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { getCurrentUserId, isClerkConfigured } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function SignUpPage() {
  if (isClerkConfigured && (await getCurrentUserId())) redirect("/");
  if (!isClerkConfigured) redirect("/sign-in");

  return (
    <div className="flex flex-1 items-center justify-center bg-[#e8f3ee] px-4 py-12">
      <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" forceRedirectUrl="/" />
    </div>
  );
}
