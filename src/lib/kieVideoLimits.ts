/**
 * Лимиты референс-изображений для Kie-видео моделей.
 * Должны совпадать с server/src/services/kieVideoCatalog.js (maxRefs).
 */
export const KIE_VIDEO_MAX_IMAGE_INPUTS: Record<string, number> = {
  'kie-kling-21-std': 1,
  'kie-kling-21-pro': 1,
  'kie-kling-30': 1,
  'kie-grok-imagine-extend': 1,
  'kie-wan-27-video': 1,
  'kie-openai-sora-2': 1,
  'kie-kling-26': 1,
  'kie-wan-26-video': 1,
  'kie-google-veo-31': 1,
  'kie-kling-25-turbo': 1,
}

export function kieVideoMaxImageInputs(modelId: string): number | null {
  const n = KIE_VIDEO_MAX_IMAGE_INPUTS[modelId]
  return typeof n === 'number' ? n : null
}
