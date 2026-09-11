export function isSafeSocialUrl(value: string, platform: "instagram" | "tiktok"): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    return platform === "instagram"
      ? host === "instagram.com" || host.endsWith(".instagram.com")
      : host === "tiktok.com" || host.endsWith(".tiktok.com");
  } catch {
    return false;
  }
}

export function isSupabaseMediaUrl(value: string): boolean {
  try {
    const media = new URL(value);
    const project = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
    return media.protocol === "https:" && media.hostname === project.hostname;
  } catch {
    return false;
  }
}

export function isCloudinaryMediaUrl(value: string): boolean {
  try {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
    const media = new URL(value);
    const segments = media.pathname.split("/").filter(Boolean);
    return Boolean(
      cloudName
      && media.protocol === "https:"
      && media.hostname === "res.cloudinary.com"
      && segments[0] === cloudName
      && segments[1] === "image"
      && segments[2] === "upload"
      && segments.includes("web-kelas")
    );
  } catch {
    return false;
  }
}

export function isManagedMediaUrl(value: string): boolean {
  return isSupabaseMediaUrl(value) || isCloudinaryMediaUrl(value);
}

export function isSafeGithubUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (url.hostname === "github.com" || url.hostname.endsWith(".github.com"));
  } catch {
    return false;
  }
}
