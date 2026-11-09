<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import type { Locale } from '../i18n'
import { GUIDE_BY_ID, type GuideId } from '../seo/guides'

const props = defineProps<{
  t: (key: string) => string
  locale: Locale
  guideId: GuideId
}>()

const router = useRouter()
const guide = computed(() => GUIDE_BY_ID[props.guideId])

const openRelated = () => {
  const slug = guide.value.relatedToolSlug
  if (!slug) return
  void router.push(`/${props.locale}/tools/${slug}/`)
}
</script>

<template>
  <div class="page-heading">
    <button class="back" type="button" @click="router.push(`/${locale}/`)">← {{ t('all') }}</button>
    <div class="eyebrow dark">{{ t('guidesEyebrow') }}</div>
    <h1>{{ guide.title[locale] }}</h1>
    <p>{{ guide.summary[locale] }}</p>
  </div>
  <div class="panel">
    <ol class="guide-steps">
      <li v-for="(step, i) in guide.steps[locale]" :key="i">{{ step }}</li>
    </ol>
    <p v-if="guide.samplePath" class="field-hint">
      {{ t('guideSample') }}:
      <a :href="guide.samplePath" target="_blank" rel="noopener">{{ guide.samplePath }}</a>
    </p>
    <p class="field-hint">{{ guide.limits[locale] }}</p>
    <div class="btn-row" style="margin-top: 12px; gap: 8px; flex-wrap: wrap">
      <button v-if="guide.relatedToolSlug" class="btn-primary" type="button" @click="openRelated">
        {{ t('guideOpenTool') }} ↗
      </button>
      <button class="btn-secondary" type="button" @click="router.push(`/${locale}/`)">{{ t('overview') }}</button>
    </div>
  </div>
</template>

<style scoped>
.guide-steps {
  margin: 0 0 12px;
  padding-left: 1.25rem;
  line-height: 1.7;
}
</style>
