export const RESUME_THEMES = [
  {
    id: "classic",
    name: "Classic",
    description: "Text-only layout with black dividers and two-column skills.",
  },
  {
    id: "modern",
    name: "Modern",
    description: "Profile photo with a separate dates and company column.",
  },
  {
    id: "professional",
    name: "Professional",
    description: "Navy sidebar with a circular photo, contacts, and skills.",
  },
  {
    id: "minimal",
    name: "Minimal",
    description: "Compact text-only layout with simple typography.",
  },
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
