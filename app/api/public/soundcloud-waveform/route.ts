import { NextRequest, NextResponse } from "next/server";
import type { ApiResponse } from "@/types";

type WaveformPayload = { samples?: unknown };

export async function GET(req: NextRequest) {
  const value = req.nextUrl.searchParams.get("url");
  if (!value) return NextResponse.json<ApiResponse>({ success: false, error: "URL waveform tidak tersedia." }, { status: 400 });

  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "wave.sndcdn.com" || !url.pathname.endsWith(".json")) {
      return NextResponse.json<ApiResponse>({ success: false, error: "URL waveform tidak valid." }, { status: 400 });
    }

    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: 86_400 },
      redirect: "error",
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error(`SoundCloud waveform ${response.status}`);
    const payload = await response.json() as WaveformPayload;
    if (!Array.isArray(payload.samples)) throw new Error("Waveform samples unavailable");

    const rawSamples = payload.samples
      .map(Number)
      .filter((sample) => Number.isFinite(sample) && sample >= 0);
    if (rawSamples.length < 2) throw new Error("Waveform samples unavailable");
    const sampleCount = Math.min(2_000, rawSamples.length);
    const samples = Array.from({ length: sampleCount }, (_, index) => rawSamples[Math.floor((index / Math.max(1, sampleCount - 1)) * (rawSamples.length - 1))]);
    const peak = Math.max(1, ...samples);
    return NextResponse.json<ApiResponse<{ samples: number[] }>>({
      success: true,
      data: { samples: samples.map((sample) => Math.min(1, sample / peak)) },
    });
  } catch (error) {
    console.error("[GET /api/public/soundcloud-waveform]", error);
    return NextResponse.json<ApiResponse>({ success: false, error: "Waveform belum dapat dimuat." }, { status: 502 });
  }
}
