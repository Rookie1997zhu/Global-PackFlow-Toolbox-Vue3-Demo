import data from './presets.js'
import {TEMPLATES} from '../templates/index.js'
import {OFFICIAL_SUBCLASS_DEFS} from './officialSubclasses.js'
import {koSearchAliases,CATALOG_KO} from '../i18n/catalogKo.js'

export const PRESET_CATALOG=data
export const PRESETS=Object.freeze(data.presets||[])

/** 粗分类 — 导入目录仅运输箱 */
export const IMPORT_CATEGORIES=Object.freeze(
  (data.categories||[
    {id:'shipping',label:'运输箱'}
  ]).map(c=>({...c,count:c.count??PRESETS.filter(p=>p.categoryId===c.id).length}))
)

/** Pacdora 风格官方盒子子类（导入目录细分；一条可属多个） */
export const OFFICIAL_SUBCLASSES=Object.freeze(
  (data.officialSubclasses||OFFICIAL_SUBCLASS_DEFS.map(d=>({...d,count:0}))).map(c=>({
    ...c,
    count:c.count??PRESETS.filter(p=>(p.subclassIds||[]).includes(c.id)).length
  }))
)

export const UNCLASSIFIED_SUBCLASS_COUNT=PRESETS.filter(p=>!(p.subclassIds||[]).length).length

/** 已有刀版按结构分组 */
export const OWNED_GROUPS=Object.freeze([
  {id:'mailer',label:'翻盖邮寄',templateIds:['mailer-parametric-demo','fefco-0427','mailer-aircraft']},
  {id:'tuck',label:'插舌盒',templateIds:['tuck-end-straight','tuck-end-reverse','tuck-window','hanging-tuck','zipper-tuck']},
  {id:'rsc',label:'开槽纸箱',templateIds:['fefco-0201']},
  {id:'autolock',label:'锁底盒',templateIds:['auto-lock-bottom','handle-box']},
  {id:'lid-base',label:'天地盖',templateIds:['lid-base']},
  {id:'drawer',label:'抽屉袖套',templateIds:['sleeve','drawer-tray']},
  {id:'food',label:'食品翻盖',templateIds:['pizza-clamshell']},
  {id:'gift',label:'礼盒展示',templateIds:['magnetic-rigid','display-pdq']},
  {id:'polygon',label:'多边形',templateIds:['polygon-tray']},
  {id:'rea',label:'REA 参数化',templateIds:[
    'rea-aircraft','rea-carton-0201','rea-pair-ste','rea-pair-rte','rea-pair-window','rea-pair-hook',
    'rea-buckle-nail','rea-cover-basset','rea-bufferwall','rea-roofflat-handle',
    'rea-display-multi','rea-double-door-lock','rea-tear-self-lock','rea-curve-box',
    'rea-flat-sheet','rea-star-box'
  ]}
])

export function ownedGroupsWithTemplates(){
  return OWNED_GROUPS.map(g=>({
    ...g,
    templates:g.templateIds.map(id=>TEMPLATES[id]).filter(Boolean)
  })).filter(g=>g.templates.length)
}

export function presetsForTemplate(templateId){
  return PRESETS.filter(p=>p.templateId===templateId)
}

export function getPreset(id){
  return PRESETS.find(p=>p.id===id)||null
}

/**
 * 导入尺寸目录筛选
 * @param {string} query
 * @param {{categoryId?:string,subclassId?:string,modelOnly?:boolean|'only'|'',limit?:number}} opts
 *   subclassId: 官方子类 id；'__none__' = 未归类；'' = 全部
 *   modelOnly: true/'only' = 仅 3D 样机；false = 排除样机；缺省不过滤
 */
export function searchImportedPresets(query='',{categoryId='',subclassId='',modelOnly,limit=100}={}){
  const q=String(query||'').trim().toLowerCase()
  let list=PRESETS
  // 双保险：导入目录默认只暴露运输箱
  const cat=categoryId||'shipping'
  list=list.filter(p=>p.categoryId===cat)
  if(subclassId==='__none__')list=list.filter(p=>!(p.subclassIds||[]).length)
  else if(subclassId)list=list.filter(p=>(p.subclassIds||[]).includes(subclassId))
  if(modelOnly===true||modelOnly==='only')list=list.filter(p=>!!p.modelOnly)
  else if(modelOnly===false)list=list.filter(p=>!p.modelOnly)
  if(q){
    list=list.filter(p=>{
      if(String(p.sourceNum).includes(q))return true
      if(p.label.toLowerCase().includes(q))return true
      if((p.templateId||'').includes(q))return true
      if((p.categoryLabel||'').includes(q))return true
      if((p.subclassLabels||[]).some(l=>String(l).toLowerCase().includes(q)))return true
      // 韩文显示名 / 子类别名（切语言后仍可按中文或韩文搜；编号始终可搜）
      return koSearchAliases(p).some(a=>a.toLowerCase().includes(q))
        ||(p.subclassIds||[]).some(id=>{
          const ko=CATALOG_KO.subclasses[id]
          return ko&&ko.toLowerCase().includes(q)
        })
    })
  }
  // 全部视图：样机排到后面
  if(modelOnly==null||modelOnly===''){
    list=[...list].sort((a,b)=>(a.modelOnly?1:0)-(b.modelOnly?1:0))
  }
  return list.slice(0,limit)
}

export function countModelOnly(){
  return PRESETS.filter(p=>p.modelOnly).length
}

const OUTBOX_PREFERRED_TEMPLATES=new Set(['rea-carton-0201','fefco-0201'])

/**
 * 外箱固定尺寸模式下的运输箱目录选项
 * 开槽箱模板优先；排除纯样机与无效尺寸
 * @returns {Array<{id:string,sourceNum:string,label:string,length:number,width:number,height:number,templateId:string,preferred:boolean}>}
 */
export function outboxCatalogOptions(){
  const list=PRESETS.filter(p=>{
    if(p.categoryId&&p.categoryId!=='shipping')return false
    if(p.modelOnly)return false
    const L=Number(p.length),W=Number(p.width),H=Number(p.height)
    return L>0&&W>0&&H>0
  }).map(p=>({
    id:p.id,
    sourceNum:String(p.sourceNum||''),
    label:p.label||'',
    length:Number(p.length),
    width:Number(p.width),
    height:Number(p.height),
    templateId:p.templateId||'',
    preferred:OUTBOX_PREFERRED_TEMPLATES.has(p.templateId)
  }))
  list.sort((a,b)=>{
    if(a.preferred!==b.preferred)return a.preferred?-1:1
    return String(a.sourceNum).localeCompare(String(b.sourceNum),'en',{numeric:true})
  })
  return list
}
