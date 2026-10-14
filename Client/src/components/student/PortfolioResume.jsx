import { createElement, useState } from "react";
import {
  Award,
  BadgeCheck,
  Briefcase,
  FileText,
  FolderKanban,
  Globe,
  GraduationCap,
  Link,
  Mail,
  MapPin,
  Phone,
  Presentation,
  UserRound,
} from "lucide-react";
import "./PortfolioResume.css";
import { validResumeTheme } from "../../utils/resumeThemes";

const date = (value) => {
  if (!value) return "";
  const parsed = new Date(
    String(value).length === 10 ? value + "T00:00:00" : value,
  );
  return Number.isNaN(parsed.getTime())
    ? ""
    : parsed.toLocaleDateString("en-US", { month: "short", year: "numeric" });
};
const period = (item) =>
  [date(item.startDate), item.current ? "Present" : date(item.endDate)]
    .filter(Boolean)
    .join(" - ");

function ResumeBullets({ text }) {
  const lines = String(text || "")
    .split("\n")
    .map((line) => line.replace(/^\s*[-*\u2022]\s*/, "").trim())
    .filter(Boolean);
  return lines.length ? (
    <ul className="resume-bullets">
      {lines.map((line, index) => (
        <li key={index}>{line}</li>
      ))}
    </ul>
  ) : null;
}

function ExperienceEntry({
  title,
  company,
  dates,
  location,
  description,
  portrait,
}) {
  return (
    <div className={`resume-entry${portrait ? " resume-entry--columns" : ""}`}>
      {portrait ? (
        <>
          <div className="resume-entry-meta">
            {dates && <p>{dates}</p>}
            {company && <p>{company}</p>}
            {location && <p className="resume-meta">{location}</p>}
          </div>
          <div className="resume-entry-body">
            <h3>{title}</h3>
            <ResumeBullets text={description} />
          </div>
        </>
      ) : (
        <>
          <div className="resume-row">
            <h3>{[title, company].filter(Boolean).join(" | ")}</h3>
            {dates && <span>{dates}</span>}
          </div>
          {location && <p className="resume-meta">{location}</p>}
          <ResumeBullets text={description} />
        </>
      )}
    </div>
  );
}

function ProfessionalHeading({ icon, children }) {
  return (
    <h2 className="resume-icon-heading">
      {createElement(icon, { size: 18, "aria-hidden": true })}
      <span>{children}</span>
    </h2>
  );
}

function ProfessionalResume({
  user,
  portfolio,
  education,
  employment,
  projects,
  internships,
  headline,
  photo,
  onPhotoError,
}) {
  const contacts = [
    [Phone, user?.contactNumber],
    [Mail, user?.email],
    [MapPin, user?.location],
    [Link, user?.linkedin],
    [Globe, user?.github],
  ].filter(([, value]) => value);
  const lists = [
    ["certifications", "Certifications", BadgeCheck],
    ["seminars", "Seminars & Training", Presentation],
    ["awards", "Achievements & Activities", Award],
  ];
  return (
    <article
      className="portfolio-resume resume-theme--professional"
      data-resume-theme="professional"
      aria-label="Resume document"
    >
      <aside className="resume-sidebar">
        {photo && (
          <img
            className="resume-photo"
            src={photo}
            alt={`${user?.name || "Student"} profile photo`}
            onError={onPhotoError}
          />
        )}
        {contacts.length > 0 && (
          <section>
            <h2>Contact</h2>
            <ul className="resume-contact-list">
              {contacts.map(([icon, value], index) => (
                <li key={index}>
                  {createElement(icon, { size: 15, "aria-hidden": true })}
                  <span>{value}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
        {!!portfolio.skills?.length && (
          <section>
            <h2>Skills</h2>
            <ul className="resume-skills">
              {portfolio.skills.map((skill, index) => (
                <li key={index}>{skill}</li>
              ))}
            </ul>
          </section>
        )}
        {!!user?.languages?.length && Array.isArray(user.languages) && (
          <section>
            <h2>Languages</h2>
            <ul>
              {user.languages.map((language, index) => (
                <li key={index}>{language}</li>
              ))}
            </ul>
          </section>
        )}
        {user?.batch && (
          <section>
            <h2>Academic Details</h2>
            <p>Batch: {user.batch}</p>
          </section>
        )}
      </aside>
      <div className="resume-body">
        <header className="resume-heading">
          <h1>{user?.name || "Student"}</h1>
          {headline && <p className="resume-program">{headline}</p>}
        </header>
        {user?.bio?.trim() && (
          <section>
            <ProfessionalHeading icon={UserRound}>
              Professional Summary
            </ProfessionalHeading>
            <p className="resume-description">{user.bio}</p>
          </section>
        )}
        {education.length > 0 && (
          <section>
            <ProfessionalHeading icon={GraduationCap}>
              Education
            </ProfessionalHeading>
            {education.map((item, index) => (
              <div className="resume-entry" key={index}>
                <div className="resume-row">
                  <h3>{item.degree || item.school}</h3>
                  {(item.year || period(item)) && (
                    <span>{item.year || period(item)}</span>
                  )}
                </div>
                {item.degree && item.school && (
                  <p className="resume-school">{item.school}</p>
                )}
                {item.location && (
                  <p className="resume-meta">{item.location}</p>
                )}
                <ResumeBullets text={item.description} />
              </div>
            ))}
          </section>
        )}
        {employment.length > 0 && (
          <section>
            <ProfessionalHeading icon={Briefcase}>
              Experience
            </ProfessionalHeading>
            {employment.map((item, index) => (
              <ExperienceEntry
                key={index}
                title={item.position || item.company}
                company={item.position ? item.company : ""}
                dates={period(item)}
                location={item.location}
                description={item.description}
              />
            ))}
          </section>
        )}
        {internships.length > 0 && (
          <section>
            <ProfessionalHeading icon={Briefcase}>
              Internships
            </ProfessionalHeading>
            {internships.map((item, index) => (
              <ExperienceEntry
                key={item._id || index}
                title="Internship"
                company={item.company}
                dates={period(item)}
                location={item.location}
                description={`${item.hoursCompleted} hours completed${item.completed ? " | Completed internship" : ""}`}
              />
            ))}
          </section>
        )}
        {projects.length > 0 && (
          <section>
            <ProfessionalHeading icon={FolderKanban}>
              Projects
            </ProfessionalHeading>
            {projects.map((item, index) => (
              <ExperienceEntry
                key={index}
                title={item.title}
                description={item.desc}
              />
            ))}
          </section>
        )}
        {!!portfolio.research?.length && (
          <section>
            <ProfessionalHeading icon={FileText}>Research</ProfessionalHeading>
            {portfolio.research.map((item, index) => (
              <ExperienceEntry
                key={index}
                title={item.title}
                description={item.desc}
              />
            ))}
          </section>
        )}
        {lists
          .filter(([key]) => portfolio[key]?.length)
          .map(([key, label, icon]) => (
            <section key={key}>
              <ProfessionalHeading icon={icon}>{label}</ProfessionalHeading>
              <ul>
                {portfolio[key].map((entry, index) => (
                  <li key={index}>{entry}</li>
                ))}
              </ul>
            </section>
          ))}
      </div>
    </article>
  );
}

export default function PortfolioResume({
  user,
  portfolio = {},
  internships = [],
  theme = "classic",
}) {
  const [failedPhoto, setFailedPhoto] = useState(null);
  const selectedTheme = validResumeTheme(theme);
  const portrait = selectedTheme === "modern";
  const photo =
    (portrait || selectedTheme === "professional") &&
    user?.profilePicture &&
    user.profilePicture !== failedPhoto
      ? user.profilePicture
      : null;
  const education = user?.education?.length
    ? user.education
    : user?.program
      ? [{ school: "Central Luzon State University", degree: user.program }]
      : [];
  const employment = user?.employmentHistory || [];
  const projects = portfolio.projects || [];
  const headline =
    user?.professionalTitle ||
    employment.find((item) => item.current)?.position ||
    user?.program;
  const additional = [
    ["Languages", Array.isArray(user?.languages) ? user.languages : []],
    ["Certifications", portfolio.certifications || []],
    ["Seminars & Training", portfolio.seminars || []],
    ["Awards & Activities", portfolio.awards || []],
  ].filter(([, entries]) => entries.length);
  const skills = !!portfolio.skills?.length && (
    <section>
      <h2>{portrait ? "Skills" : "Technical Skills"}</h2>
      <ul className="resume-skills">
        {portfolio.skills.map((skill, index) => (
          <li key={index}>{skill}</li>
        ))}
      </ul>
    </section>
  );

  if (selectedTheme === "professional")
    return (
      <ProfessionalResume
        user={user}
        portfolio={portfolio}
        education={education}
        employment={employment}
        projects={projects}
        internships={internships}
        headline={headline}
        photo={photo}
        onPhotoError={() => setFailedPhoto(photo)}
      />
    );

  return (
    <article
      className={`portfolio-resume resume-theme--${selectedTheme}`}
      data-resume-theme={selectedTheme}
      aria-label="Resume document"
    >
      <header
        className={`resume-heading${photo ? " resume-heading--with-photo" : ""}`}
      >
        {photo && (
          <img
            className="resume-photo"
            src={photo}
            alt={`${user?.name || "Student"} profile photo`}
            onError={() => setFailedPhoto(photo)}
          />
        )}
        <div className="resume-identity">
          <h1>{user?.name || "Student"}</h1>
          {headline && <p className="resume-program">{headline}</p>}
          {portrait ? (
            <>
              {(user?.contactNumber || user?.email) && (
                <div className="resume-contact-band">
                  {user?.contactNumber && (
                    <span>
                      <strong>Phone</strong> {user.contactNumber}
                    </span>
                  )}
                  {user?.email && (
                    <span>
                      <strong>Email</strong> {user.email}
                    </span>
                  )}
                </div>
              )}
              {user?.location && (
                <p className="resume-contact resume-contact-location">
                  {user.location}
                </p>
              )}
              {user?.linkedin && (
                <p className="resume-contact">{user.linkedin}</p>
              )}
            </>
          ) : (
            <p className="resume-contact">
              {[
                user?.location,
                user?.contactNumber,
                user?.email,
                user?.linkedin,
              ]
                .filter(Boolean)
                .join(" | ")}
            </p>
          )}
        </div>
      </header>
      {user?.bio?.trim() && (
        <section>
          <h2>{portrait ? "About Me" : "Summary"}</h2>
          <p className="resume-description">{user.bio}</p>
        </section>
      )}
      {!portrait && skills}
      {(employment.length > 0 ||
        internships.length > 0 ||
        projects.length > 0) && (
        <section>
          <h2>{portrait ? "Experience" : "Professional Experience"}</h2>
          {employment.map((item, index) => (
            <ExperienceEntry
              key={`work:${index}`}
              portrait={portrait}
              title={item.position || item.company}
              company={item.position ? item.company : ""}
              dates={period(item)}
              location={item.location}
              description={item.description}
            />
          ))}
          {internships.map((item, index) => (
            <ExperienceEntry
              key={`internship:${item._id || index}`}
              portrait={portrait}
              title="Internship"
              company={item.company}
              dates={period(item)}
              location={item.location}
              description={`${item.hoursCompleted} hours completed${item.completed ? " | Completed internship" : ""}`}
            />
          ))}
          {projects.map((item, index) => (
            <ExperienceEntry
              key={`project:${index}`}
              portrait={portrait}
              title={portrait ? item.title : `Project | ${item.title}`}
              company={portrait ? "Project" : ""}
              description={item.desc}
            />
          ))}
        </section>
      )}
      {education.length > 0 && (
        <section>
          <h2>Education</h2>
          {education.map((item, index) => (
            <ExperienceEntry
              key={index}
              portrait={portrait}
              title={item.degree || item.school}
              company={item.degree ? item.school : ""}
              dates={item.year || period(item)}
              location={item.location}
              description={item.description}
            />
          ))}
        </section>
      )}
      {portrait && skills}
      {!!portfolio.research?.length && (
        <section>
          <h2>Research</h2>
          {portfolio.research.map((item, index) => (
            <div className="resume-entry" key={index}>
              <h3>{item.title}</h3>
              <ResumeBullets text={item.desc} />
            </div>
          ))}
        </section>
      )}
      {additional.length > 0 && (
        <section>
          <h2>Additional Information</h2>
          <ul className="resume-additional">
            {additional.map(([label, entries]) => (
              <li key={label}>
                <strong>{label}: </strong>
                {entries.join("; ")}
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
