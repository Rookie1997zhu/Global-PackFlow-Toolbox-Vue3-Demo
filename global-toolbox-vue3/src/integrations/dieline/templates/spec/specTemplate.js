// 结构规格模板：读取 structureSpecs（面片树 + 尺寸表达式 + 自由边内收图元），按当前尺寸自研生成面片。
// 规格不含刀版坐标；位置由父子铰接关系逐级推导。
import {pdef,round} from '../rea/shared.js'
import {flattenCubicPath} from '../../geom/flattenPath.js'

const MARGIN=20
const MIN_FACE=1

/** 面片名集合签名：同一 structureCode 下几何不同（如 KnifeDraw 手绘）时据此区分 */
export function faceSignature(names){
  return [...names].sort().join('|')
}

/** 表达式 {t,k,c}：t ∈ L/W/H/P:code/null，值 = k·base + c（不钳制） */
function evalRaw(e,panel,params){
  if(!e)return 0
  let base=0
  if(e.t==='L')base=panel.length
  else if(e.t==='W')base=panel.width
  else if(e.t==='H')base=panel.height
  else if(typeof e.t==='string'&&e.t.startsWith('P:'))base=Number(params[e.t.slice(2)])||0
  return (Number(e.k)||0)*base+(Number(e.c)||0)
}

function evalExpr(e,panel,params){
  return Math.max(MIN_FACE,evalRaw(e,panel,params))
}

/**
 * 内部折线的 hingeLine（相对子面 bbox 左上角）：取子面铰接边与父面跨度的重叠段，
 * 端点顺序保证正折角朝 +z（与 side 铰链约定一致）。
 */
function interiorHingeLine(side,child,parent){
  const alongH=side==='top'||side==='bottom'
  const lo=alongH?Math.max(child.x,parent.x):Math.max(child.y,parent.y)
  const hi=alongH?Math.min(child.x+child.w,parent.x+parent.w):Math.min(child.y+child.h,parent.y+parent.h)
  const a=hi-lo>=1?lo:(alongH?child.x:child.y)
  const b=hi-lo>=1?hi:(alongH?child.x+child.w:child.y+child.h)
  let seg
  if(side==='top')seg=[[a-child.x,child.h],[b-child.x,child.h]]
  else if(side==='bottom')seg=[[b-child.x,0],[a-child.x,0]]
  else if(side==='left')seg=[[child.w,b-child.y],[child.w,a-child.y]]
  else seg=[[0,a-child.y],[0,b-child.y]]
  return seg.map(([x,y])=>[round(x),round(y)])
}

/** 沿铰接边的偏移；钳住保证子面与父面至少一半重叠，保证折线存在 */
function alongOffset(o,parentLen,childLen){
  let v
  if(o?.align==='center')v=(parentLen-childLen)/2
  else if(o?.align==='end')v=parentLen-childLen-(Number(o.c)||0)
  else v=Number(o?.c)||0
  const m=Math.min(parentLen,childLen)*.5
  return Math.min(parentLen-m,Math.max(-childLen+m,v))
}

/** 自由边（铰链对边）两端内收 → 梯形；铰链边保持整边 */
function trapezoid(side,w,h,e){
  if(!e)return null
  const len=side==='top'||side==='bottom'?w:h
  let a=Math.min(Number(e.a)||0,len*.45),b=Math.min(Number(e.b)||0,len*.45)
  if(a<.3&&b<.3)return null
  if(side==='top')return [[a,0],[w-b,0],[w,h],[0,h]]
  if(side==='bottom')return [[0,0],[w,0],[w-b,h],[a,h]]
  if(side==='left')return [[0,a],[w,0],[w,h],[0,h-b]]
  return [[0,0],[w,a],[w,h-b],[0,h]]
}

/** UV 归一化点列 → 相对 bbox 左上角的绝对 mm（钳在 bbox 内） */
function expandUv(uv,w,h){
  if(!Array.isArray(uv)||!uv.length)return null
  return uv.map(([u,v])=>[
    round(Math.min(w,Math.max(0,Number(u)*w))),
    round(Math.min(h,Math.max(0,Number(v)*h)))
  ])
}

/** UV 三次贝塞尔命令 → 相对 bbox 折线（按实际 w/h 仿射后自适应展平） */
function expandOc(oc,w,h,side=null){
  if(!Array.isArray(oc)||!oc.length)return null
  const scaled=oc.map(c=>{
    if(!Array.isArray(c)||!c.length)return c
    const m=c[0]
    if(m==='M'||m==='L')return [m,Number(c[1])*w,Number(c[2])*h]
    if(m==='C')return [m,Number(c[1])*w,Number(c[2])*h,Number(c[3])*w,Number(c[4])*h,Number(c[5])*w,Number(c[6])*h]
    if(m==='Q')return [m,Number(c[1])*w,Number(c[2])*h,Number(c[3])*w,Number(c[4])*h]
    return c
  })
  let pts=flattenCubicPath(scaled,{tol:.25,maxPts:96})
  if(pts.length<3)return null
  pts=pts.map(([px,py])=>[
    round(Math.min(w,Math.max(0,px))),
    round(Math.min(h,Math.max(0,py)))
  ])
  // 侧铰：强制铰链边为 bbox 整边，满足 assertHingeEdgeIntact，并利于邻面共边
  if(side){
    // top=铰在子底边 y=h；bottom=铰在子顶边 y=0；left=铰在子右边 x=w；right=铰在子左边 x=0
    const hingeY=side==='top'?h:side==='bottom'?0:null
    const hingeX=side==='left'?w:side==='right'?0:null
    const onHinge=p=>{
      if(hingeX!=null)return Math.abs(p[0]-hingeX)<.6
      if(hingeY!=null)return Math.abs(p[1]-hingeY)<.6
      return false
    }
    // 去掉铰链边上的旧点，再按绕向插入整边两端
    pts=pts.filter(p=>!onHinge(p))
    if(pts.length<2)return null
    let a,b
    if(side==='top'){a=[0,h];b=[w,h]}
    else if(side==='bottom'){a=[w,0];b=[0,0]}
    else if(side==='left'){a=[w,h];b=[w,0]}
    else{a=[0,0];b=[0,h]}
    // 找离铰链边最近的开口，插入整边
    let bestI=0,bestD=Infinity
    for(let i=0;i<pts.length;i++){
      const p=pts[i],q=pts[(i+1)%pts.length]
      const d=hingeX!=null
        ?Math.min(Math.abs(p[0]-hingeX),Math.abs(q[0]-hingeX))
        :Math.min(Math.abs(p[1]-hingeY),Math.abs(q[1]-hingeY))
      if(d<bestD){bestD=d;bestI=i}
    }
    pts.splice(bestI+1,0,a,b)
  }
  return pts
}

/** 射线法：点是否在多边形内（含边界） */
function pointInPoly(px,py,poly){
  let inside=false
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){
    const xi=poly[i][0],yi=poly[i][1],xj=poly[j][0],yj=poly[j][1]
    if(Math.abs(yi-yj)<1e-9&&Math.abs(py-yi)<1e-9
      &&px>=Math.min(xi,xj)-1e-9&&px<=Math.max(xi,xj)+1e-9)return true
    const hit=((yi>py)!==(yj>py))&&(px<(xj-xi)*(py-yi)/((yj-yi)||1e-12)+xi)
    if(hit)inside=!inside
  }
  return inside
}

/** 孔位图元 → 绝对坐标孔（钳在面 bbox；多边形面要求四角在轮廓内） */
function expandHole(hs,fx,fy,fw,fh,faceOutline){
  if(!hs||!Number.isFinite(hs.u)||!Number.isFinite(hs.v))return null
  let hw,hh
  if(hs.sc===1){
    hw=Math.max(.5,Number(hs.fw||0)*fw)
    hh=Math.max(.5,Number(hs.fh||0)*fh)
  }else{
    hw=Math.min(Number(hs.w)||0,.9*fw)
    hh=Math.min(Number(hs.h)||0,.9*fh)
  }
  // 面太小放不下孔则丢弃
  if(hw<.5||hh<.5||hw>fw-1e-3||hh>fh-1e-3)return null
  const margin=Math.min(1,(fw-hw)/2,(fh-hh)/2)
  let cx=fx+Number(hs.u)*fw,cy=fy+Number(hs.v)*fh
  const xLo=fx+hw/2+margin,xHi=fx+fw-hw/2-margin
  const yLo=fy+hh/2+margin,yHi=fy+fh-hh/2-margin
  cx=xLo<=xHi?Math.min(xHi,Math.max(xLo,cx)):(fx+fw/2)
  cy=yLo<=yHi?Math.min(yHi,Math.max(yLo,cy)):(fy+fh/2)
  // 舍入后仍保证 bbox 落在面内
  let x=round(cx-hw/2),y=round(cy-hh/2)
  let w=round(hw),h=round(hh)
  if(x<fx)x=round(fx)
  if(y<fy)y=round(fy)
  if(x+w>fx+fw)w=round(fx+fw-x)
  if(y+h>fy+fh)h=round(fy+fh-y)
  if(w<.5||h<.5)return null
  if(Array.isArray(faceOutline)&&faceOutline.length>=3){
    const corners=[[x,y],[x+w,y],[x+w,y+h],[x,y+h]]
    if(!corners.every(([px,py])=>pointInPoly(px,py,faceOutline)))return null
  }
  const hole={x,y,w,h,r:round(Math.max(0,Math.min(Number(hs.r)||0,w/2,h/2)))}
  if(Array.isArray(hs.ol)&&hs.ol.length>=3){
    hole.outline=hs.ol.map(([u,v])=>[
      round(x+Math.min(1,Math.max(0,Number(u)))*w),
      round(y+Math.min(1,Math.max(0,Number(v)))*h)
    ])
  }
  return hole
}

const PIECE_GAP=40

export function createSpecTemplate(spec){
  const pieces=Array.isArray(spec.pieces)&&spec.pieces.length
    ?spec.pieces.map(p=>({id:p.id,label:p.label||p.id,role:p.role,root:p.root,faces:p.faces}))
    :null
  const supportsPiece=!!(spec.supportsPiece||(pieces&&pieces.length>1))
  const allNames=Object.freeze(spec.faces.map(f=>f.n))
  const defaultPieceId=pieces?.[0]?.id||'bottom'

  const resolvePieceId=piece=>{
    if(!supportsPiece||!pieces)return null
    if(piece&&pieces.some(p=>p.id===piece))return piece
    return defaultPieceId
  }

  const facesFor=(pieceId)=>{
    if(!pieceId)return spec.faces
    return spec.faces.filter(f=>(f.piece||defaultPieceId)===pieceId)
  }

  const rootFor=(pieceId)=>{
    if(pieceId&&pieces){
      const meta=pieces.find(p=>p.id===pieceId)
      if(meta?.root)return meta.root
    }
    return spec.root
  }

  return {
    id:`spec-${spec.code}`,
    label:spec.name,
    labelEn:spec.code,
    standard:`结构规格 · 样本 ${spec.sampleNum}`,
    root:spec.root,
    faceOrder:(params,layoutOut)=>layoutOut?.faceOrder||allNames,
    supportsClosedCheck:true,
    supportsPiece,
    assembly:pieces&&pieces.length>2?'row':(supportsPiece?'stack':undefined),
    defaults:{...spec.defaults},
    limits:spec.limits,
    sizeRule:spec.sizeRule,
    specRef:{code:spec.code,sampleNum:spec.sampleNum,structureCode:spec.structureCode||spec.code},
    pieces:pieces||undefined,
    paramDefs:(spec.params||[]).map(p=>pdef(p.code,p.label,'结构参数',()=>p.def,{min:p.min,max:p.max})),
    // 带符号折角：负值表示反向折（如托盘双层翻边），缺省 90°
    hingeAngles:Object.fromEntries(spec.faces.filter(f=>f.p&&Number.isFinite(f.a)).map(f=>[f.n,f.a])),
    closedCheck:{
      pairs:[],
      buildBoxes(){return {}}
    },
    layout({panel,params,piece=defaultPieceId}){
      const pieceId=resolvePieceId(piece)
      const active=facesFor(pieceId)
      const activeRoot=rootFor(pieceId)
      const rects=new Map()
      const out=[]
      // 多 root（多坯同图）：按件横向错开，禁止叠在 (0,0)
      let originX=0,runMaxX=0,seenRoot=false
      for(const f of active){
        const w=round(evalExpr(f.w,panel,params)),h=round(evalExpr(f.h,panel,params))
        if(!f.p){
          if(seenRoot)originX=runMaxX+PIECE_GAP
          seenRoot=true
          const x=originX,y=0
          runMaxX=Math.max(runMaxX,x+w)
          rects.set(f.n,{x,y,w,h})
          out.push({f,x,y,w,h})
          continue
        }
        const p=rects.get(f.p)
        if(!p)continue
        let x,y
        if(f.o2&&!f.s){
          // 斜铰链 / 非轴对齐：二维 bbox 偏移（hingeLine 显式给出折轴）
          x=p.x+evalRaw(f.o2.ox,panel,params)
          y=p.y+evalRaw(f.o2.oy,panel,params)
        }else{
          // 折线位置：父面边，或父面内部（距起/止边 d，钳在父面跨度内）
          const foldAt=(start,len,edge)=>{
            if(!f.f)return edge
            const d=Math.min(len,Math.max(0,evalRaw(f.f.d,panel,params)))
            return f.f.from==='end'?start+len-d:start+d
          }
          if(f.s==='top'||f.s==='bottom'){
            x=p.x+alongOffset(f.o,p.w,w)
            const fy=foldAt(p.y,p.h,f.s==='top'?p.y:p.y+p.h)
            y=f.s==='top'?fy-h:fy
          }else{
            y=p.y+alongOffset(f.o,p.h,h)
            const fx=foldAt(p.x,p.w,f.s==='left'?p.x:p.x+p.w)
            x=f.s==='left'?fx-w:fx
          }
        }
        // 逐级舍入：相邻面共边坐标必须严格相等，否则折线识别失败
        x=round(x);y=round(y)
        runMaxX=Math.max(runMaxX,x+w)
        rects.set(f.n,{x,y,w,h})
        out.push({f,x,y,w,h})
      }
      if(!out.length)return {faces:[],arrows:{},faceOrder:[],root:activeRoot,holes:[]}
      const minX=Math.min(...out.map(r=>r.x)),minY=Math.min(...out.map(r=>r.y))
      const dx=round(MARGIN-minX),dy=round(MARGIN-minY)
      const holes=[]
      const faces=out.map(({f,x,y,w,h})=>{
        // 内部折 / 斜铰链：side 置空，用 hingeLine
        const useHl=!!(f.f||(f.hl&&!f.s))
        const fx=round(x+dx),fy=round(y+dy)
        const tuple=[f.n,fx,fy,w,h,f.p||null,useHl?null:(f.s||null)]
        const shape={}
        // 外形优先级：oc > outline > 梯形；侧铰 oc 强制补齐铰链整边
        const ocOl=expandOc(f.oc,w,h,useHl?null:f.s)
        if(ocOl&&ocOl.length>=3)shape.outline=ocOl
        else{
          const uvOl=expandUv(f.outline,w,h)
          if(uvOl&&uvOl.length>=3)shape.outline=uvOl
          else if(f.p&&f.s){
            const trap=trapezoid(f.s,w,h,f.e)
            if(trap)shape.outline=trap.map(([px,py])=>[round(px),round(py)])
          }
        }
        if(f.hl&&!f.s){
          const hl=expandUv(f.hl,w,h)
          if(hl?.length===2)shape.hingeLine=hl
        }else if(f.f){
          shape.hingeLine=interiorHingeLine(f.s,{x,y,w,h},rects.get(f.p))
        }
        // 孔位：相对 UV → 绝对坐标；多边形面要求四角在轮廓内
        const absOl=shape.outline?.map(([px,py])=>[fx+px,fy+py])||null
        for(const hs of f.hs||[]){
          const hole=expandHole(hs,fx,fy,w,h,absOl)
          if(hole)holes.push({...hole,face:f.n})
        }
        return Object.keys(shape).length?[...tuple,shape]:tuple
      })
      const r=rects.get(activeRoot)||rects.get(out[0].f.n)
      const rx=r.x+dx,ry=r.y+dy
      const arrows={
        length:[{x:rx,y:ry+r.h*.3},{x:rx+r.w,y:ry+r.h*.3}],
        width:[{x:rx+r.w*.7,y:ry},{x:rx+r.w*.7,y:ry+r.h}],
        height:[{x:rx+r.w*.5,y:ry},{x:rx+r.w*.5,y:ry+r.h}]
      }
      return {
        faces,
        arrows,
        holes,
        faceOrder:out.map(o=>o.f.n),
        root:activeRoot,
        piece:pieceId||undefined
      }
    }
  }
}
