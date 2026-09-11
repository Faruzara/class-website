"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import type { JadwalItem } from "@/types";

const DAYS = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

function currentAlternatingWeek(): 1 | 2 {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const weekNumber = Math.ceil((((now.getTime() - start.getTime()) / 86400000) + start.getDay() + 1) / 7);
  return weekNumber % 2 === 1 ? 1 : 2;
}

export default function PublicSchedule() {
  const activeWeek = useMemo(currentAlternatingWeek, []);
  const [selectedWeek, setSelectedWeek] = useState<1 | 2>(activeWeek);
  const [items, setItems] = useState<JadwalItem[]>([]);

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 5000);
    const client = createClient(url, key);
    Promise.resolve(client.from("jadwal").select("id, subject, day, week, room, start_period, end_period").not("subject", "is", null).order("start_period")
      .abortSignal(controller.signal))
      .then(({ data }) => setItems((data ?? []) as JadwalItem[]))
      .catch(() => undefined)
      .finally(() => window.clearTimeout(timer));
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, []);

  const weekItems = items.filter((item) => item.week === selectedWeek);
  const maxPeriod = Math.max(10, ...weekItems.map((item) => item.end_period));

  return (
    <section>
      <div className="mb-7 flex items-center gap-6 border-b border-surface-border">
        {[1, 2].map((week) => (
          <button key={week} onClick={() => setSelectedWeek(week as 1 | 2)} className={`relative pb-3 text-sm ${selectedWeek === week ? "font-semibold text-gray-900 after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-brand-500" : "text-gray-500"}`}>
            Week {week}{activeWeek === week && <span className="ml-2 text-[10px] font-medium uppercase tracking-wider text-brand-700">Aktif</span>}
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
                      <div key={item.id} className="z-10 m-1.5 flex flex-col justify-center rounded-lg border border-[#efb2ae] bg-[#fff1ef] px-3 py-2" style={{ gridColumn: `${item.start_period + 1} / ${item.end_period + 2}`, gridRow: 1 }}>
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
              return <section key={day}><h2 className="mb-3 font-semibold text-gray-900">{day}</h2><div className="space-y-2">{dayItems.map((item) => <div key={item.id} className="border-l-2 border-brand-500 bg-white px-4 py-3"><div className="flex items-start justify-between gap-4"><p className="font-medium text-gray-900">{item.subject}</p><span className="shrink-0 text-xs text-gray-500">Periode {item.start_period}–{item.end_period}</span></div>{item.room && <p className="mt-1 text-xs text-gray-500">{item.room}</p>}</div>)}</div></section>;
            })}
          </div>
        </>
      )}
    </section>
  );
}
