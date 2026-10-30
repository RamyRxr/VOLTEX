/** Hand-drawn icon set (no icon library). Always paired with a visible word. */
export type IconName =
  | "alert-octagon"
  | "alert-triangle"
  | "clock"
  | "check-circle"
  | "phone"
  | "message"
  | "arrow-right"
  | "chevron"
  | "search"
  | "printer"
  | "logout"
  | "trend-up"
  | "trend-down"
  | "trend-flat";

const PATHS: Record<IconName, React.ReactNode> = {
  "alert-octagon": (
    <>
      <path d="M5.3 1.5h5.4l3.8 3.8v5.4l-3.8 3.8H5.3L1.5 10.7V5.3Z" />
      <path d="M8 4.6v4" />
      <circle cx="8" cy="11.1" r="0.6" fill="currentColor" />
    </>
  ),
  "alert-triangle": (
    <>
      <path d="M8 1.8 14.6 13.6H1.4Z" />
      <path d="M8 6v3.6" />
      <circle cx="8" cy="11.5" r="0.6" fill="currentColor" />
    </>
  ),
  clock: (
    <>
      <circle cx="8" cy="8" r="6.3" />
      <path d="M8 4.4V8l2.5 1.6" />
    </>
  ),
  "check-circle": (
    <>
      <circle cx="8" cy="8" r="6.3" />
      <path d="m5.2 8.2 1.9 1.9 3.8-4" />
    </>
  ),
  phone: (
    <path d="M3.8 1.9h2.4l1 3-1.5 1.1a8.8 8.8 0 0 0 4.3 4.3l1.1-1.5 3 1v2.4c0 .8-.6 1.4-1.4 1.4A12.3 12.3 0 0 1 2.4 3.3c0-.8.6-1.4 1.4-1.4Z" />
  ),
  message: <path d="M2 3h12v8H6.5L3.5 13.5V11H2Z" />,
  "arrow-right": <path d="M2 8h12M9 3l5 5-5 5" />,
  chevron: <path d="m6 3 5 5-5 5" />,
  search: (
    <>
      <circle cx="7" cy="7" r="4.6" />
      <path d="m10.5 10.5 3.6 3.6" />
    </>
  ),
  printer: (
    <>
      <path d="M4 6V1.8h8V6" />
      <path d="M4 11.5H2.2V6h11.6v5.5H12" />
      <path d="M4 9.5h8v4.7H4Z" />
    </>
  ),
  logout: (
    <>
      <path d="M6 2H2.5v12H6" />
      <path d="M10.5 4.5 14 8l-3.5 3.5M14 8H6" />
    </>
  ),
  "trend-up": <path d="M2 12 14 4M8.5 4H14v5.5" />,
  "trend-down": <path d="M2 4l12 8M8.5 12H14V6.5" />,
  "trend-flat": <path d="M2 8h12M10.5 4.5 14 8l-3.5 3.5" />,
};

export function Icon({ name, size = 14, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
      style={{ flex: "none" }}
    >
      {PATHS[name]}
    </svg>
  );
}
