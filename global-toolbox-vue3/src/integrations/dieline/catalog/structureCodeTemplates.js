/**
 * 结构 code → REA 参数化 templateId（精确映射 + 可选前缀族）。
 * 前缀族默认关闭，apply 脚本可用 --prefixes 开启并打印命中清单。
 */

export const STRUCTURE_CODE_EXACT=Object.freeze({
  Aircraft:'rea-aircraft',
  AircraftNew:'rea-aircraft',
  AircraftP1:'rea-aircraft',
  AircraftWithHook:'rea-aircraft',
  Carton:'rea-carton-0201',
  Pair:'rea-pair-ste',
  PairHorizontal:'rea-pair-rte',
  PairHorizontalOne:'rea-pair-rte',
  PairWithWindow:'rea-pair-window',
  PairWithWindowTwo:'rea-pair-window',
  PairWithWindowLockExtension:'rea-pair-window',
  PairWithWindowHookLock:'rea-pair-window',
  PairWithHook:'rea-pair-hook',
  DustWingHookForwardLockBox:'rea-pair-hook',
  BuckleWithNailOne:'rea-buckle-nail',
  CoverBassetCardboardBox:'rea-cover-basset',
  Bufferwallbox:'rea-bufferwall',
  // Cover*+Window 启发式会误伤缓冲墙对盖抽屉
  CoverWindowBufferwallboxDrawer:'rea-bufferwall',
  RoofflatHandleBuckle:'rea-roofflat-handle',
  MultiFunctionDisplayBox:'rea-display-multi',
  // 自锁底 + 顶盖板的管式展示盒，不是开顶托盘
  FlipLockDisplayBox:'auto-lock-bottom',
  DoubleDoorLockBottomBoxP1:'rea-double-door-lock',
  FullCoverSelfLockingTearFlatStickyBox:'rea-tear-self-lock',
  CurveBox:'rea-curve-box',
  CanCylinder:'rea-flat-sheet',
  BoutiqueBoxDrawerCoveredMain:'sleeve-drawer',
  BoutiqueBoxDrawerCoveredMainThree:'sleeve-drawer',
  DoubleOpenToPullDrawerBox:'sleeve-drawer',
  StripInnerHoleDrawerBox:'sleeve-drawer',
  FoldCornerCardPaperToDisplayDrawerBox:'sleeve-drawer',
  StarBox:'rea-star-box',
  StarBoxOne:'rea-star-box',
  StarBoxTwo:'rea-star-box',
  StarBoxThree:'rea-star-box',
  StarBoxFour:'rea-star-box',
  StarBoxFive:'rea-star-box',
  StarBoxSix:'rea-star-box',
  StarBoxSeven:'rea-star-box',
  StarBoxEight:'rea-star-box'
})

/** StarBox* code → 默认角数 P（与金样 HS 计数对齐） */
export const STARBOX_POINTS_BY_CODE=Object.freeze({
  StarBoxOne:3,
  StarBoxTwo:4,
  StarBox:5,
  StarBoxThree:6,
  StarBoxFour:7,
  StarBoxFive:8,
  StarBoxSix:9,
  StarBoxSeven:10,
  StarBoxEight:11
})

/**
 * 前缀族：按最长前缀匹配。
 * apply-structure-code-templates.mjs --prefixes 启用；盖子错挂修复默认建议开启。
 * 顺序无关（按 prefix.length 取最长）；Hook/Window 变体须长于裸 Pair。
 */
export const STRUCTURE_CODE_PREFIXES=Object.freeze([
  {prefix:'Aircraft',templateId:'rea-aircraft'},
  {prefix:'Carton',templateId:'rea-carton-0201'},
  {prefix:'CoverBasset',templateId:'rea-cover-basset'},
  {prefix:'PairWithWindowHook',templateId:'rea-pair-window'},
  {prefix:'PairWithWindow',templateId:'rea-pair-window'},
  {prefix:'PairWithHook',templateId:'rea-pair-hook'},
  {prefix:'DustWingHook',templateId:'rea-pair-hook'},
  {prefix:'BuckleWithNail',templateId:'rea-buckle-nail'},
  {prefix:'Bufferwall',templateId:'rea-bufferwall'},
  {prefix:'CurveBox',templateId:'rea-curve-box'},
  {prefix:'StarBox',templateId:'rea-star-box'},
  {prefix:'PairHorizontal',templateId:'rea-pair-rte'},
  {prefix:'Pair',templateId:'rea-pair-ste'},
  {prefix:'CanCylinder',templateId:'rea-flat-sheet'}
])

export function resolveStructureTemplate(code,{usePrefixes=false}={}){
  const c=String(code||'').trim()
  if(!c)return null
  if(STRUCTURE_CODE_EXACT[c])return STRUCTURE_CODE_EXACT[c]
  if(!usePrefixes)return null
  // 含 Hook / Window / Aircraft / Cover 的变体（不依赖严格前缀）
  if(/Hook/i.test(c)){
    if(/Window/i.test(c))return 'rea-pair-window'
    return 'rea-pair-hook'
  }
  if(/Window/i.test(c)&&/Pair|Tuck|Lock|Box/i.test(c)&&!/Bufferwall/i.test(c))return 'rea-pair-window'
  if(/Aircraft/i.test(c))return 'rea-aircraft'
  if(/DrawerCovered|DrawerMain/i.test(c))return 'sleeve-drawer'
  if(/^Cover/i.test(c)||/CoverBasset|CoverBox|CoveredMain/i.test(c))return 'rea-cover-basset'
  let best=null
  for(const row of STRUCTURE_CODE_PREFIXES){
    if(c===row.prefix||c.startsWith(row.prefix)){
      if(!best||row.prefix.length>best.prefix.length)best=row
    }
  }
  return best?.templateId||null
}

/** 各 REA 模板建议加入的官方子类 EXPECTED */
export const REA_EXPECTED_BY_SUBCLASS=Object.freeze({
  mailer:['rea-aircraft'],
  folding:['rea-aircraft','rea-pair-ste','rea-pair-rte','rea-tear-self-lock'],
  shipping:['rea-carton-0201'],
  product:['rea-pair-ste','rea-pair-rte'],
  tuck:['rea-pair-ste','rea-pair-rte','rea-pair-window','rea-pair-hook'],
  window:['rea-pair-window'],
  hanging:['rea-pair-hook'],
  handle:['rea-roofflat-handle'],
  lid:['rea-cover-basset','cylinder-box'],
  square:['rea-cover-basset'],
  gift:['rea-buckle-nail','rea-cover-basset','cylinder-box'],
  'sleeve-tray':['rea-bufferwall','sleeve-drawer'],
  display:['rea-display-multi'],
  polygon:['rea-curve-box','rea-double-door-lock','rea-star-box','cylinder-box'],
  food:['rea-pair-ste'],
  other:['rea-tear-self-lock','rea-flat-sheet','cylinder-box']
})

/**
 * KnifePrototype 名称分流（非权威；仍须过 EXPECTED，不通过则 correct 回退）
 * 每条：{re, templateId, rule}
 */
export const PROTOTYPE_NAME_RULES=Object.freeze([
  {re:/round|circle|cylind|tube|oval|圆/i,templateId:'cylinder-box',rule:'cylinder-round'},
  {re:/tissue|纸巾|tuck\s*end/i,templateId:'rea-pair-ste',rule:'tissue/tuck'},
  {re:/flip\s*top|cigarette|烟盒/i,templateId:'rea-pair-rte',rule:'flip-top-cigarette'},
  {re:/mailer|飞机|aircraft/i,templateId:'rea-aircraft',rule:'mailer'},
  {re:/burger|clamshell|汉堡/i,templateId:'pizza-clamshell',rule:'burger-clamshell'},
  {re:/gift|礼盒|lid|base|天地/i,templateId:'rea-cover-basset',rule:'gift-lid'},
  {re:/window|开窗/i,templateId:'rea-pair-window',rule:'window'},
  {re:/hang|挂孔|hook/i,templateId:'rea-pair-hook',rule:'hang'},
  {re:/handle|提手/i,templateId:'rea-roofflat-handle',rule:'handle'},
  {re:/display|展示|pdq/i,templateId:'rea-display-multi',rule:'display'},
  {re:/milk\s*carton|砖型/i,templateId:'rea-carton-0201',rule:'milk-carton'}
])

export function resolvePrototypeTemplate(name){
  const s=String(name||'')
  for(const row of PROTOTYPE_NAME_RULES){
    if(row.re.test(s))return {templateId:row.templateId,rule:row.rule}
  }
  return null
}
