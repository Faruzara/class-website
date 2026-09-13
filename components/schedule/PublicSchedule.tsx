"use client";

import { useState } from "react";
import type { JadwalItem } from "@/types";
import type { ScheduleWeek } from "@/lib/schedule-week";

const DAYS = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

const SUBJECT_TONE_RULES = [
  { keys: ["sejarah"], tone: "border-[#a9c9e7] bg-[#e4f0fa]" },
  { keys: ["bjpg", "bahasajepang"], tone: "border-[#b8dda9] bg-[#e6f5df]" },
  { keys: ["bindo", "bahasaindonesia"], tone: "border-[#a9dcea] bg-[#def3f8]" },
  { keys: ["mtk", "matematika"], tone: "border-[#cfcfcf] bg-[#eeeeee]" },
  { keys: ["pai", "pendidikanagamaislam"], tone: "border-[#add8ea] bg-[#e2f3f9]" },
  { keys: ["bing", "bahasainggris"], tone: "border-[#d8c19f] bg-[#f3e8d8]" },
  { keys: ["bjawa", "bahasajawa"], tone: "border-[#e9bfc1] bg-[#fae8e9]" },
  { keys: ["tp2", "teknikpemesinan"], tone: "border-[#d4b9e9] bg-[#eee1f8]" },
  { keys: ["kik"], tone: "border-[#acd3ad] bg-[#def0df]" },
  { keys: ["gtk"], tone: "border-[#b3d7b2] bg-[#e2f1e1]" },
  { keys: ["bk", "bimbingankonseling"], tone: "border-[#afe0ba] bg-[#dff5e4]" },
  { keys: ["pjok"], tone: "border-[#b4dfdf] bg-[#e0f4f3]" },
  { keys: ["pancasila", "ppkn"], tone: "border-[#ecc39d] bg-[#fbeddf]" },
] as const;

const FALLBACK_TONES = [
  "border-[#efc9c5] bg-[#fff3f1]",
  "border-[#cbddec] bg-[#f1f7fb]",
  "border-[#cfe3d0] bg-[#f2f8f1]",
] as const;

function subjectTone(subject: string) {
  const subjectKey = subject.toLocaleLowerCase("id-ID").replace(/[^a-z0-9]/g, "");
  const matchingRule = SUBJECT_TONE_RULES.find(({ keys }) => keys.some((key) => subjectKey === key || (key.length > 4 && subjectKey.includes(key))));
  if (matchingRule) return matchingRule.tone;

  const toneIndex = Array.from(subjectKey)
    .reduce((total, character) => total + (character.codePointAt(0) ?? 0), 0) % FALLBACK_TONES.length;
  return FALLBACK_TONES[toneIndex];
}

export default function PublicSchedule({
  initialItems,
  initialActiveWeek,
}: {
  initialItems: JadwalItem[];
  initialActiveWeek: ScheduleWeek;
}) {
  const [selectedWeek, setSelectedWeek] = useState<ScheduleWeek>(initialActiveWeek);

  const weekItems = initialItems.filter((item) => item.week === selectedWeek);
  const maxPeriod = Math.min(11, Math.max(1, ...weekItems.map((item) => item.end_period)));

  return (
    <section>
      <div className="mb-7 flex items-center gap-6 border-b border-surface-border">
        {[1, 2].map((week) => (
          <button key={week} onClick={() => setSelectedWeek(week as ScheduleWeek)} className={`relative pb-3 text-sm ${selectedWeek === week ? "font-semibold text-gray-900 after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-brand-500" : "text-gray-500"}`}>
            Week {week}{initialActiveWeek === week && <span className="ml-2 text-[10px] font-medium uppercase tracking-wider text-brand-700">Aktif</span>}
          </button>
        ))}
      </div>

      {weekItems.length === 0 ? (
        <p className="border-l-2 border-brand-500 py-1 pl-4 text-sm text-gray-500">Jadwal Week {selectedWeek} belum tersedia.</p>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-xl border border-surface-border bg-white md:block">
            <div className="min-w-[900px]">
              <div className="grid border-b border-surface-border bg-surface-muted" style={{ gridTemplateColumns: `100px repeat(${maxPeriod}, minmax(70px, 1fr))` }}>
                <div className="p-3 text-xs font-medium text-gray-500">Hari</div>
                {Array.from({ length: maxPeriod }, (_, index) => <div key={index} className="border-l border-surface-border p-3 text-center text-xs font-medium text-gray-500">{index + 1}</div>)}
              </div>
              {DAYS.map((day) => {
                const dayItems = weekItems.filter((item) => item.day === day);
                if (dayItems.length === 0) return null;
                return (
                  <div key={day} className="grid min-h-24 border-b border-surface-border last:border-0" style={{ gridTemplateColumns: `100px repeat(${maxPeriod}, minmax(70px, 1fr))` }}>
                    <div className="z-10 flex items-center px-3 text-sm font-semibold text-gray-800" style={{ gridColumn: 1, gridRow: 1 }}>{day}</div>
                    {Array.from({ length: maxPeriod }, (_, index) => <div key={index} className="border-l border-surface-border" style={{ gridColumn: index + 2, gridRow: 1 }} />)}
                    {dayItems.map((item) => (
                      <div key={item.id} className={`z-10 m-1.5 flex flex-col justify-center rounded-lg border px-3 py-2 ${subjectTone(item.subject)}`} style={{ gridColumn: `${item.start_period + 1} / ${item.end_period + 2}`, gridRow: 1 }}>
                        <p className="text-sm font-semibold text-gray-900">{item.subject}</p>
                        {item.room && <p className="mt-1 text-[11px] text-gray-500">{item.room}</p>}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-7 md:hidden">
            {DAYS.map((day) => {
              const dayItems = weekItems.filter((item) => item.day === day);
              if (dayItems.length === 0) return null;
              return <section key={day}><h2 className="mb-3 text-sm font-semibold text-gray-900">{day}</h2><div className="space-y-2">{dayItems.map((item) => <div key={item.id} className={`rounded-xl border px-4 py-3.5 ${subjectTone(item.subject)}`}><div className="flex items-start justify-between gap-4"><p className="font-semibold text-gray-900">{item.subject}</p><span className="shrink-0 rounded-md border border-black/[0.06] bg-white/55 px-2 py-1 text-[11px] font-medium text-gray-600">{item.start_period}–{item.end_period}</span></div>{item.room && <p className="mt-1.5 text-xs text-gray-500">Ruang {item.room}</p>}</div>)}</div></section>;
            })}
          </div>
        </>
      )}
    </section>
  );
}
