/**
 * Макс. число изображений-референсов для Kie-фото (как server/src/services/kiePhotoCatalog.js → maxRefs).
 */
export const KIE_PHOTO_MAX_IMAGE_INPUTS: Record<string, number> = {
  'kie-gpt-image-2': 8,
  'kie-wan-27': 8,
  'kie-wan-27-pro': 8,
  'kie-seedream-45': 8,
  'kie-qwen2-image': 8,
  'kie-nano-banana-2': 14,
  'kie-nano-banana-pro': 8,
  'kie-seedream-50-lite': 8,
  'kie-flux-2-pro': 8,
}

export function kiePhotoMaxImageInputs(modelId: string): number | null {
  const n = KIE_PHOTO_MAX_IMAGE_INPUTS[modelId]
  return typeof n === 'number' ? n : null
}
