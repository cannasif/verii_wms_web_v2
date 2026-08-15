export type RelativeCrop = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export const FULL_CROP: RelativeCrop = { x: 0, y: 0, width: 1, height: 1 };
export const MIN_CROP_RATIO = 0.12;

export function clampCrop(crop: RelativeCrop): RelativeCrop {
  const width = Math.min(1, Math.max(MIN_CROP_RATIO, crop.width));
  const height = Math.min(1, Math.max(MIN_CROP_RATIO, crop.height));
  return {
    x: Math.min(1 - width, Math.max(0, crop.x)),
    y: Math.min(1 - height, Math.max(0, crop.y)),
    width,
    height,
  };
}

export function isNearlyFullCrop(crop: RelativeCrop): boolean {
  return crop.x <= 0.004
    && crop.y <= 0.004
    && crop.width >= 0.992
    && crop.height >= 0.992;
}

function extensionForType(type: string): string {
  if (type === "image/png") return ".png";
  if (type === "image/webp") return ".webp";
  return ".jpg";
}

export async function cropStockImageFile(file: File, crop: RelativeCrop): Promise<File> {
  if (isNearlyFullCrop(crop)) return file;

  const bitmap = await createImageBitmap(file);
  try {
    const sx = Math.max(0, Math.round(crop.x * bitmap.width));
    const sy = Math.max(0, Math.round(crop.y * bitmap.height));
    const width = Math.max(1, Math.min(bitmap.width - sx, Math.round(crop.width * bitmap.width)));
    const height = Math.max(1, Math.min(bitmap.height - sy, Math.round(crop.height * bitmap.height)));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas desteklenmiyor.");
    context.drawImage(bitmap, sx, sy, width, height, 0, 0, width, height);
    const type = file.type === "image/png" || file.type === "image/webp" ? file.type : "image/jpeg";
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (value) => {
          if (value) resolve(value);
          else reject(new Error("Görsel kırpılamadı."));
        },
        type,
        type === "image/jpeg" ? 0.92 : undefined,
      );
    });
    const baseName = file.name.replace(/\.[^.]+$/, "");
    return new File([blob], `${baseName}${extensionForType(type)}`, {
      type,
      lastModified: Date.now(),
    });
  } finally {
    bitmap.close();
  }
}
