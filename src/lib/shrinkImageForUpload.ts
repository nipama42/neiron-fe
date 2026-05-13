/**
 * Сжимает фото перед загрузкой как data URL (меньше JSON → реже ломается nginx/прокси).
 */
export async function shrinkImageFileToJpegDataUrl(
  file: File,
  opts?: { maxSide?: number; quality?: number }
): Promise<string> {
  const maxSide = opts?.maxSide ?? 1280
  const quality = opts?.quality ?? 0.86

  if (typeof createImageBitmap !== 'function') {
    return await fileToDataUrl(file)
  }

  let bmp: ImageBitmap
  try {
    bmp = await createImageBitmap(file)
  } catch {
    return await fileToDataUrl(file)
  }

  const w = bmp.width
  const h = bmp.height
  const scale = Math.min(1, maxSide / Math.max(w, h, 1))
  const tw = Math.max(1, Math.round(w * scale))
  const th = Math.max(1, Math.round(h * scale))
  const canvas = document.createElement('canvas')
  canvas.width = tw
  canvas.height = th
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    try { bmp.close() } catch { /* noop */ }
    return await fileToDataUrl(file)
  }
  ctx.drawImage(bmp, 0, 0, tw, th)
  const dataUrl = canvas.toDataURL('image/jpeg', quality)
  try { bmp.close() } catch { /* noop */ }
  if (!dataUrl.startsWith('data:image/jpeg')) {
    return await fileToDataUrl(file)
  }
  return dataUrl
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result ?? ''))
    r.onerror = () => reject(new Error('Не удалось прочитать файл'))
    r.readAsDataURL(file)
  })
}
