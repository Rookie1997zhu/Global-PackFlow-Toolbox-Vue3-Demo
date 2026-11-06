/**
 * 离屏渲染合盖态 3D 缩略图（dataURL），按 templateId 缓存。
 * assembly: stack（天地盖）/ sleeve（抽屉袖套）/ row（多件并排）。
 */
import * as THREE from 'three'
import {renderSceneToDataUrl} from './thumbRenderer.js'
import {createKnife} from './knife.js'
import {getTemplate} from './templates/index.js'
import {neutralMeshOffset,foldRotation} from './foldSim.js'
import {ensureBoardPack,createBoardMaterial} from './boardMaterial.js'

const cache=new Map()

function disposeTree(node){
  node.traverse(o=>{
    o.geometry?.dispose()
    if(o.material){
      const ms=Array.isArray(o.material)?o.material:[o.material]
      ms.forEach(m=>m.dispose())
    }
  })
}

function panelMesh(f,T,materialId,faceHoles=[],{colorScale=1}={}){
  const shape=new THREE.Shape()
  const cx=f.x+f.w/2,cy=f.y+f.h/2
  if(Array.isArray(f.outline)&&f.outline.length>=3){
    f.outline.forEach((p,i)=>{
      const x=p[0]-cx,y=-(p[1]-cy)
      if(i)shape.lineTo(x,y); else shape.moveTo(x,y)
    })
    shape.closePath()
  }else{
    shape.moveTo(-f.w/2,-f.h/2)
    shape.lineTo(f.w/2,-f.h/2)
    shape.lineTo(f.w/2,f.h/2)
    shape.lineTo(-f.w/2,f.h/2)
    shape.closePath()
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
  const mat=createBoardMaterial(materialId,{flatShading:!f.smooth})
  if(colorScale!==1)mat.color.multiplyScalar(colorScale)
  const mesh=new THREE.Mesh(geo,mat)
  mesh.position.z=neutralMeshOffset(T).z
  return mesh
}

/** 列表缩略图：插舌/锁舌/挂耳缺省角（度）；其余缺省 90 */
function defaultFoldDeg(faceName){
  const n=String(faceName||'')
  if(/^(HT|HL|HB|FT|FRT|FLT)/i.test(n)||/Hook|Lock|Tuck/i.test(n))return 155
  return 90
}

function resolveFoldDeg(knife,faceName){
  const h=knife.hinges?.find(x=>x.child===faceName)
  if(h&&Number.isFinite(h.angle))return h.angle
  return defaultFoldDeg(faceName)
}

function buildClosedGroup(knife,materialId='kraft',{colorScale=1,foldProgress=.78}={}){
  const T=Number(knife.dimensions.thickness)||1.5
  const root=new THREE.Group()
  const byName=Object.fromEntries(knife.faces.map(f=>[f.name,f]))
  const holesByFace=new Map()
  for(const h of knife.holes||[]){
    if(!h?.face)continue
    if(!holesByFace.has(h.face))holesByFace.set(h.face,[])
    holesByFace.get(h.face).push(h)
  }
  const world=new Map()
  const zOff=neutralMeshOffset(T).z
  const hingeAnchors=[]
  const prog=Math.max(0,Math.min(1,Number(foldProgress)||.78))

  function attach(name){
    if(world.has(name))return world.get(name)
    const f=byName[name]
    const mesh=panelMesh(f,T,materialId,holesByFace.get(name)||[],{colorScale})
    mesh.userData.face=f
    let anchor
    if(!f.parent){
      anchor=new THREE.Group()
      root.add(anchor)
      anchor.add(mesh)
      world.set(name,{anchor,mesh})
      return world.get(name)
    }
    const p=byName[f.parent],parent=attach(f.parent)
    const side=f.side
    anchor=new THREE.Group()
    const dx=(f.x+f.w/2)-(p.x+p.w/2),dy=-((f.y+f.h/2)-(p.y+p.h/2))
    let hx=0,hy=0,axis=null
    if(Array.isArray(f.hingeLine)&&f.hingeLine.length===2){
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
    anchor.position.set(hx,hy,0)
    parent.mesh.add(anchor)
    mesh.position.set(dx-hx,dy-hy,zOff)
    anchor.add(mesh)
    const angle=resolveFoldDeg(knife,name)*prog*Math.PI/180
    hingeAnchors.push({anchor,side,axis,angle})
    world.set(name,{anchor,mesh})
    return world.get(name)
  }

  knife.faces.forEach(f=>attach(f.name))
  for(const h of hingeAnchors){
    if(h.axis){
      const q=new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(h.axis.x,h.axis.y,h.axis.z).normalize(),
        h.angle
      )
      h.anchor.setRotationFromQuaternion(q)
    }else{
      const r=foldRotation(h.side,h.angle)
      h.anchor.rotation.set(r.x,r.y,r.z)
    }
  }
  return root
}

function makeKnife(templateId,d,materialId,piece){
  const params={}
  if(d.sides!=null)params.sides=d.sides
  if(d.lidHeight!=null)params.lidHeight=d.lidHeight
  if(d.lidClearance!=null)params.lidClearance=d.lidClearance
  return createKnife({
    templateId,
    length:d.length,width:d.width,height:d.height,
    thickness:d.thickness,bleed:0,materialId,
    piece,
    lidClearance:d.lidClearance,
    params
  })
}

function alignXY(target,ref){
  target.updateMatrixWorld(true)
  ref.updateMatrixWorld(true)
  const a=new THREE.Box3().setFromObject(ref).getCenter(new THREE.Vector3())
  const b=new THREE.Box3().setFromObject(target).getCenter(new THREE.Vector3())
  target.position.x+=a.x-b.x
  target.position.y+=a.y-b.y
}

/**
 * 合盖姿态下各轴两端的面片覆盖率（0~1），与面片命名无关。
 */
export function closedCoverage(knife){
  const group=buildClosedGroup(knife)
  group.updateMatrixWorld(true)
  const items=[]
  const nrm=new THREE.Vector3(),pos=new THREE.Vector3(),q=new THREE.Quaternion()
  group.traverse(o=>{
    const f=o.userData?.face
    if(!f)return
    o.getWorldPosition(pos)
    o.getWorldQuaternion(q)
    nrm.set(0,0,1).applyQuaternion(q)
    items.push({c:pos.toArray(),n:nrm.toArray(),area:f.w*f.h})
  })
  disposeTree(group)
  const box=new THREE.Box3()
  for(const it of items)box.expandByPoint(new THREE.Vector3(...it.c))
  const size=box.getSize(new THREE.Vector3()).toArray()
  const lo=box.min.toArray(),hi=box.max.toArray()
  return [0,1,2].map(axis=>{
    const cross=size[(axis+1)%3]*size[(axis+2)%3]||1
    const band=Math.max(3,size[axis]*.35)
    const cover=(inBand)=>Math.min(1,items
      .filter(it=>inBand(it.c[axis]))
      .reduce((s,it)=>s+it.area*Math.abs(it.n[axis]),0)/cross)
    return {
      min:cover(v=>v<=lo[axis]+band),
      max:cover(v=>v>=hi[axis]-band)
    }
  })
}

const kindCache=new Map()

function specStructureKind(t){
  if(kindCache.has(t.id))return kindCache.get(t.id)
  let kind={id:'lidded',label:'有盖'}
  try{
    const knife=makeKnife(t.id,t.defaults||{},'kraft',t.pieces?.[0]?.id||'bottom')
    const cov=closedCoverage(knife)
    const openAxes=cov.map(a=>(a.min<.5?1:0)+(a.max<.5?1:0))
    const open=openAxes.reduce((s,n)=>s+n,0)
    if(open===1)kind={id:'openTop',label:'开顶托盘'}
    else if(open===2&&openAxes.includes(2))kind={id:'openTop',label:'开顶套筒'}
    else if(open>=2)kind={id:'special',label:'异形'}
  }catch(e){
    console.warn('specStructureKind failed',t.id,e)
  }
  kindCache.set(t.id,kind)
  return kind
}

/** 卡片结构类型 */
export function structureKind(template){
  const t=typeof template==='string'?getTemplate(template):template
  if(!t)return {id:'unknown',label:'结构'}
  if(t.id==='sleeve-drawer'||t.assembly==='sleeve')return {id:'sleeveDrawer',label:'抽屉+袖套'}
  if(t.id==='cylinder-box')return {id:'cylinder',label:'圆筒盒'}
  if(t.supportsPiece&&Array.isArray(t.pieces)&&t.pieces.length>2)return {id:'multiPiece',label:'多件组合'}
  if(t.supportsPiece)return {id:'telescoping',label:'天地盖成套'}
  if(t.specRef)return specStructureKind(t)
  if(t.id==='rea-flat-sheet'||(t.limits?.height?.[1]===0&&t.limits?.height?.[0]===0)){
    return {id:'flat',label:'平板'}
  }
  const order=t.faceOrder
  const names=typeof order==='function'
    ? (order(t.defaults?{P:5}:{})||[])
    : (Array.isArray(order)?order:[])
  const hasLid=names.some(n=>
    /^(lid|topLid|topLeft|topRight|cover)/i.test(n)
    ||/Top$/.test(n)
    ||n==='F'
  )
  if(t.id==='rea-star-box')return {id:'lidded',label:'有盖'}
  if(hasLid)return {id:'lidded',label:'有盖'}
  if(/sleeve/i.test(t.id))return {id:'openTop',label:'开顶套筒'}
  return {id:'openTop',label:'开顶托盘'}
}

function placeBeside(wrap,g,x){
  g.updateMatrixWorld(true)
  const box=new THREE.Box3().setFromObject(g)
  const c=box.getCenter(new THREE.Vector3())
  const size=box.getSize(new THREE.Vector3())
  g.position.x+=x-c.x
  g.position.y-=c.y
  g.position.z-=c.z
  wrap.add(g)
  return size.x
}

function stackLidOn(bottom,lid){
  lid.rotation.x=Math.PI
  bottom.updateMatrixWorld(true)
  lid.updateMatrixWorld(true)
  const botBox=new THREE.Box3().setFromObject(bottom)
  const lidBox=new THREE.Box3().setFromObject(lid)
  const botC=botBox.getCenter(new THREE.Vector3())
  const lidC=lidBox.getCenter(new THREE.Vector3())
  lid.position.x+=botC.x-lidC.x
  lid.position.y+=botC.y-lidC.y
  const lidH=Math.max(1,lidBox.max.z-lidBox.min.z)
  lid.position.z+=botBox.max.z+(lidH*.35)-lidBox.min.z
}

function nestInsert(main,insert,{scale=.85}={}){
  main.updateMatrixWorld(true)
  insert.updateMatrixWorld(true)
  const mBox=new THREE.Box3().setFromObject(main)
  const iBox=new THREE.Box3().setFromObject(insert)
  const mSize=mBox.getSize(new THREE.Vector3())
  const iSize=iBox.getSize(new THREE.Vector3())
  const sx=mSize.x*scale/(iSize.x||1)
  const sy=mSize.y*scale/(iSize.y||1)
  const s=Math.min(sx,sy,1)
  insert.scale.setScalar(s)
  insert.updateMatrixWorld(true)
  const iBox2=new THREE.Box3().setFromObject(insert)
  const mC=mBox.getCenter(new THREE.Vector3())
  const iC=iBox2.getCenter(new THREE.Vector3())
  insert.position.x+=mC.x-iC.x
  insert.position.y+=mC.y-iC.y
  insert.position.z+=mBox.min.z+2-iBox2.min.z
}

/** 管式/插舌类 templateId（伪天地盖勿 stack） */
function isTubeLikeTemplateId(templateId){
  const id=String(templateId||'')
  return /^spec-(Pair|SealReverse|AntilifeAircraft|BuckleWithWindowHook|BotselflockWithWindowHook)/i.test(id)
    ||/Pair|Aircraft|SealReverse|WindowHook/i.test(id)
}

function faceNameSet(p){return new Set((p?.faces||[]).map(String))}
function jaccardSets(A,B){
  if(!A.size&&!B.size)return 1
  let inter=0
  for(const x of A)if(B.has(x))inter++
  return inter/(A.size+B.size-inter||1)
}
function hasTubeFaces(names){
  let n=0
  for(const x of names)if(/^(H|F|L|R|HB|FB|HL|HR|FL|FR)(\d|$)/i.test(x)||x==='H'||x==='F'||x==='L'||x==='R')n++
  return n>=2
}

/** 误拆成 bottom+lid 的管式盒：只渲主件 */
function isFakeLidStack(templateId,pieces){
  if(!pieces||pieces.length!==2)return false
  if(isTubeLikeTemplateId(templateId))return true
  const a=faceNameSet(pieces[0]),b=faceNameSet(pieces[1])
  return jaccardSets(a,b)>=.25&&hasTubeFaces(a)&&hasTubeFaces(b)
}

function assemblePieces(templateId,t,d,materialId){
  const wrap=new THREE.Group()
  const pieces=t.pieces||[]
  const hasRole=pieces.some(p=>p.role)
  let mode=t.assembly||(pieces.length>2?'row':'stack')
  if(hasRole){
    if(pieces.some(p=>p.role==='sleeve'))mode='sleeve'
    else if(pieces.some(p=>p.role==='lid'))mode='stack'
    else mode='row'
  }

  const dims=templateId==='cylinder-box'?{...d,sides:d.sides||36}:d

  if(mode==='stack'&&isFakeLidStack(templateId,pieces)){
    const mainId=pieces.find(p=>p.role==='main'||p.id==='bottom')?.id||pieces[0].id
    wrap.add(buildClosedGroup(makeKnife(templateId,dims,materialId,mainId),materialId))
    return wrap
  }

  if(mode==='sleeve'&&pieces.length>=2){
    const drawerId=pieces.find(p=>p.id==='drawer'||p.role==='main')?.id||pieces[0].id
    const sleeveId=pieces.find(p=>p.id==='sleeve'||p.role==='sleeve')?.id||pieces[1].id
    const drawer=buildClosedGroup(makeKnife(templateId,dims,materialId,drawerId),materialId)
    const sleeve=buildClosedGroup(makeKnife(templateId,dims,materialId,sleeveId),materialId,{colorScale:1.05})
    wrap.add(sleeve)
    wrap.add(drawer)
    alignXY(drawer,sleeve)
    sleeve.updateMatrixWorld(true)
    drawer.updateMatrixWorld(true)
    const sBox=new THREE.Box3().setFromObject(sleeve)
    const size=sBox.getSize(new THREE.Vector3())
    drawer.position.x+=size.x*.35
    return wrap
  }

  if(mode==='stack'&&pieces.length>=2){
    const mainId=pieces.find(p=>p.role==='main'||p.id==='bottom')?.id||pieces[0].id
    const lidId=pieces.find(p=>p.role==='lid'||p.id==='lid')?.id
    const main=buildClosedGroup(makeKnife(templateId,dims,materialId,mainId),materialId)
    wrap.add(main)
    if(lidId){
      const lid=buildClosedGroup(makeKnife(templateId,dims,materialId,lidId),materialId,{colorScale:1.06})
      wrap.add(lid)
      stackLidOn(main,lid)
    }
    for(const p of pieces){
      if(p.id===mainId||p.id===lidId)continue
      if(p.role==='insert'||p.role==='flat'){
        const g=buildClosedGroup(makeKnife(templateId,dims,materialId,p.id),materialId,{colorScale:.95})
        wrap.add(g)
        nestInsert(main,g)
      }else{
        const g=buildClosedGroup(makeKnife(templateId,dims,materialId,p.id),materialId,{colorScale:1.04})
        const mBox=new THREE.Box3().setFromObject(main)
        placeBeside(wrap,g,mBox.max.x+20)
      }
    }
    return wrap
  }

  if(mode==='row'&&pieces.length>=2){
    let x=0
    for(let i=0;i<pieces.length;i++){
      const g=buildClosedGroup(makeKnife(templateId,dims,materialId,pieces[i].id),materialId,{colorScale:1+i*.04})
      x+=placeBeside(wrap,g,x)+20
    }
    return wrap
  }

  wrap.add(buildClosedGroup(makeKnife(templateId,dims,materialId,pieces[0]?.id||'bottom'),materialId))
  return wrap
}

/**
 * @returns {Promise<string>} dataURL png
 */
export async function renderClosedThumb(templateId,{size=360,materialId='kraft'}={}){
  const key=`${templateId}|${materialId}|${size}|v8pbr`
  if(cache.has(key))return cache.get(key)

  try{
    try{await ensureBoardPack(materialId)}catch{/* 纯色回退 */}
    const t=getTemplate(templateId)
    const d=t.defaults||{}
    const scene=new THREE.Scene()
    scene.background=new THREE.Color(0xf3f5f8)
    scene.add(new THREE.HemisphereLight(0xffffff,0x8a8d93,2.4))
    const sun=new THREE.DirectionalLight(0xffffff,1.8)
    sun.position.set(220,280,260)
    scene.add(sun)

    const wrap=assemblePieces(templateId,t,d,materialId)
    scene.add(wrap)

    const box=new THREE.Box3().setFromObject(wrap)
    const center=box.getCenter(new THREE.Vector3())
    const sphere=box.getBoundingSphere(new THREE.Sphere())
    const r=Math.max(sphere.radius,20)

    const fov=36
    const camera=new THREE.PerspectiveCamera(fov,1,.1,r*20)
    const dist=r/Math.sin(fov*Math.PI/360)*1.08
    const dir=new THREE.Vector3(1.6,-1.7,1.35).normalize()
    camera.position.copy(center).addScaledVector(dir,dist)
    camera.lookAt(center)

    const url=renderSceneToDataUrl(scene,camera,size)
    disposeTree(wrap)
    cache.set(key,url)
    return url
  }catch(e){
    console.warn('thumb fail',templateId,e)
    return ''
  }
}

export function clearThumbCache(){cache.clear()}
