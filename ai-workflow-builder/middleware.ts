export { default } from "next-auth/middleware";

export const config = {
  matcher: ["/dashboard/:path*", "/workflow/:path*", "/api/workflows/:path*"],
};