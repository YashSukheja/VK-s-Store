import imageCompression from 'browser-image-compression'

/** Shrinks a phone photo to about 400 KB WebP, max 1600 px on the long side. */
export async function compressPhoto(file: File): Promise<File> {
  const out = await imageCompression(file, {
    maxSizeMB: 0.4,
    maxWidthOrHeight: 1600,
    useWebWorker: true,
    fileType: 'image/webp',
    initialQuality: 0.85,
  })
  return new File([out], file.name.replace(/\.[^.]+$/, '') + '.webp', { type: 'image/webp' })
}

/** A small copy (max 720 px, about 100 KB, sharp on phone screens) for the shop grid, cart and lists. */
export async function makeThumbnail(image: Blob): Promise<File> {
  const file = image instanceof File ? image : new File([image], 'photo.webp', { type: image.type || 'image/webp' })
  const out = await imageCompression(file, {
    maxSizeMB: 0.12,
    maxWidthOrHeight: 720,
    useWebWorker: true,
    fileType: 'image/webp',
    initialQuality: 0.85,
  })
  return new File([out], 'thumb.webp', { type: 'image/webp' })
}

/** Where a photo's small copy lives: next to it, as <name>.thumb.webp. */
export function thumbPath(path: string): string {
  return path.replace(/\.webp$/, '') + '.thumb.webp'
}
