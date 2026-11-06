import {getTemplate} from './templates/index.js'

/** 板厚中性层：挤出 0→T 后整体下移，使铰链落在板中面 */
export function neutralMeshOffset(T){
  const t=Math.max(0,Number(T)||0)
  return {x:0,y:0,z:-t/2}
}

/** 与 App setFold 一致的铰链轴向符号 */
export function foldRotation(side,angleRad){
  const a=Number(angleRad)||0
  if(side==='top')return {x:a,y:0,z:0}
  if(side==='bottom')return {x:-a,y:0,z:0}
  if(side==='left')return {x:0,y:a,z:0}
  return {x:0,y:-a,z:0}
}

export function aabbOverlap(a,b){
  return a.min[0]<=b.max[0]&&a.max[0]>=b.min[0]
    &&a.min[1]<=b.max[1]&&a.max[1]>=b.min[1]
    &&a.min[2]<=b.max[2]&&a.max[2]>=b.min[2]
}

/** 两 AABB 各轴分离距离之和；重叠时为 0 */
export function gapBetween(a,b){
  const gapX=Math.max(0,Math.max(a.min[0]-b.max[0],b.min[0]-a.max[0]))
  const gapY=Math.max(0,Math.max(a.min[1]-b.max[1],b.min[1]-a.max[1]))
  const gapZ=Math.max(0,Math.max(a.min[2]-b.max[2],b.min[2]-a.max[2]))
  return gapX+gapY+gapZ
}

/**
 * 闭合态（progress=1）简化 AABB：按模板 closedCheck 放置盒体，检测关键面板对是否重叠。
 * 非物理求解，仅作合盖告警示意。无 closedCheck 时 skipped。
 */
export function estimateClosedCollisions(knife,T){
  const template=getTemplate(knife?.template)
  const check=template?.closedCheck
  if(!check?.buildBoxes||!Array.isArray(check.pairs))return {ok:true,issues:[],skipped:true}

  const t=Math.max(.5,Number(T??knife?.dimensions?.thickness)||1.5)
  const p=knife?.dimensions?.panel||{length:knife?.dimensions?.length,width:knife?.dimensions?.width,height:knife?.dimensions?.height}
  const panel={length:Number(p.length)||0,width:Number(p.width)||0,height:Number(p.height)||0}
  const names=new Set((knife?.faces||[]).map(f=>f.name))
  const boxes=check.buildBoxes({
    panel,T:t,
    piece:knife?.piece||'bottom',
    lidClearance:knife?.lidClearance
  })||{}
  const threshold=t*2

  const issues=[]
  for(const [a,b] of check.pairs){
    if(!names.has(a)||!names.has(b))continue
    const A=boxes[a],B=boxes[b]
    if(!A||!B)continue
    // 翼/插舌/摇盖预期嵌入或对接：重叠视为成功；分离过大告警
    if(aabbOverlap(A,B))continue
    if(gapBetween(A,B)>threshold)issues.push({a,b,type:'gap'})
  }

  return {ok:issues.length===0,issues}
}
