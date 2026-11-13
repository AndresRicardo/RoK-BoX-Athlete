// Fotos del celular pueden pesar varios MB: se reducen antes de subirlas.

const MAX_SIDE = 1800;

/**
 * Devuelve la imagen reducida a JPEG (lado mayor ≤ 1800 px) si pesa más de `limit` bytes,
 * o convertida a JPEG si su formato no está en `allowedTypes` (GIF, AVIF, BMP... que la
 * galería puede entregar). Los PDF y las imágenes livianas permitidas se devuelven igual.
 * Si el navegador no puede leerla (p. ej. HEIC en Chrome), también se devuelve igual.
 */
export async function shrinkImage(file, limit = 1.5 * 1024 * 1024, allowedTypes = null) {
  if (!file) return file;
  const mustConvert = Boolean(allowedTypes) && !allowedTypes.includes(file.type)
    && (file.type.startsWith('image/') || file.type === '');
  if (!mustConvert && (!file.type?.startsWith('image/') || file.size <= limit)) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    if (!blob || (!mustConvert && blob.size >= file.size)) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  }
}
