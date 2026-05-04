export type CurriculumRequirement = {
  key: string;
  name: string;
  requiredCpMin: number | null;
  requiredCpMax: number | null;
  color: string;
  position: number;
  aliases: string[];
};

export type CurriculumProgram = {
  programKey: string;
  requirements: CurriculumRequirement[];
};

const pastelPalette = ["#A7F3D0", "#BFDBFE", "#FDE68A", "#FBCFE8", "#DDD6FE", "#FED7AA", "#BAE6FD", "#C7D2FE"];

const sharedMasterRelated = [
  requirement("study-related", "Studienbegleitende Leistungen", 9, 18, 2, [
    "studienbegleitende leistungen",
    "study-related",
    "seminare",
    "seminars",
    "praktika",
    "practicals",
    "project practicals",
    "praktikum in der lehre",
    "teaching internship"
  ]),
  requirement("general-studies", "Studium Generale", 18, 24, 3, ["studium generale", "general studies", "general education"]),
  requirement("master-thesis", "Masterarbeit", 30, 30, 4, ["masterarbeit", "master thesis", "thesis"])
];

export const CURRICULUM_REQUIREMENTS: CurriculumProgram[] = [
  {
    programKey: "bsc-informatik",
    requirements: [
      requirement("pflichtbereich", "Pflichtbereich", 114, 114, 0, ["pflichtbereich", "mandatory", "compulsory"]),
      requirement("wahlpflichtbereich", "Wahlpflichtbereich", 10, 35, 1, ["wahlpflichtbereich", "compulsory elective"]),
      requirement("informatik-wahlbereiche", "Informatik-Wahlbereiche", 5, 30, 2, [
        "wahlbereich fachprüfungen",
        "wahlbereich fachpruefungen",
        "wahlbereich künstliche intelligenz",
        "wahlbereich kuenstliche intelligenz",
        "wahlbereich cybersicherheit",
        "wahlbereich komplexe vernetzte systeme",
        "wahlbereich software und hardware",
        "wahlbereich theorie",
        "fachprüfungen",
        "fachpruefungen"
      ]),
      requirement("studienbegleitende-leistungen", "Studienbegleitende Leistungen", 9, 18, 3, [
        "wahlbereich studienbegleitende leistungen",
        "studienbegleitende leistungen",
        "seminare",
        "praktika",
        "praktikum in der lehre"
      ]),
      requirement("studium-generale", "Studium Generale", 5, 6, 4, ["studium generale", "general education"]),
      requirement("bachelorarbeit", "Bachelorarbeit", 12, 12, 5, ["bachelorarbeit", "bachelor thesis"])
    ]
  },
  {
    programKey: "msc-informatik",
    requirements: [
      requirement("basic-elective-area", "Basis-Wahlbereich", 12, 57, 0, [
        "basic elective area",
        "basis-wahlbereich",
        "software & hardware",
        "software and hardware",
        "theory",
        "theorie"
      ]),
      requirement("individual-immersion", "Individuelle Vertiefung", 6, 51, 1, [
        "elective area individual immersion",
        "individuelle vertiefung",
        "artificial intelligence",
        "cybersecurity",
        "privacy",
        "complex networked systems"
      ]),
      ...sharedMasterRelated
    ]
  },
  {
    programKey: "msc-computer-science",
    requirements: [
      requirement("basic-elective-area", "Basic Elective Area", 12, 18, 0, [
        "basic elective area",
        "software and hardware",
        "software & hardware",
        "theory"
      ]),
      requirement("specialisation", "Specialisation", 54, 60, 1, [
        "specialisation",
        "specialization",
        "data science",
        "distributed computing",
        "visual computing"
      ]),
      ...sharedMasterRelated
    ]
  },
  {
    programKey: "msc-autonome-systeme-robotik",
    requirements: [
      requirement("compulsory-electives", "Wahlpflichtbereich", 28, 68, 0, [
        "compulsory electives",
        "wahlpflicht",
        "sense",
        "act",
        "plan",
        "basis technologies"
      ]),
      requirement("electives", "Wahlbereich", 0, 40, 1, ["electives", "wahlbereich"]),
      requirement("other-electives", "Studienbegleitende Leistungen", 17, 21, 2, [
        "other electives",
        "study-related",
        "seminars",
        "practicals",
        "studienbegleitende leistungen"
      ]),
      requirement("studium-generale", "Studium Generale", 5, 6, 3, ["studium generale", "general education"]),
      requirement("master-thesis", "Masterarbeit", 30, 30, 4, ["master thesis", "masterarbeit", "thesis"])
    ]
  },
  {
    programKey: "msc-artificial-intelligence-machine-learning",
    requirements: [
      requirement("foundations-ai", "Foundations of Artificial Intelligence", null, null, 0, [
        "foundations of artificial intelligence",
        "fundamentals",
        "grundlagen"
      ]),
      requirement("ai-models-methods", "AI Models and Methods", null, null, 1, ["ai models", "models and methods", "machine learning"]),
      requirement("ai-systems", "AI Systems", null, null, 2, ["ai systems", "real ai systems", "systems"]),
      requirement("ai-domains-applications", "AI Domains and Applications", null, null, 3, [
        "ai domains",
        "domains and applications",
        "applications"
      ]),
      requirement("projects-labs-seminars", "Projects, Labs and Seminars", null, null, 4, ["projects", "labs", "seminars", "praktika"]),
      requirement("studium-generale", "Studium Generale", 5, 6, 5, ["studium generale", "general education"]),
      requirement("master-thesis", "Masterarbeit", 30, 30, 6, ["master thesis", "masterarbeit", "thesis"])
    ]
  },
  {
    programKey: "msc-it-security",
    requirements: [
      requirement("elective-areas", "Elective Areas", 59, 76, 0, [
        "elective areas",
        "cryptography",
        "foundations",
        "system security",
        "systems and communication security",
        "software security",
        "application security",
        "complementary topics"
      ]),
      requirement("seminars-labs", "Seminars, Labs and Practical Labs", 9, 15, 1, [
        "seminars",
        "labs",
        "practical labs",
        "seminare",
        "praktika"
      ]),
      requirement("general-education", "General Education", 5, 6, 2, ["general education", "studium generale"]),
      requirement("master-thesis", "Master Thesis", 30, 30, 3, ["master thesis", "masterarbeit", "thesis"])
    ]
  }
];

function requirement(
  key: string,
  name: string,
  requiredCpMin: number | null,
  requiredCpMax: number | null,
  position: number,
  aliases: string[]
): CurriculumRequirement {
  return {
    key,
    name,
    requiredCpMin,
    requiredCpMax,
    color: pastelPalette[position % pastelPalette.length]!,
    position,
    aliases: [name, key, ...aliases]
  };
}

export function requirementsForProgram(programKey: string | null | undefined): CurriculumRequirement[] {
  if (!programKey) {
    return [];
  }

  return CURRICULUM_REQUIREMENTS.find((entry) => entry.programKey === programKey)?.requirements ?? [];
}

export function serializeRequirement(requirement: CurriculumRequirement) {
  return {
    category_key: requirement.key,
    name: requirement.name,
    required_cp_min: requirement.requiredCpMin,
    required_cp_max: requirement.requiredCpMax,
    color: requirement.color,
    position: requirement.position
  };
}

export function findRequirementForClassPath(
  programKey: string | null | undefined,
  classPath: string[] | null | undefined
): CurriculumRequirement | null {
  const requirements = requirementsForProgram(programKey);
  if (requirements.length === 0 || !classPath || classPath.length === 0) {
    return null;
  }

  const normalizedPath = classPath.map(normalizeLabel).join(" ");
  if (!normalizedPath) {
    return null;
  }

  return (
    requirements.find((requirement) =>
      requirement.aliases.some((alias) => {
        const normalizedAlias = normalizeLabel(alias);
        return normalizedAlias.length > 0 && normalizedPath.includes(normalizedAlias);
      })
    ) ?? null
  );
}

function normalizeLabel(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
