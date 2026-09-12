import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get("alphaquant_session");

  const isProtectedRoute =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/operacoes") ||
    pathname.startsWith("/contas") ||
    pathname.startsWith("/historico") ||
    pathname.startsWith("/estatisticas") ||
    pathname.startsWith("/admin");

  if (isProtectedRoute && !sessionCookie) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname === "/login" && sessionCookie) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
