import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({
    request,
  });
  const isLogin = request.nextUrl.pathname.startsWith("/login");
  const isDemo = request.nextUrl.pathname.startsWith("/demo");
  const isAuthConfirmation = request.nextUrl.pathname.startsWith("/auth/confirm");
  const isApi = request.nextUrl.pathname.startsWith("/api/");

  if (isDemo || isAuthConfirmation) {
    return response;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    if (isApi) {
      return NextResponse.json({ error: "Server authentication is not configured." }, { status: 503 });
    }
    if (isLogin) return response;

    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("error", "not_configured");
    return NextResponse.redirect(url);
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const authorization = request.headers.get("authorization");
  const accessToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  const {
    data: { user },
  } = await supabase.auth.getUser(accessToken);

  const allowedEmails = [
    ...(process.env.ALLOWED_EMAILS ?? "").split(","),
    process.env.ALLOWED_EMAIL ?? "",
  ]
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  const userEmail = user?.email?.trim().toLowerCase();
  const isAllowed =
    allowedEmails.length === 0 ||
    Boolean(userEmail && allowedEmails.includes(userEmail));

  if (!user && !isLogin) {
    if (isApi) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && !isAllowed && !isLogin) {
    if (isApi) {
      return NextResponse.json({ error: "This account is not allowed to use the API." }, { status: 403 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("error", "not_allowed");
    return NextResponse.redirect(url);
  }

  if (user && isLogin && isAllowed) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
