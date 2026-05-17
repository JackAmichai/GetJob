interface IconProps {
  className?: string;
  size?: number;
}

const base = (size: number) =>
  ({
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  });

export function Icon({
  name,
  className = '',
  size = 18,
  filled = false,
}: IconProps & { name: IconName; filled?: boolean }) {
  const p = base(size);
  const cls = `inline-block flex-shrink-0 ${className}`;
  switch (name) {
    case 'sparkle':
      return (
        <svg {...p} className={cls}>
          <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.5 5.5l2 2M16.5 16.5l2 2M5.5 18.5l2-2M16.5 7.5l2-2" />
          <circle cx="12" cy="12" r="3" fill={filled ? 'currentColor' : 'none'} />
        </svg>
      );
    case 'search':
      return (
        <svg {...p} className={cls}>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      );
    case 'play':
      return (
        <svg {...p} className={cls}>
          <path d="M8 5v14l11-7z" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'refresh':
      return (
        <svg {...p} className={cls}>
          <path d="M3 12a9 9 0 0 1 15.5-6.2L21 8" />
          <path d="M21 3v5h-5" />
          <path d="M21 12a9 9 0 0 1-15.5 6.2L3 16" />
          <path d="M3 21v-5h5" />
        </svg>
      );
    case 'star':
      return (
        <svg {...p} className={cls} fill={filled ? 'currentColor' : 'none'}>
          <path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      );
    case 'x':
      return (
        <svg {...p} className={cls}>
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      );
    case 'check':
      return (
        <svg {...p} className={cls}>
          <path d="m20 6-11 11-5-5" />
        </svg>
      );
    case 'undo':
      return (
        <svg {...p} className={cls}>
          <path d="M3 7v6h6" />
          <path d="M21 17a9 9 0 0 0-15-6.7L3 13" />
        </svg>
      );
    case 'external':
      return (
        <svg {...p} className={cls}>
          <path d="M15 3h6v6" />
          <path d="m10 14 11-11" />
          <path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />
        </svg>
      );
    case 'building':
      return (
        <svg {...p} className={cls}>
          <path d="M3 21h18" />
          <path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16" />
          <path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2" />
        </svg>
      );
    case 'location':
      return (
        <svg {...p} className={cls}>
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
      );
    case 'calendar':
      return (
        <svg {...p} className={cls}>
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      );
    case 'mail':
      return (
        <svg {...p} className={cls}>
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <path d="m22 7-10 6L2 7" />
        </svg>
      );
    case 'cog':
      return (
        <svg {...p} className={cls}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      );
    case 'plus':
      return (
        <svg {...p} className={cls}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      );
    case 'trash':
      return (
        <svg {...p} className={cls}>
          <path d="M3 6h18" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
          <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
      );
    case 'info':
      return (
        <svg {...p} className={cls}>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4M12 8h.01" />
        </svg>
      );
    case 'alert':
      return (
        <svg {...p} className={cls}>
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <path d="M12 9v4M12 17h.01" />
        </svg>
      );
    case 'briefcase':
      return (
        <svg {...p} className={cls}>
          <rect x="2" y="7" width="20" height="14" rx="2" />
          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
        </svg>
      );
    case 'logo':
      return (
        <svg viewBox="0 0 32 32" width={size} height={size} className={cls} fill="none">
          <path
            d="M16 3 L28 9 L28 23 L16 29 L4 23 L4 9 Z"
            fill="url(#g)"
          />
          <path d="M11 14 L16 11 L21 14 L21 20 L16 23 L11 20 Z" fill="white" opacity="0.95" />
          <defs>
            <linearGradient id="g" x1="0" y1="0" x2="32" y2="32">
              <stop offset="0%" stopColor="#3884fc" />
              <stop offset="100%" stopColor="#1c41b4" />
            </linearGradient>
          </defs>
        </svg>
      );
    default:
      return null;
  }
}

export type IconName =
  | 'sparkle'
  | 'search'
  | 'play'
  | 'refresh'
  | 'star'
  | 'x'
  | 'check'
  | 'undo'
  | 'external'
  | 'building'
  | 'location'
  | 'calendar'
  | 'mail'
  | 'cog'
  | 'plus'
  | 'trash'
  | 'info'
  | 'alert'
  | 'briefcase'
  | 'logo';
