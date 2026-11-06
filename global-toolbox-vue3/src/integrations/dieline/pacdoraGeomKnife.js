/**
 * 运输箱例外：Pacdora geometry JSON → createKnife 同构 knife。
 * 试播阶段尺寸锁定；修复：动画角累加带符号、多段裁切/出血子路径、多根件森林。
 */
import {foldStagesFromAnimation} from './foldStages.js'
import {sizeArrowDataFromBounds} from './dimAnnotations.js'
import {BLEED_EXTRA_MM,expandBleedLoops} from './knife.js'
import {publicAssetUrl} from './assetUrl.js'

const cache=new Map()
const inflight=new Map()

export function pathFromCmds(cmds){
  if(!Array.isArray(cmds))return ''
  const parts=[]
  for(const c of cmds){
    if(!c)continue
    if(c.mtd==='M')parts.push(`M ${c.x} ${c.y}`)
    else if(c.mtd==='L')parts.push(`L ${c.x} ${c.y}`)
    // Pacdora arc/dir → SVG large-arc / sweep
    else if(c.mtd==='A')parts.push(`A ${c.rx||0} ${c.ry||0} ${c.ang||0} ${c.arc?1:0} ${c.dir?1:0} ${c.x} ${c.y}`)
    else if(c.mtd==='Q')parts.push(`Q ${c.cx} ${c.cy} ${c.x} ${c.y}`)
    else if(c.mtd==='C')parts.push(`C ${c.cx1??c.cx} ${c.cy1??c.cy} ${c.cx2??c.cx} ${c.cy2??c.cy} ${c.x} ${c.y}`)
    else if(c.mtd==='Z')parts.push('Z')
  }
  return parts.join(' ')
}

/** 按 M 拆成独立子路径，避免多坯件/多环被连成交叉线段 */
export function splitCmdsIntoSubpaths(cmds){
  const out=[]
  let cur=[]
  for(const c of cmds||[]){
    if(!c)continue
    if(c.mtd==='M'){
      if(cur.length)out.push(cur)
      cur=[c]
    }else{
      if(!cur.length)cur.push({mtd:'M',x:c.x,y:c.y})
      cur.push(c)
    }
  }
  if(cur.length)out.push(cur)
  return out
}

export function cmdsToPolyline(cmds,{arcSegs=10}={}){
  const pts=[]
  let cx=0,cy=0,started=false
  const push=(x,y)=>{
    if(!Number.isFinite(x)||!Number.isFinite(y))return
    const last=pts[pts.length-1]
    if(last&&Math.hypot(last[0]-x,last[1]-y)<1e-6)return
    pts.push([x,y])
  }
  for(const c of cmds||[]){
    if(!c)continue
    if(c.mtd==='M'){
      cx=c.x;cy=c.y;started=true;push(cx,cy)
    }else if(c.mtd==='L'){
      cx=c.x;cy=c.y;if(started)push(cx,cy)
    }else if(c.mtd==='A'){
      const x1=cx,y1=cy,x2=c.x,y2=c.y
      const rx=Math.max(1e-6,Number(c.rx)||0)
      const mx=(x1+x2)/2,my=(y1+y2)/2
      const dx=x2-x1,dy=y2-y1
      const len=Math.hypot(dx,dy)||1
      const nx=-dy/len,ny=dx/len
      const bulge=Math.min(rx,Number(c.ry)||rx)*(c.dir?1:-1)*.55
      for(let i=1;i<=arcSegs;i++){
        const t=i/arcSegs
        push((1-t)*(1-t)*x1+2*(1-t)*t*(mx+nx*bulge)+t*t*x2,(1-t)*(1-t)*y1+2*(1-t)*t*(my+ny*bulge)+t*t*y2)
      }
      cx=x2;cy=y2
    }else if(c.mtd==='Q'){
      const x1=cx,y1=cy,qx=c.cx,qy=c.cy,x2=c.x,y2=c.y
      for(let i=1;i<=arcSegs;i++){
        const t=i/arcSegs
        push((1-t)*(1-t)*x1+2*(1-t)*t*qx+t*t*x2,(1-t)*(1-t)*y1+2*(1-t)*t*qy+t*t*y2)
      }
      cx=x2;cy=y2
    }else if(c.mtd==='C'){
      const x1=cx,y1=cy
      const cx1=c.cx1??c.cx,cy1=c.cy1??c.cy,cx2=c.cx2??c.cx,cy2=c.cy2??c.cy
      const x2=c.x,y2=c.y
      for(let i=1;i<=arcSegs;i++){
        const t=i/arcSegs,u=1-t
        push(u*u*u*x1+3*u*u*t*cx1+3*u*t*t*cx2+t*t*t*x2,u*u*u*y1+3*u*u*t*cy1+3*u*t*t*cy2+t*t*t*y2)
      }
      cx=x2;cy=y2
    }else if(c.mtd==='Z'){
      if(pts.length)push(pts[0][0],pts[0][1])
    }
  }
  if(pts.length>=2){
    const a=pts[0],b=pts[pts.length-1]
    if(Math.hypot(a[0]-b[0],a[1]-b[1])<1e-4)pts.pop()
  }
  return pts
}

function cmdsToSegments(cmds){
  const segs=[]
  for(const sub of splitCmdsIntoSubpaths(cmds)){
    const poly=cmdsToPolyline(sub,{arcSegs:8})
    for(let i=0;i<poly.length-1;i++){
      const a=poly[i],b=poly[i+1]
      if(Math.hypot(a[0]-b[0],a[1]-b[1])<1e-6)continue
      segs.push({x1:a[0],y1:a[1],x2:b[0],y2:b[1]})
    }
    if(poly.length>=3){
      const a=poly[poly.length-1],b=poly[0]
      if(Math.hypot(a[0]-b[0],a[1]-b[1])>1e-4)segs.push({x1:a[0],y1:a[1],x2:b[0],y2:b[1]})
    }
  }
  return segs
}

function pickLayer(j){
  if(!j?.layer)return null
  if(j.layer.traditional)return j.layer.traditional
  const keys=Object.keys(j.layer)
  return keys.length?j.layer[keys[0]]:null
}

function parseFoldName(name){
  const s=String(name||'').trim()
  if(!s||s==='x'||s==='X')return null
  const i=s.indexOf('_')
  if(i<=0||i>=s.length-1)return null
  const parent=s.slice(0,i),child=s.slice(i+1)
  if(!parent||!child||parent==='x'||child==='x')return null
  return {parent,child}
}

function inferSide(parent,child){
  if(!parent||!child)return 'top'
  const pcx=parent.x+parent.w/2,pcy=parent.y+parent.h/2
  const ccx=child.x+child.w/2,ccy=child.y+child.h/2
  const dx=ccx-pcx,dy=ccy-pcy
  if(Math.abs(dx)>=Math.abs(dy))return dx>=0?'right':'left'
  return dy>=0?'bottom':'top'
}

function defaultFoldDeg(faceName){
  const n=String(faceName||'')
  if(/^(HT|HL|HB|FT|FRT|FLT|FLB|FRB)/i.test(n)||/Hook|Lock|Tuck/i.test(n))return -155
  return -90
}

/** 累加各阶段带符号转角（自锁底常先 -120 再 +30 → 净 -90） */
function angleMapFromAnimation(ly){
  const map={}
  for(const stage of foldStagesFromAnimation(ly?.animation?.animations)){
    for(const step of stage){
      if(!step.child)continue
      map[step.child]=(map[step.child]||0)+step.rotate
    }
  }
  return map
}

function buildHoles(ly){
  const holes=[]
  for(const f of ly.faces||[]){
    for(const h of f.holes||[]){
      const cmds=Array.isArray(h)?h:(h.dlist||[])
      if(!cmds.length)continue
      const loop=cmdsToPolyline(cmds)
      if(loop.length<3)continue
      holes.push({face:f.name,loop,path:pathFromCmds(cmds)})
    }
  }
  for(const h of ly.holes||[]){
    const cmds=Array.isArray(h)?h:(h.dlist||[])
    if(!cmds.length)continue
    holes.push({face:h.face||null,loop:cmdsToPolyline(cmds),path:pathFromCmds(cmds)})
  }
  return holes
}

/** 无向连通分量；不把不同坯件硬并到同一根 */
function connectedComponents(faceNames,folds){
  const adj=new Map([...faceNames].map(n=>[n,new Set()]))
  for(const fo of folds||[]){
    const p=parseFoldName(fo.name)
    if(!p)continue
    if(!adj.has(p.parent)||!adj.has(p.child))continue
    adj.get(p.parent).add(p.child)
    adj.get(p.child).add(p.parent)
  }
  const seen=new Set(),comps=[]
  for(const n of faceNames){
    if(seen.has(n))continue
    const q=[n],comp=[]
    seen.add(n)
    while(q.length){
      const u=q.pop();comp.push(u)
      for(const v of adj.get(u)||[]){
        if(seen.has(v))continue
        seen.add(v);q.push(v)
      }
    }
    comps.push(comp)
  }
  return comps
}

/**
 * @param {object} raw Pacdora geom JSON
 * @param {{sourceNum?:string,label?:string,length?:number,width?:number,height?:number,thickness?:number}} meta
 */
export function knifeFromPacdoraGeom(raw,meta={}){
  const ly=pickLayer(raw)
  if(!ly?.faces?.length)throw new Error('pacdora geom: no faces')

  const angleMap=angleMapFromAnimation(ly)
  const faceList=ly.faces||[]
  const faceNames=new Set(faceList.map(f=>f.name))
  const byRaw=Object.fromEntries(faceList.map(f=>[f.name,f]))

  const parentOf=new Map()
  const foldByChild=new Map()
  for(const fo of ly.folds||[]){
    const parsed=parseFoldName(fo.name)
    if(!parsed)continue
    if(!faceNames.has(parsed.parent)||!faceNames.has(parsed.child))continue
    if(parsed.parent===parsed.child)continue
    // 同名折线以首次为准；动画里的 Parent_Child 与 folds 一致
    if(!parentOf.has(parsed.child)){
      parentOf.set(parsed.child,parsed.parent)
      foldByChild.set(parsed.child,fo)
    }
  }

  // 破环：若 child 链回到自身，取消最后一条
  for(const child of [...parentOf.keys()]){
    const seen=new Set()
    let n=child
    while(parentOf.has(n)){
      if(seen.has(n)){parentOf.delete(child);foldByChild.delete(child);break}
      seen.add(n)
      n=parentOf.get(n)
    }
  }

  const comps=connectedComponents(faceNames,ly.folds)
  const rootSet=new Set()
  for(const comp of comps){
    const candidates=comp.filter(n=>!parentOf.has(n))
    const root=candidates.sort((a,b)=>(byRaw[b].w*byRaw[b].h)-(byRaw[a].w*byRaw[a].h))[0]||comp[0]
    rootSet.add(root)
    for(const n of comp){
      if(n===root)continue
      if(!parentOf.has(n)){
        // 分量内仍无父的面：挂到同分量 root（仅同坯），避免跨件硬连
        parentOf.set(n,root)
      }
    }
  }

  const faces=faceList.map(f=>{
    const outline=cmdsToPolyline(f.dlist||[])
    const isRoot=rootSet.has(f.name)
    const parent=isRoot?null:(parentOf.get(f.name)||null)
    const parentFace=parent?byRaw[parent]:null
    const side=parent?inferSide(
      {x:parentFace?.x??0,y:parentFace?.y??0,w:parentFace?.w??0,h:parentFace?.h??0},
      {x:f.x,y:f.y,w:f.w,h:f.h}
    ):null
    const face={
      name:f.name,
      x:Number(f.x)||0,
      y:Number(f.y)||0,
      w:Number(f.w)||0,
      h:Number(f.h)||0,
      parent,
      side,
      dlist:f.dlist||[]
    }
    if(outline.length>=3)face.outline=outline
    const fo=foldByChild.get(f.name)
    if(fo&&Number.isFinite(fo.x1)){
      face.hingeLine=[[fo.x1,fo.y1],[fo.x2,fo.y2]]
    }
    return face
  })

  const folds=(ly.folds||[]).map(fo=>({
    name:fo.name,
    x1:fo.x1,y1:fo.y1,x2:fo.x2,y2:fo.y2
  })).filter(fo=>parseFoldName(fo.name)||fo.name) // 保留几何折线供 2D；无效名仍画线

  const cutSubs=splitCmdsIntoSubpaths(ly.cuts||[])
  const bleedSubs=splitCmdsIntoSubpaths(ly.bleeds||[])
  const cutPaths=cutSubs.map(pathFromCmds).filter(Boolean)
  // 官方 bleed 再等距外扩默认 +10mm（紧贴的多件先合并）
  const bleedLoops=expandBleedLoops(
    bleedSubs.map(sub=>cmdsToPolyline(sub,{arcSegs:8})),
    BLEED_EXTRA_MM
  )
  const bleedPaths=bleedLoops.map(loop=>{
    if(!loop.length)return ''
    return loop.map((p,i)=>`${i?'L':'M'} ${p[0]} ${p[1]}`).join(' ')+' Z'
  }).filter(Boolean)
  const cutPath=cutPaths.join(' ')
  const bleedPath=bleedPaths.join(' ')
  const cuts=cmdsToSegments(ly.cuts||[])
  const bleeds=bleedLoops.flatMap(loop=>{
    const segs=[]
    for(let i=0;i<loop.length;i++){
      const a=loop[i],b=loop[(i+1)%loop.length]
      if(Math.hypot(a[0]-b[0],a[1]-b[1])<1e-6)continue
      segs.push({x1:a[0],y1:a[1],x2:b[0],y2:b[1]})
    }
    return segs
  })

  const foldStages=foldStagesFromAnimation(ly?.animation?.animations)
  const axisByChild={}
  for(const stage of foldStages)for(const s of stage){
    if(s.child&&s.vector&&!axisByChild[s.child])axisByChild[s.child]=s.vector
  }
  const hinges=faces.filter(f=>f.parent).map(f=>{
    const signed=Number.isFinite(angleMap[f.name])?angleMap[f.name]:defaultFoldDeg(f.name)
    const h={parent:f.parent,child:f.name,side:f.side,angle:signed}
    if(f.hingeLine)h.hingeLine=f.hingeLine
    if(axisByChild[f.name])h.axisVec=axisByChild[f.name]
    return h
  })

  const holes=buildHoles(ly)
  const xs=[],ys=[]
  for(const f of faces){
    xs.push(f.x,f.x+f.w);ys.push(f.y,f.y+f.h)
    for(const p of f.outline||[]){xs.push(p[0]);ys.push(p[1])}
  }
  const minX=Math.min(...xs),minY=Math.min(...ys),maxX=Math.max(...xs),maxY=Math.max(...ys)

  const size=raw.size||{}
  const L=Number(meta.length??size.L)||0
  const W=Number(meta.width??size.W)||0
  const H=Number(meta.height??size.H)||0
  const T=Number(meta.thickness??ly.thickness??size.D)||1.5
  const sourceNum=String(meta.sourceNum||raw.cate_no||'')
  const bleedSrc=Number(ly.bleedline)||5
  const bleedEff=bleedSrc+BLEED_EXTRA_MM

  const layers={
    trim:{role:'trim',color:'#2028b0',segments:cuts},
    crease:{role:'crease',color:'#fa0000',dash:true,segments:folds.filter(f=>Number.isFinite(f.x1)).map(f=>({x1:f.x1,y1:f.y1,x2:f.x2,y2:f.y2}))},
    bleed:{role:'bleed',color:'#46ba00',segments:bleeds}
  }

  return {
    schema:'boxcraft.knife.v3',
    unit:'mm',
    template:`pacdora-geom:${sourceNum}`,
    templateInfo:{
      id:`pacdora-geom:${sourceNum}`,
      label:meta.label||sourceNum,
      labelEn:'Pacdora shipping sample',
      standard:'官方样本刀版（运输箱例外）',
      sizeRule:'locked-sample'
    },
    sourceNum,
    geomMode:true,
    dimensions:{
      length:L,width:W,height:H,thickness:T,
      sizeMode:'inner',fluteDirection:'L',
      inner:{length:L,width:W,height:H},
      outer:{length:L,width:W,height:H},
      panel:{length:L,width:W,height:H}
    },
    material:{id:'kraft',science:'pacdora-sample',fluteDirection:'L'},
    bleed:bleedSrc,
    bleedEffective:bleedEff,
    params:{},
    faces,cuts,bleeds,folds,hinges,foldStages,layers,holes,
    cutPath,bleedPath,cutPaths,bleedPaths,
    meta:{anyPoly:true,fromPacdoraGeom:true,components:comps.length,foldStageCount:foldStages.length,bleedExtra:BLEED_EXTRA_MM,bleedEffective:bleedEff},
    topology:{
      root:[...rootSet][0]||faces[0]?.name,
      roots:[...rootSet],
      faceCount:faces.length,
      hingeCount:hinges.length,
      faceOrder:faces.map(f=>f.name),
      supportsClosedCheck:false,
      supportsPiece:false,
      holeCount:holes.length,
      anyPoly:true,
      components:comps.length
    },
    animation:ly.animation||{groups:[],animations:foldStages},
    sizeArrowData:sizeArrowDataFromBounds(
      {minX,minY,maxX,maxY},
      {length:L,width:W,height:H,sizeMode:'inner'}
    ),
    totalX:Math.round((maxX-minX)*1000)/1000,
    totalY:Math.round((maxY-minY)*1000)/1000,
    bounds:{minX,minY,maxX,maxY},
    manufacturingReady:false,
    productionReady:false,
    validation:{ok:true,checks:[{id:'pacdora-geom',ok:true,detail:'sample geometry playback'}]}
  }
}

export async function loadPacdoraGeomKnife(sourceNum,meta={}){
  const num=String(sourceNum||'')
  if(!num)throw new Error('missing sourceNum')
  if(cache.has(num))return cache.get(num)
  if(inflight.has(num))return inflight.get(num)
  const p=fetch(publicAssetUrl(`shipping-geom/${num}.json`))
    .then(r=>{
      if(!r.ok)throw new Error(`geom fetch ${num}: ${r.status}`)
      return r.json()
    })
    .then(raw=>{
      const knife=knifeFromPacdoraGeom(raw,{...meta,sourceNum:num})
      cache.set(num,knife)
      inflight.delete(num)
      return knife
    })
    .catch(err=>{
      inflight.delete(num)
      throw err
    })
  inflight.set(num,p)
  return p
}

export function clearPacdoraGeomCache(){
  cache.clear()
}
