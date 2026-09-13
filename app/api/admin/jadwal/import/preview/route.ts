import { NextRequest, NextResponse } from "next/server";
import { getEditorSession } from "@/lib/auth";
import { parseSchedulePdf } from "@/lib/schedule-pdf";
import type { ApiResponse, ParsedScheduleClass } from "@/types";

export const runtime = "nodejs";

const MAX_PDF_BYTES = 10 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const session = await getEditorSession("schedule");
  if (!session) return NextResponse.json<ApiResponse>({ success: false, error: "Unauthorized" }, { status: 401 });

  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json<ApiResponse>({ success: false, error: "Pilih file PDF terlebih dahulu" }, { status: 400 });
    }
    if (file.size < 5 || file.size > MAX_PDF_BYTES) {
      return NextResponse.json<ApiResponse>({ success: false, error: "Ukuran PDF harus di bawah 10 MB" }, { status: 400 });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes[0] !== 0x25 || bytes[1] !== 0x50 || bytes[2] !== 0x44 || bytes[3] !== 0x46 || bytes[4] !== 0x2d) {
      return NextResponse.json<ApiResponse>({ success: false, error: "File bukan PDF yang valid" }, { status: 400 });
    }

    const classes = await parseSchedulePdf(bytes);
    if (!classes.length) {
      return NextResponse.json<ApiResponse>({ success: false, error: "Tidak menemukan tabel jadwal kelas. Gunakan PDF dari aSc Timetables atau format serupa." }, { status: 422 });
    }
    return NextResponse.json<ApiResponse<ParsedScheduleClass[]>>({ success: true, data: classes });
  } catch (error) {
    console.error("[schedule-pdf-preview]", error instanceof Error ? error.message : error);
    return NextResponse.json<ApiResponse>({ success: false, error: "PDF tidak dapat dibaca" }, { status: 422 });
  }
}
