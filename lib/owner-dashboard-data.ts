import "server-only";

import {
  getAccessSessions,
  getActivityLogs,
  getAdminSlots,
  getAnggota,
  getGaleriCount,
  getJadwal,
  getPengumuman,
  getFeedbackSubmissions,
  getSiteSettings,
  getTempAccessHistory,
} from "@/lib/db";
import { getOwnerSession } from "@/lib/auth";
import { listMoments, ownerMomentSummary } from "@/lib/moments-server";
import type { OwnerMomentSummary } from "@/lib/moments";
import type { AccessSession, ActivityLog, AdminSlot, Anggota, FeedbackSubmission, GaleriFoto, JadwalItem, Pengumuman, SiteSettings, TempKey } from "@/types";

export type OwnerDataSource = "access" | "temporary" | "sessions" | "homepage" | "schedule" | "members" | "gallery" | "announcements" | "feedback" | "moments" | "activity";

export interface OwnerOverviewSnapshot {
  refreshedAt: string;
  unavailable: OwnerDataSource[];
  admin: {
    active: number;
    total: number;
    expiring: Array<{ id: number; label: string; expiresAt: string }>;
  };
  temporary: {
    active: number;
    nearest: { label: string; expiresAt: string } | null;
  };
  moments: {
    live: number;
    cleanupPending: number;
  };
  content: {
    homepage: { complete: boolean; hasRecord: boolean; updatedAt: string | null };
    schedule: { count: number };
    members: { total: number; visible: number };
    gallery: { count: number };
  };
}

export interface OwnerDashboardData {
  slots: AdminSlot[];
  logs: ActivityLog[];
  tempKeys: TempKey[];
  sessions: AccessSession[];
  settings: SiteSettings | null;
  schedule: JadwalItem[];
  members: Anggota[];
  gallery: GaleriFoto[];
  announcements: Pengumuman[];
  feedback: FeedbackSubmission[];
  moments: OwnerMomentSummary[];
  overview: OwnerOverviewSnapshot;
}

function resolved<T>(result: PromiseSettledResult<T>, fallback: T): T {
  return result.status === "fulfilled" ? result.value : fallback;
}

export async function loadOwnerDashboardData(): Promise<OwnerDashboardData> {
  const ownerSession = await getOwnerSession();
  const results = await Promise.allSettled([
    getAdminSlots(),
    getTempAccessHistory(),
    getAccessSessions(ownerSession?.session_id),
    getSiteSettings(),
    getJadwal(),
    getAnggota(true),
    getGaleriCount(),
    getPengumuman(),
    getFeedbackSubmissions(),
    listMoments(true),
    getActivityLogs(30),
  ] as const);

  const [slotsResult, tempResult, sessionsResult, settingsResult, scheduleResult, membersResult, galleryResult, announcementsResult, feedbackResult, momentsResult, logsResult] = results;
  const slots = resolved(slotsResult, []).map((slot) => ({ ...slot, key_hash: null, generated_key: null }));
  const tempKeys = resolved(tempResult, []);
  const sessions = resolved(sessionsResult, []);
  const settings = resolved(settingsResult, null);
  const schedule = resolved(scheduleResult, []);
  const members = resolved(membersResult, []);
  const galleryCount = resolved(galleryResult, 0);
  const gallery: GaleriFoto[] = [];
  const announcements = resolved(announcementsResult, []);
  const feedback = resolved(feedbackResult, []);
  const moments = resolved(momentsResult, []);
  const logs = resolved(logsResult, []);
  const unavailable: OwnerDataSource[] = [];

  if (slotsResult.status === "rejected") unavailable.push("access");
  if (tempResult.status === "rejected") unavailable.push("temporary");
  if (sessionsResult.status === "rejected") unavailable.push("sessions");
  if (settingsResult.status === "rejected") unavailable.push("homepage");
  if (scheduleResult.status === "rejected") unavailable.push("schedule");
  if (membersResult.status === "rejected") unavailable.push("members");
  if (galleryResult.status === "rejected") unavailable.push("gallery");
  if (announcementsResult.status === "rejected") unavailable.push("announcements");
  if (feedbackResult.status === "rejected") unavailable.push("feedback");
  if (momentsResult.status === "rejected") unavailable.push("moments");
  if (logsResult.status === "rejected") unavailable.push("activity");

  const now = Date.now();
  const activeSlots = slots.filter((slot) => slot.is_active);
  const expiring = activeSlots
    .filter((slot) => {
      if (!slot.expires_at) return false;
      const remaining = new Date(slot.expires_at).getTime() - now;
      return remaining > 0 && remaining <= 3 * 24 * 60 * 60 * 1000;
    })
    .map((slot) => ({ id: slot.id, label: slot.label, expiresAt: slot.expires_at! }));
  const activeTempKeys = tempKeys.filter((key) => !key.revoked_at && new Date(key.expires_at).getTime() > now && (key.is_used || !key.activation_expires_at || new Date(key.activation_expires_at).getTime() > now));
  const nearestTemp = [...activeTempKeys]
    .sort((a, b) => new Date(a.expires_at).getTime() - new Date(b.expires_at).getTime())[0] ?? null;

  return {
    slots,
    logs,
    tempKeys,
    sessions,
    settings,
    schedule,
    members,
    gallery,
    announcements,
    feedback,
    moments: moments.map(ownerMomentSummary),
    overview: {
      refreshedAt: new Date().toISOString(),
      unavailable,
      admin: { active: activeSlots.length, total: slots.length, expiring },
      temporary: {
        active: activeTempKeys.length,
        nearest: nearestTemp ? { label: nearestTemp.label, expiresAt: nearestTemp.expires_at } : null,
      },
      moments: {
        live: moments.filter((moment) => moment.status === "published").length,
        cleanupPending: moments.filter((moment) => moment.status !== "published").length,
      },
      content: {
        homepage: {
          hasRecord: Boolean(settings),
          complete: Boolean(settings?.hero_image_url && settings.about_text?.trim()),
          updatedAt: settings?.updated_at ?? null,
        },
        schedule: { count: schedule.length },
        members: { total: members.length, visible: members.filter((member) => member.is_visible).length },
        gallery: { count: galleryCount },
      },
    },
  };
}
