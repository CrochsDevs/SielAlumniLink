export const CLSU_PROGRAM_GROUPS = [
  {
    college: "College of Agriculture",
    programs: [
      "Bachelor of Science in Agriculture",
      "Bachelor of Science in Agribusiness",
    ],
  },
  {
    college: "College of Arts and Social Sciences",
    programs: [
      "Bachelor of Science in Development Communication",
      "Bachelor of Science in Psychology",
      "Bachelor of Arts in Literature",
      "Bachelor of Arts in Social Sciences",
      "Bachelor of Arts in Filipino",
      "Bachelor of Arts in International Studies - Global Sustainable Development",
    ],
  },
  {
    college: "College of Business and Accountancy",
    programs: [
      "Bachelor of Science in Accountancy",
      "Bachelor of Science in Business Administration - Marketing Mngt",
      "Bachelor of Science in Business Administration - Business Economics",
      "Bachelor of Science in Business Administration - Human Resource Mngt",
      "Bachelor of Science in Entrepreneurship",
      "Bachelor of Science in Management Accounting",
    ],
  },
  {
    college: "College of Education",
    programs: [
      "Bachelor of Physical Education",
      "Bachelor of Secondary Education - Math",
      "Bachelor of Secondary Education - Filipino",
      "Bachelor of Secondary Education - Values Education",
      "Bachelor of Secondary Education - English",
      "Bachelor of Secondary Education - Science",
      "Bachelor of Elementary Education",
      "Bachelor of Culture and Arts Education",
      "Bachelor of Early Childhood Education",
      "Bachelor of Technology and Livelihood Education - HE",
      "Bachelor of Technology and Livelihood Education - IA",
      "Bachelor of Technology and Livelihood Education - AFA",
    ],
  },
  {
    college: "College of Engineering",
    programs: [
      "Bachelor of Science in Agricultural and Biosystems Engineering",
      "Bachelor of Science in Civil Engineering",
      "Bachelor of Science in Information Technology",
    ],
  },
  {
    college: "College of Fisheries",
    programs: ["Bachelor of Science in Fisheries"],
  },
  {
    college: "College of Home Science and Industry",
    programs: [
      "Bachelor of Science in Food Technology",
      "Bachelor of Science in Hospitality Management",
      "Bachelor of Science in Tourism Management",
    ],
  },
  {
    college: "College of Veterinary Science and Medicine",
    programs: ["Doctor of Veterinary Medicine"],
  },
  {
    college: "College of Science",
    programs: [
      "Bachelor of Science in Chemistry",
      "Bachelor of Science in Meteorology",
      "Bachelor of Science in Biology - Biotechnology",
      "Bachelor of Science in Biology - Zoology",
      "Bachelor of Science in Biology - Botany",
      "Bachelor of Science in Biology - Microbiology",
      "Bachelor of Science in Mathematics (COMPUTER APPLICATION TRACK)",
      "Bachelor of Science in Mathematics (BIOMATHEMATICS)",
      "Bachelor of Science in Statistics",
      "Bachelor of Science in Environmental Science",
    ],
  },
];

export const CLSU_PROGRAMS = CLSU_PROGRAM_GROUPS.flatMap(
  (group) => group.programs,
);
