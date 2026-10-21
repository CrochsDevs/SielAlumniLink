import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import { MongoClient } from "mongodb";
import { nameGrams } from "../modules/search/search.names.js";
import { updateEmployment } from "../modules/employment/employment.policy.js";
import { validateTracerResponse } from "../modules/tracer/tracer.alignment.js";
import { tracerQuarterStatus } from "../modules/tracer/tracer.quarter.js";

dotenv.config({ path: new URL("../.env", import.meta.url), quiet: true });

const seedGroup = "demo-users-v1";
const defaultPassword = "Demo@12345";
const password = process.env.SEED_PASSWORD || defaultPassword;
const now = new Date();
const year = Number(
  new Intl.DateTimeFormat("en", {
    year: "numeric",
    timeZone: "Asia/Manila",
  }).format(now),
);
const quarter = tracerQuarterStatus(null, now).quarter;
const quarterNumber = Number(quarter.slice(-1));
const previousQuarter = new Date(
  Date.UTC(year, (quarterNumber - 1) * 3, 1) - 8 * 3600000 - 1,
);

//demo account
//alumni01@demo.siel.test
// Demo@12345

//student01@demo.siel.test
//Demo@12345

// Fictional identities and businesses; .test addresses never receive email.
const alumniNames = [
  "Gabriel Santos",
  "Isabella Reyes",
  "Miguel Dela Cruz",
  "Sofia Garcia",
  "Rafael Mendoza",
  "Andrea Bautista",
  "Daniel Ramos",
  "Camille Aquino",
  "Joshua Navarro",
  "Bianca Torres",
  "Paolo Villanueva",
  "Nicole Flores",
  "Adrian Castillo",
  "Patricia Mercado",
  "Marco Salazar",
  "Alyssa Santiago",
  "Carlo Fernandez",
  "Jasmine Rivera",
  "Francis Lim",
  "Angela Soriano",
];
const studentNames = [
  "Ethan Cruz",
  "Chloe Domingo",
  "Nathan Lopez",
  "Mikaela Gonzales",
  "Liam Perez",
  "Hannah Valdez",
  "Jacob Manalo",
  "Ella Pascual",
  "Aaron Estrada",
  "Sophia Rosales",
  "Luis Cabrera",
  "Julia Velasco",
  "David Agustin",
  "Kyla Padilla",
  "Enzo Marquez",
  "Faith Tolentino",
  "Noah Alonzo",
  "Bea Manansala",
  "Sean David",
  "Trisha Evangelista",
];
const careers = [
  {
    program: "Bachelor of Science in Information Technology",
    position: "Software Developer",
    industry: "Information Technology",
    company: "Demo Nueva Digital Studio",
    skills: ["JavaScript", "React", "SQL"],
    duties:
      "I build web applications and manage databases using the programming skills from my degree.",
  },
  {
    program: "Bachelor of Science in Agriculture",
    position: "Agricultural Technician",
    industry: "Agriculture",
    company: "Demo Harvest Farm Services",
    skills: ["Crop Management", "Research", "Data Analysis"],
    duties:
      "I monitor crop health and support field trials using agricultural science and research methods.",
  },
  {
    program: "Bachelor of Science in Accountancy",
    position: "Accountant",
    industry: "Accounting",
    company: "Demo Central Plains Accounting",
    skills: ["Bookkeeping", "Financial Reporting", "Excel"],
    duties:
      "I prepare financial statements and maintain accounting records using the principles from my program.",
  },
  {
    program: "Bachelor of Secondary Education - Math",
    position: "Mathematics Teacher",
    industry: "Education",
    company: "Demo Learning Academy",
    skills: ["Teaching", "Lesson Planning", "Mathematics"],
    duties:
      "I teach mathematics and create lesson plans using subject knowledge and teaching methods from my degree.",
  },
  {
    program: "Bachelor of Science in Civil Engineering",
    position: "Civil Engineer",
    industry: "Construction",
    company: "Demo Plains Engineering",
    skills: ["AutoCAD", "Project Management", "Structural Design"],
    duties:
      "I review structural plans and supervise site work using civil engineering design principles.",
  },
  {
    program: "Bachelor of Science in Hospitality Management",
    position: "Guest Services Supervisor",
    industry: "Hospitality",
    company: "Demo Lakeside Suites",
    skills: ["Customer Service", "Operations", "Communication"],
    duties:
      "I coordinate guest services and daily operations using the hospitality management skills from my degree.",
  },
  {
    program: "Bachelor of Science in Psychology",
    position: "Human Resources Associate",
    industry: "Human Resources",
    company: "Demo Peopleworks Services",
    skills: ["Recruitment", "Communication", "Research"],
    duties:
      "I support recruitment and staff development using psychology, communication, and research skills.",
  },
  {
    program: "Bachelor of Science in Fisheries",
    position: "Aquaculture Technician",
    industry: "Aquaculture",
    company: "Demo Freshwater Aquaculture",
    skills: ["Aquaculture", "Water Quality Testing", "Research"],
    duties:
      "I monitor fish growth and water quality using aquaculture methods learned in my program.",
  },
  {
    program: "Bachelor of Science in Food Technology",
    position: "Quality Assurance Analyst",
    industry: "Food Manufacturing",
    company: "Demo Green Valley Foods",
    skills: ["Food Safety", "Quality Assurance", "Laboratory Testing"],
    duties:
      "I test food products and check safety standards using food chemistry and laboratory skills.",
  },
  {
    program: "Bachelor of Science in Entrepreneurship",
    position: "Business Owner",
    industry: "Retail",
    company: "Demo Nueva Creative Shop",
    skills: ["Marketing", "Business Planning", "Customer Service"],
    duties:
      "I manage a small business, plan budgets, and develop marketing campaigns using entrepreneurship skills.",
  },
];
const locations = [
  "Science City of Munoz, Nueva Ecija",
  "San Jose City, Nueva Ecija",
  "Cabanatuan City, Nueva Ecija",
  "Tarlac City, Tarlac",
  "Quezon City, Metro Manila",
];

function demoProfile(role, index) {
  const career = careers[index % careers.length];
  const number = String(index + 1).padStart(2, "0");
  const name = (role === "alumni" ? alumniNames : studentNames)[index];
  const batch = role === "alumni" ? String(year - 3 - (index % 6)) : "";
  return {
    seedGroup,
    name,
    role,
    email: `${role}${number}@demo.siel.test`,
    studentId: `DEMO-${role === "alumni" ? batch : year}-${number}`,
    program: career.program,
    batch,
    academicStatus: role === "alumni" ? "Graduated" : "Enrolled",
    yearLevel: role === "student" ? String((index % 4) + 1) : "",
    section: role === "student" ? (index % 2 ? "B" : "A") : "",
    location: locations[index % locations.length],
    skills: career.skills,
    interests: [career.industry, "Career Development", "Community Service"],
    bio:
      role === "alumni"
        ? `Demo CLSU graduate in ${career.program}. Interested in sharing experience in ${career.industry.toLowerCase()} and supporting student career development.`
        : `Demo CLSU student studying ${career.program}. Building skills in ${career.skills.join(", ")} and looking for learning and mentorship opportunities.`,
    searchNameGrams: nameGrams(name),
    createdAt: now,
    updatedAt: now,
  };
}

async function seedUsers(db) {
  const auth = db.collection("auth");
  const users = db.collection("users");
  const tracer = db.collection("tracer_responses");
  const profiles = ["alumni", "student"].flatMap((role) =>
    Array.from({ length: 20 }, (_, index) => demoProfile(role, index)),
  );
  const emails = profiles.map((profile) => profile.email);

  // Refuse collisions before writing; never adopt or change a real account.
  for (const collection of [auth, users]) {
    if (
      await collection.findOne({
        email: { $in: emails },
        seedGroup: { $ne: seedGroup },
      })
    ) {
      throw new Error(
        "A demo email is already used by a non-seed account. No seed records were written.",
      );
    }
  }

  const hash = await bcrypt.hash(password, 10);
  const created = { alumni: 0, student: 0, profiles: 0, tracerResponses: 0 };
  for (let index = 0; index < profiles.length; index++) {
    const profile = profiles[index];
    const { email, role } = profile;
    const career = careers[index % careers.length];
    const result = await auth.updateOne(
      { email, seedGroup },
      {
        $setOnInsert: {
          email,
          role,
          seedGroup,
          password: hash,
          isVerified: true,
          passwordSetupRequired: false,
          createdAt: now,
          updatedAt: now,
        },
      },
      { upsert: true },
    );
    created[role] += result.upsertedCount;
    const account = await auth.findOne({ email, seedGroup });

    if (role === "alumni") {
      const status =
        index % 10 === 8
          ? "Unemployed"
          : index % 10 === 7
            ? "Studying"
            : index % 10 === 9
              ? "Self-employed"
              : "Employed";
      Object.assign(
        profile,
        updateEmployment(
          {},
          {
            employmentStatus: status,
            currentCompany: career.company,
            position: career.position,
            industry: career.industry,
            location: profile.location,
            startDate: `${Number(profile.batch) + 1}-07`,
          },
          now,
        ),
      );
      // Alumni 19 and 20 demonstrate the required quarterly prompt.
      const recordedAt = index >= 18 ? previousQuarter : now;
      const working = status === "Employed" || status === "Self-employed";
      const response = validateTracerResponse(
        {
          batch: profile.batch,
          program: profile.program,
          status,
          company: working
            ? career.company
            : status === "Studying"
              ? "Demo Graduate School"
              : "",
          position: working
            ? career.position
            : status === "Studying"
              ? "Graduate Studies"
              : "",
          location: profile.location,
          salaryRange: working ? "Prefer not to say" : "",
          employmentDate: working ? `${Number(profile.batch) + 1}-07` : "",
          jobAlignment: working ? "directly_related" : "",
          alignmentExplanation: working ? career.duties : "",
        },
        now,
      );
      const tracerResult = await tracer.updateOne(
        { authId: account._id },
        {
          $setOnInsert: {
            ...response,
            email,
            seedGroup,
            authId: account._id,
            respondedAt: recordedAt,
            updatedAt: recordedAt,
            responseHistory: [{ ...response, recordedAt }],
          },
        },
        { upsert: true },
      );
      created.tracerResponses += tracerResult.upsertedCount;
    }

    const profileResult = await users.updateOne(
      { email, seedGroup },
      {
        $setOnInsert: {
          ...profile,
          authId: account._id,
        },
      },
      { upsert: true },
    );
    created.profiles += profileResult.upsertedCount;
  }

  const totals = await auth
    .aggregate([
      { $match: { seedGroup } },
      { $group: { _id: "$role", count: { $sum: 1 } } },
    ])
    .toArray();
  console.log("New records:", JSON.stringify(created));
  console.log(
    "Demo accounts:",
    totals.map(({ _id, count }) => `${count} ${_id}`).join(", "),
  );
  console.log(
    "Alumni: alumni01@demo.siel.test through alumni20@demo.siel.test",
  );
  console.log(
    "Students: student01@demo.siel.test through student20@demo.siel.test",
  );
  console.log(
    process.env.SEED_PASSWORD
      ? "New account password: your SEED_PASSWORD value."
      : `New account password: ${defaultPassword}`,
  );
  console.log(
    "Existing accounts, passwords, and edited profiles were preserved.",
  );
}

let connection;
try {
  if (!process.env.MONGO_URI)
    throw new Error("Set MONGO_URI in Server/.env before running this script.");
  connection = new MongoClient(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 5000,
  });
  await connection.connect();
  await seedUsers(connection.db("SielAlumni"));
} catch (error) {
  console.error("Demo user seed failed:", error.message);
  process.exitCode = 1;
} finally {
  await connection?.close();
}
