import { getInfoAsync } from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';

/** 1000 KB — mismo umbral que el respaldo en la nube. */
export const MAX_IMAGE_BYTES = 1000 * 1024;

async function fileSize(uri: string): Promise<number | null> {
  const info = await getInfoAsync(uri);
  if (!info.exists || !('size' in info) || info.size == null) return null;
  return info.size;
}

export async function compressImageIfNeeded(
  sourceUri: string
): Promise<{ uri: string; compressed: boolean }> {
  const size = await fileSize(sourceUri);
  if (size == null || size <= MAX_IMAGE_BYTES) {
    return { uri: sourceUri, compressed: false };
  }

  const steps: Array<{ width?: number; quality: number }> = [
    { quality: 0.85 },
    { quality: 0.7 },
    { quality: 0.55, width: 1920 },
    { quality: 0.5, width: 1600 },
    { quality: 0.45, width: 1280 },
    { quality: 0.4, width: 1024 },
    { quality: 0.35, width: 800 },
    { quality: 0.3, width: 640 },
  ];

  let uri = sourceUri;
  for (const step of steps) {
    const actions: ImageManipulator.Action[] = step.width ? [{ resize: { width: step.width } }] : [];
    const result = await ImageManipulator.manipulateAsync(sourceUri, actions, {
      compress: step.quality,
      format: ImageManipulator.SaveFormat.JPEG,
    });
    uri = result.uri;
    const newSize = await fileSize(uri);
    if (newSize != null && newSize <= MAX_IMAGE_BYTES) {
      return { uri, compressed: true };
    }
  }

  return { uri, compressed: uri !== sourceUri };
}
