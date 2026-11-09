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

const top = computed(() => {
  const { s, vw, vh } = scaleSvg(props.container.length, props.container.width)
  const rects = props.placements
    .map(
      (p) =>
        `<rect x="${p.x * s}" y="${p.y * s}" width="${p.l * s}" height="${p.w * s}" fill="${p.color}" fill-opacity="0.45" stroke="${p.color}" stroke-width="1"/><text x="${p.x * s + 3}" y="${p.y * s + 12}" font-size="10" fill="#123654" font-family="Arial,sans-serif">${escapeXml(p.name)}</text>`,
    )
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${vw}" height="${vh}" viewBox="0 0 ${vw} ${vh}"><rect x="0" y="0" width="${vw}" height="${vh}" fill="#f8fafc" stroke="#64748b" stroke-width="2"/>${rects}</svg>`
})

const side = computed(() => {
  const { s, vw, vh } = scaleSvg(props.container.length, props.container.height)
  const rects = props.placements
    .map(
      (p) =>
        `<rect x="${p.x * s}" y="${(props.container.height - p.z - p.h) * s}" width="${p.l * s}" height="${p.h * s}" fill="${p.color}" fill-opacity="0.45" stroke="${p.color}" stroke-width="1"/>`,
    )
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${vw}" height="${vh}" viewBox="0 0 ${vw} ${vh}"><rect x="0" y="0" width="${vw}" height="${vh}" fill="#f8fafc" stroke="#64748b" stroke-width="2"/>${rects}</svg>`
})

function escapeXml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

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
</style>
