import {
  DESIGN_QR_LOGO_MAX_ALT_CHARACTERS,
  DESIGN_QR_LOGO_MAX_SOURCE_CHARACTERS,
  DESIGN_QR_LOGO_SIZE_DEFAULT,
  type DesignQRLogoOptions,
} from 'designqr/config';

const EDITOR_LOGO_MAX_INPUT_BYTES = 100 * 1024 * 1024;
const EDITOR_LOGO_MAX_OUTPUT_BYTES = 1024 * 1024;
const EDITOR_LOGO_MAX_EDGE = 96;
const EDITOR_LOGO_WORKING_MAX_EDGE = 2048;
export const EDITOR_LOGO_CROP_MIN_SOURCE_EDGE = EDITOR_LOGO_MAX_EDGE;
export const EDITOR_LOGO_CROP_ZOOM_MIN = 1;
export const EDITOR_LOGO_CROP_ZOOM_MAX = 3;
const RASTER_MEDIA_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
]);
const CANONICAL_RASTER_MEDIA_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
]);

export interface EditorLogoSource {
  file: File;
  source: CanvasImageSource;
  width: number;
  height: number;
  close(): void;
}

export interface EditorLogoCrop {
  centerX: number;
  centerY: number;
  zoom: number;
}

export interface EditorLogoCropBounds extends EditorLogoCrop {
  sourceX: number;
  sourceY: number;
  sourceSize: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function boundedWorkingDimensions(
  width: number,
  height: number
): { width: number; height: number } {
  const scale = Math.min(
    1,
    EDITOR_LOGO_WORKING_MAX_EDGE / Math.max(width, height)
  );
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function closeOnce(dispose: () => void): () => void {
  let closed = false;
  return () => {
    if (closed) return;
    closed = true;
    dispose();
  };
}

export function resolveEditorLogoCropBounds(
  width: number,
  height: number,
  crop: EditorLogoCrop
): EditorLogoCropBounds {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const zoom = clamp(
    Number.isFinite(crop.zoom) ? crop.zoom : EDITOR_LOGO_CROP_ZOOM_MIN,
    EDITOR_LOGO_CROP_ZOOM_MIN,
    EDITOR_LOGO_CROP_ZOOM_MAX
  );
  const sourceSize = Math.min(safeWidth, safeHeight) / zoom;
  const horizontalInset = sourceSize / (safeWidth * 2);
  const verticalInset = sourceSize / (safeHeight * 2);
  const centerX = clamp(
    Number.isFinite(crop.centerX) ? crop.centerX : 0.5,
    horizontalInset,
    1 - horizontalInset
  );
  const centerY = clamp(
    Number.isFinite(crop.centerY) ? crop.centerY : 0.5,
    verticalInset,
    1 - verticalInset
  );

  return {
    centerX,
    centerY,
    zoom,
    sourceX: centerX * safeWidth - sourceSize / 2,
    sourceY: centerY * safeHeight - sourceSize / 2,
    sourceSize,
  };
}

function logoAltFromFilename(filename: string): string {
  const withoutExtension = filename.replace(/\.[^.]+$/, '');
  const readable = withoutExtension.replace(/[-_]+/g, ' ').trim();
  return Array.from(readable || 'Logo')
    .slice(0, DESIGN_QR_LOGO_MAX_ALT_CHARACTERS)
    .join('');
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('The logo file could not be read.'));
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('The logo file could not be converted.'));
    };
    reader.readAsDataURL(blob);
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

export async function loadEditorLogoSource(file: File): Promise<EditorLogoSource> {
  validateEditorLogoFile(file);

  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const workingSize = boundedWorkingDimensions(bitmap.width, bitmap.height);
    if (workingSize.width !== bitmap.width || workingSize.height !== bitmap.height) {
      try {
        const resized = await createImageBitmap(bitmap, {
          resizeWidth: workingSize.width,
          resizeHeight: workingSize.height,
          resizeQuality: 'high',
        });
        bitmap.close();
        return {
          file,
          source: resized,
          width: resized.width,
          height: resized.height,
          close: closeOnce(() => resized.close()),
        };
      } catch (cause) {
        bitmap.close();
        throw cause;
      }
    }
    return {
      file,
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      close: closeOnce(() => bitmap.close()),
    };
  }

  const objectUrl = URL.createObjectURL(file);
  const image = new Image();
  image.decoding = 'async';
  image.src = objectUrl;
  try {
    await image.decode();
  } catch (cause) {
    URL.revokeObjectURL(objectUrl);
    throw cause;
  }
  const workingSize = boundedWorkingDimensions(image.naturalWidth, image.naturalHeight);
  if (
    workingSize.width !== image.naturalWidth
    || workingSize.height !== image.naturalHeight
  ) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) {
      URL.revokeObjectURL(objectUrl);
      throw new Error('This browser cannot prepare logo artwork.');
    }
    canvas.width = workingSize.width;
    canvas.height = workingSize.height;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(objectUrl);
    return {
      file,
      source: canvas,
      width: canvas.width,
      height: canvas.height,
      close: closeOnce(() => {
        canvas.width = 1;
        canvas.height = 1;
      }),
    };
  }
  return {
    file,
    source: image,
    width: image.naturalWidth,
    height: image.naturalHeight,
    close: closeOnce(() => URL.revokeObjectURL(objectUrl)),
  };
}

/** Converts an editor upload into a sub-1 MiB, share-link-safe raster logo. */
export function validateEditorLogoFile(file: File): void {
  if (!RASTER_MEDIA_TYPES.has(file.type.toLowerCase())) {
    throw new Error('Choose a PNG, JPEG, or WebP logo.');
  }
  if (file.size === 0) {
    throw new Error('Choose a logo that is not empty.');
  }
  if (file.size > EDITOR_LOGO_MAX_INPUT_BYTES) {
    throw new Error('Choose a logo up to 100 MB.');
  }
}

/** Converts an editor upload, and optional square crop, into a bounded raster logo. */
export async function prepareEditorLogo(
  file: File,
  crop?: EditorLogoCrop
): Promise<Required<DesignQRLogoOptions>> {
  const decoded = await loadEditorLogoSource(file);
  try {
    return await prepareEditorLogoSource(decoded, crop);
  } finally {
    decoded.close();
  }
}

/** Prepares a previously decoded editor source without decoding it a second time. */
export async function prepareEditorLogoSource(
  decoded: EditorLogoSource,
  crop?: EditorLogoCrop
): Promise<Required<DesignQRLogoOptions>> {
  const { file } = decoded;
  validateEditorLogoFile(file);
  if (decoded.width <= 0 || decoded.height <= 0) {
    throw new Error('The selected logo has invalid dimensions.');
  }

  if (
    !crop
    && Math.max(decoded.width, decoded.height) <= EDITOR_LOGO_MAX_EDGE
    && file.size < EDITOR_LOGO_MAX_OUTPUT_BYTES
    && CANONICAL_RASTER_MEDIA_TYPES.has(file.type.toLowerCase())
    && file.size * 1.38 + 64 <= DESIGN_QR_LOGO_MAX_SOURCE_CHARACTERS
  ) {
    const originalSource = await blobToDataUrl(file);
    if (originalSource.length <= DESIGN_QR_LOGO_MAX_SOURCE_CHARACTERS) {
      return {
        src: originalSource,
        alt: logoAltFromFilename(file.name),
        size: DESIGN_QR_LOGO_SIZE_DEFAULT,
      };
    }
  }

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) throw new Error('This browser cannot prepare logo artwork.');
  const cropBounds = crop
    ? resolveEditorLogoCropBounds(decoded.width, decoded.height, crop)
    : null;
  const sourceWidth = cropBounds?.sourceSize ?? decoded.width;
  const sourceHeight = cropBounds?.sourceSize ?? decoded.height;
  const originalMaxEdge = Math.max(sourceWidth, sourceHeight);
  const edgeCandidates = [96, 80, 64, 48, 40, 32]
    .filter((edge) => edge <= originalMaxEdge);
  if (edgeCandidates.length === 0) edgeCandidates.push(originalMaxEdge);

  for (const edge of edgeCandidates) {
    const scale = Math.min(1, edge / originalMaxEdge);
    canvas.width = Math.max(1, Math.round(sourceWidth * scale));
    canvas.height = Math.max(1, Math.round(sourceHeight * scale));
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (cropBounds) {
      context.drawImage(
        decoded.source,
        cropBounds.sourceX,
        cropBounds.sourceY,
        cropBounds.sourceSize,
        cropBounds.sourceSize,
        0,
        0,
        canvas.width,
        canvas.height
      );
    } else {
      context.drawImage(decoded.source, 0, 0, canvas.width, canvas.height);
    }

    for (const quality of [0.82, 0.68, 0.54, 0.4]) {
      const output = await canvasToBlob(canvas, 'image/webp', quality);
      if (
        !output
        || output.size >= EDITOR_LOGO_MAX_OUTPUT_BYTES
        || !CANONICAL_RASTER_MEDIA_TYPES.has(output.type.toLowerCase())
      ) continue;
      const source = await blobToDataUrl(output);
      if (source.length <= DESIGN_QR_LOGO_MAX_SOURCE_CHARACTERS) {
        return {
          src: source,
          alt: logoAltFromFilename(file.name),
          size: DESIGN_QR_LOGO_SIZE_DEFAULT,
        };
      }
    }
  }

  throw new Error('This logo is too detailed for an editable share link.');
}
