import nextConstants from "next/constants.js";

const { PHASE_DEVELOPMENT_SERVER } = nextConstants;

/**
 * `next dev` writes to .next-dev, `next build`/`next start` to .next.
 * Running both at once (or switching between them) can no longer corrupt
 * the other's output ("__webpack_modules__[moduleId] is not a function").
 *
 * @param {string} phase
 * @returns {import('next').NextConfig}
 */
export default function nextConfig(phase) {
  return {
    reactStrictMode: true,
    poweredByHeader: false,
    distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next",
    /** Defence in depth for a health-data app (no inline-script CSP: hydration needs it). */
    async headers() {
      return [
        {
          source: "/:path*",
          headers: [
            { key: "X-Content-Type-Options", value: "nosniff" },
            { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
            { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
            { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
            { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          ],
        },
      ];
    },
    /** The first prototype used /doctor and /patient; CLAUDE.md §3 uses /d and /p. */
    async redirects() {
      return [
        { source: "/doctor/indicateurs", destination: "/d/indicators", permanent: false },
        { source: "/doctor", destination: "/d", permanent: false },
        { source: "/doctor/:path*", destination: "/d/:path*", permanent: false },
        { source: "/patient", destination: "/p", permanent: false },
        { source: "/patient/:path*", destination: "/p/:path*", permanent: false },
      ];
    },
  };
}
