import { NextRequest, NextResponse } from "next/server";
import { createFeedbackSubmission } from "@/lib/db";
import { isMissingSupabaseRelation } from "@/lib/supabase-compat";
import type { ApiResponse, FeedbackSubmission, FeedbackType } from "@/types";

const attempts = new Map<string, number[]>();
const WINDOW_MS = 10 * 60 * 1000;
const LIMIT = 3;

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if ((origin && origin !== request.nextUrl.origin) || request.headers.get("sec-fetch-site") === "cross-site") {
    return NextResponse.json<ApiResponse>({ success: false, error: "Request ditolak." }, { status: 403 });
  }
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (String(body?.website ?? "")) return NextResponse.json<ApiResponse>({ success: true });
  const type = String(body?.type ?? "") as FeedbackType;
  const message = String(body?.message ?? "").trim();
  const pagePath = String(body?.page_path ?? "").trim();
  if (!["bug", "feature"].includes(type) || message.length < 10 || message.length > 1000 || pagePath.length > 300 || (pagePath && !pagePath.startsWith("/"))) {
    return NextResponse.json<ApiResponse>({ success: false, error: "Isi feedback 10-1000 karakter." }, { status: 400 });
  }

  const key = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const now = Date.now();
  const recent = (attempts.get(key) ?? []).filter((time) => now - time < WINDOW_MS);
  if (recent.length >= LIMIT) return NextResponse.json<ApiResponse>({ success: false, error: "Terlalu banyak kiriman. Coba lagi beberapa menit." }, { status: 429 });
  attempts.set(key, [...recent, now]);

  try {
    const feedback = await createFeedbackSubmission({ type, message, page_path: pagePath || null });
    return NextResponse.json<ApiResponse<FeedbackSubmission>>({ success: true, data: feedback });
  } catch (error) {
    if (isMissingSupabaseRelation(error, "feedback_submissions")) {
      return NextResponse.json<ApiResponse>({ success: false, error: "Fitur feedback belum diaktifkan oleh pengelola." }, { status: 503 });
    }
    return NextResponse.json<ApiResponse>({ success: false, error: "Feedback gagal dikirim." }, { status: 500 });
  }
}
