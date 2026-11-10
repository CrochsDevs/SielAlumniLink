export const RESUME_THEMES = [
  {
    id: "classic",
    name: "Classic",
    description: "Traditional layout with black dividers and two-column skills.",
  },
  {
    id: "modern",
    photo: true,
    name: "Modern",
    description: "Profile photo with a separate dates and company column.",
  },
  {
    id: "professional",
    photo: true,
    name: "Professional",
    description: "Navy sidebar with a circular photo, contacts, and skills.",
  },
  {
    id: "minimal",
    name: "Minimal",
    description: "Compact layout with simple typography and generous white space.",
  },
  {
    id: "emerald",
    photo: true,
    name: "Emerald",
    description: "Green accents, a circular portrait, and clear section labels.",
  },
  {
    id: "executive",
    name: "Executive",
    description: "Centered heading with navy serif typography and gold dividers.",
  },
  {
    id: "academic",
    photo: true,
    name: "Academic",
    description: "Formal serif layout with a right-side portrait and burgundy accents.",
  },
  {
    id: "midnight",
    photo: true,
    name: "Midnight",
    description: "Dark navy heading, a rounded portrait, and crisp section labels.",
  },
  {
    id: "cobalt",
    name: "Cobalt",
    description: "Bold blue typography with clean dividers and compact skill columns.",
  },
  {
    id: "studio",
    photo: true,
    name: "Studio",
    description: "Violet accents, an editorial heading, and a right-side portrait.",
  },
  { id: "nordic", name: "Nordic", description: "Section labels in a narrow left column with a spacious, neutral layout." },
  { id: "terracotta", name: "Terracotta", photo: true, description: "Warm copper accents, a rounded heading, and a right-side portrait." },
  { id: "monochrome", name: "Monochrome", description: "A bold black heading and graphic section dividers in black and white." },
  { id: "aurora", name: "Aurora", photo: true, description: "Teal section bands, a circular portrait, and an airy heading." },
  { id: "editorial", name: "Editorial", description: "Oversized serif name, fine rules, and a magazine-inspired heading." },
  { id: "timeline", name: "Timeline", photo: true, description: "Experience entries along a blue timeline with clear date markers." },
  { id: "linen", name: "Linen", description: "Soft ivory heading, olive details, and warm serif typography." },
  { id: "ledger", name: "Ledger", description: "Dates and organizations in a separate left column with precise navy rules." },
];

export const RESUME_THEME_GROUPS = [
  { name: 'Simple & traditional', ids: ['classic', 'minimal', 'nordic', 'monochrome'] },
  { name: 'Modern & creative', ids: ['modern', 'studio', 'midnight', 'editorial', 'timeline'] },
  { name: 'Professional & formal', ids: ['professional', 'executive', 'academic', 'ledger'] },
  { name: 'Color accents', ids: ['emerald', 'cobalt', 'terracotta', 'aurora', 'linen'] },
];

export const validResumeTheme = (value) => {
  const migrated = value === "sidebar" ? "professional" : value;
  return RESUME_THEMES.some((theme) => theme.id === migrated)
    ? migrated
    : "classic";
};

export function readResumeTheme(key) {
  try {
    return validResumeTheme(localStorage.getItem(key));
  } catch {
    return "classic";
  }
}
