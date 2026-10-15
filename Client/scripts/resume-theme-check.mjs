import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { transformWithOxc } from "vite";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import postcss from "postcss";
import {
  RESUME_THEMES,
  validResumeTheme,
  readResumeTheme,
} from "../src/utils/resumeThemes.js";

const source = (
  await readFile(
    new URL("../src/components/student/PortfolioResume.jsx", import.meta.url),
    "utf8",
  )
)
  .replace(/import ["']\.\/PortfolioResume\.css["'];?/, "")
  .replace(
    "../../utils/resumeContact",
    new URL("../src/utils/resumeContact.js", import.meta.url).href,
  )
  .replace(
    "../../utils/resumeThemes",
    new URL("../src/utils/resumeThemes.js", import.meta.url).href,
  );
const transformed = await transformWithOxc(source, "PortfolioResume.jsx", {
  jsx: { runtime: "automatic" },
});
const code = transformed.code
  .replaceAll(
    '"lucide-react"',
    JSON.stringify(import.meta.resolve("lucide-react")),
  )
  .replaceAll(
    "'lucide-react'",
    JSON.stringify(import.meta.resolve("lucide-react")),
  )
  .replaceAll("'react'", JSON.stringify(import.meta.resolve("react")))
  .replaceAll('"react"', JSON.stringify(import.meta.resolve("react")))
  .replaceAll(
    '"react/jsx-runtime"',
    JSON.stringify(import.meta.resolve("react/jsx-runtime")),
  )
  .replaceAll(
    "'react/jsx-runtime'",
    JSON.stringify(import.meta.resolve("react/jsx-runtime")),
  );
const { default: Resume } = await import(
  "data:text/javascript;base64," + Buffer.from(code).toString("base64")
);
const portfolio = {
  skills: ["React", "Communication"],
  projects: [{ title: "Accessible <portal>", desc: "Built with a team." }],
  research: [],
  certifications: ["Credential"],
  seminars: [],
  awards: [],
};
const user = {
  name: "Alex Santos",
  email: "alex@example.test",
  contactEmail: "contact@example.test",
  profileLinks: [
    { type: "website", url: "https://alex.example.test/work" },
    { type: "github", url: "https://github.com/alex" },
    { type: "github", url: "https://github.com/alex/project" },
  ],
  program: "BS Information Technology",
  profilePicture: "https://example.test/profile-photo.jpg",
  bio: "Student developer.",
  employmentHistory: [
    {
      position: "Developer",
      company: "Campus",
      startDate: "2026-01-01",
      current: true,
    },
  ],
};
for (const theme of RESUME_THEMES) {
  const html = renderToStaticMarkup(
    createElement(Resume, { user, portfolio, theme: theme.id }),
  );
  assert.ok(html.includes(`data-resume-theme="${theme.id}"`));
  assert.ok(html.includes('contact@example.test'));
  assert.ok(!html.includes('alex@example.test'));
  assert.ok(html.includes('href="https://alex.example.test/work"'));
  assert.ok(html.includes('href="https://github.com/alex/project"'));
  assert.equal(
    html.includes('class="resume-photo"'),
    ["modern", "professional"].includes(theme.id),
  );
  if (theme.id === "professional") {
    assert.ok(html.includes('class="resume-sidebar"'));
    assert.ok(html.includes('class="resume-body"'));
    assert.ok(html.includes('src="https://example.test/profile-photo.jpg"'));
    assert.ok(html.includes("Professional Summary"));
    assert.ok(html.includes("Projects"));
    assert.ok(html.includes("Certifications"));
  } else if (theme.id === "modern") {
    assert.ok(html.includes('src="https://example.test/profile-photo.jpg"'));
    assert.ok(html.includes('alt="Alex Santos profile photo"'));
    assert.ok(html.includes("resume-entry--columns"));
    assert.ok(
      html.indexOf("<h2>Experience</h2>") < html.indexOf("<h2>Skills</h2>"),
    );
    assert.ok(html.includes("<h2>About Me</h2>"));
  } else {
    assert.equal(html.includes("<img"), false);
    assert.ok(
      html.indexOf("<h2>Technical Skills</h2>") <
        html.indexOf("<h2>Professional Experience</h2>"),
    );
    assert.ok(
      html.indexOf("<h2>Professional Experience</h2>") <
        html.indexOf("<h2>Education</h2>"),
    );
  }
  if (theme.id !== "professional")
    assert.ok(
      html.indexOf("<h2>Education</h2>") <
        html.indexOf("<h2>Additional Information</h2>"),
    );
  assert.ok(html.includes('class="resume-skills"'));
  for (const content of [
    "Alex Santos",
    "contact@example.test",
    "Jan 2026 - Present",
    "Accessible &lt;portal&gt;",
    "Credential",
  ])
    assert.ok(html.includes(content), content);
  for (const absent of [
    "Research</h2>",
    "Awards &amp; Recognition</h2>",
    "Invalid Date",
  ])
    assert.equal(html.includes(absent), false);
}
const noPhoto = renderToStaticMarkup(
  createElement(Resume, {
    user: { name: "Student" },
    portfolio,
    theme: "modern",
  }),
);
assert.equal(noPhoto.includes('class="resume-photo"'), false);
assert.equal(noPhoto.includes("<h2>Summary</h2>"), false);
const updatedAbout = renderToStaticMarkup(
  createElement(Resume, {
    user: { ...user, bio: "Updated career goals." },
    portfolio,
  }),
);
assert.ok(updatedAbout.includes("Updated career goals."));
assert.equal(updatedAbout.includes("Student developer."), false);
assert.equal(validResumeTheme("unknown"), "classic");
assert.equal(validResumeTheme("sidebar"), "professional");
assert.equal(readResumeTheme("unavailable"), "classic");
const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
};
localStorage.setItem("account-one", "modern");
assert.equal(readResumeTheme("account-one"), "modern");
assert.equal(readResumeTheme("account-two"), "classic");
localStorage.setItem("account-two", "bad-value");
assert.equal(readResumeTheme("account-two"), "classic");
postcss.parse(
  await readFile(
    new URL("../src/components/student/PortfolioResume.css", import.meta.url),
    "utf8",
  ),
);
for (const path of [
  "../src/pages/student/studentPortfolio.jsx",
  "../src/components/student/ResumeThemePicker.jsx",
  "../src/components/student/ResumePreview.jsx",
])
  await transformWithOxc(
    await readFile(new URL(path, import.meta.url), "utf8"),
    path,
    { jsx: { runtime: "automatic" } },
  );
console.log(
  "Passed: all resume themes render saved content safely, omit empty sections, validate preferences per account, and compile JSX/CSS.",
);
