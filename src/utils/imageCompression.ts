import { Image } from 'react-native';
import { manipulateAsync, SaveFormat, type Action } from 'expo-image-manipulator';
import { File } from 'expo-file-system';

const MAX_DIMENSION = 1600;
const MAX_BYTES = 2 * 1024 * 1024; // 2MB
const QUALITY_STEPS = [0.8, 0.6, 0.4];

export interface CompressedImage {
  uri: string;
  name: string;
  type: string;
}

function getFileSize(uri: string): number {
  try {
    return new File(uri).size;
  } catch {
    return 0;
  }
}

function getImageSize(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      () => resolve({ width: 0, height: 0 }),
    );
  });
}

/**
 * Resizes and re-encodes a picked/captured photo as JPEG before it's uploaded —
 * caps the longest side at MAX_DIMENSION (handles both orientations) and forces
 * JPEG output so iPhone HEIC photos never reach the backend. If the resize pass
 * alone doesn't get under MAX_BYTES, quality is stepped down a couple more times.
 */
export async function compressImageForUpload(uri: string): Promise<CompressedImage> {
  const { width, height } = await getImageSize(uri);
  const longestSide = Math.max(width, height);
  const actions: Action[] =
    longestSide > MAX_DIMENSION
      ? [width >= height ? { resize: { width: MAX_DIMENSION } } : { resize: { height: MAX_DIMENSION } }]
      : [];

  let result = await manipulateAsync(uri, actions, { compress: QUALITY_STEPS[0], format: SaveFormat.JPEG });

  for (let i = 1; i < QUALITY_STEPS.length && getFileSize(result.uri) > MAX_BYTES; i++) {
    result = await manipulateAsync(result.uri, [], { compress: QUALITY_STEPS[i], format: SaveFormat.JPEG });
  }

  return {
    uri: result.uri,
    name: `photo_${Date.now()}.jpg`,
    type: 'image/jpeg',
  };
}
