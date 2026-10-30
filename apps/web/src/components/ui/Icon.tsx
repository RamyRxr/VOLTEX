/** Small stroke icon set (16 px grid). Decorative unless a label is given. */
export type IconName =
  | "octagon"
  | "triangle"
  | "eye"
  | "clock"
  | "check"
  | "pulse"
  | "users"
  | "bell"
  | "key"
  | "logout"
  | "search"
  | "chevron-left"
  | "chevron-right"
  | "send"
  | "sparkle"
  | "note"
  | "copy"
  | "phone"
  | "plus"
  | "x";

const PATHS: Readonly<Record<IconName, React.ReactNode>> = {
  octagon: (
    <>
      <path d="M5.5 1.5h5l4 4v5l-4 4h-5l-4-4v-5Z" />
      <path d="M8 4.5v4M8 11v.5" />
    </>
  ),
  triangle: (
    <>
      <path d="M8 1.8 15 14H1Z" />
      <path d="M8 6v3.5M8 11.6v.4" />
    </>
  ),
  eye: (
    <>
      <path d="M1 8s2.6-5 7-5 7 5 7 5-2.6 5-7 5-7-5-7-5Z" />
      <circle cx="8" cy="8" r="2" />
    </>
  ),
  clock: (
    <>
      <circle cx="8" cy="8" r="6.5" />
      <path d="M8 4.5V8l2.5 1.5" />
    </>
  ),
  check: (
    <>
      <circle cx="8" cy="8" r="6.5" />
      <path d="m5 8.2 2 2 4-4.2" />
    </>
  ),
  pulse: <path d="M1 8h3l1.5-4 3 8L10 8h5" />,
  users: (
    <>
      <circle cx="6" cy="5" r="2.5" />
      <path d="M1.5 14c0-2.5 2-4.5 4.5-4.5s4.5 2 4.5 4.5M11 2.8a2.5 2.5 0 0 1 0 4.4M12.5 9.8c1.2.6 2 1.9 2 4.2" />
    </>
  ),
  bell: (
    <>
      <path d="M4 11V7a4 4 0 0 1 8 0v4l1.5 1.5h-11Z" />
      <path d="M6.5 14.2a1.6 1.6 0 0 0 3 0" />
    </>
  ),
  key: (
    <>
      <circle cx="5" cy="10.5" r="3" />
      <path d="m7.2 8.3 6.3-6.3M11 4.5l2 2M12.5 3l1.5 1.5" />
    </>
  ),
  logout: (
    <>
      <path d="M6 2H2.5v12H6" />
      <path d="M10.5 4.5 14 8l-3.5 3.5M14 8H6" />
    </>
  ),
  search: (
    <>
      <circle cx="7" cy="7" r="4.5" />
      <path d="m10.5 10.5 3.5 3.5" />
    </>
  ),
  "chevron-left": <path d="M10 3 5 8l5 5" />,
  "chevron-right": <path d="m6 3 5 5-5 5" />,
  send: <path d="M14.5 1.5 7 9M14.5 1.5 10 14.5 7 9 1.5 6Z" />,
  sparkle: <path d="M8 1.5 9.4 6.6 14.5 8 9.4 9.4 8 14.5 6.6 9.4 1.5 8 6.6 6.6Z" />,
  note: (
    <>
      <path d="M3 1.5h7l3 3v10H3Z" />
      <path d="M5.5 7h5M5.5 9.5h5M5.5 12h3" />
    </>
  ),
  copy: (
    <>
      <rect x="5" y="5" width="9" height="9" rx="1.5" />
      <path d="M11 5V3a1.5 1.5 0 0 0-1.5-1.5h-6A1.5 1.5 0 0 0 2 3v6a1.5 1.5 0 0 0 1.5 1.5H5" />
    </>
  ),
  phone: <path d="M3 1.5h3l1.5 3.5-2 1.3a8 8 0 0 0 4.2 4.2l1.3-2 3.5 1.5v3A1.5 1.5 0 0 1 13 14.5 11.5 11.5 0 0 1 1.5 3 1.5 1.5 0 0 1 3 1.5Z" />,
  plus: <path d="M8 2.5v11M2.5 8h11" />,
  x: <path d="m3.5 3.5 9 9M12.5 3.5l-9 9" />,
};

export function Icon({ name, size = 16, label }: { name: IconName; size?: number; label?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
