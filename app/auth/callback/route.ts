import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") ?? "/dashboard";
  const error = requestUrl.searchParams.get("error");
  const errorDescription = requestUrl.searchParams.get("error_description");

  // Determine fallback page based on intent
  const fallbackPath = next.startsWith("/reset-password") ? "/reset-password" : "/login";

  if (error) {
    const redirectUrl = new URL(fallbackPath, requestUrl.origin);
    redirectUrl.searchParams.set("error", error);
    if (errorDescription) {
      redirectUrl.searchParams.set("error_description", errorDescription);
    }
    return NextResponse.redirect(redirectUrl);
  }

  if (code) {
    const supabase = await createClient();
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (!exchangeError) {
      const forwardedHost = request.headers.get("x-forwarded-host");
      const isLocalEnv = process.env.NODE_ENV === "development";
      const targetPath = next.startsWith("/") ? next : `/${next}`;

      if (isLocalEnv) {
        return NextResponse.redirect(`${requestUrl.origin}${targetPath}`);
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${targetPath}`);
      } else {
        return NextResponse.redirect(`${requestUrl.origin}${targetPath}`);
      }
    }

    const redirectUrl = new URL(fallbackPath, requestUrl.origin);
    redirectUrl.searchParams.set("error", exchangeError.message);
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.redirect(new URL("/login", requestUrl.origin));
}

