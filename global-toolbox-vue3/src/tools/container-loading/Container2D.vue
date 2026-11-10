<script setup lang="ts">
import { computed } from 'vue'
import type { ContainerConfig, Placement } from './packing'

const props = defineProps<{
  container: ContainerConfig
  placements: Placement[]
  t: (key: string) => string
}>()

const maxView = 520

function scaleSvg(w: number, h: number) {
  const s = Math.min(maxView / Math.max(w, 1), maxView / Math.max(h, 1))
  return { s, vw: w * s, vh: h * s }
}

function escapeXml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** Prefer "SKU-A" from "SKU-A / Gift box". */
function shortName(name: string): string {
  const base = (name.split('/')[0] || name).trim()
  return base || name
}

/** Tiny boxes: "SKU-A" → "A". */
function compactCode(name: string): string {
  const short = shortName(name)
  const m = short.match(/SKU[-_\s]?([A-Za-z0-9]+)/i)
  if (m) return m[1].toUpperCase()
  return short.slice(0, 2).toUpperCase()
}

function clipSafeId(unitId: string, i: number): string {
  return `clip-${i}-${unitId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24) || 'box'}`
}

function fitLabel(name: string, boxW: number, boxH: number): { text: string; font: number } | null {
  if (boxW < 12 || boxH < 10) return null
  const font = Math.max(7, Math.min(10, Math.floor(Math.min(boxW / 4.2, boxH * 0.5))))
  const maxChars = Math.max(1, Math.floor((boxW - 3) / (font * 0.62)))
  const full = shortName(name)
  if (full.length <= maxChars) return { text: full, font }
  const code = compactCode(name)
  if (code.length <= maxChars) return { text: code, font }
  return null
}

function topBoxMarkup(p: Placement, s: number, i: number): string {
  const x = p.x * s
  const y = p.y * s
  const w = p.l * s
  const h = p.w * s
  const clipId = clipSafeId(p.unitId, i)
  const label = fitLabel(p.name, w, h)
  const title = `<title>${escapeXml(p.name)} · ${Math.round(p.l)}×${Math.round(p.w)}×${Math.round(p.h)} mm</title>`
  const text =
    label == null
      ? ''
      : `<text x="${x + 2}" y="${y + Math.min(h - 2, label.font + 2)}" font-size="${label.font}" fill="#0f2942" font-family="Arial,sans-serif" clip-path="url(#${clipId})">${escapeXml(label.text)}</text>`
  return `<g>${title}<clipPath id="${clipId}"><rect x="${x}" y="${y}" width="${w}" height="${h}"/></clipPath><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${p.color}" fill-opacity="0.45" stroke="${p.color}" stroke-width="1"/>${text}</g>`
}

const legend = computed(() => {
  const map = new Map<string, { name: string; color: string; count: number }>()
  for (const p of props.placements) {
    const key = p.skuId || p.name
    const prev = map.get(key)
    if (prev) prev.count += 1
    else map.set(key, { name: shortName(p.name), color: p.color, count: 1 })
  }
  return [...map.values()]
})

const top = computed(() => {
  const { s, vw, vh } = scaleSvg(props.container.length, props.container.width)
  const rects = props.placements.map((p, i) => topBoxMarkup(p, s, i)).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${vw}" height="${vh}" viewBox="0 0 ${vw} ${vh}"><rect x="0" y="0" width="${vw}" height="${vh}" fill="#f8fafc" stroke="#64748b" stroke-width="2"/>${rects}</svg>`
})

const side = computed(() => {
  const { s, vw, vh } = scaleSvg(props.container.length, props.container.height)
  const rects = props.placements
    .map((p, i) => {
      const x = p.x * s
      const y = (props.container.height - p.z - p.h) * s
      const w = p.l * s
      const h = p.h * s
      const clipId = clipSafeId(`side-${p.unitId}`, i)
      const label = fitLabel(shortName(p.name), w, h)
      const text =
        label == null
          ? ''
          : `<text x="${x + 2}" y="${y + Math.min(h - 2, label.font + 2)}" font-size="${label.font}" fill="#0f2942" font-family="Arial,sans-serif" clip-path="url(#${clipId})">${escapeXml(label.text)}</text>`
      return `<g><title>${escapeXml(p.name)}</title><clipPath id="${clipId}"><rect x="${x}" y="${y}" width="${w}" height="${h}"/></clipPath><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${p.color}" fill-opacity="0.45" stroke="${p.color}" stroke-width="1"/>${text}</g>`
    })
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${vw}" height="${vh}" viewBox="0 0 ${vw} ${vh}"><rect x="0" y="0" width="${vw}" height="${vh}" fill="#f8fafc" stroke="#64748b" stroke-width="2"/>${rects}</svg>`
})

defineExpose({
  getTopSvg: () => top.value,
  getSideSvg: () => side.value,
})
</script>

<template>
  <div class="container-2d">
    <div>
      <strong>{{ t('containerTopView') }}</strong>
      <div class="view-box" v-html="top" />
      <ul v-if="legend.length" class="sku-legend">
        <li v-for="item in legend" :key="item.name + item.color">
          <span class="swatch" :style="{ background: item.color }" />
          <span>{{ item.name }} ×{{ item.count }}</span>
        </li>
      </ul>
    </div>
    <div>
      <strong>{{ t('containerSideView') }}</strong>
      <div class="view-box" v-html="side" />
    </div>
  </div>
</template>

<style scoped>
.container-2d {
  display: grid;
  gap: 14px;
}
.container-2d strong {
  display: block;
  margin-bottom: 8px;
  color: #0d526d;
  font-size: 13px;
}
.view-box {
  overflow: auto;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 10px;
  line-height: 0;
}
.view-box :deep(svg) {
  max-width: 100%;
  height: auto;
  display: block;
}
.sku-legend {
  list-style: none;
  margin: 10px 0 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
}
.sku-legend li {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #475569;
}
.sku-legend .swatch {
  width: 12px;
  height: 12px;
  border-radius: 3px;
  border: 1px solid #cbd5e1;
  flex: 0 0 auto;
}
</style>
