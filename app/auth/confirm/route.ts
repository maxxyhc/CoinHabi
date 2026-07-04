import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const redirectTo = request.nextUrl.clone();
  redirectTo.pathname = "/";
  redirectTo.search = "";

  if (!supabaseUrl || !supabaseKey) {
    return redirectToLogin(request, "confirmation_failed");
  }

  const response = NextResponse.redirect(redirectTo);
  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;
  const code = request.nextUrl.searchParams.get("code");

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });
    return error ? redirectToLogin(request, "confirmation_failed") : response;
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    return error ? redirectToLogin(request, "confirmation_failed") : response;
  }

  return redirectToLogin(request, "confirmation_failed");
}

function redirectToLogin(request: NextRequest, error: string) {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  url.searchParams.set("error", error);
  return NextResponse.redirect(url);
}
