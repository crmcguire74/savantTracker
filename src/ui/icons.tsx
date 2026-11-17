// ✏️ Inline SVG icons. Stroke icons inherit `currentColor`, so they follow
// the theme and the active state without per-icon styling.

import type { ReactNode, SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function Svg({ size = 18, children, ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  )
}

export const Icon = {
  Portfolio: (p: IconProps) => (
    <Svg {...p}>
      <rect x="3.5" y="3.5" width="7" height="9" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="5" rx="1.5" />
      <rect x="13.5" y="11.5" width="7" height="9" rx="1.5" />
      <rect x="3.5" y="15.5" width="7" height="5" rx="1.5" />
    </Svg>
  ),
  Board: (p: IconProps) => (
    <Svg {...p}>
      <rect x="3.5" y="4" width="5" height="16" rx="1.5" />
      <rect x="10" y="4" width="5" height="11" rx="1.5" />
      <rect x="16.5" y="4" width="4" height="7" rx="1.5" />
    </Svg>
  ),
  Timeline: (p: IconProps) => (
    <Svg {...p}>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4M7.5 13.5h5M10.5 16.5h6" />
    </Svg>
  ),
  Person: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M4.5 20c.8-3.8 3.8-6 7.5-6s6.7 2.2 7.5 6" />
    </Svg>
  ),
  People: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="9" cy="8.5" r="3" />
      <circle cx="17" cy="9.5" r="2.4" />
      <path d="M3 19c.6-3.1 3-5 6-5s5.4 1.9 6 5M15.5 14.3c2.6-.4 4.8 1.1 5.5 4.2" />
    </Svg>
  ),
  Reports: (p: IconProps) => (
    <Svg {...p}>
      <path d="M4 20h16" />
      <rect x="5.5" y="12" width="3" height="5.5" rx="0.8" />
      <rect x="10.5" y="7" width="3" height="10.5" rx="0.8" />
      <rect x="15.5" y="10" width="3" height="7.5" rx="0.8" />
    </Svg>
  ),
  Settings: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </Svg>
  ),
  Help: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.6 9.4a2.5 2.5 0 0 1 4.8.9c0 1.6-2.4 2-2.4 3.4M12 16.9v.1" />
    </Svg>
  ),
  Shield: (p: IconProps) => (
    <Svg {...p}>
      <path d="M12 3.5 5 6v5.5c0 4.2 2.9 7.6 7 9 4.1-1.4 7-4.8 7-9V6l-7-2.5Z" />
      <path d="m9 12 2 2 4-4" />
    </Svg>
  ),
  Clipboard: (p: IconProps) => (
    <Svg {...p}>
      <rect x="5" y="4.5" width="14" height="16.5" rx="2" />
      <path d="M9 4.5V3.8A.8.8 0 0 1 9.8 3h4.4a.8.8 0 0 1 .8.8v.7M8.5 11h7M8.5 14.5h7M8.5 18h4" />
    </Svg>
  ),
  Sync: (p: IconProps) => (
    <Svg {...p}>
      <path d="M19.5 9A7.5 7.5 0 0 0 6 6.6L4.5 8M4.5 15A7.5 7.5 0 0 0 18 17.4l1.5-1.4" />
      <path d="M4.5 4v4h4M19.5 20v-4h-4" />
    </Svg>
  ),
  Sheet: (p: IconProps) => (
    <Svg {...p}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M4 9.5h16M4 14.5h16M10 9.5V20" />
    </Svg>
  ),
  Search: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.2-4.2" />
    </Svg>
  ),
  Sun: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" />
    </Svg>
  ),
  Moon: (p: IconProps) => (
    <Svg {...p}>
      <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
    </Svg>
  ),
  Chevron: (p: IconProps) => (
    <Svg {...p}>
      <path d="m9 6 6 6-6 6" />
    </Svg>
  ),
  ArrowLeft: (p: IconProps) => (
    <Svg {...p}>
      <path d="M19 12H5M11 18l-6-6 6-6" />
    </Svg>
  ),
  Plus: (p: IconProps) => (
    <Svg {...p}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  ),
  Edit: (p: IconProps) => (
    <Svg {...p}>
      <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z" />
      <path d="m13.5 6.5 4 4" />
    </Svg>
  ),
  Trash: (p: IconProps) => (
    <Svg {...p}>
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
    </Svg>
  ),
  Close: (p: IconProps) => (
    <Svg {...p}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Svg>
  ),
  External: (p: IconProps) => (
    <Svg {...p}>
      <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
    </Svg>
  ),
  History: (p: IconProps) => (
    <Svg {...p}>
      <path d="M3.5 12a8.5 8.5 0 1 0 2.5-6L3.5 8.5" />
      <path d="M3.5 4v4.5H8M12 8v4.5l3 2" />
    </Svg>
  ),
  Check: (p: IconProps) => (
    <Svg {...p}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </Svg>
  ),
  Print: (p: IconProps) => (
    <Svg {...p}>
      <path d="M7 9V3.5h10V9M7 17H5a1.5 1.5 0 0 1-1.5-1.5v-5A1.5 1.5 0 0 1 5 9h14a1.5 1.5 0 0 1 1.5 1.5v5A1.5 1.5 0 0 1 19 17h-2" />
      <rect x="7" y="14" width="10" height="6.5" rx="1" />
    </Svg>
  ),
  Download: (p: IconProps) => (
    <Svg {...p}>
      <path d="M12 4v11M7 10.5l5 5 5-5M4.5 20h15" />
    </Svg>
  ),
  Upload: (p: IconProps) => (
    <Svg {...p}>
      <path d="M12 20V9M7 13.5l5-5 5 5M4.5 4h15" />
    </Svg>
  ),
  Install: (p: IconProps) => (
    <Svg {...p}>
      <rect x="3.5" y="4" width="17" height="12.5" rx="2" />
      <path d="M8.5 20h7M12 7.5v5.5M9.5 10.5 12 13l2.5-2.5" />
    </Svg>
  ),
  Database: (p: IconProps) => (
    <Svg {...p}>
      <ellipse cx="12" cy="6" rx="7" ry="2.8" />
      <path d="M5 6v12c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8V6M5 12c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8" />
    </Svg>
  ),
  Logout: (p: IconProps) => (
    <Svg {...p}>
      <path d="M15 4h3.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H15M10 16l4-4-4-4M14 12H4" />
    </Svg>
  ),
  /**
   * The WiseTrack mark: an owl in a shield, one eye a monocle whose chain is the project track.
   * Drawn in currentColor so it follows the theme. Same geometry as public/icons/icon.svg and
   * redesign/logo.svg (navy #183A5A ground, mint #8FCFC7 mark).
   */
  Logo: ({ size = 28, ...rest }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 128 128" fill="none" aria-hidden focusable="false" {...rest}>
      <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 11 C 24 11, 44 12, 56 12.5 L 64 3.5 L 72 12.5 C 84 12, 104 11, 124 11" strokeWidth={8} />
        <path d="M16 13 V 70 C 16 95, 40 112, 64 124.5 C 88 112, 112 95, 112 70 V 13" strokeWidth={7.5} />
        <path d="M33 15 L 39.25 25.77 M 52.85 49.22 L 62 65 L 70.61 50.65 M 86.21 24.65 L 92 15" strokeWidth={6} strokeLinejoin="miter" />
        <circle cx="40" cy="41" r="11.5" strokeWidth={7.5} />
        <circle cx="84" cy="41" r="14.5" strokeWidth={4} />
        <circle cx="84" cy="41" r="7.2" strokeWidth={4.6} />
        <path d="M91 54.5 C 92.5 61, 89 66, 82.5 68.5 L 62.5 76 L 43 81 L 37 84" strokeWidth={2.4} />
        <path d="M18.5 71 C 36 78, 50 95, 58 117" strokeWidth={7} />
        <path d="M109.5 66 C 92 75, 77 94, 70 117" strokeWidth={7} />
      </g>
      <g fill="currentColor">
        <circle cx="82.5" cy="68.5" r="3.9" />
        <circle cx="62.5" cy="76" r="3.9" />
        <circle cx="43" cy="81" r="3.9" />
      </g>
    </svg>
  ),
  Lock: (p: IconProps) => (
    <Svg {...p}>
      <rect x="5" y="10.5" width="14" height="10" rx="2" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3M12 14.5v2" />
    </Svg>
  ),
}
