import type { JadwalItem, ScheduleColor } from "@/types";

export const SCHEDULE_COLOR_OPTIONS: ReadonlyArray<{ value: ScheduleColor; label: string }> = [
  { value: "blue", label: "Biru" },
  { value: "lime", label: "Hijau muda" },
  { value: "green", label: "Hijau" },
  { value: "emerald", label: "Hijau emerald" },
  { value: "cyan", label: "Cyan" },
  { value: "aqua", label: "Aqua" },
  { value: "sky", label: "Biru muda" },
  { value: "purple", label: "Ungu" },
  { value: "pink", label: "Merah muda" },
  { value: "orange", label: "Oranye" },
  { value: "amber", label: "Cokelat krem" },
  { value: "gray", label: "Abu-abu" },
];

const COLOR_TONES: Record<ScheduleColor, string> = {
  blue: "border-[#a9c9e7] bg-[#e4f0fa]",
  lime: "border-[#b8dda9] bg-[#e6f5df]",
  cyan: "border-[#a9dcea] bg-[#def3f8]",
  gray: "border-[#cfcfcf] bg-[#eeeeee]",
  sky: "border-[#add8ea] bg-[#e2f3f9]",
  amber: "border-[#d8c19f] bg-[#f3e8d8]",
  pink: "border-[#e9bfc1] bg-[#fae8e9]",
  purple: "border-[#d4b9e9] bg-[#eee1f8]",
  green: "border-[#acd3ad] bg-[#def0df]",
  emerald: "border-[#afe0ba] bg-[#dff5e4]",
  aqua: "border-[#b4dfdf] bg-[#e0f4f3]",
  orange: "border-[#ecc39d] bg-[#fbeddf]",
};

const SUBJECT_COLOR_RULES: ReadonlyArray<{ keys: string[]; color: ScheduleColor }> = [
  { keys: ["sejarah"], color: "blue" },
  { keys: ["bjpg", "bahasajepang"], color: "lime" },
  { keys: ["bindo", "bahasaindonesia"], color: "cyan" },
  { keys: ["mtk", "matematika"], color: "gray" },
  { keys: ["pai", "pendidikanagamaislam"], color: "sky" },
  { keys: ["bing", "bahasainggris"], color: "amber" },
  { keys: ["bjawa", "bahasajawa"], color: "pink" },
  { keys: ["tp2", "teknikpemesinan"], color: "purple" },
  { keys: ["kik"], color: "green" },
  { keys: ["gtk"], color: "green" },
  { keys: ["bk", "bimbingankonseling"], color: "emerald" },
  { keys: ["pjok"], color: "aqua" },
  { keys: ["pancasila", "ppkn"], color: "orange" },
];

const FALLBACK_COLORS: ScheduleColor[] = ["pink", "blue", "green"];

export function scheduleColorTone(color: ScheduleColor) {
  return COLOR_TONES[color];
}

export function isScheduleColor(value: unknown): value is ScheduleColor {
  return typeof value === "string" && SCHEDULE_COLOR_OPTIONS.some((option) => option.value === value);
}

export function scheduleItemTone(item: Pick<JadwalItem, "subject" | "room" | "color_override">) {
  if (item.color_override) return COLOR_TONES[item.color_override];

  const subjectKey = item.subject.toLocaleLowerCase("id-ID").replace(/[^a-z0-9]/g, "");
  const roomKey = (item.room ?? "").toLocaleLowerCase("id-ID").replace(/[^a-z0-9]/g, "");
  if ((subjectKey === "tp2" || subjectKey.includes("teknikpemesinan")) && (roomKey.includes("bubut") || roomKey.includes("p13"))) {
    return COLOR_TONES.lime;
  }

  const matchingRule = SUBJECT_COLOR_RULES.find(({ keys }) => keys.some((key) => subjectKey === key || (key.length > 4 && subjectKey.includes(key))));
  if (matchingRule) return COLOR_TONES[matchingRule.color];

  const colorIndex = Array.from(subjectKey)
    .reduce((total, character) => total + (character.codePointAt(0) ?? 0), 0) % FALLBACK_COLORS.length;
  return COLOR_TONES[FALLBACK_COLORS[colorIndex]];
}
