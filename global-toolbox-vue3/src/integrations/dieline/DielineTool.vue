<script setup>
import {ref,computed,watch,onMounted,onBeforeUnmount,nextTick,inject} from 'vue'
import {useI18n} from 'vue-i18n'
import './dieline.css'
import * as THREE from 'three'
import {OrbitControls} from 'three/addons/controls/OrbitControls.js'
import {Box,Download,RotateCcw,ZoomIn,ZoomOut,Eye,Layers3,Maximize2,ArrowLeft,Search} from 'lucide-vue-next'
import {createKnife,deriveSizes,resolveParams,BLEED_EXTRA_MM} from './knife.js'
import {neutralMeshOffset,foldRotation,estimateClosedCollisions} from './foldSim.js'
import {anglesAtProgress,stageIndexAt} from './foldStages.js'
import {buildGeomRig} from './geomRig.js'
import {toDxf,toPdf,toAi,toSvgDieline} from './exportDieline.js'
import {buildDimAnnotations} from './dimAnnotations.js'
import {DEFAULT_TEMPLATE_ID,getTemplate} from './templates/index.js'
import {PRESET_CATALOG,OFFICIAL_SUBCLASSES,UNCLASSIFIED_SUBCLASS_COUNT,getPreset,searchImportedPresets,ownedGroupsWithTemplates,countModelOnly,outboxCatalogOptions} from './catalog/index.js'
import {renderClosedThumb,structureKind} from './renderClosedThumb.js'
import {renderProxyThumb} from './renderProxyThumb.js'
import {renderGeomClosedThumb} from './renderGeomClosedThumb.js'
import {loadPacdoraGeomKnife,clearPacdoraGeomCache} from './pacdoraGeomKnife.js'
import {ensureBoardPack,createBoardMaterial} from './boardMaterial.js'
import {publicAssetUrl} from './assetUrl.js'
import {setLocale} from './i18n/index.js'
import {CATALOG_KO} from './i18n/catalogKo.js'
import {
  displaySubclassLabel,
  displayOwnedGroupLabel,
  displayTemplateLabel,
  displayPresetLabel,
  displayPieceLabel,
  displayStructureKindLabel
} from './i18n/displayName.js'
import {
  DEFAULT_OUTBOX_GAP,
  DEFAULT_OUTBOX_THICKNESS,
  OUTBOX_TEMPLATE_ID,
  buildOutboxKnife,
  canBuildOutbox,
  packingContentCells
} from './outbox.js'
import {createKnifeScene} from './lab/knifeScene.js'
clearPacdoraGeomCache()
function assetUrl(path){return publicAssetUrl(path)}

const {t,locale}=useI18n()
function switchLocale(code){setLocale(code)}
const hostLocale=inject('hostLocale',null)
const hostLocaleUnsupported=ref(false)
function mapHostLocale(code){
  if(code==='ko')return 'ko-KR'
  if(code==='zh')return 'zh-CN'
  return null
}
if(hostLocale){
  watch(hostLocale,(code)=>{
    const mapped=mapHostLocale(code)
    if(mapped){
      hostLocaleUnsupported.value=false
      setLocale(mapped)
    }else{
      // en (and unknown): do not force Chinese; keep user's last zh/ko choice.
      hostLocaleUnsupported.value=true
    }
  },{immediate:true})
}
function kindLabel(tpl){
  const k=structureKind(tpl)
  return displayStructureKindLabel(k.id,k.label)
}

const EMPTY_KNIFE=Object.freeze({
  faces:[],folds:[],cuts:[],bleeds:[],hinges:[],holes:[],
  cutPath:'',bleedPath:'',
  bounds:{minX:0,minY:0,maxX:100,maxY:100},
  dimensions:{
    length:0,width:0,height:0,thickness:1.5,
    inner:{length:0,width:0,height:0},
    outer:{length:0,width:0,height:0},
    panel:{length:0,width:0,height:0}
  },
  sizeArrowData:[],totalX:100,totalY:100,
  template:'loading',validation:{ok:false,checks:[]},productionReady:false,manufacturingReady:false
})

const screen=ref('gallery') // gallery = 盒子列表；lab = 当前编辑界面
const boxTab=ref('owned') // owned = 已有的刀版；imported = 导入的尺寸目录
const galleryQuery=ref('')
const thumbMap=ref({}) // templateId -> dataURL
const proxyThumbMap=ref({}) // preset.id -> dataURL
const geomThumbMap=ref({}) // preset.id -> 合盖 3D dataURL
const thumbsLoading=ref(false)
const templateId=ref(DEFAULT_TEMPLATE_ID)
const template=computed(()=>getTemplate(templateId.value))
const ownedGroups=ownedGroupsWithTemplates()
const importSubclassId=ref('') // '' = 全部；__none__ = 未归类；__modelOnly__ = 仅 3D 样机
const importQuery=ref('')
const importId=ref('')
const modelOnlyFilter=computed(()=>importSubclassId.value==='__modelOnly__')
const importedList=computed(()=>searchImportedPresets(importQuery.value,{
  subclassId:modelOnlyFilter.value?'':importSubclassId.value,
  modelOnly:modelOnlyFilter.value?'only':undefined,
  limit:120
}))
const importCategoryCount=computed(()=>{
  if(importSubclassId.value==='__modelOnly__')return countModelOnly()
  if(!importSubclassId.value)return PRESET_CATALOG.count
  if(importSubclassId.value==='__none__')return UNCLASSIFIED_SUBCLASS_COUNT
  return OFFICIAL_SUBCLASSES.find(c=>c.id===importSubclassId.value)?.count||0
})
const galleryOwnedGroups=computed(()=>{
  void locale.value
  const q=galleryQuery.value.trim().toLowerCase()
  if(!q)return ownedGroups
  return ownedGroups.map(g=>({
    ...g,
    templates:g.templates.filter(tpl=>{
      const koTpl=CATALOG_KO.templates[tpl.id]||''
      const koGroup=CATALOG_KO.ownedGroups[g.id]||''
      return (tpl.label||'').toLowerCase().includes(q)
        ||(tpl.labelEn||'').toLowerCase().includes(q)
        ||(tpl.standard||'').toLowerCase().includes(q)
        ||(tpl.id||'').toLowerCase().includes(q)
        ||(g.label||'').toLowerCase().includes(q)
        ||koTpl.toLowerCase().includes(q)
        ||koGroup.toLowerCase().includes(q)
    })
  })).filter(g=>g.templates.length)
})
const galleryImported=computed(()=>searchImportedPresets(galleryQuery.value||importQuery.value,{
  subclassId:modelOnlyFilter.value?'':importSubclassId.value,
  modelOnly:modelOnlyFilter.value?'only':undefined,
  limit:120
}))

async function ensureThumbs(ids){
  const need=[...new Set(ids.filter(Boolean))].filter(id=>!thumbMap.value[id])
  if(!need.length)return
  thumbsLoading.value=true
  const next={...thumbMap.value}
  for(const id of need){
    next[id]=await renderClosedThumb(id,{size:320,materialId:material.value})
    thumbMap.value={...next}
  }
  thumbsLoading.value=false
}
async function ensureProxyThumbs(presets){
  const need=presets.filter(p=>p?.modelOnly&&p.id&&!proxyThumbMap.value[p.id])
  if(!need.length)return
  thumbsLoading.value=true
  const next={...proxyThumbMap.value}
  for(const p of need){
    next[p.id]=await renderProxyThumb(p,{size:320})
    proxyThumbMap.value={...next}
  }
  thumbsLoading.value=false
}
async function ensureGeomThumbs(presets){
  const need=presets.filter(p=>p?.hasGeometry&&p.sourceNum&&p.id&&!geomThumbMap.value[p.id])
  if(!need.length)return
  thumbsLoading.value=true
  const next={...geomThumbMap.value}
  for(const p of need){
    next[p.id]=await renderGeomClosedThumb(p.sourceNum,{
      size:320,
      materialId:material.value,
      label:p.label,
      length:p.length,
      width:p.width,
      height:p.height,
      thickness:p.thickness
    })
    geomThumbMap.value={...next}
  }
  thumbsLoading.value=false
}
function loadGalleryThumbs(){
  if(boxTab.value==='owned'){
    const ids=galleryOwnedGroups.value.flatMap(g=>g.templates.map(t=>t.id))
    ensureThumbs(ids)
  }else{
    const list=galleryImported.value
    ensureGeomThumbs(list.filter(p=>p.hasGeometry))
    ensureThumbs(list.filter(p=>!p.modelOnly&&!p.hasGeometry).map(p=>p.templateId).filter(Boolean))
    ensureProxyThumbs(list.filter(p=>p.modelOnly))
  }
}

function remount3D(){
  return build3D().then(()=>{if(screen.value==='lab')resetView()})
}
function syncOutboxContents(){
  if(!outboxScene)return
  if(!outboxShowContents.value||!outboxKnife.value||!outboxPacking.value||!outboxPlan.value){
    outboxScene.setContents(null)
    return
  }
  outboxScene.setContents({
    cells:packingContentCells(outboxPacking.value),
    boxSize:outboxPlan.value.inner,
    outerSize:outboxKnife.value?.dimensions?.outer||outboxKnife.value?.dimensions?.panel||null,
    materialId:material.value
  })
}
function mountOutboxScene(){
  nextTick(()=>nextTick(async()=>{
    if(screen.value!=='lab')return
    if(!outboxEligible.value||!outboxKnife.value||!outboxThreeRef.value){
      disposeOutboxScene()
      return
    }
    if(!outboxScene)outboxScene=createKnifeScene(outboxThreeRef.value,{materialId:material.value})
    await outboxScene.setKnife(outboxKnife.value,outboxThickness.value,material.value)
    outboxScene.setProgress(outboxProgress.value)
    syncOutboxContents()
  }))
}
function mountLabScene(){
  nextTick(()=>nextTick(()=>{
    if(!threeRef.value)return
    progress.value=100
    if(!renderer)init3D()
    else remount3D()
    mountOutboxScene()
  }))
}
function enterLabFromTemplate(id){
  selectTemplate(id)
  screen.value='lab'
  mountLabScene()
}
const unmappedToast=ref('')
let unmappedToastTimer=0
function showUnmappedToast(msg){
  unmappedToast.value=msg
  clearTimeout(unmappedToastTimer)
  unmappedToastTimer=setTimeout(()=>{unmappedToast.value=''},4200)
}
async function enterLabFromPreset(id){
  const p=getPreset(id)
  if(!p)return
  if(!p.hasGeometry&&!p.templateId){
    showUnmappedToast(t('toast.sizeOnly',{name:displayPresetLabel(p)||p.sourceNum}))
    return
  }
  if(!applyImportedSize(id))return
  if(p.hasGeometry)await refreshGeomKnife()
  screen.value='lab'
  mountLabScene()
}
function disposeOutboxScene(){
  outboxScene?.dispose()
  outboxScene=null
}
function resetOutboxView(){outboxScene?.resetView()}
function backToGallery(){
  screen.value='gallery'
  // 释放 lab 里的 WebGL，回列表再进时重建
  disposeOutboxScene()
  cancelAnimationFrame(raf);raf=0
  observer?.disconnect();observer=null
  controls?.dispose();controls=null
  if(group){scene?.remove(group);disposeTree(group);group=null}
  renderer?.dispose()
  renderer?.domElement?.remove()
  renderer=null;scene=null;camera=null;hinges=[];geomRig=null
  nextTick(()=>loadGalleryThumbs())
}
const L=ref(315),W=ref(202),H=ref(62),thickness=ref(1.5),progress=ref(100),zoom=ref(1),bleed=ref(5)
const sizeMode=ref('inner'),fluteDirection=ref('L')
const piece=ref('bottom') // 多件：底盖/天盖/抽屉/袖套等
const outboxEnabled=ref(true)
const outboxSizingMode=ref('grow') // 'grow' | 'fixed'
const outboxGapL=ref(DEFAULT_OUTBOX_GAP.length)
const outboxGapW=ref(DEFAULT_OUTBOX_GAP.width)
const outboxGapH=ref(DEFAULT_OUTBOX_GAP.height)
const outboxThickness=ref(DEFAULT_OUTBOX_THICKNESS)
const outboxQty=ref(1)
const outboxManual=ref(false)
const outboxNx=ref(1)
const outboxNy=ref(1)
const outboxNz=ref(1)
const outboxRotated=ref(false)
const outboxShowContents=ref(true)
const outboxProgress=ref(100)
const outboxZoom=ref(1)
const outboxFixedL=ref(430)
const outboxFixedW=ref(210)
const outboxFixedH=ref(270)
const outboxCatalogPick=ref('')
const outboxThreeRef=ref(null)
let outboxScene=null
const outboxCatalogList=computed(()=>outboxCatalogOptions())
/** 仅 3D 样机（无刀版）提示文案 */
const MODEL_ONLY_TEXT=computed(()=>t('modelOnly.hint'))
const activePreset=computed(()=>importId.value?getPreset(importId.value):null)
const isModelOnly=computed(()=>!!activePreset.value?.modelOnly)
/** 运输箱例外：有采集几何则播官方刀版 */
const geomMode=computed(()=>!!activePreset.value?.hasGeometry&&!!activePreset.value?.sourceNum)
const geomKnife=ref(null)
const geomLoading=ref(false)
const geomError=ref('')
const pieceOptions=computed(()=>{
  void locale.value
  if(geomMode.value)return []
  const ps=template.value?.pieces
  if(Array.isArray(ps)&&ps.length){
    return ps.map(p=>({...p,label:displayPieceLabel(p.id,p.label)}))
  }
  if(template.value?.supportsPiece){
    return [
      {id:'bottom',label:displayPieceLabel('bottom',t('lab.pieceBottom'))},
      {id:'lid',label:displayPieceLabel('lid',t('lab.pieceLid'))}
    ]
  }
  return []
})
const labTitle=computed(()=>{
  void locale.value
  if(geomMode.value&&activePreset.value){
    return {
      label:displayPresetLabel(activePreset.value),
      labelEn:`Pacdora #${activePreset.value.sourceNum}`,
      standard:t('lab.standardOfficial')
    }
  }
  const tpl=template.value
  return {
    label:displayTemplateLabel(tpl.id,tpl.label),
    labelEn:tpl.labelEn,
    standard:tpl.standard
  }
})
const sizeFieldDefs=computed(()=>[
  {label:t('lab.lengthL'),key:'L'},
  {label:t('lab.widthW'),key:'W'},
  {label:t('lab.heightH'),key:'H'},
  {label:t('lab.thickness'),key:'T'},
  {label:t('lab.bleed'),key:'B'}
])
const materialLabels=computed(()=>({
  kraft:t('lab.kraft'),
  white:t('lab.white'),
  blue:t('lab.blue')
}))
async function refreshGeomKnife(){
  const p=activePreset.value
  if(!p?.hasGeometry||!p.sourceNum){
    geomKnife.value=null
    geomError.value=''
    geomLoading.value=false
    return
  }
  geomLoading.value=true
  geomError.value=''
  try{
    geomKnife.value=await loadPacdoraGeomKnife(p.sourceNum,{
      label:p.label,
      length:p.length,
      width:p.width,
      height:p.height,
      thickness:p.thickness
    })
  }catch(err){
    console.error(err)
    geomKnife.value=null
    geomError.value=String(err?.message||err)
  }finally{
    geomLoading.value=false
    if(screen.value==='lab'&&renderer)nextTick(()=>remount3D())
  }
}
function defaultPieceId(t){
  if(Array.isArray(t?.pieces)&&t.pieces.length)return t.pieces[0].id
  return 'bottom'
}
const showBleed=ref(true),showCut=ref(true),showFold=ref(true),showDims=ref(true),material=ref('kraft')
const advancedParams=ref({})
const advancedDirty=ref({})
const showAdvanced=ref(false)
const foldStatus=ref({ok:true,issues:[]})
const svgRef=ref(),threeRef=ref()
const hasParamDefs=computed(()=>!geomMode.value&&Array.isArray(template.value.paramDefs)&&template.value.paramDefs.length>0)
const paramGroups=computed(()=>{
  const defs=template.value.paramDefs||[]
  const map=new Map()
  const fallback=t('lab.paramGroupFallback')
  for(const d of defs){
    const g=d.group||fallback
    if(!map.has(g))map.set(g,[])
    map.get(g).push(d)
  }
  return [...map.entries()].map(([label,items])=>({label,items}))
})
function syncAdvancedDefaults(resetAll=false){
  if(!hasParamDefs.value){advancedParams.value={};advancedDirty.value={};return}
  const derived=deriveSizes(template.value,{
    length:L.value,width:W.value,height:H.value,thickness:thickness.value,sizeMode:sizeMode.value
  })
  const next=resolveParams(template.value,derived.panel,derived.T,{})
  const merged={...next}
  if(!resetAll){
    for(const [k,v] of Object.entries(advancedDirty.value)){
      if(v&&advancedParams.value[k]!=null)merged[k]=advancedParams.value[k]
    }
  }else{
    advancedDirty.value={}
  }
  advancedParams.value=merged
}
function onAdvancedChange(code,raw){
  const n=Number(raw)
  if(!Number.isFinite(n))return
  advancedParams.value={...advancedParams.value,[code]:n}
  advancedDirty.value={...advancedDirty.value,[code]:true}
}
function resetAdvanced(){syncAdvancedDefaults(true)}
const isFlatHeight=computed(()=>{
  const lim=template.value?.limits?.height
  return Array.isArray(lim)&&lim[0]===0&&lim[1]===0
})
const knife=computed(()=>{
  if(geomMode.value){
    if(geomKnife.value)return geomKnife.value
    return EMPTY_KNIFE
  }
  return createKnife({
    templateId:templateId.value,
    length:L.value,width:W.value,height:isFlatHeight.value?0:H.value,thickness:thickness.value,bleed:bleed.value,
    sizeMode:sizeMode.value,fluteDirection:fluteDirection.value,materialId:material.value,
    piece:piece.value,
    params:hasParamDefs.value?advancedParams.value:undefined
  })
})
const cutPath=computed(()=>knife.value.cutPath)
const bleedPath=computed(()=>knife.value.bleedPath)
const cutPaths=computed(()=>{
  const ps=knife.value.cutPaths
  if(Array.isArray(ps)&&ps.length)return ps
  return cutPath.value?[cutPath.value]:[]
})
const bleedPaths=computed(()=>{
  const ps=knife.value.bleedPaths
  if(Array.isArray(ps)&&ps.length)return ps
  return bleedPath.value?[bleedPath.value]:[]
})
const dimFontSize=computed(()=>Math.max(4,Math.min(13,Math.min(knife.value.totalX,knife.value.totalY)/30)))
const dimAnnotations=computed(()=>buildDimAnnotations(knife.value))
const dimLines=computed(()=>dimAnnotations.value.flatMap((a,ai)=>(a.lines||[]).map((ln,li)=>({key:`dl${ai}-${li}`,...ln}))))
const dimPolys=computed(()=>dimAnnotations.value.flatMap((a,ai)=>(a.polys||[]).map((pts,pi)=>({key:`dp${ai}-${pi}`,points:pts.map(p=>`${p[0]},${p[1]}`).join(' ')}))))
const dimTexts=computed(()=>dimAnnotations.value.filter(a=>a.text).map((a,ai)=>({key:`dt${ai}`,kind:a.kind,...a.text})))
const bleedEffectiveMm=computed(()=>Number(knife.value.bleedEffective)||(Number(knife.value.bleed||bleed.value||0)+BLEED_EXTRA_MM))
const viewBox=computed(()=>{const b=knife.value.bounds,p=26+bleedEffectiveMm.value;return `${b.minX-p} ${b.minY-p} ${b.maxX-b.minX+2*p} ${b.maxY-b.minY+2*p}`})

const outboxGap=computed(()=>({
  length:Number(outboxGapL.value)||0,
  width:Number(outboxGapW.value)||0,
  height:Number(outboxGapH.value)||0
}))
const outboxEligible=computed(()=>canBuildOutbox({
  knife:knife.value,
  modelOnly:isModelOnly.value,
  flatHeight:isFlatHeight.value,
  enabled:outboxEnabled.value
}))
const outboxManualLayout=computed(()=>{
  if(outboxSizingMode.value!=='grow')return null
  if(!outboxManual.value)return null
  return {
    nx:outboxNx.value,
    ny:outboxNy.value,
    nz:outboxNz.value,
    rotated:outboxRotated.value
  }
})
const outboxFixedInner=computed(()=>({
  length:Number(outboxFixedL.value)||0,
  width:Number(outboxFixedW.value)||0,
  height:Number(outboxFixedH.value)||0
}))
const outboxBundle=computed(()=>buildOutboxKnife({
  inboxKnife:knife.value,
  gap:outboxGap.value,
  thickness:outboxThickness.value,
  bleed:bleed.value,
  materialId:material.value,
  fluteDirection:fluteDirection.value,
  modelOnly:isModelOnly.value,
  flatHeight:isFlatHeight.value,
  enabled:outboxEnabled.value,
  quantity:outboxQty.value,
  manualLayout:outboxManualLayout.value,
  sizingMode:outboxSizingMode.value,
  fixedInner:outboxSizingMode.value==='fixed'?outboxFixedInner.value:null
}))
const outboxKnife=computed(()=>outboxBundle.value?.knife||null)
const outboxPlan=computed(()=>outboxBundle.value?.plan||null)
const outboxOuter=computed(()=>outboxBundle.value?.outer||null)
const outboxPacking=computed(()=>outboxBundle.value?.packing||null)
const outboxStats=computed(()=>outboxBundle.value?.stats||null)
const outboxError=computed(()=>outboxBundle.value?.error||null)
const outboxHint=computed(()=>outboxBundle.value?.hint||null)
const outboxHasMismatch=computed(()=>(outboxPlan.value?.warnings||[]).includes('layoutMismatch'))
const outboxStatsLine=computed(()=>{
  const s=outboxStats.value
  if(!s)return ''
  return [
    t('outbox.unitVol',{v:s.unitLiters}),
    t('outbox.totalVol',{v:s.totalLiters}),
    t('outbox.cavityVol',{v:s.cavityLiters}),
    t('outbox.fillRate',{v:s.fillRate})
  ].join(' · ')
})
const outboxErrorText=computed(()=>{
  const err=outboxError.value
  if(!err)return ''
  if(err==='overLimit'){
    const o=outboxHint.value?.overflow||{}
    return t('outbox.errOverLimit',{
      ol:o.length||0,
      ow:o.width||0,
      oh:o.height||0
    })
  }
  if(err==='noneFit')return t('outbox.errNoneFit')
  if(err==='fixedOutOfRange')return t('outbox.errFixedRange')
  return err
})
const outboxErrorHintText=computed(()=>{
  if(outboxError.value!=='overLimit')return ''
  const max=outboxHint.value?.maxFit
  if(!(max>0))return ''
  return t('outbox.errOverLimitHint',{max})
})
function applyOutboxCatalogPick(id){
  outboxCatalogPick.value=id||''
  if(!id)return
  const opt=outboxCatalogList.value.find(p=>p.id===id)
  if(!opt)return
  outboxFixedL.value=opt.length
  outboxFixedW.value=opt.width
  outboxFixedH.value=opt.height
}
function setOutboxSizingMode(mode){
  if(mode!=='grow'&&mode!=='fixed')return
  if(mode==='fixed'&&outboxSizingMode.value==='grow'&&outboxPlan.value?.inner){
    // 切到固定模式时，用当前自动算出的外箱内空作默认值
    outboxFixedL.value=outboxPlan.value.inner.length
    outboxFixedW.value=outboxPlan.value.inner.width
    outboxFixedH.value=outboxPlan.value.inner.height
    outboxCatalogPick.value=''
  }
  outboxSizingMode.value=mode
}

watch(outboxPacking,(p)=>{
  if(!p||outboxSizingMode.value!=='grow'||outboxManual.value)return
  if(p.error)return
  outboxNx.value=p.nx
  outboxNy.value=p.ny
  outboxNz.value=p.nz
  outboxRotated.value=!!p.rotated
})
const outboxCutPaths=computed(()=>{
  const k=outboxKnife.value
  if(!k)return []
  if(Array.isArray(k.cutPaths)&&k.cutPaths.length)return k.cutPaths
  return k.cutPath?[k.cutPath]:[]
})
const outboxBleedPaths=computed(()=>{
  const k=outboxKnife.value
  if(!k)return []
  if(Array.isArray(k.bleedPaths)&&k.bleedPaths.length)return k.bleedPaths
  return k.bleedPath?[k.bleedPath]:[]
})
const outboxBleedEffectiveMm=computed(()=>{
  const k=outboxKnife.value
  if(!k)return 0
  return Number(k.bleedEffective)||(Number(k.bleed||bleed.value||0)+BLEED_EXTRA_MM)
})
const outboxViewBox=computed(()=>{
  const k=outboxKnife.value
  if(!k?.bounds)return '0 0 100 100'
  const b=k.bounds,p=26+outboxBleedEffectiveMm.value
  return `${b.minX-p} ${b.minY-p} ${b.maxX-b.minX+2*p} ${b.maxY-b.minY+2*p}`
})
const outboxDimFontSize=computed(()=>{
  const k=outboxKnife.value
  if(!k)return 8
  return Math.max(4,Math.min(13,Math.min(k.totalX,k.totalY)/30))
})
const outboxDimAnnotations=computed(()=>outboxKnife.value?buildDimAnnotations(outboxKnife.value):[])
const outboxDimLines=computed(()=>outboxDimAnnotations.value.flatMap((a,ai)=>(a.lines||[]).map((ln,li)=>({key:`odl${ai}-${li}`,...ln}))))
const outboxDimPolys=computed(()=>outboxDimAnnotations.value.flatMap((a,ai)=>(a.polys||[]).map((pts,pi)=>({key:`odp${ai}-${pi}`,points:pts.map(p=>`${p[0]},${p[1]}`).join(' ')}))))
const outboxDimTexts=computed(()=>outboxDimAnnotations.value.filter(a=>a.text).map((a,ai)=>({key:`odt${ai}`,kind:a.kind,...a.text})))
const foldStatusText=computed(()=>{
  const s=foldStatus.value
  if(s.skipped)return t('fold.checkSkip')
  if(s.ok)return t('fold.checkOk')
  return t('fold.checkWarn',{n:s.issues.length})
})
const contractStatusText=computed(()=>{
  const v=knife.value.validation
  if(!v)return t('contract.unknown')
  if(v.ok)return t('contract.ok')
  const n=(v.checks||[]).filter(c=>!c.ok).length
  return t('contract.fail',{n})
})
let scene,camera,renderer,controls,group,raf,observer,hinges=[],geomRig=null,buildToken=0
function disposeTree(node){node.traverse(o=>{o.geometry?.dispose();if(o.material){const ms=Array.isArray(o.material)?o.material:[o.material];ms.forEach(m=>m.dispose())}})}
function panelMesh(f,faceHoles=[]){
  const T=Number(thickness.value)
  const shape=new THREE.Shape()
  const cx=f.x+f.w/2,cy=f.y+f.h/2
  if(Array.isArray(f.outline)&&f.outline.length>=3){
    // outline 绝对坐标 → 相对面中心；布局 y 向下，3D y 向上故翻转
    f.outline.forEach((p,i)=>{
      const x=p[0]-cx,y=-(p[1]-cy)
      if(i)shape.lineTo(x,y); else shape.moveTo(x,y)
    })
    shape.closePath()
  }else{
    shape.moveTo(-f.w/2,-f.h/2);shape.lineTo(f.w/2,-f.h/2);shape.lineTo(f.w/2,f.h/2);shape.lineTo(-f.w/2,f.h/2);shape.closePath()
  }
  for(const hole of faceHoles){
    const loop=Array.isArray(hole.loop)&&hole.loop.length>=3
      ?hole.loop
      :[[hole.x,hole.y],[hole.x+hole.w,hole.y],[hole.x+hole.w,hole.y+hole.h],[hole.x,hole.y+hole.h]]
    const path=new THREE.Path()
    loop.forEach((p,i)=>{
      const x=p[0]-cx,y=-(p[1]-cy)
      if(i)path.lineTo(x,y); else path.moveTo(x,y)
    })
    path.closePath()
    shape.holes.push(path)
  }
  const geo=new THREE.ExtrudeGeometry(shape,{depth:T,bevelEnabled:false})
  const mat=createBoardMaterial(material.value,{flatShading:!f.smooth})
  const mesh=new THREE.Mesh(geo,mat)
  mesh.name=f.name
  const off=neutralMeshOffset(T)
  mesh.position.z=off.z
  return mesh
}
function updateFoldStatus(){
  if(Number(progress.value)<100){foldStatus.value={ok:true,issues:[]};return}
  foldStatus.value=estimateClosedCollisions(knife.value,thickness.value)
}
async function build3D(){
  if(!scene)return
  const token=++buildToken
  const mid=material.value
  try{await ensureBoardPack(mid)}catch{/* 退回纯色 */}
  if(token!==buildToken||!scene)return
  if(group){scene.remove(group);disposeTree(group)}group=new THREE.Group();scene.add(group);hinges=[];geomRig=null
  const faces=knife.value.faces||[]
  if(!faces.length){setFold();controls?.update();return}
  const byName=Object.fromEntries(faces.map(f=>[f.name,f]));const world=new Map()
  const holesByFace=new Map()
  for(const h of knife.value.holes||[]){
    if(!h?.face)continue
    if(!holesByFace.has(h.face))holesByFace.set(h.face,[])
    holesByFace.get(h.face).push(h)
  }
  const zOff=neutralMeshOffset(thickness.value).z
  if(knife.value.geomMode){
    // 官方几何：回放动画（含多件整件平移拼合）
    geomRig=buildGeomRig(knife.value,{makeMesh:f=>panelMesh(f,holesByFace.get(f.name)||[]),zOff})
    group.add(geomRig.root)
    setFold();controls?.update();return
  }
  function attach(name){if(world.has(name))return world.get(name);const f=byName[name];if(!f)return null;const mesh=panelMesh(f,holesByFace.get(name)||[]);let anchor
    if(!f.parent){
      anchor=new THREE.Group()
      group.add(anchor)
      anchor.add(mesh)
      world.set(name,{anchor,mesh});return world.get(name)
    }
    const p=byName[f.parent];if(!p){
      anchor=new THREE.Group();group.add(anchor)
      anchor.add(mesh);world.set(name,{anchor,mesh});return world.get(name)
    }
    const parent=attach(f.parent);if(!parent)return null
    const side=f.side;anchor=new THREE.Group()
    const dx=(f.x+f.w/2)-(p.x+p.w/2),dy=-((f.y+f.h/2)-(p.y+p.h/2))
    const hingeRec=knife.value.hinges.find(h=>h.child===name)
    let hx=0,hy=0,axis=null
    if(Array.isArray(f.hingeLine)&&f.hingeLine.length===2){
      // 任意轴：锚点放在铰链中点（父面局部），轴向量绕 Z=0 平面
      const [[ax,ay],[bx,by]]=f.hingeLine
      const mx=(ax+bx)/2,my=(ay+by)/2
      const pcx=p.x+p.w/2,pcy=p.y+p.h/2
      hx=mx-pcx; hy=-(my-pcy)
      const dirX=bx-ax,dirY=-(by-ay)
      const len=Math.hypot(dirX,dirY)||1
      axis={x:dirX/len,y:dirY/len,z:0}
    }else{
    if(side==='top')hy=p.h/2
    if(side==='bottom')hy=-p.h/2
    if(side==='left')hx=-p.w/2
    if(side==='right')hx=p.w/2
    }
    anchor.position.set(hx,hy,0);parent.mesh.add(anchor)
    mesh.position.set(dx-hx,dy-hy,zOff);anchor.add(mesh)
    // 官方动画角带符号（合盖方向）；缺省 -90
    const deg=Number.isFinite(hingeRec?.angle)?hingeRec.angle:-90
    hinges.push({anchor,side,axis,name,angle:deg*Math.PI/180})
    world.set(name,{anchor,mesh});return world.get(name)
  }
  faces.forEach(f=>attach(f.name));setFold();controls?.update()
  // 贴图 await 之后再对齐一次视角（resize 首次 fit 常早于 mesh 就绪）
  if(camera)resetView()
}
const foldStageLabel=computed(()=>{
  const stages=knife.value?.foldStages
  const n=Array.isArray(stages)?stages.length:0
  if(!n)return ''
  const p01=Math.max(0,Math.min(1,Number(progress.value)/100))
  const {now,total}=stageIndexAt(p01,n)
  return t('fold.step',{now,total})
})
function setFold(){
  const p01=Math.max(0,Math.min(1,Number(progress.value)/100))
  if(geomRig){geomRig.apply(p01);updateFoldStatus();return}
  const stages=knife.value?.foldStages
  const staged=Array.isArray(stages)&&stages.length>0
  const angMap=staged?anglesAtProgress(stages,p01):null
  const stagedKids=staged?new Set(stages.flatMap(st=>(st||[]).map(s=>s.child))):null
  const s=p01*p01*(3-2*p01)
  for(const h of hinges){
    let v
    if(staged){
      // 已入表：阶段累加角；尚未轮到：0；从未进阶段：同步终角
      if(angMap.has(h.name))v=angMap.get(h.name)
      else if(stagedKids.has(h.name))v=0
      else v=s*h.angle
    }else{
      v=s*h.angle // 保留符号，匹配 Pacdora 正负转角
    }
    if(h.axis){
      const q=new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(h.axis.x,h.axis.y,h.axis.z).normalize(),
        v
      )
      h.anchor.setRotationFromQuaternion(q)
    }else{
      const r=foldRotation(h.side,v)
      h.anchor.rotation.set(r.x,r.y,r.z)
    }
  }
  updateFoldStatus()
}
function init3D(){
  if(!threeRef.value||renderer)return
  scene=new THREE.Scene();scene.background=new THREE.Color(0xf7f8fa);camera=new THREE.PerspectiveCamera(38,1,.1,5000);renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));threeRef.value.appendChild(renderer.domElement);scene.add(new THREE.HemisphereLight(0xffffff,0x8a8d93,2.7));const sun=new THREE.DirectionalLight(0xffffff,2);sun.position.set(250,300,300);scene.add(sun);controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.minDistance=100;controls.maxDistance=2500
  renderer.domElement.addEventListener('webglcontextlost',()=>console.warn('[lab3d] WebGL context lost'))
  renderer.domElement.addEventListener('webglcontextrestored',()=>remount3D())
  remount3D()
  let fittedOnce=false
  const resize=()=>{
    const r=threeRef.value?.getBoundingClientRect()
    if(!r?.width||!r?.height||!renderer)return
    renderer.setSize(r.width,r.height)
    camera.aspect=r.width/r.height
    camera.updateProjectionMatrix()
    if(!fittedOnce){fittedOnce=true;resetView()}
  }
  observer=new ResizeObserver(resize);observer.observe(threeRef.value);resize()
  const draw=()=>{raf=requestAnimationFrame(draw);if(!renderer||!scene||!camera)return;controls?.update();renderer.render(scene,camera)};draw()
}
function resetView(){
  if(!camera)return
  if(group)group.updateMatrixWorld(true)
  const box=group?new THREE.Box3().setFromObject(group):new THREE.Box3()
  const center=new THREE.Vector3()
  const sphere=new THREE.Sphere()
  if(box.isEmpty()){
    const p=knife.value.dimensions?.panel||knife.value.dimensions||{}
    const fallback=Math.max(Number(p.length)||200,Number(p.width)||200,Number(p.height)||100,80)
    center.set(0,0,0)
    sphere.radius=fallback
  }else{
    box.getCenter(center)
    box.getBoundingSphere(sphere)
  }
  const r=Math.max(sphere.radius,20)
  const fov=camera.fov||38
  const dist=r/Math.sin((fov*Math.PI/180)/2)*1.15
  const dir=new THREE.Vector3(0.8,-0.9,1).normalize()
  camera.position.copy(center).addScaledVector(dir,dist)
  if(controls){
    controls.target.copy(center)
    controls.maxDistance=Math.max(2500,dist*4)
    controls.update()
  }
}
function saveFile(content,type,name){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function exportBase(){return `${knife.value.template}-${L.value}x${W.value}x${H.value}`}
/** 椭圆近似周长 → 圆筒边数 24–48 */
function sidesFromSize(len,wid){
  const a=Math.max(1,Number(len)||80)/2,b=Math.max(1,Number(wid)||80)/2
  const h=((a-b)*(a-b))/((a+b)*(a+b)||1)
  const perim=Math.PI*(a+b)*(1+3*h/(10+Math.sqrt(Math.max(0,4-3*h))))
  return Math.min(48,Math.max(24,Math.round(perim/6)))
}
function applyCylinderSides(){
  if(templateId.value!=='cylinder-box')return
  const s=sidesFromSize(L.value,W.value)
  advancedParams.value={...advancedParams.value,sides:s}
  advancedDirty.value={...advancedDirty.value,sides:true}
}
function selectTemplate(id){
  if(id===templateId.value&&boxTab.value==='owned')return
  const d=getTemplate(id).defaults
  boxTab.value='owned'
  importId.value=''
  geomKnife.value=null
  geomError.value=''
  templateId.value=id
  piece.value=defaultPieceId(getTemplate(id))
  L.value=d.length;W.value=d.width;H.value=d.height;thickness.value=d.thickness
  advancedDirty.value={}
  syncAdvancedDefaults(true)
  applyCylinderSides()
  if(screen.value==='lab')nextTick(()=>{if(renderer)remount3D()})
}
/** @returns {boolean} 是否成功挂上结构模板 / 官方几何 */
function applyImportedSize(id){
  const p=getPreset(id)
  if(!p){importId.value='';return false}
  // 运输箱例外：有采集几何直接播官方刀版
  if(p.hasGeometry&&p.sourceNum){
    boxTab.value='imported'
    importId.value=p.id
    if(p.templateId&&getTemplate(p.templateId)){
      templateId.value=p.templateId
      piece.value=defaultPieceId(getTemplate(p.templateId))
    }
    L.value=Number(p.length)||0
    W.value=Number(p.width)||0
    H.value=Number(p.height)||0
    thickness.value=Math.max(.5,Number(p.thickness)||1.5)
    if(['kraft','white','blue'].includes(p.materialId))material.value=p.materialId
    sizeMode.value='inner'
    advancedDirty.value={}
    progress.value=100
    // 几何加载由 enterLabFromPreset await refreshGeomKnife；此处只写入状态
    return true
  }
  // 未映射禁止回退当前 templateId，否则会静默变成翻盖邮寄盒等错误结构
  if(!p.templateId){
    importId.value=p.id
    showUnmappedToast(t('toast.unmapped',{name:displayPresetLabel(p)||p.sourceNum}))
    return false
  }
  const tid=p.templateId
  const tpl=getTemplate(tid)
  if(!tpl){
    showUnmappedToast(t('toast.missingTemplate',{tid,name:displayPresetLabel(p)||p.sourceNum}))
    return false
  }
  const clamp=(n,lo,hi)=>Math.min(hi,Math.max(lo,n))
  boxTab.value='imported'
  importId.value=p.id
  geomKnife.value=null
  templateId.value=tid
  piece.value=defaultPieceId(tpl)
  L.value=clamp(p.length,...tpl.limits.length)
  W.value=clamp(p.width,...tpl.limits.width)
  H.value=clamp(p.height,...tpl.limits.height)
  thickness.value=Math.max(.5,Number(p.thickness)||tpl.defaults.thickness)
  if(['kraft','white','blue'].includes(p.materialId))material.value=p.materialId
  sizeMode.value='inner'
  advancedDirty.value={}
  syncAdvancedDefaults(true)
  if(p.defaultParams&&typeof p.defaultParams==='object'){
    const merged={...advancedParams.value}
    for(const [k,v] of Object.entries(p.defaultParams)){
      if(v==null||v==='')continue
      merged[k]=Number(v)
      advancedDirty.value={...advancedDirty.value,[k]:true}
    }
    advancedParams.value=merged
  }
  applyCylinderSides()
  if(screen.value==='lab')nextTick(()=>{if(renderer)remount3D()})
  return true
}
function downloadSVG(){if(isModelOnly.value)return;saveFile(toSvgDieline(knife.value,{includeDims:showDims.value}),'image/svg+xml',`${exportBase()}.svg`)}
function downloadDXF(){if(isModelOnly.value)return;saveFile(toDxf(knife.value),'application/dxf',`${exportBase()}.dxf`)}
async function downloadPDF(){if(isModelOnly.value)return;const bytes=await toPdf(knife.value);saveFile(bytes,'application/pdf',`${exportBase()}.pdf`)}
async function downloadAI(){if(isModelOnly.value)return;const bytes=await toAi(knife.value);saveFile(bytes,'application/postscript',`${exportBase()}.ai`)}
function downloadJSON(){if(isModelOnly.value)return;saveFile(JSON.stringify(knife.value,null,2),'application/json',`knife-v3-${exportBase()}.json`)}
function outboxExportBase(){
  const plan=outboxPlan.value?.inner
  const size=plan?`${plan.length}x${plan.width}x${plan.height}`:`${L.value}x${W.value}x${H.value}`
  const p=outboxPacking.value
  const layout=p&&!p.error?`-N${p.quantity}-${p.nx}x${p.ny}x${p.nz}`:''
  const modeTag=outboxSizingMode.value==='fixed'?'-fixed':''
  return `outbox-${OUTBOX_TEMPLATE_ID}-${size}${layout}${modeTag}`
}
function downloadOutboxSVG(){
  if(!outboxKnife.value)return
  saveFile(toSvgDieline(outboxKnife.value,{includeDims:showDims.value}),'image/svg+xml',`${outboxExportBase()}.svg`)
}
function downloadOutboxDXF(){
  if(!outboxKnife.value)return
  saveFile(toDxf(outboxKnife.value),'application/dxf',`${outboxExportBase()}.dxf`)
}
async function downloadOutboxPDF(){
  if(!outboxKnife.value)return
  const bytes=await toPdf(outboxKnife.value)
  saveFile(bytes,'application/pdf',`${outboxExportBase()}.pdf`)
}
function downloadOutboxJSON(){
  if(!outboxKnife.value)return
  saveFile(JSON.stringify(outboxKnife.value,null,2),'application/json',`${outboxExportBase()}.json`)
}
watch([L,W,H,thickness,sizeMode,templateId],()=>{if(screen.value==='lab')syncAdvancedDefaults(false)})
watch([L,W,H,thickness,material,sizeMode,fluteDirection,piece,advancedParams],()=>{
  if(geomMode.value)return
  if(screen.value==='lab'&&renderer)remount3D()
})
watch(material,()=>{if(screen.value==='lab'&&renderer&&geomMode.value)remount3D()})
watch(geomKnife,()=>{if(screen.value==='lab'&&renderer&&geomMode.value)nextTick(()=>remount3D())})
watch(progress,()=>{
  if(screen.value!=='lab')return
  setFold()
})
watch(outboxProgress,()=>{
  if(screen.value==='lab')outboxScene?.setProgress(outboxProgress.value)
})
watch([outboxKnife,outboxThickness,material,outboxEnabled,outboxQty,outboxManual,outboxNx,outboxNy,outboxNz,outboxRotated,outboxSizingMode,outboxFixedL,outboxFixedW,outboxFixedH,outboxError],()=>{
  if(screen.value!=='lab')return
  if(outboxError.value||!outboxKnife.value){
    disposeOutboxScene()
    return
  }
  mountOutboxScene()
})
watch(outboxShowContents,()=>{
  if(screen.value==='lab')syncOutboxContents()
})
watch([boxTab,importSubclassId,galleryQuery],()=>{if(screen.value==='gallery')nextTick(loadGalleryThumbs)})
onMounted(()=>nextTick(()=>{
  syncAdvancedDefaults(true)
  // 预热纸板/纸纹贴图，列表缩略图与 Lab 共用缓存
  ensureBoardPack('kraft').catch(()=>{})
  ensureBoardPack('white').catch(()=>{})
  loadGalleryThumbs()
}))
onBeforeUnmount(()=>{
  disposeOutboxScene()
  cancelAnimationFrame(raf);observer?.disconnect();controls?.dispose();if(group)disposeTree(group);renderer?.dispose();renderer?.domElement?.remove()
})
</script>
<template>
<div class="dieline-tool">
<p v-if="hostLocaleUnsupported" class="field-hint" style="margin:8px 12px;padding:8px 12px;background:#fff8e8;border:1px solid #e6d3a8;border-radius:8px;color:#7a4e12">
  Dieline UI currently supports Chinese and Korean only. Host English will not force Chinese; use the language chips below.
</p>
<header>
  <div class="brand"><span class="brandmark"><Box :size="22"/></span><div><strong>BOXCRAFT <span>LAB</span></strong><small>{{t('brand.subtitle')}}</small></div></div>
  <div class="headright">
    <div class="lang-switch" role="group" :aria-label="t('lang.zh')+' / '+t('lang.ko')">
      <button type="button" :class="['chip','lang-chip',{selected:locale==='zh-CN'}]" @click="switchLocale('zh-CN')">{{t('lang.zh')}}</button>
      <button type="button" :class="['chip','lang-chip',{selected:locale==='ko-KR'}]" @click="switchLocale('ko-KR')">{{t('lang.ko')}}</button>
    </div>
    <template v-if="screen==='lab'">
      <button type="button" class="btn" @click="backToGallery"><ArrowLeft :size="15"/> {{t('nav.boxList')}}</button>
      <span class="demo-tag">{{geomMode?(geomLoading?t('nav.loadingGeom'):t('nav.facesOfficial',{n:knife.faces.length})):t('nav.facesConcept',{n:knife.faces.length})}}</span>
      <button class="btn dark" :disabled="isModelOnly" @click="downloadSVG"><Download :size="15"/> {{t('nav.exportSvg')}}</button>
    </template>
    <template v-else>
      <span class="demo-tag">{{boxTab==='imported'?t('nav.tagImported'):t('nav.tagOwned')}}</span>
    </template>
  </div>
</header>

<!-- 盒子列表 -->
<div v-if="screen==='gallery'" class="gallery">
  <div class="gallery-toolbar">
    <div class="box-tabs gallery-tabs">
      <button type="button" :class="['chip',{selected:boxTab==='owned'}]" @click="boxTab='owned'">{{t('gallery.tabOwned')}}</button>
      <button type="button" :class="['chip',{selected:boxTab==='imported'}]" @click="boxTab='imported'">{{t('gallery.tabImported')}}</button>
    </div>
    <div class="gallery-search">
      <Search :size="16"/>
      <input v-model="galleryQuery" type="search" :placeholder="t('gallery.searchPlaceholder')"/>
    </div>
    <span class="gallery-meta" v-if="thumbsLoading">{{t('gallery.thumbsLoading')}}</span>
  </div>

  <div v-if="boxTab==='imported'" class="gallery-filters">
    <button type="button" :class="['chip',{selected:!importSubclassId}]" @click="importSubclassId=''">{{t('gallery.all')}}<small>{{PRESET_CATALOG.count}}</small></button>
    <button v-for="c in OFFICIAL_SUBCLASSES" :key="c.id" type="button" :class="['chip',{selected:importSubclassId===c.id}]" @click="importSubclassId=c.id">{{displaySubclassLabel(c.id,c.label)}}<small>{{c.count}}</small></button>
    <button type="button" :class="['chip',{selected:importSubclassId==='__none__'}]" @click="importSubclassId='__none__'">{{t('gallery.unclassified')}}<small>{{UNCLASSIFIED_SUBCLASS_COUNT}}</small></button>
    <button type="button" :class="['chip',{selected:importSubclassId==='__modelOnly__'}]" @click="importSubclassId='__modelOnly__'">{{t('gallery.modelOnly')}}<small>{{countModelOnly()}}</small></button>
  </div>

  <template v-if="boxTab==='owned'">
    <section v-for="g in galleryOwnedGroups" :key="g.id" class="gallery-section">
      <h2>{{displayOwnedGroupLabel(g.id,g.label)}}</h2>
      <div class="box-grid">
        <button v-for="tpl in g.templates" :key="tpl.id" type="button" class="box-card" @click="enterLabFromTemplate(tpl.id)">
          <div class="box-cover">
            <img v-if="thumbMap[tpl.id]" :src="thumbMap[tpl.id]" :alt="displayTemplateLabel(tpl.id,tpl.label)"/>
            <div v-else class="box-cover-ph">{{t('gallery.coverPreview')}}</div>
            <i class="box-badge" :data-kind="structureKind(tpl).id">{{kindLabel(tpl)}}</i>
          </div>
          <div class="box-card-body">
            <strong>{{displayTemplateLabel(tpl.id,tpl.label)}}</strong>
            <small>{{tpl.standard}}</small>
            <span>{{tpl.defaults.length}}×{{tpl.defaults.width}}×{{tpl.defaults.height}} mm</span>
          </div>
        </button>
      </div>
    </section>
    <p v-if="!galleryOwnedGroups.length" class="gallery-empty">{{t('gallery.emptyOwned')}}</p>
  </template>

  <template v-else>
    <section class="gallery-section">
      <h2>{{t('gallery.importedHeading',{shown:galleryImported.length,total:importCategoryCount})}}</h2>
      <div class="box-grid">
        <button
          v-for="p in galleryImported"
          :key="p.id"
          type="button"
          class="box-card"
          :class="{'is-unmapped':!p.hasGeometry&&!p.templateId}"
          :title="p.hasGeometry?t('gallery.titleGeom'):(p.templateId?t('gallery.titleMapped'):t('gallery.titleUnmapped'))"
          @click="enterLabFromPreset(p.id)"
        >
          <div class="box-cover">
            <img v-if="geomThumbMap[p.id]" :src="geomThumbMap[p.id]" :alt="displayPresetLabel(p)"/>
            <img v-else-if="p.modelOnly&&proxyThumbMap[p.id]" :src="proxyThumbMap[p.id]" :alt="displayPresetLabel(p)"/>
            <img v-else-if="p.templateId&&thumbMap[p.templateId]" :src="thumbMap[p.templateId]" :alt="displayPresetLabel(p)"/>
            <img v-else-if="p.coverRel" :src="assetUrl(p.coverRel)" :alt="displayPresetLabel(p)"/>
            <div v-else class="box-cover-ph">{{p.hasGeometry?t('gallery.coverPreview'):(p.modelOnly?t('gallery.proxyPreview'):(p.templateId?t('gallery.coverPreview'):t('gallery.unmapped')))}}</div>
            <i v-if="p.hasGeometry||p.coverRel" class="box-badge" data-kind="closed">{{t('gallery.shipping')}}</i>
            <i v-else-if="p.modelOnly" class="box-badge" data-kind="modelOnly">{{t('gallery.modelOnly')}}</i>
            <i v-else-if="p.templateId" class="box-badge" :data-kind="structureKind(p.templateId).id">{{kindLabel(p.templateId)}}</i>
            <i v-else class="box-badge" data-kind="unmapped">{{t('gallery.sizeOnly')}}</i>
          </div>
          <div class="box-card-body">
            <strong>{{displayPresetLabel(p)}}</strong>
            <small>{{displaySubclassLabel(p.subclassIds&&p.subclassIds[0],(p.subclassLabels&&p.subclassLabels[0])||p.categoryLabel||t('gallery.unclassified'))}} · {{p.sourceNum}}</small>
            <span>{{p.length}}×{{p.width}}×{{p.height}} mm</span>
            <em v-if="!p.hasGeometry&&!p.templateId" class="unmap-hint">{{t('gallery.unmapHint')}}</em>
            <em v-else-if="p.modelOnly" class="unmap-hint">{{MODEL_ONLY_TEXT}}</em>
          </div>
        </button>
      </div>
    </section>
    <p v-if="!galleryImported.length" class="gallery-empty">{{t('gallery.emptyImported')}}</p>
  </template>
  <div v-if="unmappedToast" class="unmap-toast" role="status">{{unmappedToast}}</div>
</div>

<!-- 刀版工位（原界面） -->
<div v-else class="workspace"><aside><div class="section"><div class="eyebrow">{{t('lab.category')}}</div><h2 class="cat-title">{{labTitle.label}}</h2>
<p class="muted">{{labTitle.labelEn}} · {{labTitle.standard}}</p>
<p class="hint">{{t('lab.fromList')}}</p>
<p v-if="geomError" class="hint model-only-hint">{{t('lab.geomFail',{msg:geomError})}}</p>
<div class="mini-illustration">
  <img v-if="activePreset&&geomThumbMap[activePreset.id]" class="mini-cover" :src="geomThumbMap[activePreset.id]" :alt="labTitle.label"/>
  <img v-else-if="thumbMap[templateId]" class="mini-cover" :src="thumbMap[templateId]" :alt="labTitle.label"/>
  <img v-else-if="activePreset?.coverRel" class="mini-cover" :src="assetUrl(activePreset.coverRel)" :alt="labTitle.label"/>
  <svg v-else viewBox="0 0 180 110"><path d="M30 40L105 22L150 45L76 66Z" fill="#d9b98b" stroke="#96744a"/><path d="M30 40V75L76 100V66Z" fill="#c5a072" stroke="#96744a"/><path d="M76 66V100L150 76V45Z" fill="#b58e60" stroke="#96744a"/><path d="M30 40L15 18L90 2L105 22Z" fill="#e9cfa7" stroke="#96744a"/></svg>
</div></div><div class="section"><div class="eyebrow">{{t('lab.parameters')}}</div><h3>{{t('lab.sizeSettings')}} <span class="unit">mm</span></h3>
<p v-if="geomMode" class="hint">{{t('lab.sizeLocked')}}</p>
<div class="field"><label>{{t('lab.sizeMode')}}</label><div class="inputwrap mode-toggle"><button type="button" :class="['chip',{selected:sizeMode==='inner'}]" :disabled="geomMode" @click="sizeMode='inner'">{{t('lab.inner')}}</button><button type="button" :class="['chip',{selected:sizeMode==='outer'}]" :disabled="geomMode" @click="sizeMode='outer'">{{t('lab.outer')}}</button></div></div>
<div v-if="pieceOptions.length" class="field"><label>{{t('lab.piece')}}</label>
  <div v-if="pieceOptions.length<=4" class="inputwrap mode-toggle"><button v-for="p in pieceOptions" :key="p.id" type="button" :class="['chip',{selected:piece===p.id}]" @click="piece=p.id">{{p.label||p.id}}</button></div>
  <div v-else class="inputwrap"><select :value="piece" @change="piece=$event.target.value"><option v-for="p in pieceOptions" :key="p.id" :value="p.id">{{p.label||p.id}}</option></select></div>
</div>
<p v-if="isModelOnly" class="hint model-only-hint">{{MODEL_ONLY_TEXT}}</p>
<div class="field"><label>{{t('lab.flute')}}</label><div class="inputwrap mode-toggle"><button type="button" :class="['chip',{selected:fluteDirection==='L'}]" :disabled="geomMode" @click="fluteDirection='L'">{{t('lab.fluteL')}}</button><button type="button" :class="['chip',{selected:fluteDirection==='W'}]" :disabled="geomMode" @click="fluteDirection='W'">{{t('lab.fluteW')}}</button></div></div>
<div v-for="f in sizeFieldDefs" :key="f.key" class="field"><label>{{f.label}}</label><div class="inputwrap"><input v-if="f.key==='L'" v-model.number="L" type="number" :min="template.limits.length[0]" :max="template.limits.length[1]" :disabled="geomMode"/><input v-else-if="f.key==='W'" v-model.number="W" type="number" :min="template.limits.width[0]" :max="template.limits.width[1]" :disabled="geomMode"/><input v-else-if="f.key==='H'" v-model.number="H" type="number" :min="template.limits.height[0]" :max="template.limits.height[1]" :disabled="geomMode||isFlatHeight"/><input v-else-if="f.key==='T'" v-model.number="thickness" type="number" min="0.5" step="0.5" :disabled="geomMode"/><input v-else v-model.number="bleed" type="number" min="0" max="20" :disabled="geomMode"/><b>mm</b></div></div>
<p v-if="isFlatHeight&&!geomMode" class="hint">{{t('lab.flatHint')}}</p>
<p class="hint dim-meta" v-if="geomMode">{{t('lab.sampleSize',{l:L,w:W,h:H,extra:geomLoading?t('lab.loading'):(geomError||t('lab.facesN',{n:knife.faces.length}))})}}</p>
<p class="hint dim-meta" v-else>{{t('lab.clearance',{il:knife.dimensions.inner.length,iw:knife.dimensions.inner.width,ih:knife.dimensions.inner.height,ol:knife.dimensions.outer.length,ow:knife.dimensions.outer.width,oh:knife.dimensions.outer.height})}}</p>
<div v-if="hasParamDefs" class="advanced-params">
  <button type="button" class="adv-toggle" @click="showAdvanced=!showAdvanced">{{showAdvanced?t('lab.advCollapse',{n:template.paramDefs.length}):t('lab.advExpand',{n:template.paramDefs.length})}}</button>
  <div v-show="showAdvanced" class="adv-body">
    <div v-for="g in paramGroups" :key="g.label" class="adv-group">
      <div class="group-label">{{g.label}}</div>
      <div v-for="d in g.items" :key="d.code" class="field">
        <label>{{d.label}} <small>{{d.code}}</small></label>
        <div class="inputwrap">
          <input type="number" :min="d.min" :max="d.max" step="0.1"
            :value="advancedParams[d.code]"
            @input="onAdvancedChange(d.code,$event.target.value)"/>
          <b>{{d.unit||'mm'}}</b>
        </div>
      </div>
    </div>
    <button type="button" class="btn full ghost" @click="resetAdvanced">{{t('lab.resetAdvanced')}}</button>
  </div>
</div>
</div>
<div class="section outbox-section">
  <div class="eyebrow">{{t('outbox.title')}}</div>
  <div class="field"><label>{{t('outbox.enable')}}</label>
    <div class="inputwrap mode-toggle">
      <button type="button" :class="['chip',{selected:outboxEnabled}]" @click="outboxEnabled=true">ON</button>
      <button type="button" :class="['chip',{selected:!outboxEnabled}]" @click="outboxEnabled=false">OFF</button>
    </div>
  </div>
  <template v-if="outboxEnabled&&outboxEligible">
    <p class="hint">{{t('outbox.template')}}</p>
    <div class="field"><label>{{t('outbox.modeGrow')}}</label>
      <div class="inputwrap mode-toggle">
        <button type="button" :class="['chip','lang-chip',{selected:outboxSizingMode==='grow'}]" @click="setOutboxSizingMode('grow')">{{t('outbox.modeGrow')}}</button>
        <button type="button" :class="['chip','lang-chip',{selected:outboxSizingMode==='fixed'}]" @click="setOutboxSizingMode('fixed')">{{t('outbox.modeFixed')}}</button>
      </div>
    </div>

    <template v-if="outboxSizingMode==='grow'">
      <div class="field"><label>{{t('outbox.qty')}}</label><div class="inputwrap"><input v-model.number="outboxQty" type="number" min="1" max="500" step="1"/><b>pcs</b></div></div>
      <div class="field"><label>{{outboxManual?t('outbox.layoutManual'):t('outbox.layoutAuto')}}</label>
        <div class="inputwrap mode-toggle">
          <button type="button" :class="['chip',{selected:!outboxManual}]" @click="outboxManual=false">{{t('outbox.layoutAuto')}}</button>
          <button type="button" :class="['chip',{selected:outboxManual}]" @click="outboxManual=true">{{t('outbox.layoutManual')}}</button>
        </div>
      </div>
      <p class="hint dim-meta" v-if="outboxPacking&&!outboxError">{{t('outbox.layoutLabel',{nx:outboxPacking.nx,ny:outboxPacking.ny,nz:outboxPacking.nz})}}{{outboxPacking.rotated?` · ${t('outbox.rotated')}`:''}}</p>
      <template v-if="outboxManual">
        <div class="field"><label>{{t('outbox.nx')}}</label><div class="inputwrap"><input v-model.number="outboxNx" type="number" min="1" max="50" step="1"/></div></div>
        <div class="field"><label>{{t('outbox.ny')}}</label><div class="inputwrap"><input v-model.number="outboxNy" type="number" min="1" max="50" step="1"/></div></div>
        <div class="field"><label>{{t('outbox.nz')}}</label><div class="inputwrap"><input v-model.number="outboxNz" type="number" min="1" max="50" step="1"/></div></div>
        <div class="field"><label>{{t('outbox.rotated')}}</label>
          <div class="inputwrap mode-toggle">
            <button type="button" :class="['chip',{selected:outboxRotated}]" @click="outboxRotated=true">ON</button>
            <button type="button" :class="['chip',{selected:!outboxRotated}]" @click="outboxRotated=false">OFF</button>
          </div>
        </div>
        <p class="hint model-only-hint" v-if="outboxHasMismatch">{{t('outbox.layoutMismatch')}}</p>
      </template>
    </template>

    <template v-else>
      <div class="field"><label>{{t('outbox.catalogPick')}}</label>
        <select class="outbox-select" :value="outboxCatalogPick" @change="applyOutboxCatalogPick($event.target.value)">
          <option value="">{{t('outbox.catalogNone')}}</option>
          <option v-for="opt in outboxCatalogList" :key="opt.id" :value="opt.id">
            #{{opt.sourceNum}} · {{displayPresetLabel(opt)}} · {{opt.length}}×{{opt.width}}×{{opt.height}}
          </option>
        </select>
      </div>
      <div class="field"><label>{{t('outbox.fixedL')}}</label><div class="inputwrap"><input v-model.number="outboxFixedL" type="number" min="80" max="1200" step="1"/><b>mm</b></div></div>
      <div class="field"><label>{{t('outbox.fixedW')}}</label><div class="inputwrap"><input v-model.number="outboxFixedW" type="number" min="60" max="1000" step="1"/><b>mm</b></div></div>
      <div class="field"><label>{{t('outbox.fixedH')}}</label><div class="inputwrap"><input v-model.number="outboxFixedH" type="number" min="40" max="1000" step="1"/><b>mm</b></div></div>
      <p class="hint dim-meta" v-if="outboxPacking&&!outboxError">{{t('outbox.fitResult',{n:outboxPacking.quantity,nx:outboxPacking.nx,ny:outboxPacking.ny,nz:outboxPacking.nz})}}{{outboxPacking.rotated?` · ${t('outbox.rotated')}`:''}}</p>
    </template>

    <div class="outbox-error" v-if="outboxError">
      <p>{{outboxErrorText}}</p>
      <p v-if="outboxErrorHintText">{{outboxErrorHintText}}</p>
    </div>

    <p class="hint dim-meta" v-if="!outboxError&&outboxOuter&&outboxPlan&&outboxPacking">{{t('outbox.mapping',{ol:outboxOuter.length,ow:outboxOuter.width,oh:outboxOuter.height,n:outboxPacking.quantity,nx:outboxPacking.nx,ny:outboxPacking.ny,nz:outboxPacking.nz,il:outboxPlan.inner.length,iw:outboxPlan.inner.width,ih:outboxPlan.inner.height})}}</p>
    <p class="hint dim-meta" v-if="!outboxError&&outboxStats">{{outboxStatsLine}}</p>
    <div class="field"><label>{{t('outbox.gapL')}}</label><div class="inputwrap"><input v-model.number="outboxGapL" type="number" min="0" max="80" step="1"/><b>mm</b></div></div>
    <div class="field"><label>{{t('outbox.gapW')}}</label><div class="inputwrap"><input v-model.number="outboxGapW" type="number" min="0" max="80" step="1"/><b>mm</b></div></div>
    <div class="field"><label>{{t('outbox.gapH')}}</label><div class="inputwrap"><input v-model.number="outboxGapH" type="number" min="0" max="80" step="1"/><b>mm</b></div></div>
    <div class="field"><label>{{t('outbox.thickness')}}</label><div class="inputwrap"><input v-model.number="outboxThickness" type="number" min="0.5" max="12" step="0.5"/><b>mm</b></div></div>
    <div class="field"><label>{{t('outbox.showContents')}}</label>
      <div class="inputwrap mode-toggle">
        <button type="button" :class="['chip',{selected:outboxShowContents}]" @click="outboxShowContents=true">ON</button>
        <button type="button" :class="['chip',{selected:!outboxShowContents}]" @click="outboxShowContents=false">OFF</button>
      </div>
    </div>
    <div class="eyebrow" style="margin-top:14px">{{t('outbox.export')}}</div>
    <p class="hint model-only-hint" v-if="outboxError">{{t('outbox.exportDisabled')}}</p>
    <button class="btn full ghost" type="button" :disabled="!!outboxError||!outboxKnife" @click="downloadOutboxSVG"><Download :size="15"/> {{t('outbox.exportSvg')}}</button>
    <button class="btn full ghost" type="button" :disabled="!!outboxError||!outboxKnife" @click="downloadOutboxDXF"><Download :size="15"/> {{t('outbox.exportDxf')}}</button>
    <button class="btn full ghost" type="button" :disabled="!!outboxError||!outboxKnife" @click="downloadOutboxPDF"><Download :size="15"/> {{t('outbox.exportPdf')}}</button>
    <button class="btn full ghost" type="button" :disabled="!!outboxError||!outboxKnife" @click="downloadOutboxJSON"><Download :size="15"/> {{t('outbox.exportJson')}}</button>
  </template>
  <p v-else-if="outboxEnabled" class="hint">{{t('outbox.hidden')}}</p>
</div>
<div class="section"><div class="eyebrow">{{t('lab.material')}}</div><div class="swatches"><button v-for="(c,name) in {kraft:'#c6a47a',white:'#f4f0e7',blue:'#8aa6c8'}" :key="name" :class="['swatch',{selected:material===name}]" @click="material=name"><i :style="{background:c}"></i>{{materialLabels[name]}}</button></div></div><div class="section bottom"><div class="eyebrow">{{t('lab.export')}}</div><button class="btn full" :disabled="isModelOnly" @click="downloadJSON"><Download :size="15"/> {{t('lab.exportJson')}}</button><button class="btn full ghost" :disabled="isModelOnly" @click="downloadDXF"><Download :size="15"/> {{t('lab.exportDxf')}}</button><button class="btn full ghost" :disabled="isModelOnly" @click="downloadPDF"><Download :size="15"/> {{t('lab.exportPdf')}}</button><button class="btn full ghost" :disabled="isModelOnly" @click="downloadAI"><Download :size="15"/> {{t('lab.exportAi')}}</button><p class="hint contract-status" :class="{ok:knife.validation?.ok,warn:!knife.validation?.ok}">{{contractStatusText}} · productionReady={{knife.productionReady}} · manufacturingReady=false</p><p class="hint">{{t('lab.exportHint',{faces:knife.faces.length,folds:knife.folds.length,cuts:knife.cuts.length})}}</p></div></aside>
<main><div class="panels" :class="{'model-only-lab':isModelOnly}"><section v-if="!isModelOnly" class="panel"><div class="panel-header"><div><div class="eyebrow">{{t('lab.dielineEditor')}}</div><h3>{{geomMode?t('lab.dieline2dOfficial'):t('lab.dieline2dParam')}}</h3></div><div class="pill">{{geomMode?t('lab.pillGeom'):t('lab.pillKnife')}}</div></div><div class="canvas-area"><div class="canvas-controls"><button @click="zoom=Math.min(2,zoom+.15)"><ZoomIn :size="17"/></button><span>{{Math.round(zoom*100)}}%</span><button @click="zoom=Math.max(.4,zoom-.15)"><ZoomOut :size="17"/></button><button @click="zoom=1"><Maximize2 :size="16"/></button></div><svg ref="svgRef" class="dieline" :viewBox="viewBox" preserveAspectRatio="xMidYMid meet" :style="{transform:`scale(${zoom})`}"><path v-for="(d,i) in (showBleed?bleedPaths:[])" :key="'b'+i" :d="d" fill="none" stroke="#46ba00" stroke-width="0.9" opacity=".55"/><path v-for="(d,i) in (showCut?cutPaths:[])" :key="'c'+i" :d="d" fill="none" stroke="#2028b0" stroke-width="2"/><g v-if="showFold" stroke="#fa0000" stroke-width="1.6" stroke-dasharray="6 4"><line v-for="(f,i) in knife.folds" :key="i" :x1="f.x1" :y1="f.y1" :x2="f.x2" :y2="f.y2"/></g><g v-if="showDims" fill="#667085" stroke="#667085" stroke-width="0.9" :font-size="dimFontSize" text-anchor="middle"><line v-for="dl in dimLines" :key="dl.key" :x1="dl.x1" :y1="dl.y1" :x2="dl.x2" :y2="dl.y2"/><polygon v-for="dp in dimPolys" :key="dp.key" :points="dp.points" fill="#667085" stroke="none"/><text v-for="dt in dimTexts" :key="dt.key" :x="dt.x" :y="dt.y" stroke="none" dominant-baseline="middle">{{dt.value}}</text></g></svg></div><div class="legend"><label><input v-model="showCut" type="checkbox"/><i style="background:#2028b0"></i>{{t('lab.legendCut')}}</label><label><input v-model="showFold" type="checkbox"/><i style="background:#fa0000"></i>{{t('lab.legendFold')}}</label><label><input v-model="showBleed" type="checkbox"/><i style="background:#46ba00"></i>{{t('lab.legendBleed',{n:Math.round(bleedEffectiveMm),extra:BLEED_EXTRA_MM})}}</label><label><input v-model="showDims" type="checkbox"/><Eye :size="14"/>{{t('lab.legendDims')}}</label></div></section>
<section class="panel"><div class="panel-header"><div><div class="eyebrow">{{t('lab.livePreview')}}</div><h3>{{t('lab.fold3d')}}</h3></div><span class="pill"><Layers3 :size="14"/> Three.js</span></div><div class="scene-area"><div ref="threeRef" class="three-container"></div><button class="reset-camera" @click="resetView"><RotateCcw :size="15"/> {{t('lab.resetView')}}</button><div class="scene-note">{{t('lab.sceneNote')}}</div></div><div class="fold-controls"><div class="fold-top"><strong>{{t('lab.foldProgress')}}</strong><span>{{progress}}%{{foldStageLabel?` · ${foldStageLabel}`:''}}</span></div><input v-model.number="progress" class="range" type="range" min="0" max="100" step="1"/><div class="range-labels"><span>{{t('lab.unfold0')}}</span><span>{{t('lab.close100')}}</span></div><div class="preset"><button @click="progress=0">{{t('lab.fullOpen')}}</button><button @click="progress=50">{{t('lab.halfFold')}}</button><button @click="progress=100">{{t('lab.fullClose')}}</button></div><p class="fold-status" :class="{ok:foldStatus.ok,warn:!foldStatus.ok}">{{foldStatusText}}</p></div></section></div>
<div v-if="outboxEligible&&outboxError" class="panels outbox-panels">
  <section class="panel outbox-error-panel">
    <div class="panel-header">
      <div><div class="eyebrow">{{t('outbox.title')}}</div><h3>{{t('outbox.preview')}}</h3></div>
      <div class="pill">{{t('outbox.template')}}</div>
    </div>
    <div class="outbox-error">
      <p>{{outboxErrorText}}</p>
      <p v-if="outboxErrorHintText">{{outboxErrorHintText}}</p>
      <p class="hint">{{t('outbox.exportDisabled')}}</p>
    </div>
  </section>
</div>
<div v-else-if="outboxKnife" class="panels outbox-panels">
  <section class="panel">
    <div class="panel-header">
      <div><div class="eyebrow">{{t('outbox.title')}}</div><h3>{{t('outbox.dieline')}}</h3></div>
      <div class="pill">{{t('outbox.template')}}</div>
    </div>
    <div class="canvas-area">
      <div class="canvas-controls">
        <button @click="outboxZoom=Math.min(2,outboxZoom+.15)"><ZoomIn :size="17"/></button>
        <span>{{Math.round(outboxZoom*100)}}%</span>
        <button @click="outboxZoom=Math.max(.4,outboxZoom-.15)"><ZoomOut :size="17"/></button>
        <button @click="outboxZoom=1"><Maximize2 :size="16"/></button>
      </div>
      <svg class="dieline" :viewBox="outboxViewBox" preserveAspectRatio="xMidYMid meet" :style="{transform:`scale(${outboxZoom})`}">
        <path v-for="(d,i) in (showBleed?outboxBleedPaths:[])" :key="'ob'+i" :d="d" fill="none" stroke="#46ba00" stroke-width="0.9" opacity=".55"/>
        <path v-for="(d,i) in (showCut?outboxCutPaths:[])" :key="'oc'+i" :d="d" fill="none" stroke="#2028b0" stroke-width="2"/>
        <g v-if="showFold" stroke="#fa0000" stroke-width="1.6" stroke-dasharray="6 4">
          <line v-for="(f,i) in outboxKnife.folds" :key="'of'+i" :x1="f.x1" :y1="f.y1" :x2="f.x2" :y2="f.y2"/>
        </g>
        <g v-if="showDims" fill="#667085" stroke="#667085" stroke-width="0.9" :font-size="outboxDimFontSize" text-anchor="middle">
          <line v-for="dl in outboxDimLines" :key="dl.key" :x1="dl.x1" :y1="dl.y1" :x2="dl.x2" :y2="dl.y2"/>
          <polygon v-for="dp in outboxDimPolys" :key="dp.key" :points="dp.points" fill="#667085" stroke="none"/>
          <text v-for="dt in outboxDimTexts" :key="dt.key" :x="dt.x" :y="dt.y" stroke="none" dominant-baseline="middle">{{dt.value}}</text>
        </g>
      </svg>
    </div>
    <div class="legend">
      <label><input v-model="showCut" type="checkbox"/><i style="background:#2028b0"></i>{{t('lab.legendCut')}}</label>
      <label><input v-model="showFold" type="checkbox"/><i style="background:#fa0000"></i>{{t('lab.legendFold')}}</label>
      <label><input v-model="showBleed" type="checkbox"/><i style="background:#46ba00"></i>{{t('lab.legendBleed',{n:Math.round(outboxBleedEffectiveMm),extra:BLEED_EXTRA_MM})}}</label>
      <label><input v-model="showDims" type="checkbox"/><Eye :size="14"/>{{t('lab.legendDims')}}</label>
    </div>
  </section>
  <section class="panel">
    <div class="panel-header">
      <div><div class="eyebrow">{{t('outbox.title')}}</div><h3>{{t('outbox.preview')}}</h3></div>
      <span class="pill"><Layers3 :size="14"/> Three.js</span>
    </div>
    <div class="scene-area">
      <div ref="outboxThreeRef" class="three-container"></div>
      <button class="reset-camera" @click="resetOutboxView"><RotateCcw :size="15"/> {{t('lab.resetView')}}</button>
      <div class="scene-note">{{t('outbox.foldNote')}}</div>
    </div>
    <div class="fold-controls">
      <div class="fold-top"><strong>{{t('outbox.foldProgress')}}</strong><span>{{outboxProgress}}%</span></div>
      <input v-model.number="outboxProgress" class="range" type="range" min="0" max="100" step="1"/>
      <div class="range-labels"><span>{{t('lab.unfold0')}}</span><span>{{t('lab.close100')}}</span></div>
      <div class="preset">
        <button type="button" @click="outboxProgress=0">{{t('lab.fullOpen')}}</button>
        <button type="button" @click="outboxProgress=50">{{t('lab.halfFold')}}</button>
        <button type="button" @click="outboxProgress=100">{{t('lab.fullClose')}}</button>
      </div>
    </div>
  </section>
</div>
<div class="notice"><strong>{{t('lab.noticeTitle')}}</strong><span>{{t('lab.noticeBody')}}</span></div></main></div></div>
</template>


