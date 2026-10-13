import imageCompression from 'browser-image-compression'

/** Shrinks a phone photo to about 250 KB WebP, max 1600 px on the long side. */
export async function compressPhoto(file: File): Promise<File> {
  const out = await imageCompression(file, {
    maxSizeMB: 0.25,
    maxWidthOrHeight: 1600,
    useWebWorker: true,
    fileType: 'image/webp',
    initialQuality: 0.8,
  })
  return new File([out], file.name.replace(/\.[^.]+$/, '') + '.webp', { type: 'image/webp' })
}
