/**
 * 官方子类 ↔ 合理模板规则（诊断与纠错共用）。
 * plastic/other 不参与纠错；EXPECTED 为空数组表示「预期大量未映射」。
 */

/** 子类 → 预期合理的 templateId；不在列表内算疑似错挂 */
export const EXPECTED=Object.freeze({
  square:Object.freeze(['lid-base','magnetic-rigid','tuck-end-straight','tuck-end-reverse','auto-lock-bottom','fefco-0201','rea-cover-basset','rea-pair-ste','rea-pair-hook','rea-buckle-nail']),
  // gift：开顶 PDQ 仅明确展示名时由 pickTemplate 选择；白名单不再默认放行 display-pdq
  gift:Object.freeze(['lid-base','magnetic-rigid','tuck-end-straight','tuck-end-reverse','auto-lock-bottom','handle-box','rea-buckle-nail','rea-cover-basset','rea-pair-ste','cylinder-box']),
  mailer:Object.freeze(['mailer-parametric-demo','fefco-0427','mailer-aircraft','fefco-0201','rea-aircraft']),
  shipping:Object.freeze(['fefco-0201','mailer-parametric-demo','fefco-0427','mailer-aircraft','auto-lock-bottom','rea-carton-0201']),
  product:Object.freeze(['tuck-end-straight','tuck-end-reverse','auto-lock-bottom','tuck-window','hanging-tuck','lid-base','rea-pair-ste','rea-pair-rte','rea-pair-window','rea-pair-hook']),
  food:Object.freeze(['pizza-clamshell','drawer-tray','tuck-end-straight','fefco-0201','rea-pair-ste']),
  // 展示盒：保留 PDQ/托盘白名单，但 window/hanging/tuck 主子类优先纠错
  display:Object.freeze(['tuck-end-straight','tuck-end-reverse','auto-lock-bottom','tuck-window','lid-base','magnetic-rigid','mailer-aircraft','handle-box','display-pdq','drawer-tray','sleeve','polygon-tray','hanging-tuck','rea-display-multi','rea-pair-window','rea-pair-hook','rea-pair-ste']),
  folding:Object.freeze(['tuck-end-straight','tuck-end-reverse','auto-lock-bottom','tuck-window','zipper-tuck','hanging-tuck','rea-aircraft','rea-pair-ste','rea-pair-rte','rea-tear-self-lock','rea-pair-window']),
  'sleeve-tray':Object.freeze(['sleeve','drawer-tray','sleeve-drawer','display-pdq','lid-base','polygon-tray','rea-bufferwall']),
  // 有盖特征子类：禁止 display-pdq 被当成「合理」而跳过纠错
  window:Object.freeze(['tuck-window','hanging-tuck','tuck-end-straight','rea-pair-window','rea-pair-hook']),
  handle:Object.freeze(['handle-box','fefco-0201','auto-lock-bottom','tuck-end-straight','rea-roofflat-handle']),
  lid:Object.freeze(['lid-base','magnetic-rigid','fefco-0427','mailer-parametric-demo','rea-cover-basset','cylinder-box']),
  hanging:Object.freeze(['hanging-tuck','tuck-window','tuck-end-straight','rea-pair-hook','rea-pair-window']),
  tuck:Object.freeze(['tuck-end-straight','tuck-end-reverse','auto-lock-bottom','tuck-window','hanging-tuck','zipper-tuck','rea-pair-ste','rea-pair-rte','rea-pair-window','rea-pair-hook']),
  // 多边形：默认有盖；开顶 tray 仅明确托盘
  polygon:Object.freeze(['tuck-end-straight','tuck-window','lid-base','mailer-aircraft','auto-lock-bottom','polygon-tray','drawer-tray','rea-curve-box','rea-double-door-lock','rea-star-box','cylinder-box']),
  plastic:Object.freeze([]),
  other:null
})

/** 多子类时特征越具体越优先（数字越小越优先） */
export const SUBCLASS_PRIORITY=Object.freeze({
  hanging:1,
  window:2,
  handle:3,
  polygon:4,
  lid:5,
  mailer:6,
  shipping:7,
  food:8,
  'sleeve-tray':9,
  display:10,
  tuck:11,
  folding:12,
  product:13,
  gift:14,
  square:15
  // plastic / other 不参与
})

const SKIP_CORRECT=new Set(['plastic','other'])

/** 从所属子类中取主子类（最具体）；无可纠错子类返回 null */
export function primarySubclass(subclassIds=[]){
  let best=null,bestRank=Infinity
  for(const id of subclassIds){
    if(SKIP_CORRECT.has(id))continue
    if(!(id in SUBCLASS_PRIORITY))continue
    const r=SUBCLASS_PRIORITY[id]
    if(r<bestRank){bestRank=r;best=id}
  }
  return best
}

/** 当前模板是否落在任一可纠错所属子类的合理列表中（plastic/other 跳过） */
export function templateFitsAnySubclass(templateId,subclassIds=[]){
  if(!templateId)return false
  for(const id of subclassIds){
    const exp=EXPECTED[id]
    if(!Array.isArray(exp)||!exp.length)continue
    if(exp.includes(templateId))return true
  }
  return false
}

/**
 * 按主子类 + 名称/结构 code 选出目标模板
 * @returns {string|null}
 */
export function pickTemplate(subclassId,label='',structureCode=''){
  if(!subclassId||SKIP_CORRECT.has(subclassId))return null
  const s=`${label} ${structureCode}`.toLowerCase()

  switch(subclassId){
    case 'mailer':
      if(/aircraft|飞机/.test(s))return 'mailer-aircraft'
      if(/0201|rsc|slotted/.test(s))return 'fefco-0201'
      if(/rollover|parametric|150010/.test(s))return 'mailer-parametric-demo'
      return 'fefco-0427'
    case 'shipping':
      return 'fefco-0201'
    case 'lid':
    case 'square':
      if(/magnetic|磁吸|boutique|rigid/.test(s))return 'magnetic-rigid'
      return 'lid-base'
    case 'handle':
      return 'handle-box'
    case 'polygon':
      // 开顶托盘仅留给明确托盘/开顶；有盖/插舌/挂孔优先有盖模板，减轻「多边形全开顶」挤挂
      if(/flip\s*top|翻盖|mailer|飞机|aircraft/.test(s))return /mailer|飞机|aircraft/.test(s)?'mailer-aircraft':'tuck-end-straight'
      if(/snap.?lock|swing.?top|auto.?lock|锁底|锁扣/.test(s))return 'auto-lock-bottom'
      if(/open\s*top|tray|托盘|pdq|counter/.test(s)&&!/lid|cover|tuck|盖|插舌|插口|flip|翻盖|mailer|snap|swing|lock|锁/.test(s))return 'polygon-tray'
      if(/star|星形/.test(s))return 'rea-star-box'
      if(/curve|曲线/.test(s))return 'rea-curve-box'
      if(/double\s*door|双开/.test(s))return 'rea-double-door-lock'
      if(/lid|cover|天地|磁吸|magnetic|rigid|flip/.test(s))return 'lid-base'
      if(/window|开窗/.test(s))return 'tuck-window'
      if(/tuck|插舌|插口|fold/.test(s))return 'tuck-end-straight'
      return 'tuck-end-straight'
    case 'food':
      if(/pizza|burger|hot\s*dog|clamshell|食品翻盖|快餐/.test(s))return 'pizza-clamshell'
      if(/\btray\b|托盘/.test(s))return 'drawer-tray'
      if(/display|pdq|展示/.test(s)&&!/tuck|lid|盖|插/.test(s))return 'display-pdq'
      return 'tuck-end-straight'
    case 'folding':
      if(/reverse/.test(s))return 'tuck-end-reverse'
      if(/auto.?lock|crash.?lock|snap.?lock|锁底|自锁/.test(s))return 'auto-lock-bottom'
      if(/zipper|拉链/.test(s))return 'zipper-tuck'
      if(/window|开窗/.test(s))return 'tuck-window'
      if(/hang|挂孔/.test(s))return 'hanging-tuck'
      return 'tuck-end-straight'
    case 'window':
      return 'tuck-window'
    case 'hanging':
      if(/window|开窗/.test(s))return 'tuck-window'
      if(/hook|euro|挂孔/.test(s)&&/pair|rea/.test(s))return 'rea-pair-hook'
      if(/slim|medicine|药/.test(s))return 'hanging-tuck'
      return 'hanging-tuck'
    case 'sleeve-tray':
      if(/sleeve|套筒|外袖|滑套/.test(s))return 'sleeve'
      if(/display|pdq|展示/.test(s)&&!/tuck|lid|盖/.test(s))return 'display-pdq'
      if(/polygon|多边/.test(s)&&/tray|托盘|open/.test(s))return 'polygon-tray'
      if(/lid|盖|天地/.test(s))return 'lid-base'
      return 'drawer-tray'
    case 'display':
      // 默认改为有盖插舌，避免大量展示盒挤挂成开顶 PDQ（「没有盖子」主因之一）
      if(/mailer|飞机|aircraft/.test(s))return 'mailer-aircraft'
      if(/flip\s*top|翻盖/.test(s))return 'tuck-end-straight'
      if(/handle|提手|手提/.test(s))return 'handle-box'
      if(/sleeve|套筒/.test(s)&&!/tuck|lid|盖|flip|插/.test(s))return 'sleeve'
      if(/\bpdq\b|counter\s*display|open\s*top|开顶/.test(s)&&!/tuck|lid|盖|flip|插舌|handle|提手/.test(s))return 'display-pdq'
      if(/drawer|tray|托盘/.test(s)&&!/tuck|lid|盖|插舌|flip|翻盖|mailer|handle|提手/.test(s))return 'drawer-tray'
      if(/window|开窗/.test(s))return 'tuck-window'
      if(/\bhang(ing|er)?\b|挂孔|挂盒/.test(s))return 'hanging-tuck'
      if(/polygon|多边/.test(s)&&/tray|托盘/.test(s)&&!/flip|lid|盖|mailer/.test(s))return 'polygon-tray'
      if(/lid|cover|天地|磁吸|magnetic|rigid/.test(s))return /magnetic|磁吸|rigid/.test(s)?'magnetic-rigid':'lid-base'
      if(/auto.?lock|锁底|snap.?lock/.test(s))return 'auto-lock-bottom'
      if(/reverse/.test(s))return 'tuck-end-reverse'
      return 'tuck-end-straight'
    case 'tuck':
      if(/reverse/.test(s))return 'tuck-end-reverse'
      if(/auto.?lock|crash|snap.?lock|锁底/.test(s))return 'auto-lock-bottom'
      if(/window|开窗/.test(s))return 'tuck-window'
      if(/hang|挂孔/.test(s))return 'hanging-tuck'
      if(/zipper|拉链/.test(s))return 'zipper-tuck'
      return 'tuck-end-straight'
    case 'product':
      if(/window|开窗/.test(s))return 'tuck-window'
      if(/hang|挂/.test(s))return 'hanging-tuck'
      if(/lid|盖/.test(s))return 'lid-base'
      if(/auto.?lock|锁底/.test(s))return 'auto-lock-bottom'
      if(/reverse/.test(s))return 'tuck-end-reverse'
      return 'tuck-end-straight'
    case 'gift':
      if(/magnetic|磁吸|rigid|boutique/.test(s))return 'magnetic-rigid'
      if(/lid|盖|天地/.test(s))return 'lid-base'
      if(/handle|提手/.test(s))return 'handle-box'
      if(/display|展示/.test(s))return 'display-pdq'
      if(/auto.?lock|锁底/.test(s))return 'auto-lock-bottom'
      return 'tuck-end-straight'
    default:
      return null
  }
}

export function shouldCorrectSubclass(subclassId){
  if(!subclassId||SKIP_CORRECT.has(subclassId))return false
  const exp=EXPECTED[subclassId]
  return Array.isArray(exp)&&exp.length>0
}
