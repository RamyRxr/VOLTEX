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
    distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next",
  };
}
