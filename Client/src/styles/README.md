# Shared design settings

Change `design-tokens.css` for application colors, light/dark surfaces, page spacing,
sidebar width, panel corners and shadows. `responsive.css` owns the shared screen
layout rules for authentication, student, alumni and admin views.

## Brand color

`--primary` is the single source for the application brand. It contains HSL
channels, for example `142.8 100% 29.411765%` for the current university green.
Set it once under `:root`; dark mode inherits it. Adjust
`--primary-foreground` if a new brand needs different foreground contrast.

Use semantic Tailwind utilities: `bg-primary`, `text-primary`,
`border-primary`, `ring-primary/20`, `hover:bg-[var(--color-primary-hover)]`.
Existing `brand` utilities are aliases to this same primary token and support opacity.
Use `hsl(var(--primary))` in CSS, inline styles and SVG colors.
Use `hsl(var(--primary) / 0.15)` for translucent accents.
Use `var(--color-primary-hover)` or `var(--color-primary-soft)` for derived shades.
Status colors and third-party logos retain their own meanings.

## Shared layout

- Page: `workspace-page` with `max-w-workspace p-page`.
- Heading and actions: `PageHeader` / `workspace-page-header`.
- Panel: `workspace-panel` or `rounded-panel shadow-panel bg-card border-border`.
- Gaps: `gap-section` / `space-y-section`.
- Controls: `h-control`, with text allowed to wrap as needed.
- Navigation: use `w-sidebar` and `lg:pl-sidebar` when introducing new shells.
- Tables: place inside `min-w-0 overflow-x-auto`; keep scrolling inside the panel.
- Card grids: use `responsive-grid` (controlled by `--content-card-min`) or
  `minmax(0, 1fr)` for custom column layouts. Dashboard summary cards use
  `--summary-card-min` so side rails cannot squeeze their labels into narrow columns.

Existing shells and page spacing classes also consume the shared settings, so
updating a token changes existing pages as well as new components. Responsive
rules apply to screens; printable resumes and certificates retain document sizing.

Use the existing Tailwind breakpoints consistently: `sm` 640px, `md` 768px,
`lg` 1024px and `xl` 1280px. Navigation becomes a drawer below `lg`.
Feature-specific grids can retain their own breakpoints when the content requires it.

## Checks

Run `npm run build` and `node scripts/responsive-browser-check.mjs` with Vite
running on port 5173. The browser check uses the same local Playwright setup as the
existing validation scripts and an installed Microsoft Edge browser. It intercepts
API requests with fixtures and blocks writes. Reports and failure screenshots go
to the OS temporary directory under `alumnilink-responsive-check`.

Optional environment variables: `RESPONSIVE_ORIGIN`, `RESPONSIVE_ROUTES` (comma
separated paths), and `RESPONSIVE_WIDTHS` (default: 320,375,768,1024,1440).

Emails use inline colors because email clients do not reliably support CSS custom
properties; their shared template lives in `Server/utils/email-templates.js`.
