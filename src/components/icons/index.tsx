import type { SVGProps } from 'react';

/**
 * Bộ icon kỹ thuật riêng cho DDC Control Tower.
 * Style thống nhất: 24×24 viewBox, stroke-based `currentColor`, strokeWidth 1.7,
 * round cap/join - theme-aware (đổi màu theo currentColor).
 * Thêm icon mới: bám đúng style này.
 */

export type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function IconBase({ size = 24, children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

// ---- Navigation ----
export const IconOverview = (p: IconProps) => (
  <IconBase {...p}>
    <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
    <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
    <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
    <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
  </IconBase>
);

export const IconProject = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
    <path d="M14 3v5h5" />
    <path d="M9 13h6M9 17h4" />
  </IconBase>
);

export const IconDataEntry = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    <path d="m15 5 4 4" />
  </IconBase>
);

export const IconAdmin = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M4 6h16M4 12h16M4 18h16" />
    <circle cx="9" cy="6" r="2" />
    <circle cx="15" cy="12" r="2" />
    <circle cx="7" cy="18" r="2" />
  </IconBase>
);

export const IconSchema = (p: IconProps) => (
  <IconBase {...p}>
    <circle cx="5" cy="6" r="2" />
    <circle cx="19" cy="6" r="2" />
    <circle cx="12" cy="18" r="2" />
    <path d="M7 6h10M7 7.5 10.5 16M17 7.5 13.5 16" />
  </IconBase>
);

// ---- Domain (kết cấu thép) ----
export const IconFactory = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M3 21V8l6 4V8l6 4V8l6 4v9" />
    <path d="M3 21h18" />
    <path d="M9 21v-3h2v3" />
  </IconBase>
);

export const IconCrane = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M3 21h18" />
    <path d="M5 21V9h11v12" />
    <path d="M8 9V5l6-2v6" />
    <path d="M19 7v5" />
    <path d="M16 12h6l-3 4Z" />
    <path d="M19 12v2.5" />
  </IconBase>
);

export const IconSteelBeam = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M12 3v18" />
    <path d="M5 8h14M5 16h14" />
    <path d="M4 21h16M4 3h16" />
  </IconBase>
);

export const IconTruck = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M3 7h11v8H3z" />
    <path d="M14 10h4l3 3v2h-7" />
    <circle cx="7" cy="17" r="1.8" />
    <circle cx="17" cy="17" r="1.8" />
  </IconBase>
);

export const IconBolt = (p: IconProps) => (
  <IconBase {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="m12 9 1.2-1.2 3.4 3.4L12 15l-3.4-3.4L12 9Z" />
  </IconBase>
);

export const IconShip = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M3 14h18v2a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3Z" />
    <path d="M5 14 7 6h10l2 8" />
    <path d="M12 3v3M9.5 3h5" />
  </IconBase>
);

export const IconStadium = (p: IconProps) => (
  <IconBase {...p}>
    <ellipse cx="12" cy="14" rx="8" ry="4" />
    <path d="M4 14v4c0 2.2 3.6 4 8 4s8-1.8 8-4v-4" />
    <path d="M12 10V6M9 8h6" />
  </IconBase>
);

export const IconBuilding = (p: IconProps) => (
  <IconBase {...p}>
    <rect x="5" y="3" width="14" height="18" rx="1.5" />
    <path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2" />
    <path d="M9 21v-3h6v3" />
  </IconBase>
);

export const IconBridge = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M3 18h18" />
    <path d="M4 18c0-6 4-10 8-10s8 4 8 10" />
    <path d="M12 8v10M4 14h16" />
  </IconBase>
);

export const IconAirport = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M3 16h18" />
    <path d="M6 16 4 7l4 1 2 5 3-3-1-3 1.5-2L16 6l2 3-3 3-3-1-3 3-1 2Z" />
  </IconBase>
);

// ---- Metrics ----
export const IconTrend = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M3 3v18h18" />
    <path d="m6 15 4-4 3 3 5-6" />
    <path d="M15 8h3v3" />
  </IconBase>
);

export const IconDonut = (p: IconProps) => (
  <IconBase {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="4" />
    <path d="M12 3.5v5M20.5 12h-5" />
  </IconBase>
);

export const IconSCurve = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M3 3v18h18" />
    <path d="M4 18c3-12 7-2 10-14 2-2 5-1 6 0" />
  </IconBase>
);

export const IconAlert = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M12 3 2.5 20h19Z" />
    <path d="M12 10v4M12 17.5v.5" />
  </IconBase>
);

export const IconGauge = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M4 15a8 8 0 1 1 16 0" />
    <path d="m12 14 4-4" />
    <circle cx="12" cy="14" r="1.5" />
    <path d="M4 18h16" />
  </IconBase>
);

export const IconFlag = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M5 21V4" />
    <path d="M5 4c4-2 6 2 10 0v8c-4 2-6-2-10 0" />
  </IconBase>
);

// ---- Operations ----
export const IconReport = (p: IconProps) => (
  <IconBase {...p}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M7 15v-2M12 15V9M17 15v-4" />
  </IconBase>
);

export const IconBell = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.7 21a2 2 0 0 1-3.4 0" />
  </IconBase>
);

export const IconChecklist = (p: IconProps) => (
  <IconBase {...p}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="m8 11 2 2 4-4" />
    <path d="M8 16h8" />
  </IconBase>
);

export const IconHistory = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M3 12a9 9 0 1 0 2.64-6.36L3 8" />
    <path d="M3 3v5h5" />
    <path d="M12 7v5l3.5 2" />
  </IconBase>
);

// ---- Action ----
export const IconCalendar = (p: IconProps) => (
  <IconBase {...p}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M8 3v4M16 3v4M3 10h18" />
  </IconBase>
);

export const IconMoney = (p: IconProps) => (
  <IconBase {...p}>
    <rect x="2.5" y="6" width="19" height="12" rx="2" />
    <circle cx="12" cy="12" r="2.6" />
    <path d="M6 9h.01M18 15h.01" />
  </IconBase>
);

export const IconUser = (p: IconProps) => (
  <IconBase {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" />
  </IconBase>
);

export const IconPhoto = (p: IconProps) => (
  <IconBase {...p}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <circle cx="9" cy="10" r="1.6" />
    <path d="m3 16 5-4 4 3 3-3 6 5" />
  </IconBase>
);

export const IconUpload = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M12 16V4M7 8l5-5 5 5" />
    <path d="M4 20h16" />
  </IconBase>
);

export const IconExport = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M12 4v12M7 11l5 5 5-5" />
    <path d="M4 20h16" />
  </IconBase>
);

export const IconFilter = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M4 5h16l-6 7v6l-4 2v-8Z" />
  </IconBase>
);

export const IconSearch = (p: IconProps) => (
  <IconBase {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </IconBase>
);

export const IconCheck = (p: IconProps) => (
  <IconBase {...p}>
    <path d="m4 12 5 5L20 6" />
  </IconBase>
);

export const IconClose = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </IconBase>
);

export const IconChevronDown = (p: IconProps) => (
  <IconBase {...p}>
    <path d="m6 9 6 6 6-6" />
  </IconBase>
);

export const IconChevronRight = (p: IconProps) => (
  <IconBase {...p}>
    <path d="m9 6 6 6-6 6" />
  </IconBase>
);

export const IconPlus = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M12 5v14M5 12h14" />
  </IconBase>
);

export const IconArrowUp = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M12 19V5M6 11l6-6 6 6" />
  </IconBase>
);

export const IconArrowDown = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M12 5v14M6 13l6 6 6-6" />
  </IconBase>
);

export const IconLogout = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M9 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3" />
    <path d="M16 17l5-5-5-5M21 12H9" />
  </IconBase>
);

export const IconGlobe = (p: IconProps) => (
  <IconBase {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18" />
  </IconBase>
);

export const IconMenu = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M4 6h16M4 12h16M4 18h16" />
  </IconBase>
);

export const IconGear = (p: IconProps) => (
  <IconBase {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2.5v2.2M12 19.3v2.2M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6" />
  </IconBase>
);

export const IconConfig = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    <circle cx="12" cy="12" r="3" />
  </IconBase>
);

export const IconSun = (p: IconProps) => (
  <IconBase {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </IconBase>
);

export const IconMoon = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
  </IconBase>
);

export const IconBook = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2Z" />
    <path d="M4 19a2 2 0 0 1 2-2h14" />
    <path d="M9 7h6M9 11h6" />
  </IconBase>
);

export const IconEye = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
    <circle cx="12" cy="12" r="2.5" />
  </IconBase>
);

export const IconEyeOff = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M3 3l18 18" />
    <path d="M10.6 5.1A9.8 9.8 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-2.2 3.2M6.6 6.6A16.6 16.6 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
  </IconBase>
);
