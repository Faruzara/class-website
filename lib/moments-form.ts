import 'server-only';
import { MOMENT_MAX_BYTES, MOMENT_PREVIEW_MAX_BYTES } from './moments';
import { MomentError } from './moments-server';

// Bound chunked/multipart bodies too, not just the optional Content-Length.
export async function readMomentForm(request: Request) {
  const limit = MOMENT_MAX_BYTES + MOMENT_PREVIEW_MAX_BYTES + 16384;
  if (Number(request.headers.get('content-length')) > limit) throw new MomentError('Foto terlalu besar.', 413);
  if (!request.headers.get('content-type')?.startsWith('multipart/form-data') || !request.body) throw new MomentError('Format upload tidak valid.', 400);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; void reader.cancel().catch(() => undefined); }, 20000);
  try {
    for (;;) {
      const chunk = await reader.read();
      if (timedOut) throw new MomentError('Upload terlalu lama. Coba lagi.', 408);
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > limit) { void reader.cancel().catch(() => undefined); throw new MomentError('Foto terlalu besar.', 413); }
      chunks.push(chunk.value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return await new Response(bytes, { headers: { 'Content-Type': request.headers.get('content-type')! } }).formData();
  } catch (error) {
    if (error instanceof MomentError) throw error;
    throw new MomentError('Data foto tidak valid.', 400);
  } finally { clearTimeout(timer); reader.releaseLock(); }
}
