import type { PersonAttendanceStats, PersonStatsInput } from "@/lib/kav/stats-domain";

type LegacyStat = {
  baseDays: number;
  homeDays: number;
  name: string;
  variants?: string[];
};

const KISHUFIM_2025_STATS: LegacyStat[] = [
  { name: "גיא כהן", variants: ["גיא"], baseDays: 31, homeDays: 55 },
  { name: "מלסה אטלאי", variants: ["מלסה"], baseDays: 32, homeDays: 53 },
  { name: "אריאל דויב", variants: ["דוייב", "אריאל דוייב"], baseDays: 34, homeDays: 51 },
  { name: "יונתן אבוחצירא", variants: ["יוני"], baseDays: 34, homeDays: 51 },
  { name: "אורי בנבג'י", variants: ["בגי", "בג'י"], baseDays: 36, homeDays: 49 },
  { name: "ירין אמסילי", variants: ["אמסילי"], baseDays: 36, homeDays: 49 },
  { name: "אסף אליאב", variants: ["אסף"], baseDays: 36, homeDays: 49 },
  { name: "תמיר אסראסו", variants: ["אסראסו"], baseDays: 37, homeDays: 48 },
  { name: "דניאל גרוס", variants: ["גרוס"], baseDays: 37, homeDays: 48 },
  { name: "בנימין ברי", variants: ["ברי"], baseDays: 37, homeDays: 48 },
  { name: "לידור דורון", variants: ["לידור"], baseDays: 38, homeDays: 47 },
  { name: "רפאל עזרא", variants: ["רפאל"], baseDays: 38, homeDays: 47 },
  { name: "ניתאי ידעי", variants: ["ניתאי"], baseDays: 40, homeDays: 45 },
  { name: "ירין כהן", variants: ["ירין"], baseDays: 40, homeDays: 45 },
  { name: "עמנואל אלמו", variants: ["מנו"], baseDays: 25, homeDays: 33 },
  { name: "עדן מימון", variants: ["מימון"], baseDays: 41, homeDays: 44 },
  { name: "אביאל אלקאיל", variants: ["אביאל"], baseDays: 41, homeDays: 44 },
];

export function getLegacyLineStatsOverride(
  period: { name: string },
  people: PersonStatsInput[],
): PersonAttendanceStats[] | null {
  if (period.name !== "קו כיסופים 2025") return null;

  const statsByName = new Map<string, LegacyStat>();
  for (const stat of KISHUFIM_2025_STATS) {
    statsByName.set(normalizeName(stat.name), stat);
    for (const variant of stat.variants ?? []) statsByName.set(normalizeName(variant), stat);
  }

  return people.flatMap((person) => {
    const stat = statsByName.get(normalizeName(person.fullName));
    if (!stat) return [];
    const totalElapsedDays = stat.baseDays + stat.homeDays;
    return [{
      attendancePercentage: totalElapsedDays ? stat.baseDays / totalElapsedDays : null,
      baseDays: stat.baseDays,
      finalizedExpectedDays: totalElapsedDays,
      fullName: person.fullName,
      homeDays: stat.homeDays,
      homePercentage: totalElapsedDays ? stat.homeDays / totalElapsedDays : 0,
      leaveDays: 0,
      personId: person.id,
      photoUrl: person.photoUrl ?? null,
      presentOnExpectedDays: stat.baseDays,
      totalElapsedDays,
    }];
  });
}

function normalizeName(name: string) {
  return name.replace(/\s+/g, " ").trim();
}
