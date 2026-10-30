import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/token";

/** /p/* needs a patient session, /d/* a doctor session; others go to /login. */
function requiredRole(pathname: string): "PATIENT" | "DOCTOR" | null {
  if (pathname === "/p" || pathname.startsWith("/p/")) return "PATIENT";
  if (pathname === "/d" || pathname.startsWith("/d/") || pathname.startsWith("/dev/")) return "DOCTOR";
  return null;
}

export async function middleware(req: NextRequest) {
  const role = requiredRole(req.nextUrl.pathname);
  if (!role) return NextResponse.next();
  const claims = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (claims?.role === role) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = `?next=${encodeURIComponent(req.nextUrl.pathname)}`;
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/p", "/p/:path*", "/d", "/d/:path*", "/dev/:path*"] };
