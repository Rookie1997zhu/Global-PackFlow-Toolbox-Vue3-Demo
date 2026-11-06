// Independent demonstrator geometry. Millimetres throughout. Not a manufacturing dieline.
// 引擎：模板只给出面板矩形与补偿规则，这里统一生成裁切/压线/出血、铰链与校验。
import polygonClipping from 'polygon-clipping'
import {orderFaces,validateKnife} from './knifeContract.js'
import {getTemplate} from './templates/index.js'
import {buildDepthFoldStages} from './foldStages.js'
const round=n=>Math.round(n*1000)/1000
const rect=(x,y,w,h)=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]]
const key=p=>p.map(round).join(',')
const edgeKey=(a,b)=>[key(a),key(b)].sort().join('|')
const almost=(a,b)=>Math.abs(a-b)<1e-6
const clamp=(n,min,max)=>Math.min(max,Math.max(min,n))
const DIMS=['length','width','height']
const CLOSE_EPS=.25 // 面缝形态闭合（mm）；铰链浮点缝常用 0.1–0.2
/** 默认在 UI/源出血之上再外扩 1cm，便于视觉区分裁切与出血 */
export const BLEED_EXTRA_MM=10
export function effectiveBleedMm(bleed){
  return Math.max(0,Number(bleed)||0)+BLEED_EXTRA_MM
}

/** 按模板 paramDefs 计算默认值，再用 overrides 覆盖并夹取 */
export function resolveParams(template,panel,T,overrides={}){
  const defs=template?.paramDefs||[]
  const out={}
  for(const d of defs){
    const code=d.code
    if(!code)continue
    const defVal=typeof d.default==='function'?d.default(panel,T):Number(d.default)
    let v=overrides[code]!=null&&overrides[code]!==''?Number(overrides[code]):defVal
    if(!Number.isFinite(v))v=defVal
    if(Number.isFinite(d.min))v=Math.max(d.min,v)
    if(Number.isFinite(d.max))v=Math.min(d.max,v)
    out[code]=round(v)
  }
  return out
}

/** 轴对齐矩形孔轮廓；r>0 时四角圆弧细分为折线（绕向与直角孔一致） */
export function holeLoop(x,y,w,h,r=0,arcSeg=4){
  r=Math.max(0,Math.min(Number(r)||0,w/2,h/2))
  if(r<1e-6)return [[x,y],[x,y+h],[x+w,y+h],[x+w,y]]
  const pts=[]
  const arc=(cx,cy,a0,a1)=>{
    for(let i=0;i<=arcSeg;i++){
      const t=a0+(a1-a0)*(i/arcSeg)
      pts.push([cx+r*Math.cos(t),cy+r*Math.sin(t)])
    }
  }
  // 与直角孔相同绕向：下→上→右→下（y 向下坐标系）
  pts.push([x+r,y])
  arc(x+w-r,y, -Math.PI/2, 0)
  arc(x+w-r,y+h-r, 0, Math.PI/2)
  arc(x+r,y+h-r, Math.PI/2, Math.PI)
  arc(x+r,y+r, Math.PI, Math.PI*1.5)
  return pts.map(([px,py])=>[round(px),round(py)])
}

/** 轴对齐矩形并集的外轮廓（有序闭合点列，不含重复终点） */
function outlineFromRects(rects){
  const xs=[...new Set(rects.flatMap(r=>[round(r.x),round(r.x+r.w)]))].sort((a,b)=>a-b)
  const ys=[...new Set(rects.flatMap(r=>[round(r.y),round(r.y+r.h)]))].sort((a,b)=>a-b)
  const inside=Array.from({length:ys.length-1},()=>Array(xs.length-1).fill(false))
  for(const r of rects){
    for(let i=0;i<xs.length-1;i++)for(let j=0;j<ys.length-1;j++){
      const cx=(xs[i]+xs[i+1])/2,cy=(ys[j]+ys[j+1])/2
      if(cx>r.x&&cx<r.x+r.w&&cy>r.y&&cy<r.y+r.h)inside[j][i]=true
    }
  }
  const edges=[]
  for(let j=0;j<ys.length;j++)for(let i=0;i<xs.length-1;i++){
    const below=j<ys.length-1&&inside[j][i],above=j>0&&inside[j-1][i]
    if(below!==above)edges.push([[xs[i],ys[j]],[xs[i+1],ys[j]]])
  }
  for(let i=0;i<xs.length;i++)for(let j=0;j<ys.length-1;j++){
    const right=i<xs.length-1&&inside[j][i],left=i>0&&inside[j][i-1]
    if(right!==left)edges.push([[xs[i],ys[j]],[xs[i],ys[j+1]]])
  }
  return chainLoop(edges)
}

/** 面轮廓点列（绝对坐标）；无 outline 时退化为 bbox 矩形 */
function faceOutline(f){
  if(Array.isArray(f.outline)&&f.outline.length>=3)return f.outline
  return rect(f.x,f.y,f.w,f.h)
}

/** 在共线重叠边上插入端点，便于成对消边 */
function splitColinearOverlaps(edges){
  const ptsOn=new Map()
  const addPt=(ek,p)=>{
    if(!ptsOn.has(ek))ptsOn.set(ek,[])
    const list=ptsOn.get(ek)
    const k=key(p)
    if(!list.some(q=>key(q)===k))list.push(p)
  }
  for(let i=0;i<edges.length;i++){
    const [a,b]=edges[i]
    const ax=a[0],ay=a[1],bx=b[0],by=b[1]
    const horiz=almost(ay,by),vert=almost(ax,bx)
    if(!horiz&&!vert)continue
    for(let j=0;j<edges.length;j++){
      if(i===j)continue
      const [c,d]=edges[j]
      if(horiz&&almost(c[1],ay)&&almost(d[1],ay)){
        const lo=Math.min(ax,bx),hi=Math.max(ax,bx)
        for(const p of [c,d]){
          if(p[0]>lo+1e-9&&p[0]<hi-1e-9)addPt(edgeKey(a,b),[p[0],ay])
        }
      }else if(vert&&almost(c[0],ax)&&almost(d[0],ax)){
        const lo=Math.min(ay,by),hi=Math.max(ay,by)
        for(const p of [c,d]){
          if(p[1]>lo+1e-9&&p[1]<hi-1e-9)addPt(edgeKey(a,b),[ax,p[1]])
        }
      }
    }
  }
  const out=[]
  for(const [a,b] of edges){
    const ek=edgeKey(a,b)
    const extras=ptsOn.get(ek)||[]
    if(!extras.length){out.push([a,b]);continue}
    const horiz=almost(a[1],b[1])
    const pts=[a,...extras,b]
    pts.sort((p,q)=>horiz?p[0]-q[0]:p[1]-q[1])
    // 保持原方向
    const forward=horiz?(b[0]>=a[0]):(b[1]>=a[1])
    const ordered=forward?pts:[...pts].reverse()
    for(let i=0;i<ordered.length-1;i++){
      const p=ordered[i],q=ordered[i+1]
      if(key(p)===key(q))continue
      out.push([p,q])
    }
  }
  return out
}

/** 多边形面并集外轮廓：切分共线重叠 → 去掉成对共享边 → 串环（legacy 回退） */
function outlineFromPolygons(faces){
  let edges=[]
  for(const f of faces){
    const pts=faceOutline(f)
    for(let i=0;i<pts.length;i++){
      const a=pts[i],b=pts[(i+1)%pts.length]
      if(key(a)===key(b))continue
      edges.push([[round(a[0]),round(a[1])],[round(b[0]),round(b[1])]])
    }
  }
  edges=splitColinearOverlaps(edges)
  const counts=new Map()
  for(const [a,b] of edges){
    const k=edgeKey(a,b)
    if(!counts.has(k))counts.set(k,{n:0,a,b})
    counts.get(k).n++
  }
  const boundary=[]
  for(const {n,a,b} of counts.values()){
    if(n===1)boundary.push([a,b])
  }
  if(!boundary.length)return []
  return chainLoop(boundary)
}

function ringArea(pts){
  let s=0
  for(let i=0;i<pts.length;i++){
    const a=pts[i],b=pts[(i+1)%pts.length]
    s+=a[0]*b[1]-b[0]*a[1]
  }
  return s/2
}

/** 闭合环（首尾可不重复）→ polygon-clipping 多边形 */
function toClipPoly(pts){
  if(!pts||pts.length<3)return null
  const ring=pts.map(p=>[round(p[0]),round(p[1])])
  if(key(ring[0])!==key(ring[ring.length-1]))ring.push(ring[0].slice())
  // 去退化
  const clean=[ring[0]]
  for(let i=1;i<ring.length;i++){
    if(key(ring[i])!==key(clean[clean.length-1]))clean.push(ring[i])
  }
  if(clean.length>=2&&key(clean[0])===key(clean[clean.length-1])){/* keep close */}
  else if(clean.length>=3)clean.push(clean[0].slice())
  if(clean.length<4)return null
  return [clean]
}

/** 从 clip 结果取外环（去掉闭合重复点） */
function fromClipRing(ring){
  if(!ring||ring.length<3)return []
  const pts=ring.map(p=>[round(p[0]),round(p[1])])
  if(pts.length>=2&&key(pts[0])===key(pts[pts.length-1]))pts.pop()
  return mergeColinear(pts)
}

const r2=n=>Math.round(n*100)/100 // 0.01mm，稳住 clip 浮点

/** 分批 union，单批失败则跳过该批 */
function unionBatched(parts,batchSize=40){
  if(!parts.length)return null
  let acc=null
  for(let i=0;i<parts.length;i+=batchSize){
    const chunk=parts.slice(i,i+batchSize)
    try{
      const u=chunk.length===1?chunk:polygonClipping.union(...chunk)
      if(!u?.length)continue
      acc=acc==null?u:polygonClipping.union(...acc,...u)
    }catch{
      // 回退：逐个并入
      for(const p of chunk){
        try{acc=acc==null?[p]:polygonClipping.union(...acc,p)}catch{/* skip */}
      }
    }
  }
  return acc
}

/** 抽稀折线，限制 Minkowski 代价 */
function decimateLoop(pts,maxN=64){
  if(!pts||pts.length<=maxN)return pts
  const step=pts.length/maxN
  const out=[]
  for(let i=0;i<maxN;i++)out.push(pts[Math.min(pts.length-1,Math.floor(i*step))])
  if(key(out[0])!==key(out[out.length-1])){/* open */}
  // 去重
  const clean=[]
  for(const p of out){
    if(!clean.length||key(clean[clean.length-1])!==key(p))clean.push(p)
  }
  return clean.length>=3?clean:pts
}

/**
 * 外扩：优先角平分线（快且不自交）；否则 Minkowski（边矩形∪顶点方，抽稀至 96）。
 * 自交的 offset 结果不直接返回。
 * @returns {number[][]|null}
 */
function expandsBbox(src,out,tol=0.5){
  if(!src?.length||!out?.length)return false
  const sx=src.map(p=>p[0]),sy=src.map(p=>p[1])
  const ox=out.map(p=>p[0]),oy=out.map(p=>p[1])
  return Math.min(...ox)<=Math.min(...sx)+tol
    &&Math.max(...ox)>=Math.max(...sx)-tol
    &&Math.min(...oy)<=Math.min(...sy)+tol
    &&Math.max(...oy)>=Math.max(...sy)-tol
}

function bufferLoop(pts,d){
  if(!pts?.length||!(d>0))return pts?.length?pts.slice():null
  const fast=offsetLoop(pts,d)
  const fastOk=fast?.length>=3&&!loopSelfIntersects(fast)
    &&new Set(fast.map(p=>key(p))).size===fast.length
    &&expandsBbox(pts,fast,0.25)
  if(fastOk)return mergeColinear(fast)

  const src=decimateLoop(pts,96)
  const parts=[]
  const rounded=src.map(p=>[r2(p[0]),r2(p[1])])
  const base=toClipPoly(rounded)
  if(base)parts.push(base)
  const n=rounded.length
  for(let i=0;i<n;i++){
    const a=rounded[i],b=rounded[(i+1)%n]
    const dx=b[0]-a[0],dy=b[1]-a[1]
    const len=Math.hypot(dx,dy)||1
    const nx=r2(-dy/len*d),ny=r2(dx/len*d)
    parts.push([[
      [r2(a[0]+nx),r2(a[1]+ny)],[r2(b[0]+nx),r2(b[1]+ny)],
      [r2(b[0]-nx),r2(b[1]-ny)],[r2(a[0]-nx),r2(a[1]-ny)],
      [r2(a[0]+nx),r2(a[1]+ny)]
    ]])
    const s=d
    parts.push([[[a[0]-s,a[1]-s],[a[0]+s,a[1]-s],[a[0]+s,a[1]+s],[a[0]-s,a[1]+s],[a[0]-s,a[1]-s]]])
  }
  try{
    const united=unionBatched(parts,24)
    if(united?.length){
      let best=null,bestA=0
      for(const poly of united){
        const ring=fromClipRing(poly[0])
        if(ring.length<3)continue
        const a=Math.abs(ringArea(ring))
        if(a>bestA){bestA=a;best=ring}
      }
      if(best&&expandsBbox(pts,best,0.25))return mergeColinear(best)
      if(best)return mergeColinear(best) // Minkowski 偶发欠盖仍返回，由上层 covers 判定
    }
  }catch{/* */}
  // 最后：仅在无自交且真正外扩时接受角平分线结果
  if(fast?.length>=3&&!loopSelfIntersects(fast)&&expandsBbox(pts,fast,0.25)){
    return mergeColinear(dedupeClosedLoop(fast))
  }
  return null
}

/** 外裁候选打分：越高越好；rects 额外扣分 */
function scoreCutCandidate(loop,faceSum,minX,minY,maxX,maxY,{isRects=false}={}){
  if(!loop||loop.length<3)return -100
  let s=0
  const simple=new Set(loop.map(p=>key(p))).size===loop.length
  if(simple)s+=3
  if(loop.length>=4)s+=1
  if(loop.length>=6)s+=1
  const a=Math.abs(ringArea(loop))
  if(faceSum>0){
    const r=a/faceSum
    if(r>=.15&&r<=1.6)s+=3
    else if(r>=.12&&r<.15)s+=1
    else if(r<.12)s-=6 // 过小外环（局部岛）强力抑制
    else if(r>1.6)s-=2
  }
  const xs=loop.map(p=>p[0]),ys=loop.map(p=>p[1])
  if(Math.min(...xs)<=minX+3&&Math.max(...xs)>=maxX-3
    &&Math.min(...ys)<=minY+3&&Math.max(...ys)>=maxY-3)s+=2
  if(isRects)s-=5
  return s
}

/** 形态学腐蚀：bbox − buffer(bbox − P)，取最大连通外环 */
function erodeLoop(pts,d){
  if(!pts?.length||!(d>0))return pts?.length?pts.slice():null
  const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1])
  const pad=d*3+20
  const minX=Math.min(...xs)-pad,maxX=Math.max(...xs)+pad
  const minY=Math.min(...ys)-pad,maxY=Math.max(...ys)+pad
  const bbox=[[[minX,minY],[maxX,minY],[maxX,maxY],[minX,maxY],[minX,minY]]]
  const subject=toClipPoly(pts)
  if(!subject)return null
  try{
    const complement=polygonClipping.difference(bbox,subject)
    if(!complement?.length)return null
    const dilatedParts=[]
    for(const poly of complement){
      const outer=fromClipRing(poly[0])
      if(outer.length<3)continue
      const buf=bufferLoop(outer,d)
      const cp=toClipPoly(buf)
      if(cp)dilatedParts.push(cp)
    }
    if(!dilatedParts.length)return null
    const dilComp=dilatedParts.length===1
      ?[dilatedParts[0]]
      :polygonClipping.union(...dilatedParts)
    const eroded=polygonClipping.difference(bbox,...dilComp)
    if(!eroded?.length)return null
    let best=null,bestA=0
    for(const poly of eroded){
      const ring=fromClipRing(poly[0])
      if(ring.length<3)continue
      const a=Math.abs(ringArea(ring))
      if(a>bestA){bestA=a;best=ring}
    }
    return best
  }catch{
    return null
  }
}

/** 两环最近距离（顶点到顶点，近似） */
function loopMinDist(a,b){
  let best=Infinity
  for(const p of a){
    for(const q of b){
      const d=Math.hypot(p[0]-q[0],p[1]-q[1])
      if(d<best)best=d
    }
  }
  return best
}

/** 单次并集尝试（可选 buffer 闭运算） */
function tryUnionOnce(faces,closeEps){
  const polys=[]
  for(const f of faces){
    let pts=faceOutline(f)
    if(pts.length<3)continue
    if(closeEps>0){
      const expanded=bufferLoop(pts,closeEps)
      if(expanded?.length>=3)pts=expanded
    }
    const poly=toClipPoly(pts)
    if(poly)polys.push(poly)
  }
  if(!polys.length)return null
  let united
  try{
    united=polys.length===1?[polys[0]]:polygonClipping.union(...polys)
  }catch{return null}
  if(!united?.length)return null
  // 多外环且有内洞：外环再 buffer 合缝
  if(united.length>1&&united.some(poly=>poly.length>1)&&closeEps>0){
    try{
      const grown=united.map(poly=>{
        const outer=fromClipRing(poly[0])
        const ex=bufferLoop(outer,closeEps)
        return toClipPoly(ex?.length>=3?ex:outer)
      }).filter(Boolean)
      if(grown.length)united=polygonClipping.union(...grown)
    }catch{/* keep */}
  }
  const components=[]
  for(const poly of united||[]){
    let outer=fromClipRing(poly[0])
    if(outer.length<3)continue
    // 闭运算内缩：reverse+offset（快）；失败则保留外扩环
    if(closeEps>0){
      const before=Math.abs(ringArea(outer))
      const rev=outer.slice().reverse()
      const viaOff=offsetLoop(rev,closeEps)
      if(viaOff?.length>=3&&!loopSelfIntersects(viaOff)){
        const after=Math.abs(ringArea(viaOff))
        if(after>=before*.65&&after<=before*1.05)outer=viaOff.slice().reverse()
      }
    }
    components.push({pts:mergeColinear(outer),area:Math.abs(ringArea(outer))})
  }
  if(!components.length)return null
  components.sort((a,b)=>b.area-a.area)
  return {loops:components.map(c=>c.pts),n:components.length,area:components[0].area}
}

/** 伪多坯并入主环：面积&lt;12% 或距离&lt;6mm */
function mergePseudoExtras(loops){
  if(!loops?.length)return []
  const main=loops[0]
  const mainA=Math.abs(ringArea(main))||1
  const keep=[main]
  const absorb=[]
  for(let i=1;i<loops.length;i++){
    const L=loops[i]
    const a=Math.abs(ringArea(L))
    if(a<mainA*.12||loopMinDist(main,L)<6)absorb.push(L)
    else keep.push(L)
  }
  if(!absorb.length)return keep
  try{
    // 直接并集；不相接时用 1mm 缓冲再并，成功则尽量内缩回去
    let parts=[toClipPoly(main),...absorb.map(l=>toClipPoly(l))].filter(Boolean)
    let u=parts.length===1?[parts[0]]:polygonClipping.union(...parts)
    if((!u||u.length>1)){
      const eps=1
      parts=[main,...absorb].map(l=>{
        const b=bufferLoop(l,eps)
        return toClipPoly(b?.length>=3?b:l)
      }).filter(Boolean)
      u=parts.length===1?[parts[0]]:polygonClipping.union(...parts)
      if(u?.[0]?.[0]){
        let outer=fromClipRing(u[0][0])
        const rev=outer.slice().reverse()
        const shrunk=offsetLoop(rev,eps)
        if(shrunk?.length>=3&&!loopSelfIntersects(shrunk)&&Math.abs(ringArea(shrunk))>=Math.abs(ringArea(outer))*.7){
          outer=shrunk.slice().reverse()
        }
        return [mergeColinear(outer),...keep.slice(1)]
      }
    }else if(u?.[0]?.[0]){
      return [mergeColinear(fromClipRing(u[0][0])),...keep.slice(1)]
    }
  }catch{/* keep original */}
  return keep
}

/**
 * 面轮廓布尔并集。逐级加大闭合缝：优先连通分量少，同分量取面积大。
 * @returns {{loops:number[][][], reason?:string}|null}
 */
function unionOutline(faces){
  const steps=[0,CLOSE_EPS,.75,1.5,3]
  let best=null
  for(const eps of steps){
    const r=tryUnionOnce(faces,eps)
    if(!r)continue
    const better=!best
      ||r.n<best.n
      ||(r.n===best.n&&r.area>best.area)
    if(better)best={...r,eps}
    if(r.n<=1)break
  }
  if(!best)return {loops:[],reason:'noBoundary'}
  const loops=mergePseudoExtras(best.loops)
  return {loops,reason:best.eps>0||loops.length<best.loops.length?'closedGaps':undefined}
}

/** 多边形是否自交（端点共享不计） */
function loopSelfIntersects(pts){
  if(pts.length<4)return false
  const n=pts.length
  const segIntersect=(a,b,c,d)=>{
    const cross=(p,q,r)=>(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0])
    const d1=cross(a,b,c),d2=cross(a,b,d),d3=cross(c,d,a),d4=cross(c,d,b)
    if(((d1>0&&d2<0)||(d1<0&&d2>0))&&((d3>0&&d4<0)||(d3<0&&d4>0)))return true
    return false
  }
  for(let i=0;i<n;i++){
    const a=pts[i],b=pts[(i+1)%n]
    for(let j=i+1;j<n;j++){
      if(Math.abs(i-j)<=1||(i===0&&j===n-1))continue
      const c=pts[j],d=pts[(j+1)%n]
      // 共享顶点的相邻段已跳过；对角共享端点也不算穿越
      if(key(a)===key(c)||key(a)===key(d)||key(b)===key(c)||key(b)===key(d))continue
      if(segIntersect(a,b,c,d))return true
    }
  }
  return false
}

/** 外环按顶点法线外扩 bleed；失败返回 null */
function offsetLoop(pts,dist){
  if(!pts.length||!(dist>0))return pts.slice()
  const n=pts.length
  const out=[]
  for(let i=0;i<n;i++){
    const prev=pts[(i-1+n)%n],cur=pts[i],next=pts[(i+1)%n]
    const e1=[cur[0]-prev[0],cur[1]-prev[1]]
    const e2=[next[0]-cur[0],next[1]-cur[1]]
    const l1=Math.hypot(e1[0],e1[1])||1,l2=Math.hypot(e2[0],e2[1])||1
    // 边左侧法线（假设环为逆时针；若顺时针则整体反向，仍外扩）
    const n1=[-e1[1]/l1,e1[0]/l1],n2=[-e2[1]/l2,e2[0]/l2]
    const bis=[n1[0]+n2[0],n1[1]+n2[1]]
    const bl=Math.hypot(bis[0],bis[1])
    if(bl<1e-8){
      out.push([round(cur[0]+n1[0]*dist),round(cur[1]+n1[1]*dist)])
      continue
    }
    const cos=Math.max(-1,Math.min(1,(n1[0]*n2[0]+n1[1]*n2[1])))
    // 凹角截断：夹角过尖时限制倍率
    let m=dist/Math.max(0.2,Math.sqrt((1+cos)/2))
    if(m>dist*4)m=dist*4
    out.push([round(cur[0]+bis[0]/bl*m),round(cur[1]+bis[1]/bl*m)])
  }
  // 外扩判定：面积绝对值应增大；朝内则翻转法线重算
  const area=poly=>{
    let s=0
    for(let i=0;i<poly.length;i++){
      const a=poly[i],b=poly[(i+1)%poly.length]
      s+=a[0]*b[1]-b[0]*a[1]
    }
    return s/2
  }
  const a0=Math.abs(area(pts)),a1=Math.abs(area(out))
  const wrongDir=(a0>1e-6&&a1<a0*.98)
    ||(Math.sign(area(out))!==Math.sign(area(pts))&&a0>1e-6)
  if(wrongDir){
    const flipped=[]
    for(let i=0;i<n;i++){
      const prev=pts[(i-1+n)%n],cur=pts[i],next=pts[(i+1)%n]
      const e1=[cur[0]-prev[0],cur[1]-prev[1]]
      const e2=[next[0]-cur[0],next[1]-cur[1]]
      const l1=Math.hypot(e1[0],e1[1])||1,l2=Math.hypot(e2[0],e2[1])||1
      const n1=[e1[1]/l1,-e1[0]/l1],n2=[e2[1]/l2,-e2[0]/l2]
      const bis=[n1[0]+n2[0],n1[1]+n2[1]]
      const bl=Math.hypot(bis[0],bis[1])||1
      const cos=Math.max(-1,Math.min(1,(n1[0]*n2[0]+n1[1]*n2[1])))
      let m=dist/Math.max(0.2,Math.sqrt((1+cos)/2))
      if(m>dist*4)m=dist*4
      flipped.push([round(cur[0]+bis[0]/bl*m),round(cur[1]+bis[1]/bl*m)])
    }
    return flipped
  }
  return out
}

function dedupeClosedLoop(pts){
  const out=[]
  for(const p of pts||[]){
    const q=[round(p[0]),round(p[1])]
    if(!out.length||key(out[out.length-1])!==key(q))out.push(q)
  }
  if(out.length>=2&&key(out[0])===key(out[out.length-1]))out.pop()
  return out
}

/** 闭合环 Douglas-Peucker 简化：只删近共线点，保留拐角（区别于按序号抽点的 decimateLoop） */
function simplifyClosedLoop(pts,tol){
  if(pts.length<=4)return pts
  const segDist=(p,a,b)=>{
    const dx=b[0]-a[0],dy=b[1]-a[1]
    const L2=dx*dx+dy*dy
    if(L2<1e-12)return Math.hypot(p[0]-a[0],p[1]-a[1])
    const t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/L2))
    return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy)
  }
  const dp=(arr)=>{
    if(arr.length<=2)return arr
    let maxD=0,idx=0
    for(let i=1;i<arr.length-1;i++){
      const dd=segDist(arr[i],arr[0],arr[arr.length-1])
      if(dd>maxD){maxD=dd;idx=i}
    }
    if(maxD<=tol)return [arr[0],arr[arr.length-1]]
    const left=dp(arr.slice(0,idx+1)),right=dp(arr.slice(idx))
    return left.slice(0,-1).concat(right)
  }
  // 以离首点最远的点切成两条开链分别简化
  let far=0,farD=0
  for(let i=1;i<pts.length;i++){
    const dd=Math.hypot(pts[i][0]-pts[0][0],pts[i][1]-pts[0][1])
    if(dd>farD){farD=dd;far=i}
  }
  const a=dp(pts.slice(0,far+1))
  const b=dp(pts.slice(far).concat([pts[0]]))
  const out=a.slice(0,-1).concat(b.slice(0,-1))
  return out.length>=3?out:pts
}

/**
 * 真正的等距外扩：原多边形 ∪ 每条边的单侧外带 ∪ 凸角处的圆（多边形近似）。
 * 凹角被相邻外带覆盖，无需放圆。
 */
function minkowskiOffsetLoop(pts,d,{circleSeg=8}={}){
  const ccw=ringArea(pts)>0
  const parts=[]
  const base=toClipPoly(pts.map(p=>[r2(p[0]),r2(p[1])]))
  if(base)parts.push(base)
  const n=pts.length
  for(let i=0;i<n;i++){
    const prev=pts[(i-1+n)%n],a=pts[i],b=pts[(i+1)%n]
    const dx=b[0]-a[0],dy=b[1]-a[1]
    const len=Math.hypot(dx,dy)
    if(len>1e-6){
      // y 向下坐标系中，ringArea>0 的环外法线为 (dy,-dx)
      const s=ccw?1:-1
      const nx=s*dy/len*d,ny=-s*dx/len*d
      const quad=toClipPoly([
        [r2(a[0]),r2(a[1])],[r2(b[0]),r2(b[1])],
        [r2(b[0]+nx),r2(b[1]+ny)],[r2(a[0]+nx),r2(a[1]+ny)]
      ])
      if(quad)parts.push(quad)
    }
    const cross=(a[0]-prev[0])*(b[1]-a[1])-(a[1]-prev[1])*(b[0]-a[0])
    const convex=ccw?cross>1e-9:cross<-1e-9
    if(!convex)continue
    const circ=[]
    for(let k=0;k<circleSeg;k++){
      const t=k/circleSeg*Math.PI*2
      circ.push([r2(a[0]+Math.cos(t)*d),r2(a[1]+Math.sin(t)*d)])
    }
    const cp=toClipPoly(circ)
    if(cp)parts.push(cp)
  }
  const united=unionBatched(parts,64)
  if(!united?.length)return null
  let best=null,bestA=0
  for(const poly of united){
    const ring=fromClipRing(poly[0])
    if(ring.length<3)continue
    const ar=Math.abs(ringArea(ring))
    if(ar>bestA){bestA=ar;best=ring}
  }
  return best
}

/** 外扩结果质量门：拒绝自交/未真正外扩 */
function isGoodBleedExpand(src,out,d){
  if(!out||out.length<3)return false
  if(loopSelfIntersects(out))return false
  if(!expandsBbox(src,out,Math.max(0.5,d*0.15)))return false
  const a0=Math.abs(ringArea(src)),a1=Math.abs(ringArea(out))
  if(a0>1&&a1<a0*0.98)return false
  return true
}

/**
 * 闭合环再等距外扩 dist mm（Minkowski）。
 * 只做保拐角简化，不按序号抽点（会切掉拐角、出现斜线）。
 */
export function expandBleedLoop(pts,dist=BLEED_EXTRA_MM){
  const d=Math.max(0,Number(dist)||0)
  if(!pts?.length||!(d>0))return (pts||[]).map(p=>[p[0],p[1]])
  let src=mergeColinear(dedupeClosedLoop(pts))
  if(src.length<3)return src
  if(src.length>40)src=simplifyClosedLoop(src,0.4)

  let offset=null
  try{offset=minkowskiOffsetLoop(src,d)}catch(e){
    console.warn('expandBleedLoop: minkowski failed',{points:src.length,dist:d,error:e?.message})
    offset=null
  }
  if(isGoodBleedExpand(src,offset,d))return offset

  const xs=src.map(p=>p[0]),ys=src.map(p=>p[1])
  const x0=Math.min(...xs)-d,x1=Math.max(...xs)+d,y0=Math.min(...ys)-d,y1=Math.max(...ys)+d
  return rect(x0,y0,x1-x0,y1-y0)
}

/** 多个出血环：先合并相接/重叠的环（多件紧贴排版），再逐个等距外扩 */
export function expandBleedLoops(loops,dist=BLEED_EXTRA_MM){
  const valid=(loops||[]).filter(l=>l?.length>=3)
  if(valid.length<=1)return valid.map(l=>expandBleedLoop(l,dist))
  let merged=valid
  try{
    const polys=valid.map(l=>toClipPoly(l)).filter(Boolean)
    const united=polys.length>1?polygonClipping.union(...polys):polys
    const outers=united.map(poly=>fromClipRing(poly[0])).filter(r=>r.length>=3)
    if(outers.length)merged=outers
  }catch(e){
    console.warn('expandBleedLoops: union failed',{loops:valid.length,error:e?.message})
  }
  return merged.map(l=>expandBleedLoop(l,dist))
}

/** 将无向边串成闭合环 */
function chainLoop(edges){
  if(!edges.length)return []
  const adj=new Map()
  const add=(a,b)=>{
    const ka=key(a),kb=key(b)
    if(!adj.has(ka))adj.set(ka,[])
    if(!adj.has(kb))adj.set(kb,[])
    adj.get(ka).push({k:kb,p:b});adj.get(kb).push({k:ka,p:a})
  }
  for(const [a,b] of edges)add(a,b)
  let start=[...adj.keys()].sort((a,b)=>{
    const [ax,ay]=a.split(',').map(Number),[bx,by]=b.split(',').map(Number)
    return ax-bx||ay-by
  })[0]
  const loop=[];let prev=null,cur=start
  for(let guard=0;guard<edges.length+2;guard++){
    const [cx,cy]=cur.split(',').map(Number)
    loop.push([cx,cy])
    const nexts=adj.get(cur)||[]
    const n=nexts.find(x=>x.k!==prev)||nexts[0]
    if(!n)break
    prev=cur;cur=n.k
    if(cur===start)break
  }
  return mergeColinear(loop)
}

/** 合并共线顶点，减少外扩尖角误差 */
function mergeColinear(pts){
  if(pts.length<3)return pts
  const out=[]
  for(let i=0;i<pts.length;i++){
    const a=pts[(i-1+pts.length)%pts.length],b=pts[i],c=pts[(i+1)%pts.length]
    const cross=(b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0])
    if(Math.abs(cross)>1e-6)out.push(b)
  }
  return out.length?out:pts
}

function loopToCuts(pts){
  const cuts=[]
  for(let i=0;i<pts.length;i++){
    const a=pts[i],b=pts[(i+1)%pts.length]
    cuts.push({x1:round(a[0]),y1:round(a[1]),x2:round(b[0]),y2:round(b[1])})
  }
  return cuts
}

function loopToPath(pts){
  if(!pts.length)return ''
  return pts.map((p,i)=>`${i?'L':'M'} ${round(p[0])} ${round(p[1])}`).join(' ')+' Z'
}

/** 子面朝向父面的那条边与父面边的重叠段；不相邻返回 null */
function hingeSegment(child,parent){
  const overlap=(a0,a1,b0,b1)=>{const s=Math.max(a0,b0),e=Math.min(a1,b1);return e-s>1e-6?[s,e]:null}
  const side=child.side
  if(side==='right'||side==='left'){
    const x=side==='right'?parent.x+parent.w:parent.x
    if(!almost(side==='right'?child.x:child.x+child.w,x))return null
    const o=overlap(child.y,child.y+child.h,parent.y,parent.y+parent.h)
    return o&&[[x,o[0]],[x,o[1]]]
  }
  const y=side==='top'?parent.y:parent.y+parent.h
  if(!almost(side==='top'?child.y+child.h:child.y,y))return null
  const o=overlap(child.x,child.x+child.w,parent.x,parent.x+parent.w)
  return o&&[[o[0],y],[o[1],y]]
}

/** 压线 = 相邻面的完整共享边 ∪ 铰链处的部分重叠边 ∪ 显式 hingeLine；smooth 面不出压线 */
function foldsFromFaces(faces){
  const smoothNames=new Set(faces.filter(f=>f.smooth).map(f=>f.name))
  const edgeMap=new Map()
  for(const f of faces){
    if(f.smooth)continue
    const pts=faceOutline(f)
    for(let i=0;i<pts.length;i++){
      const a=pts[i],b=pts[(i+1)%pts.length]
      if(key(a)===key(b))continue
      const k=edgeKey(a,b)
      if(!edgeMap.has(k))edgeMap.set(k,[])
      edgeMap.get(k).push({a,b,face:f.name})
    }
  }
  const folds=[]
  const seen=new Set()
  for(const [k,entries] of edgeMap){
    if(entries.length!==2)continue
    // 任一侧为 smooth 虚折：不出压线
    if(entries.some(e=>smoothNames.has(e.face)))continue
    const {a,b}=entries[0]
    seen.add(k)
    folds.push({name:entries.map(e=>e.face).join('_'),x1:round(a[0]),y1:round(a[1]),x2:round(b[0]),y2:round(b[1])})
  }
  const byName=Object.fromEntries(faces.map(f=>[f.name,f]))
  for(const f of faces){
    if(!f.parent||f.smooth)continue
    if(Array.isArray(f.hingeLine)&&f.hingeLine.length===2){
      const [a,b]=f.hingeLine
      const k=edgeKey(a,b)
      if(!seen.has(k)){
        seen.add(k)
        folds.push({name:`${f.parent}_${f.name}`,x1:round(a[0]),y1:round(a[1]),x2:round(b[0]),y2:round(b[1])})
      }
      continue
    }
    const seg=hingeSegment(f,byName[f.parent])
    if(!seg)continue
    const k=edgeKey(seg[0],seg[1])
    if(seen.has(k))continue
    seen.add(k)
    folds.push({name:`${f.parent}_${f.name}`,x1:round(seg[0][0]),y1:round(seg[0][1]),x2:round(seg[1][0]),y2:round(seg[1][1])})
  }
  return folds
}

/** 相对轮廓 → 绝对；并校验落在 bbox 内 */
function absoluteOutline(x,y,w,h,rel){
  if(!Array.isArray(rel)||rel.length<3)return null
  const abs=rel.map(([px,py])=>[round(x+px),round(y+py)])
  for(const [px,py] of abs){
    if(px<x-1e-6||py<y-1e-6||px>x+w+1e-6||py>y+h+1e-6){
      throw new Error(`outline point (${px},${py}) outside face bbox ${x},${y},${w}x${h}`)
    }
  }
  return abs
}

/** side 铰链边必须是 bbox 整条直边（斜角/圆弧只能在自由边） */
function assertHingeEdgeIntact(face){
  if(!face.parent||!face.side||!face.outline)return
  if(face.hingeLine)return
  const {x,y,w,h,side,outline:pts}=face
  const onEdge=(p)=>{
    if(side==='left')return almost(p[0],x)
    if(side==='right')return almost(p[0],x+w)
    if(side==='top')return almost(p[1],y) // 布局 y 向下：top 贴父面时子面靠下边？见 hingeSegment
    if(side==='bottom')return almost(p[1],y+h)
    return true
  }
  // hingeSegment: top 子面底边贴父顶 → child.y+child.h；bottom 子面顶边贴父底 → child.y
  // 与 side 命名：top = 子在父上方 → 铰在子面底边 (y+h)；bottom → 铰在子面顶边 (y)
  const hingeY=side==='top'?y+h:side==='bottom'?y:null
  const hingeX=side==='left'?x+w:side==='right'?x:null
  const hingePts=pts.filter(p=>{
    if(hingeX!=null)return almost(p[0],hingeX)
    if(hingeY!=null)return almost(p[1],hingeY)
    return false
  })
  if(hingePts.length<2)throw new Error(`face ${face.name}: hinge side ${side} missing from outline`)
  if(side==='left'||side==='right'){
    const ys=hingePts.map(p=>p[1]).sort((a,b)=>a-b)
    if(Math.abs(ys[0]-y)>1e-3||Math.abs(ys[ys.length-1]-(y+h))>1e-3){
      throw new Error(`face ${face.name}: hinged ${side} edge must span full bbox height`)
    }
  }else{
    const xs=hingePts.map(p=>p[0]).sort((a,b)=>a-b)
    if(Math.abs(xs[0]-x)>1e-3||Math.abs(xs[xs.length-1]-(x+w))>1e-3){
      throw new Error(`face ${face.name}: hinged ${side} edge must span full bbox width`)
    }
  }
  // 自由边才允许斜切；铰链边上不应出现非端点缺口（已由满跨度覆盖）
  void onEdge
}

/**
 * 按模板补偿规则推导三套尺寸：inner（净空）、panel（刀版面板）、outer（外廓）。
 * 外尺寸输入时先反推净空；两种输入都按模板 limits 夹取净空。
 */
export function deriveSizes(template,{length,width,height,thickness,sizeMode='inner'}={}){
  const {defaults,limits,sizeRule}=template
  const T=Math.max(.5,Number(thickness)||defaults.thickness)
  const mode=sizeMode==='outer'?'outer':'inner'
  const input={length:Number(length)||defaults.length,width:Number(width)||defaults.width,height:Number(height)||defaults.height}
  const inner={},panel={},outer={}
  for(const k of DIMS){
    const raw=mode==='inner'?input[k]:input[k]-sizeRule.outerAdd[k]*T
    inner[k]=round(clamp(raw,limits[k][0],limits[k][1]))
    panel[k]=round(inner[k]+sizeRule.panelAdd[k]*T)
    outer[k]=round(inner[k]+sizeRule.outerAdd[k]*T)
  }
  return {sizeMode:mode,T,inner,outer,panel}
}

/** 兼容旧调用：未传 templateId 时使用默认翻盖邮寄盒 */
export function derivePanelSizes({templateId,...args}={}){
  return deriveSizes(getTemplate(templateId),args)
}

export function createKnife({templateId,length:L,width:W,height:H,thickness:T,bleed=5,sizeMode='inner',fluteDirection='L',materialId='kraft',piece,lidClearance,params:paramOverrides}={}){
  const template=getTemplate(templateId)
  const bleedInput=Math.max(0,Number(bleed)||0)
  const bleedExtra=BLEED_EXTRA_MM
  const bleedEff=bleedInput+bleedExtra
  bleed=bleedEff // 几何外扩用有效出血；knife.bleed 仍写 UI 输入值
  fluteDirection=fluteDirection==='W'?'W':'L'
  materialId=['kraft','white','blue'].includes(materialId)?materialId:'kraft'
  const derived=deriveSizes(template,{length:L,width:W,height:H,thickness:T,sizeMode})
  T=derived.T
  sizeMode=derived.sizeMode
  const pieceList=Array.isArray(template.pieces)&&template.pieces.length?template.pieces:null
  const supportsPiece=!!(template.supportsPiece||(pieceList&&pieceList.length>1))
  const defaultPieceId=pieceList?.[0]?.id||'bottom'
  const resolvedPiece=supportsPiece
    ?(piece&&pieceList?.some(p=>p.id===piece)?piece:(piece==='lid'&&(!pieceList||pieceList.some(p=>p.id==='lid'))?'lid':defaultPieceId))
    :defaultPieceId
  const resolvedClearance=supportsPiece
    ?Math.max(0,Number(lidClearance??template.defaults?.lidClearance??2)||0)
    :0
  const params=resolveParams(template,derived.panel,T,paramOverrides||{})
  const layoutArgs={panel:derived.panel,inner:derived.inner,T,params}
  if(supportsPiece){
    layoutArgs.piece=resolvedPiece
    // lidClearance 只对 lid 件生效
    if(resolvedPiece==='lid')layoutArgs.lidClearance=resolvedClearance
  }
  const layoutOut=template.layout(layoutArgs)
  const {faces:raw,arrows}=layoutOut
  const rawHoles=Array.isArray(layoutOut.holes)?layoutOut.holes:[]
  const resolvedRoot=layoutOut.root||template.root
  const faceOrder=typeof template.faceOrder==='function'
    ?template.faceOrder(params,layoutOut)
    :(layoutOut.faceOrder||template.faceOrder)
  const angleMap={...(template.hingeAngles||{}),...(layoutOut.hingeAngles||{})}
  const faces=orderFaces(raw.map(tuple=>{
    const [name,x0,y0,w0,h0,parent,side,shape]=tuple
    let x=round(x0),y=round(y0),w=round(w0),h=round(h0)
    const face={name,x,y,w,h,parent,side}
    if(shape?.smooth)face.smooth=true
    if(shape?.outline){
      face.outline=absoluteOutline(x,y,w,h,shape.outline)
    }
    if(Array.isArray(shape?.hingeLine)&&shape.hingeLine.length===2){
      // hingeLine 相对面 bbox 左下角
      face.hingeLine=shape.hingeLine.map(([px,py])=>[round(x+px),round(y+py)])
    }
    const loop=face.outline||rect(x,y,w,h)
    face.dlist=loop.map(([px,py],i)=>({mtd:i?'L':'M',x:round(px),y:round(py)})).concat([{mtd:'Z'}])
    if(face.outline)assertHingeEdgeIntact(face)
    return face
  }),faceOrder)
  const folds=foldsFromFaces(faces)
  const anyPoly=faces.some(f=>Array.isArray(f.outline)&&f.outline.length>=3)
  const minX0=Math.min(...faces.map(f=>f.x)),minY0=Math.min(...faces.map(f=>f.y))
  const maxX0=Math.max(...faces.map(f=>f.x+f.w)),maxY0=Math.max(...faces.map(f=>f.y+f.h))
  // 裁切 = 多边形布尔并集；失败再边消元 / 矩形并集 / AABB
  const isSimpleLoop=loop=>{
    if(!loop||loop.length<3)return false
    return new Set(loop.map(p=>key(p))).size===loop.length
  }
  let cutLoop=[]
  let cutExtraLoops=[] // 多坯次外环，并入 cuts
  let cutApprox=false
  let cutApproxReason=null
  let cutChosen='rects' // union|legacy|rects
  const polyArea=pts=>{
    let s=0
    for(let i=0;i<pts.length;i++){
      const a=pts[i],b=pts[(i+1)%pts.length]
      s+=a[0]*b[1]-b[0]*a[1]
    }
    return Math.abs(s)/2
  }
  const dedupePts=pts=>{
    const out=[]
    for(const p of pts||[]){
      const q=[round(p[0]),round(p[1])]
      if(!out.length||key(out[out.length-1])!==key(q))out.push(q)
    }
    if(out.length>=2&&key(out[0])===key(out[out.length-1]))out.pop()
    return out
  }
  if(anyPoly){
    const faceAreaSum=faces.reduce((s,f)=>s+(Array.isArray(f.outline)&&f.outline.length>=3?polyArea(f.outline):f.w*f.h),0)
    const candidates=[]
    const uni=unionOutline(faces)
    let uniExtras=[]
    if(uni?.loops?.length){
      const main=dedupePts(uni.loops[0])
      uniExtras=uni.loops.slice(1).map(dedupePts).filter(l=>l.length>=3&&loopMinDist(main,l)>=1)
      const mainA=polyArea(main)
      // 重叠面：单环面积落在合理区间且简单 → 略抬 union
      const overlapOk=uniExtras.length===0&&isSimpleLoop(main)&&main.length>=4
        &&faceAreaSum>0&&mainA>=faceAreaSum*.15&&mainA<=faceAreaSum*1.6
      const sc=scoreCutCandidate(main,faceAreaSum,minX0,minY0,maxX0,maxY0)
      candidates.push({kind:'union',loop:main,extras:uniExtras,score:overlapOk?sc+4:sc})
    }
    const legacy=outlineFromPolygons(faces)
    if(legacy.length>=3){
      const L=dedupePts(legacy)
      candidates.push({kind:'legacy',loop:L,extras:[],score:scoreCutCandidate(L,faceAreaSum,minX0,minY0,maxX0,maxY0)})
    }
    const rects=outlineFromRects(faces)
    candidates.push({kind:'rects',loop:rects,extras:[],score:scoreCutCandidate(rects,faceAreaSum,minX0,minY0,maxX0,maxY0,{isRects:true})})
    candidates.sort((a,b)=>b.score-a.score)
    let best=candidates[0]
    // 面积过小/过大（含次环合计）则换候选；仍无则强制 face AABB
    const totalA=c=>polyArea(c.loop)+(c.extras||[]).reduce((s,l)=>s+polyArea(l),0)
    const areaOk=c=>{
      if(!c?.loop||c.loop.length<4||!(faceAreaSum>0))return false
      const a=totalA(c)
      return a>=faceAreaSum*.15&&a<=faceAreaSum*1.65
    }
    if(!areaOk(best)){
      const alt=candidates.find(c=>areaOk(c))
      best=alt||{kind:'rects',loop:rect(minX0,minY0,maxX0-minX0,maxY0-minY0),extras:[],score:-99}
    }
    // 禁止在仍有可用充足面积的 union/legacy 时选 rects
    if(best.kind==='rects'){
      const better=candidates.find(c=>c.kind!=='rects'&&isSimpleLoop(c.loop)&&areaOk(c))
      if(better)best=better
    }
    cutLoop=best.loop
    cutExtraLoops=best.extras||[]
    cutChosen=best.kind
    if(best.kind==='rects'){
      cutApprox=true
      cutApproxReason=uni?.loops?.length?'notCover':(uni?.reason||'noBoundary')
    }
  }else{
    cutLoop=outlineFromRects(faces)
    cutChosen='rects'
  }
  if(!isSimpleLoop(cutLoop)){
    cutLoop=rect(minX0,minY0,maxX0-minX0,maxY0-minY0)
    cutExtraLoops=[]
    cutApprox=true
    cutChosen='rects'
    cutApproxReason=cutApproxReason||'aabbFallback'
  }
  const cuts=loopToCuts(cutLoop)
  for(const loop of cutExtraLoops){
    if(isSimpleLoop(loop))cuts.push(...loopToCuts(loop))
  }
  // 内孔：有 outline 用折线环，否则矩形/圆角；缺 face 时按中心落入最小面补齐
  // 采样/圆角细分后可能出现近重复点，合并后再用
  const dedupeLoop=pts=>{
    if(!pts?.length)return []
    const out=[]
    for(const p of pts){
      const q=[round(p[0]),round(p[1])]
      if(!out.length||key(out[out.length-1])!==key(q))out.push(q)
    }
    if(out.length>=2&&key(out[0])===key(out[out.length-1]))out.pop()
    return out
  }
  // 只归属 bbox 完全落入的面（取面积最小），避免中心落在小舌片但孔跨出面外
  const faceForHole=(hx,hy,hw,hh)=>{
    let best=null,bestA=Infinity
    for(const f of faces){
      if(hx<f.x-1e-3||hy<f.y-1e-3||hx+hw>f.x+f.w+1e-3||hy+hh>f.y+f.h+1e-3)continue
      const a=f.w*f.h
      if(a<bestA){bestA=a;best=f.name}
    }
    return best
  }
  const holes=rawHoles.filter(h=>h&&h.w>0&&h.h>0).map(h=>{
    const x=round(h.x),y=round(h.y),w=round(h.w),hh=round(h.h),r=round(Math.max(0,Number(h.r)||0))
    let loop=null
    if(Array.isArray(h.outline)&&h.outline.length>=3){
      const ol=dedupeLoop(h.outline)
      // 自触/重访顶点的异形孔退回圆角矩形，保证简单环
      if(ol.length>=3&&new Set(ol.map(p=>key(p))).size===ol.length)loop=ol
    }
    if(!loop)loop=dedupeLoop(holeLoop(x,y,w,hh,r))
    if(loop.length<3||new Set(loop.map(p=>key(p))).size!==loop.length)loop=rect(x,y,w,hh)
    const face=h.face||faceForHole(x,y,w,hh)||null
    return {x,y,w,h:hh,r,face,loop,cuts:loopToCuts(loop),path:loopToPath(loop)}
  })
  for(const hole of holes)cuts.push(...hole.cuts)
  let bleedLoop=cutLoop
  let bleedApprox=false
  // AABB 外扩：覆盖 cutLoop（闭运算可能略超面 bbox）
  const aabbBleed=()=>{
    const cxs=cutLoop.map(p=>p[0]),cys=cutLoop.map(p=>p[1])
    const x0=Math.min(minX0,...cxs),x1=Math.max(maxX0,...cxs)
    const y0=Math.min(minY0,...cys),y1=Math.max(maxY0,...cys)
    return rect(x0-bleed,y0-bleed,x1-x0+2*bleed,y1-y0+2*bleed)
  }
  if(bleed>0&&anyPoly&&!cutApprox){
    // 出血只扩主环；超密环先抽稀再 buffer，提高 Minkowski 成功率
    let offset=null
    const bleedSrc=cutLoop.length>120?decimateLoop(cutLoop,96):cutLoop
    try{offset=bufferLoop(bleedSrc,bleed)}catch{offset=null}
    if(!offset||offset.length<3){
      const soft=offsetLoop(bleedSrc,bleed)
      if(soft?.length>=3)offset=soft
    }
    if(offset?.length>=3)offset=mergeColinear(dedupePts(offset))
    const cutXs=cutLoop.map(p=>p[0]),cutYs=cutLoop.map(p=>p[1])
    const tol=Math.max(1.5,bleed*.25)
    const coversBbox=offset?.length>=3
      &&Math.min(...offset.map(p=>p[0]))<=Math.min(...cutXs)+tol
      &&Math.max(...offset.map(p=>p[0]))>=Math.max(...cutXs)-tol
      &&Math.min(...offset.map(p=>p[1]))<=Math.min(...cutYs)+tol
      &&Math.max(...offset.map(p=>p[1]))>=Math.max(...cutYs)-tol
    if(coversBbox&&offset.length>=4){
      bleedLoop=offset
    }else{
      bleedLoop=aabbBleed()
      bleedApprox=true
    }
  }else if(!anyPoly||cutApprox||bleed>0){
    // min 档 bleed=0：仍用 face AABB，避免残缺 cutLoop 触发 bleed X/Y
    bleedLoop=aabbBleed()
    if(cutApprox||(anyPoly&&bleed>0))bleedApprox=true
  }
  const bleeds=loopToCuts(bleedLoop)
  const cutPath=[loopToPath(cutLoop),...cutExtraLoops.map(loopToPath),...holes.map(h=>h.path)].filter(Boolean).join(' ')
  const bleedPath=loopToPath(bleedLoop)

  const hinges=faces.filter(f=>f.parent).map(f=>{
    const h={parent:f.parent,child:f.name,side:f.side,angle:angleMap[f.name]??90}
    if(f.hingeLine)h.hingeLine=f.hingeLine
    if(f.smooth)h.smooth=true
    return h
  })
  const foldStages=buildDepthFoldStages(faces,hinges)
  const minX=Math.min(...faces.map(f=>f.x)),minY=Math.min(...faces.map(f=>f.y)),maxX=Math.max(...faces.map(f=>f.x+f.w)),maxY=Math.max(...faces.map(f=>f.y+f.h))
  const show=sizeMode==='inner'?derived.inner:derived.outer
  const arrowName={length:'L',width:'W',height:'H'}
  const sizeArrowData=DIMS.map(k=>({lineName:`${arrowName[k]}(${sizeMode})`,lineLength:show[k],p1:arrows[k][0],p2:arrows[k][1]}))
  const layers={
    trim:{role:'trim',color:'#2028b0',segments:cuts},
    crease:{role:'crease',color:'#fa0000',dash:true,segments:folds},
    bleed:{role:'bleed',color:'#46ba00',segments:bleeds}
  }
  const material={id:materialId,science:'demo-board',fluteDirection}
  const knife={
    schema:'boxcraft.knife.v3',unit:'mm',template:template.id,
    templateInfo:{id:template.id,label:template.label,labelEn:template.labelEn,standard:template.standard,sizeRule:template.sizeRule},
    dimensions:{
      length:show.length,width:show.width,height:show.height,thickness:T,
      sizeMode,fluteDirection,
      inner:derived.inner,outer:derived.outer,panel:derived.panel
    },
    material,bleed:bleedInput,bleedEffective:bleedEff,params,
    faces,cuts,bleeds,folds,hinges,foldStages,layers,holes,
    cutPath,bleedPath,cutLoop,cutExtraLoops,bleedLoop,
    meta:{anyPoly,bleedApprox,cutApprox,cutApproxReason:cutApprox?cutApproxReason:undefined,cutChosen,extraCutLoops:cutExtraLoops.length,foldStageCount:foldStages.length,bleedExtra,bleedEffective:bleedEff},
    topology:{
      root:resolvedRoot,faceCount:faces.length,hingeCount:hinges.length,
      faceOrder:[...faceOrder],supportsClosedCheck:template.supportsClosedCheck!==false&&!!template.closedCheck,
      supportsPiece,holeCount:holes.length,anyPoly
    },
    animation:{groups:[{name:'main',hinges:hinges.map(h=>h.child)}],animations:hinges.map(h=>({name:h.child,action:'rotate',rotate:h.angle,vector:h.side}))},
    sizeArrowData,totalX:round(maxX-minX),totalY:round(maxY-minY),
    bounds:{minX,minY,maxX,maxY},
    manufacturingReady:false
  }
  if(supportsPiece){
    knife.piece=resolvedPiece
    knife.lidClearance=resolvedClearance
  }
  const validation=validateKnife(knife)
  knife.validation=validation
  knife.productionReady=validation.ok
  return knife
}
export function pathsFromCuts(cuts){return cuts.map(e=>`M ${e.x1} ${e.y1} L ${e.x2} ${e.y2}`).join(' ')}
