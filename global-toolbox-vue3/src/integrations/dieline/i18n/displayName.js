import {CATALOG_KO,koPresetLabel} from './catalogKo.js'
import {i18n} from './index.js'

function isKo(){
  return String(i18n.global.locale.value||i18n.global.locale)==='ko-KR'
}

export function displaySubclassLabel(id,fallback=''){
  if(isKo()&&id&&CATALOG_KO.subclasses[id])return CATALOG_KO.subclasses[id]
  return fallback||id||''
}

export function displayOwnedGroupLabel(id,fallback=''){
  if(isKo()&&id&&CATALOG_KO.ownedGroups[id])return CATALOG_KO.ownedGroups[id]
  return fallback||id||''
}

export function displayTemplateLabel(templateId,fallback=''){
  if(isKo()&&templateId&&CATALOG_KO.templates[templateId])return CATALOG_KO.templates[templateId]
  return fallback||templateId||''
}

export function displayPresetLabel(preset){
  if(!preset)return ''
  if(isKo()){
    const ko=koPresetLabel(preset)
    if(ko)return ko
  }
  return preset.label||String(preset.sourceNum||preset.id||'')
}

export function displayPieceLabel(pieceId,fallback=''){
  if(isKo()&&pieceId&&CATALOG_KO.pieces[pieceId])return CATALOG_KO.pieces[pieceId]
  return fallback||pieceId||''
}

export function displayCategoryLabel(id,fallback=''){
  if(isKo()&&id&&CATALOG_KO.categories[id])return CATALOG_KO.categories[id]
  return fallback||id||''
}

/** structureKind.id → 当前语言文案 */
export function displayStructureKindLabel(kindId,fallback=''){
  const key=`kind.${kindId}`
  const t=i18n.global.t
  const translated=t(key)
  if(translated&&translated!==key)return translated
  return fallback||kindId||''
}

/** 列表搜索：中文原字段 + 韩文别名 + 编号 */
export function matchesCatalogQuery(textParts,query){
  const q=String(query||'').trim().toLowerCase()
  if(!q)return true
  return textParts.some(s=>String(s||'').toLowerCase().includes(q))
}
