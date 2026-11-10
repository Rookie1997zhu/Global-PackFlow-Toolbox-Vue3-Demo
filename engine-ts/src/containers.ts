/** Container presets: internal dimensions in mm, payload in kg. */
export type ContainerPreset = {
  id: string
  labelKey: string
  length: number
  width: number
  height: number
  maxPayload: number
}

export const CONTAINER_PRESETS: ContainerPreset[] = [
  { id: '20GP', labelKey: 'container20GP', length: 5890, width: 2350, height: 2390, maxPayload: 28000 },
  { id: '40GP', labelKey: 'container40GP', length: 12030, width: 2350, height: 2390, maxPayload: 26500 },
  { id: '40HQ', labelKey: 'container40HQ', length: 12030, width: 2350, height: 2690, maxPayload: 26500 },
  { id: 'custom', labelKey: 'containerCustom', length: 12000, width: 2350, height: 2690, maxPayload: 26000 },
]

export function getPreset(id: string): ContainerPreset {
  return CONTAINER_PRESETS.find((p) => p.id === id) || CONTAINER_PRESETS[2]
}
