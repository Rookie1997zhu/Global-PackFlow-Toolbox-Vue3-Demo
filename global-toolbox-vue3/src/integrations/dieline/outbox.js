/**
 * INBOX → OUTBOX 尺寸联动 + 每箱数量排布
 * 外箱默认 rea-carton-0201（与运输箱目录 200010 对齐的参数化 0201）
 *
 * sizingMode:
 *  - grow  : 按内盒×数量算外箱；超模板上限则 error=overLimit，不静默夹紧
 *  - fixed : 固定外箱内空，算最多能装几盒
 */
import {createKnife} from './knife.js'
import {getTemplate} from './templates/index.js'

export const OUTBOX_TEMPLATE_ID='rea-carton-0201'
export const DEFAULT_OUTBOX_GAP=Object.freeze({length:5,width:5,height:5})
export const DEFAULT_OUTBOX_THICKNESS=3

function roundUpMm(n){
  const v=Number(n)
  if(!Number.isFinite(v)||v<=0)return 0
  return Math.ceil(v)
}

function liters2(mm3){
  return Math.round((Number(mm3)||0)/10000)/100 // L with 2 decimals
}

/** 从内盒 knife 取外廓；缺省回退 length/width/height */
export function inboxOuterDims(knife){
  if(!knife)return null
  const d=knife.dimensions||{}
  const outer=d.outer||{}
  let length=Number(outer.length)
  let width=Number(outer.width)
  let height=Number(outer.height)
  if(!(length>0))length=Number(d.length)||0
  if(!(width>0))width=Number(d.width)||0
  if(!(height>0))height=Number(d.height)||0
  if(!(length>0&&width>0&&height>0))return null
  return {length,width,height}
}

/**
 * 是否可为该内盒生成外箱
 * @param {{knife?:object,modelOnly?:boolean,flatHeight?:boolean,enabled?:boolean}} opts
 */
export function canBuildOutbox({knife,modelOnly=false,flatHeight=false,enabled=true}={}){
  if(!enabled)return false
  if(modelOnly)return false
  if(flatHeight)return false
  if(!knife?.faces?.length)return false
  return !!inboxOuterDims(knife)
}

function normalizeGap(gap=DEFAULT_OUTBOX_GAP){
  return {
    length:Math.max(0,Number(gap.length)||0),
    width:Math.max(0,Number(gap.width)||0),
    height:Math.max(0,Number(gap.height)||0)
  }
}

/** 模板 limits；缺省回退 0201 官方范围 */
export function outboxLimits(){
  const tpl=getTemplate(OUTBOX_TEMPLATE_ID)
  const lim=tpl?.limits||{}
  return {
    length:Array.isArray(lim.length)&&lim.length.length>=2?lim.length:[80,1200],
    width:Array.isArray(lim.width)&&lim.width.length>=2?lim.width:[60,1000],
    height:Array.isArray(lim.height)&&lim.height.length>=2?lim.height:[40,1000]
  }
}

export function withinLimits(inner){
  if(!inner)return false
  const lim=outboxLimits()
  for(const key of ['length','width','height']){
    const range=lim[key]
    const v=Number(inner[key])
    if(!(v>=range[0]&&v<=range[1]))return false
  }
  return true
}

/** 相对模板上限的超出量（mm）；未超的边为 0 */
export function overflowAgainstLimits(inner){
  const lim=outboxLimits()
  const overflow={length:0,width:0,height:0}
  for(const key of ['length','width','height']){
    const v=Number(inner[key])||0
    const hi=lim[key][1]
    overflow[key]=v>hi?Math.round((v-hi)*10)/10:0
  }
  return overflow
}

function rawInnerFromPack(cell,gap,nx,ny,nz){
  const g=normalizeGap(gap)
  return {
    length:roundUpMm(nx*cell.length+2*g.length),
    width:roundUpMm(ny*cell.width+2*g.width),
    height:roundUpMm(nz*cell.height+2*g.height)
  }
}

function cellOrients(outer){
  const base={length:outer.length,width:outer.width,height:outer.height}
  const orients=[
    {rotated:false,cell:{...base}},
    {rotated:true,cell:{length:base.width,width:base.length,height:base.height}}
  ]
  const uniq=[]
  const seen=new Set()
  for(const o of orients){
    const key=`${o.cell.length}x${o.cell.width}x${o.cell.height}`
    if(seen.has(key))continue
    seen.add(key)
    uniq.push(o)
  }
  return uniq
}

/**
 * 枚举 nx*ny*nz===N 的因数组合；每种试 L/W 互换（直立不侧放）
 */
export function packingCandidates(outer,N=1){
  const n=Math.max(1,Math.floor(Number(N)||1))
  const out=[]
  for(let nx=1;nx<=n;nx++){
    if(n%nx)continue
    const rem=n/nx
    for(let ny=1;ny<=rem;ny++){
      if(rem%ny)continue
      const nz=rem/ny
      for(const o of cellOrients(outer)){
        out.push({
          nx,ny,nz:Math.floor(nz),
          rotated:o.rotated,
          cell:{...o.cell},
          quantity:n
        })
      }
    }
  }
  return out
}

/**
 * 自动选最省体积；手动覆盖时校验乘积
 * 全部超限时返回 {error:'overLimit', overflow, bestAttempt, ...}
 * @returns {object|null}
 */
export function choosePacking(outer,N=1,gap=DEFAULT_OUTBOX_GAP,{manual=null}={}){
  if(!outer)return null
  const n=Math.max(1,Math.floor(Number(N)||1))
  const g=normalizeGap(gap)
  const warnings=[]

  if(manual&&manual.nx&&manual.ny&&manual.nz){
    const nx=Math.max(1,Math.floor(Number(manual.nx)||1))
    const ny=Math.max(1,Math.floor(Number(manual.ny)||1))
    const nz=Math.max(1,Math.floor(Number(manual.nz)||1))
    const rotated=!!manual.rotated
    const cell=rotated
      ?{length:outer.width,width:outer.length,height:outer.height}
      :{length:outer.length,width:outer.width,height:outer.height}
    if(nx*ny*nz!==n)warnings.push('layoutMismatch')
    const rawInner=rawInnerFromPack(cell,g,nx,ny,nz)
    if(!withinLimits(rawInner)){
      return {
        nx,ny,nz,rotated,cell,quantity:n,mode:'manual',warnings,
        rawInner,
        score:rawInner.length*rawInner.width*rawInner.height,
        error:'overLimit',
        overflow:overflowAgainstLimits(rawInner)
      }
    }
    return {
      nx,ny,nz,rotated,cell,quantity:n,mode:'manual',warnings,
      rawInner,
      score:rawInner.length*rawInner.width*rawInner.height
    }
  }

  const cands=packingCandidates(outer,n)
  let best=null
  let bestAttempt=null
  for(const c of cands){
    const rawInner=rawInnerFromPack(c.cell,g,c.nx,c.ny,c.nz)
    const vol=rawInner.length*rawInner.width*rawInner.height
    const area=2*(rawInner.length*rawInner.width+rawInner.length*rawInner.height+rawInner.width*rawInner.height)
    if(!bestAttempt||vol<bestAttempt.score||(vol===bestAttempt.score&&area<bestAttempt.tie)){
      bestAttempt={...c,rawInner,score:vol,tie:area,mode:'auto',warnings:[]}
    }
    if(!withinLimits(rawInner))continue
    if(!best||vol<best.score||(vol===best.score&&area<best.tie)){
      best={...c,rawInner,score:vol,tie:area,mode:'auto',warnings:[]}
    }
  }
  if(best)return best
  if(!bestAttempt)return null
  return {
    ...bestAttempt,
    error:'overLimit',
    overflow:overflowAgainstLimits(bestAttempt.rawInner)
  }
}

/**
 * 固定外箱内空下，最多能装多少内盒（直立，可选 L/W 旋转）
 * @returns {{nx,ny,nz,rotated,cell,quantity,mode:'fixed',warnings:string[],rawInner}|{error:'noneFit'|'fixedOutOfRange',...}|null}
 */
export function fitInFixedOutbox(outer,fixedInner,gap=DEFAULT_OUTBOX_GAP){
  if(!outer||!fixedInner)return null
  const g=normalizeGap(gap)
  const inner={
    length:Number(fixedInner.length)||0,
    width:Number(fixedInner.width)||0,
    height:Number(fixedInner.height)||0
  }
  if(!(inner.length>0&&inner.width>0&&inner.height>0)){
    return {error:'fixedOutOfRange',quantity:0,overflow:overflowAgainstLimits(inner),rawInner:inner}
  }
  if(!withinLimits(inner)){
    return {
      error:'fixedOutOfRange',
      quantity:0,
      overflow:overflowAgainstLimits(inner),
      rawInner:inner,
      mode:'fixed',
      warnings:[]
    }
  }
  const usable={
    length:inner.length-2*g.length,
    width:inner.width-2*g.width,
    height:inner.height-2*g.height
  }
  let best=null
  for(const o of cellOrients(outer)){
    const cell=o.cell
    if(!(cell.length>0&&cell.width>0&&cell.height>0))continue
    const nx=Math.floor(usable.length/cell.length)
    const ny=Math.floor(usable.width/cell.width)
    const nz=Math.floor(usable.height/cell.height)
    if(nx<1||ny<1||nz<1)continue
    const quantity=nx*ny*nz
    const occVol=quantity*cell.length*cell.width*cell.height
    const cavityVol=inner.length*inner.width*inner.height
    const fill=cavityVol>0?occVol/cavityVol:0
    if(
      !best
      ||quantity>best.quantity
      ||(quantity===best.quantity&&fill>best.fill)
    ){
      best={
        nx,ny,nz,
        rotated:o.rotated,
        cell:{...cell},
        quantity,
        mode:'fixed',
        warnings:[],
        rawInner:{...inner},
        fill,
        score:cavityVol
      }
    }
  }
  if(!best){
    return {
      error:'noneFit',
      quantity:0,
      mode:'fixed',
      warnings:[],
      rawInner:{...inner},
      overflow:{length:0,width:0,height:0}
    }
  }
  return best
}

/** 在模板最大内空下能装的最多盒数 */
export function maxQuantityWithinLimits(outer,gap=DEFAULT_OUTBOX_GAP){
  if(!outer)return 0
  const lim=outboxLimits()
  const maxInner={
    length:lim.length[1],
    width:lim.width[1],
    height:lim.height[1]
  }
  const fit=fitInFixedOutbox(outer,maxInner,gap)
  if(!fit||fit.error)return 0
  return fit.quantity||0
}

/**
 * 外箱内空 = 排布占用 + 2×间隙
 * grow 模式调用方已保证 withinLimits；此处仍可 clamp 作防御，但标记 clamped
 * fixed 模式直接使用 fixedInner
 */
export function computeOutboxSize(outer,gap=DEFAULT_OUTBOX_GAP,packing=null,{fixedInner=null}={}){
  if(!outer)return null
  const g=normalizeGap(gap)
  if(fixedInner){
    const inner={
      length:Number(fixedInner.length)||0,
      width:Number(fixedInner.width)||0,
      height:Number(fixedInner.height)||0
    }
    // fixed 用用户给定值，不做夹紧改写（超限由上层报错）
    return {
      inner:{...inner},
      clamped:false,
      warnings:[],
      gap:g,
      packing,
      raw:{...inner}
    }
  }
  const pack=packing||{
    nx:1,ny:1,nz:1,rotated:false,
    cell:{length:outer.length,width:outer.width,height:outer.height},
    quantity:1
  }
  const cell=pack.cell||outer
  const nx=Math.max(1,Number(pack.nx)||1)
  const ny=Math.max(1,Number(pack.ny)||1)
  const nz=Math.max(1,Number(pack.nz)||1)
  const raw={
    length:roundUpMm(nx*cell.length+2*g.length),
    width:roundUpMm(ny*cell.width+2*g.width),
    height:roundUpMm(nz*cell.height+2*g.height)
  }
  // grow 路径：调用方应已保证 withinLimits；若仍超限，不夹紧，交上层处理
  if(!withinLimits(raw)){
    return {inner:raw,clamped:false,warnings:['overLimit'],gap:g,packing:pack,raw,overflow:overflowAgainstLimits(raw)}
  }
  return {inner:raw,clamped:false,warnings:[],gap:g,packing:pack,raw}
}

/** 体积与装载率（升 L，2 位小数） */
export function packingStats(outer,quantity,plan){
  if(!outer||!plan?.inner)return null
  const n=Math.max(0,Math.floor(Number(quantity)||0))
  if(n<=0)return null
  const unitMm3=outer.length*outer.width*outer.height
  const totalMm3=unitMm3*n
  const cavityMm3=plan.inner.length*plan.inner.width*plan.inner.height
  const fillRate=cavityMm3>0?Math.round((totalMm3/cavityMm3)*1000)/10:0
  return {
    unitLiters:liters2(unitMm3),
    totalLiters:liters2(totalMm3),
    cavityLiters:liters2(cavityMm3),
    fillRate,
    quantity:n
  }
}

/** 内容物网格中心坐标（相对外箱内空原点，单位 mm） */
export function packingContentCells(packing){
  if(!packing?.cell)return []
  const {nx,ny,nz,cell}=packing
  const cells=[]
  for(let iz=0;iz<nz;iz++){
    for(let iy=0;iy<ny;iy++){
      for(let ix=0;ix<nx;ix++){
        cells.push({
          x:(ix+0.5)*cell.length,
          y:(iy+0.5)*cell.width,
          z:(iz+0.5)*cell.height,
          length:cell.length,
          width:cell.width,
          height:cell.height
        })
      }
    }
  }
  return cells
}

/**
 * 排布占用是否装得进外箱内空（含单盒任一边超内空）
 * @returns {{ok:boolean,overflow:{length:number,width:number,height:number}}}
 */
export function packingFitsCavity(packing,inner,eps=0.5){
  const empty={length:0,width:0,height:0}
  if(!packing?.cell||!inner)return {ok:false,overflow:empty}
  const cell=packing.cell
  const nx=Math.max(0,Number(packing.nx)||0)
  const ny=Math.max(0,Number(packing.ny)||0)
  const nz=Math.max(0,Number(packing.nz)||0)
  const need={
    length:nx*cell.length,
    width:ny*cell.width,
    height:nz*cell.height
  }
  const overflow={
    length:Math.max(0,Math.round((need.length-Number(inner.length))*10)/10),
    width:Math.max(0,Math.round((need.width-Number(inner.width))*10)/10),
    height:Math.max(0,Math.round((need.height-Number(inner.height))*10)/10)
  }
  const ok=
    need.length<=Number(inner.length)+eps
    &&need.width<=Number(inner.width)+eps
    &&need.height<=Number(inner.height)+eps
    &&cell.length<=Number(inner.length)+eps
    &&cell.width<=Number(inner.width)+eps
    &&cell.height<=Number(inner.height)+eps
  return {ok,overflow,need}
}

/**
 * 生成外箱 knife
 * @param {{sizingMode?:'grow'|'fixed',fixedInner?:{length,width,height}}} opts
 * @returns {{knife,plan,outer,packing,stats,error,hint}|null}
 */
export function buildOutboxKnife({
  inboxKnife,
  gap=DEFAULT_OUTBOX_GAP,
  thickness=DEFAULT_OUTBOX_THICKNESS,
  bleed=5,
  materialId='kraft',
  fluteDirection='L',
  modelOnly=false,
  flatHeight=false,
  enabled=true,
  quantity=1,
  manualLayout=null,
  sizingMode='grow',
  fixedInner=null
}={}){
  if(!canBuildOutbox({knife:inboxKnife,modelOnly,flatHeight,enabled}))return null
  const outer=inboxOuterDims(inboxKnife)
  if(!outer)return null
  const mode=sizingMode==='fixed'?'fixed':'grow'
  const g=normalizeGap(gap)

  if(mode==='fixed'){
    const packing=fitInFixedOutbox(outer,fixedInner,g)
    if(!packing)return {knife:null,plan:null,outer,packing:null,stats:null,error:'noneFit',hint:{maxFit:0}}
    if(packing.error){
      const maxFit=maxQuantityWithinLimits(outer,g)
      return {
        knife:null,
        plan:null,
        outer,
        packing,
        stats:null,
        error:packing.error,
        hint:{maxFit,overflow:packing.overflow||null}
      }
    }
    const plan=computeOutboxSize(outer,g,packing,{fixedInner})
    const fit=packingFitsCavity(packing,plan.inner)
    if(!fit.ok){
      return {
        knife:null,
        plan:null,
        outer,
        packing,
        stats:null,
        error:'noneFit',
        hint:{maxFit:0,overflow:fit.overflow,need:fit.need}
      }
    }
    const T=Math.max(0.5,Number(thickness)||DEFAULT_OUTBOX_THICKNESS)
    const knife=createKnife({
      templateId:OUTBOX_TEMPLATE_ID,
      length:plan.inner.length,
      width:plan.inner.width,
      height:plan.inner.height,
      thickness:T,
      bleed,
      sizeMode:'inner',
      fluteDirection,
      materialId
    })
    const stats=packingStats(outer,packing.quantity,plan)
    return {knife,plan,outer,packing,stats,error:null,hint:{maxFit:packing.quantity}}
  }

  // grow
  const packing=choosePacking(outer,quantity,g,{manual:manualLayout})
  if(!packing)return null
  if(packing.error==='overLimit'){
    const maxFit=maxQuantityWithinLimits(outer,g)
    return {
      knife:null,
      plan:null,
      outer,
      packing,
      stats:null,
      error:'overLimit',
      hint:{
        maxFit,
        overflow:packing.overflow||overflowAgainstLimits(packing.rawInner),
        rawInner:packing.rawInner||null
      }
    }
  }
  const plan=computeOutboxSize(outer,g,packing)
  if(!plan)return null
  if(plan.warnings?.includes('overLimit')||!withinLimits(plan.inner)){
    const maxFit=maxQuantityWithinLimits(outer,g)
    return {
      knife:null,
      plan:null,
      outer,
      packing,
      stats:null,
      error:'overLimit',
      hint:{
        maxFit,
        overflow:plan.overflow||overflowAgainstLimits(plan.raw||plan.inner),
        rawInner:plan.raw||plan.inner
      }
    }
  }
  const fit=packingFitsCavity(packing,plan.inner)
  if(!fit.ok){
    const maxFit=maxQuantityWithinLimits(outer,g)
    return {
      knife:null,
      plan:null,
      outer,
      packing,
      stats:null,
      error:'noneFit',
      hint:{maxFit,overflow:fit.overflow,need:fit.need}
    }
  }
  if(packing.warnings?.length){
    plan.warnings=[...(plan.warnings||[]),...packing.warnings]
  }
  const T=Math.max(0.5,Number(thickness)||DEFAULT_OUTBOX_THICKNESS)
  const knife=createKnife({
    templateId:OUTBOX_TEMPLATE_ID,
    length:plan.inner.length,
    width:plan.inner.width,
    height:plan.inner.height,
    thickness:T,
    bleed,
    sizeMode:'inner',
    fluteDirection,
    materialId
  })
  const stats=packingStats(outer,packing.quantity,plan)
  return {knife,plan,outer,packing,stats,error:null,hint:{maxFit:maxQuantityWithinLimits(outer,g)}}
}
