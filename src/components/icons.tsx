import type { SVGProps } from "react";

/**
 * Flat line icons — one stroke weight, currentColor, 24-box. Replaces the
 * emoji / geometric glyphs the UI used to lean on. Filled where a solid shape
 * reads better (play, the three-dot menu, status marks).
 */

function Svg({ className = "", children, ...rest }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`inline-block shrink-0 ${className}`}
      {...rest}
    >
      {children}
    </svg>
  );
}

/* ---------------------------------------------------------------- nav / action */

export const IconPlay = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="none" />
  </Svg>
);

export const IconPlus = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);

export const IconClose = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
);

export const IconArrowLeft = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M13 5l-7 7 7 7M6 12h13" />
  </Svg>
);

export const IconChevronLeft = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M14 6l-6 6 6 6" />
  </Svg>
);

export const IconChevronRight = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M10 6l6 6-6 6" />
  </Svg>
);

export const IconChevronDown = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M6 10l6 6 6-6" />
  </Svg>
);

export const IconPencil = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M4 20h4L19 9l-4-4L4 16z" />
    <path d="M14 6l4 4" />
  </Svg>
);

export const IconMore = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p} stroke="none">
    <circle cx="5" cy="12" r="1.7" fill="currentColor" />
    <circle cx="12" cy="12" r="1.7" fill="currentColor" />
    <circle cx="19" cy="12" r="1.7" fill="currentColor" />
  </Svg>
);

export const IconSound = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M4 9.5v5h3.5L13 19V5L7.5 9.5z" fill="currentColor" />
    <path d="M16.5 9c1.4 1.6 1.4 4.4 0 6" />
  </Svg>
);

/** Retry loop — a card reappearing after a wrong answer. */
export const IconLoop = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M4 12a8 8 0 1 1 2.7 6" />
    <path d="M4 17v-5h5" />
  </Svg>
);

export const IconSort = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M8 4v16M8 4 5 7.5M8 4l3 3.5" />
    <path d="M16 20V4M16 20l-3-3.5M16 20l3-3.5" />
  </Svg>
);

export const IconWarning = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M12 4 2.5 20.5h19L12 4z" />
    <path d="M12 10v4.5" />
    <path d="M12 17.6v.1" />
  </Svg>
);

export const IconSpinner = ({ className = "", ...p }: SVGProps<SVGSVGElement>) => (
  <Svg className={`animate-spin ${className}`} {...p}>
    <path d="M12 3a9 9 0 1 1-6.9 3.2" opacity="0.9" />
  </Svg>
);

/* ---------------------------------------------------------------- status marks */

export const IconCheck = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M4 12.5l5 5L20 6.5" />
  </Svg>
);

/** "Correct, but slow" — a tilde. */
export const IconSlow = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M3.5 13.5c1.8-3.4 3.7-3.4 5.5 0s3.7 3.4 5.5 0 3.7-3.4 5.5 0" />
  </Svg>
);

/** "Not yet — that's fine" — a hollow ring. */
export const IconPending = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="7.25" />
  </Svg>
);
