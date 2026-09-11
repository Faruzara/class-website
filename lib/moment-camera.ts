import { MOMENT_MAX_EDGE, momentPreviewSize } from './moments';

// Owns stream lifetime, including requests resolving after close/StrictMode replay.
export class MomentCamera {
  private version = 0;
  stream: MediaStream | null = null;
  stop() {
    this.version++;
    this.stream?.getTracks().forEach(track => track.stop());
    this.stream = null;
  }
  async open(media: Pick<MediaDevices, 'getUserMedia'>, deviceId?: string) {
    this.stop();
    const version = this.version;
    try {
      const stream = await media.getUserMedia({ audio: false, video: {
        ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: { ideal: 'environment' } }),
        width: { ideal: 1920 }, height: { ideal: 1440 },
      } });
      if (version !== this.version) { stream.getTracks().forEach(track => track.stop()); return null; }
      this.stream = stream;
      return stream;
    } catch (error) { if (version !== this.version) return null; throw error; }
  }
}

export function cameraErrorMessage(error: unknown) {
  const name = error && typeof error === 'object' && 'name' in error ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'Izin kamera diperlukan untuk mengambil Moment.';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'Kamera tidak ditemukan di perangkat ini.';
  if (name === 'NotReadableError') return 'Kamera sedang digunakan atau tidak bisa dibuka.';
  return 'Kamera tidak dapat diakses. Gunakan HTTPS atau localhost, lalu coba lagi.';
}

function jpegBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Capture tidak selesai.')), 10000);
    canvas.toBlob(blob => {
      clearTimeout(timeout);
      if (!blob || blob.type !== 'image/jpeg') reject(new Error('Capture JPEG tidak didukung.'));
      else resolve(blob);
    }, 'image/jpeg', quality);
  });
}

export async function captureMoment(video: HTMLVideoElement) {
  if (!video.videoWidth || !video.videoHeight || video.readyState < 2) throw new Error('Kamera belum siap.');
  const scale = Math.min(1, MOMENT_MAX_EDGE / Math.max(video.videoWidth, video.videoHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
  canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Capture tidak didukung.');
  // Exactly one video frame; full native aspect ratio, no crop, no mirror.
  // The CSS-mirrored front preview never affects this source draw.
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  const preview = document.createElement('canvas');
  const previewSize = momentPreviewSize(canvas.width, canvas.height);
  preview.width = previewSize.width;
  preview.height = previewSize.height;
  const small = preview.getContext('2d');
  if (!small) throw new Error('Preview tidak didukung.');
  small.drawImage(canvas, 0, 0, preview.width, preview.height);
  try {
    const [image, tiny] = await Promise.all([jpegBlob(canvas, 0.88), jpegBlob(preview, 0.6)]);
    return { image, preview: tiny };
  } finally { canvas.width = 0; preview.width = 0; }
}
