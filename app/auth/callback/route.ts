import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { type EmailOtpType } from "@supabase/supabase-js";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const token_hash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type") as EmailOtpType | null;
  const next = requestUrl.searchParams.get("next") ?? "/dashboard";
  const error = requestUrl.searchParams.get("error");
  const errorDescription = requestUrl.searchParams.get("error_description");

  // If this is a password recovery flow, destination is always reset-password
  const isRecovery = type === "recovery" || next.startsWith("/reset-password");
  const fallbackPath = isRecovery ? "/reset-password" : "/login";
  const targetDestination = isRecovery ? "/reset-password" : next;

  if (error) {
    const redirectUrl = new URL(fallbackPath, requestUrl.origin);
    redirectUrl.searchParams.set("error", error);
    if (errorDescription) {
      redirectUrl.searchParams.set("error_description", errorDescription);
    }
    return NextResponse.redirect(redirectUrl);
  }

  const supabase = await createClient();

  // 1. Verify token_hash if present (standard Supabase email link flow)
  if (token_hash && type) {
    const { error: verifyError } = await supabase.auth.verifyOtp({
      token_hash,
      type,
    });

    if (!verifyError) {
      return getRedirectResponse(request, requestUrl, targetDestination);
    }

    const redirectUrl = new URL(fallbackPath, requestUrl.origin);
    redirectUrl.searchParams.set("error", verifyError.message);
    return NextResponse.redirect(redirectUrl);
  }

  // 2. Exchange code if present (PKCE flow)
  if (code) {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (!exchangeError) {
      return getRedirectResponse(request, requestUrl, targetDestination);
    }

    const redirectUrl = new URL(fallbackPath, requestUrl.origin);
    redirectUrl.searchParams.set("error", exchangeError.message);
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.redirect(new URL("/login", requestUrl.origin));
}

function getRedirectResponse(request: Request, requestUrl: URL, targetPath: string) {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const isLocalEnv = process.env.NODE_ENV === "development";
  const formattedTarget = targetPath.startsWith("/") ? targetPath : `/${targetPath}`;

  if (isLocalEnv) {
    return NextResponse.redirect(`${requestUrl.origin}${formattedTarget}`);
  } else if (forwardedHost) {
    return NextResponse.redirect(`https://${forwardedHost}${formattedTarget}`);
  } else {
    return NextResponse.redirect(`${requestUrl.origin}${formattedTarget}`);
  }
}
