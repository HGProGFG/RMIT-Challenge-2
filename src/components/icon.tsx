import type { CSSProperties } from "react";
export type IconName = "vault" | "grid" | "activity" | "shield" | "users" | "arrow" | "plus" | "search" | "chevron" | "lock" | "file" | "clock" | "check" | "close" | "upload" | "eye" | "download" | "logout" | "refresh" | "info" | "menu" | "key" | "external" | "code";
const paths: Record<IconName, React.ReactNode> = {
  vault: <><rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="12" cy="12" r="4"/><path d="M12 6v2m0 8v2m-6-6h2m8 0h2m-9-3 1 1m4 4 1 1m0-6-1 1m-4 4-1 1"/></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
  activity: <><path d="M3 12h4l3-8 4 16 3-8h4"/></>,
  shield: <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z"/><path d="m8.5 12 2.5 2.5 4.5-5"/></>,
  users: <><circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3m1-16a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 4v3"/></>,
  arrow: <><path d="M4 12h16m-6-6 6 6-6 6"/></>, plus: <path d="M12 5v14M5 12h14"/>,
  search: <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></>,
  chevron: <path d="m9 5 7 7-7 7"/>,
  lock: <><rect x="5" y="10" width="14" height="11" rx="2.5"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/></>,
  file: <><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8m-8 4h5"/></>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  check: <path d="m5 12 4 4L19 6"/>, close: <path d="m6 6 12 12M6 18 18 6"/>,
  upload: <><path d="M12 16V3m-5 5 5-5 5 5M4 15v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5"/></>,
  eye: <><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></>,
  download: <><path d="M12 3v13m-5-5 5 5 5-5M4 16v5h16v-5"/></>,
  logout: <><path d="M9 4H4v16h5m5-13 5 5-5 5m-6-5h11"/></>,
  refresh: <><path d="M20 7v5h-5M4 17v-5h5"/><path d="M6 7a7 7 0 0 1 12-1l2 6M4 12l2 6a7 7 0 0 0 12-1"/></>,
  info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.1"/></>,
  menu: <path d="M4 6h16M4 12h16M4 18h16"/>,
  key: <><circle cx="8" cy="8" r="5"/><path d="m12 12 9 9m-6-6 3-3m0 6 3-3"/></>,
  external: <><path d="M14 3h7v7m0-7L10 14M11 4H4v16h16v-7"/></>,
  code: <><path d="m8 7-5 5 5 5m8-10 5 5-5 5m-7 7 4-18"/></>,
};
export function Icon({ name, size = 20, className, style }: { name: IconName; size?: number; className?: string; style?: CSSProperties }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className} style={style}>{paths[name]}</svg>;
}
