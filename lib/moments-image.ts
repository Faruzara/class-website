import { MOMENT_MAX_BYTES, MOMENT_MAX_EDGE, MOMENT_PREVIEW_EDGE, MOMENT_PREVIEW_MAX_BYTES, momentOrientation, momentPreviewSize } from './moments';

// Read bounded JPEG SOF headers, not client-supplied dimensions/MIME alone.
// Camera canvas emits baseline JPEG; no heavy image decoder/dependency is needed.
export function jpegDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[bytes.length - 2] !== 0xff || bytes[bytes.length - 1] !== 0xd9) return null;
  for (let offset = 2; offset + 4 < bytes.length;) {
    if (bytes[offset++] !== 0xff) return null;
    while (bytes[offset] === 0xff) offset++;
    const marker = bytes[offset++];
    if (marker === 0xda || marker === 0xd9) return null;
    const length = (bytes[offset] << 8) | bytes[offset + 1];
    if (length < 2 || offset + length > bytes.length) return null;
    if (marker === 0xc0 || marker === 0xc2) {
      if (length < 8 || bytes[offset + 2] !== 8) return null;
      const height = (bytes[offset + 3] << 8) | bytes[offset + 4];
      const width = (bytes[offset + 5] << 8) | bytes[offset + 6];
      return width > 0 && height > 0 ? { width, height } : null;
    }
    offset += length;
  }
  return null;
}

export async function validateMomentImages(original: FormDataEntryValue | null, preview: FormDataEntryValue | null) {
  if (!(original instanceof Blob) || !(preview instanceof Blob) || original.type !== 'image/jpeg' || preview.type !== 'image/jpeg' || original.size > MOMENT_MAX_BYTES || preview.size > MOMENT_PREVIEW_MAX_BYTES) {
    throw new Error('Foto kamera harus JPEG, maksimal 5 MB, dengan preview kecil.');
  }
  const [imageBytes, previewBytes] = await Promise.all([original.arrayBuffer(), preview.arrayBuffer()]);
  const size = jpegDimensions(new Uint8Array(imageBytes));
  const small = jpegDimensions(new Uint8Array(previewBytes));
  if (!size || !small || Math.max(size.width, size.height) > MOMENT_MAX_EDGE || Math.max(small.width, small.height) > MOMENT_PREVIEW_EDGE) throw new Error('Dimensi foto atau preview tidak valid.');
  const expected = momentPreviewSize(size.width, size.height);
  // Keep an already-open older camera tab compatible during deployment.
  const legacyScale = 16 / Math.max(size.width, size.height);
  const legacy = small.width === Math.max(1, Math.round(size.width * legacyScale)) && small.height === Math.max(1, Math.round(size.height * legacyScale));
  if (!legacy && (small.width !== expected.width || small.height !== expected.height)) throw new Error('Preview tidak sesuai dimensi foto.');
  return { imageBytes, previewBytes, ...size, orientation: momentOrientation(size.width, size.height) };
}
