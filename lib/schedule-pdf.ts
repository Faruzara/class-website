import type { ParsedScheduleClass, ScheduleImportItem } from "@/types";

type PdfTextItem = {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

const DAY_LABEL = /^(SENIN|SELASA|RABU|KAMIS|JUMAT|SABTU)\s+([12])$/i;
const CLASS_LABEL = /^(?:X|XI|XII)\s+[A-Z0-9][A-Z0-9 .-]*$/i;
const DAY_NAMES: Record<string, ScheduleImportItem["day"]> = {
  SENIN: "Senin",
  SELASA: "Selasa",
  RABU: "Rabu",
  KAMIS: "Kamis",
  JUMAT: "Jumat",
  SABTU: "Sabtu",
};
const SUBJECT_NAMES: Record<string, string> = {
  BJPG: "B Jepang",
  BINDO: "B Indonesia",
  BING: "B Inggris",
  BJAWA: "B Jawa",
};

function cleanText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeSubject(subject: string) {
  const cleaned = cleanText(subject);
  return SUBJECT_NAMES[cleaned.replace(/\s+/g, "").toUpperCase()] ?? cleaned;
}

function assignSubjectSpans(subjects: PdfTextItem[], periodCenters: number[]) {
  type Result = { cost: number; spans: Array<{ start: number; end: number }> };
  const memo = new Map<string, Result | null>();

  function solve(subjectIndex: number, startPeriod: number): Result | null {
    const memoKey = `${subjectIndex}:${startPeriod}`;
    if (memo.has(memoKey)) return memo.get(memoKey) ?? null;
    if (subjectIndex >= subjects.length) return { cost: 0, spans: [] };

    const remainingSubjects = subjects.length - subjectIndex - 1;
    const latestEnd = periodCenters.length - remainingSubjects;
    const subjectCenter = subjects[subjectIndex].x + subjects[subjectIndex].width / 2;
    let best: Result | null = null;

    for (let endPeriod = startPeriod; endPeriod <= latestEnd; endPeriod += 1) {
      const spanCenter = (periodCenters[startPeriod - 1] + periodCenters[endPeriod - 1]) / 2;
      const next = solve(subjectIndex + 1, endPeriod + 1);
      if (!next) continue;
      const result = {
        cost: (subjectCenter - spanCenter) ** 2 + next.cost,
        spans: [{ start: startPeriod, end: endPeriod }, ...next.spans],
      };
      if (!best || result.cost < best.cost) best = result;
    }

    memo.set(memoKey, best);
    return best;
  }

  return solve(0, 1)?.spans ?? [];
}

function mergeAdjacent(items: ScheduleImportItem[]) {
  const merged: ScheduleImportItem[] = [];
  for (const item of items) {
    const previous = merged.at(-1);
    if (
      previous
      && previous.week === item.week
      && previous.day === item.day
      && previous.subject === item.subject
      && previous.room === item.room
      && previous.end_period + 1 === item.start_period
    ) {
      previous.end_period = item.end_period;
    } else {
      merged.push({ ...item });
    }
  }
  return merged;
}

function parsePage(items: PdfTextItem[], pageNumber: number): ParsedScheduleClass | null {
  const classItem = items
    .filter((item) => item.height >= 18 && CLASS_LABEL.test(item.str) && !/^JADWAL\b/i.test(item.str))
    .sort((left, right) => right.height - left.height)[0];
  if (!classItem) return null;

  const periodItems = items
    .filter((item) => item.height >= 18 && /^(?:[1-9]|10|11)$/.test(item.str))
    .sort((left, right) => left.x - right.x);
  if (periodItems.length < 2) return null;

  const periodCenters = periodItems.map((item) => item.x + item.width / 2);
  const averageColumnWidth = periodCenters.length > 1
    ? (periodCenters.at(-1)! - periodCenters[0]) / (periodCenters.length - 1)
    : 1;
  const tableLeft = periodCenters[0] - averageColumnWidth / 2;

  const rows = items
    .map((item) => ({ item, match: item.str.match(DAY_LABEL) }))
    .filter((entry): entry is { item: PdfTextItem; match: RegExpMatchArray } => Boolean(entry.match))
    .sort((left, right) => right.item.y - left.item.y);
  if (!rows.length) return null;

  const parsed: ScheduleImportItem[] = [];
  for (const { item: row, match } of rows) {
    const day = DAY_NAMES[match[1].toUpperCase()];
    const week = Number(match[2]) as 1 | 2;
    const subjects = items
      .filter((item) => {
        if (!item.str || item.x < tableLeft || item.height < 5 || item.height > row.height * 0.9) return false;
        return Math.abs(item.y - row.y) <= Math.max(4, row.height * 0.3);
      })
      .sort((left, right) => left.x - right.x);

    const spans = assignSubjectSpans(subjects, periodCenters);

    subjects.forEach((subject, index) => {
      const span = spans[index];
      if (!span) return;
      const leftBoundary = periodCenters[span.start - 1] - averageColumnWidth / 2;
      const rightBoundary = periodCenters[span.end - 1] + averageColumnWidth / 2;
      const details = items
        .filter((item) => item.str && item.x >= leftBoundary && item.x <= rightBoundary && item.height > 1 && item.height < subject.height * 0.75 && item.y < subject.y - subject.height * 0.45 && item.y > subject.y - row.height * 1.4)
        .sort((left, right) => left.x - right.x);
      if (!details.length) return;

      const roomParts = details.slice(0, -1).map((item) => cleanText(item.str)).filter(Boolean);

      parsed.push({
        subject: normalizeSubject(subject.str),
        day,
        week,
        room: roomParts.length ? roomParts.join(" ") : null,
        start_period: span.start,
        end_period: span.end,
      });
    });
  }

  return {
    class_name: cleanText(classItem.str),
    page_number: pageNumber,
    items: mergeAdjacent(parsed),
  };
}

export async function parseSchedulePdf(data: Uint8Array): Promise<ParsedScheduleClass[]> {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = getDocument({ data, useSystemFonts: true });
  const document = await loadingTask.promise;
  const parsed: ParsedScheduleClass[] = [];

  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const items = content.items.flatMap((item) => {
        if (!("str" in item)) return [];
        const str = cleanText(item.str);
        if (!str) return [];
        return [{
          str,
          x: item.transform[4],
          y: item.transform[5],
          width: item.width,
          height: item.height,
        }];
      });
      const result = parsePage(items, pageNumber);
      if (result?.items.length) parsed.push(result);
      page.cleanup();
    }
  } finally {
    await loadingTask.destroy();
  }

  return parsed;
}
