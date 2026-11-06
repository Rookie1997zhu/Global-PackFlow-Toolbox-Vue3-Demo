/**
 * 官方几何 3D 骨架：回放 Pacdora 动画（旋转 + 平移），工位与列表封面共用。
 * 刀版坐标 (x 右, y 下, z 入纸) → 场景 (x, -y, -z)，保持右手系，转角符号不变。
 */
import * as THREE from 'three'
import {foldRotation} from './foldSim.js'
import {anglesAtProgress,translationsAtProgress,translatedFaces} from './foldStages.js'

const ZERO=Object.freeze({x:0,y:0,z:0})

function smoothstep(x){
  const u=Math.max(0,Math.min(1,x))
  return u*u*(3-2*u)
}

/** 动画 vector 为准；桥接折线常为零长度，不能用来定轴 */
function hingeAxis(face,hinge){
  const v=hinge?.axisVec
  if(v){
    const x=Number(v.x)||0,y=-(Number(v.y)||0),z=-(Number(v.z)||0)
    const len=Math.hypot(x,y,z)
    if(len>1e-12)return new THREE.Vector3(x/len,y/len,z/len)
  }
  if(Array.isArray(face.hingeLine)&&face.hingeLine.length===2){
    const [[ax,ay],[bx,by]]=face.hingeLine
    const x=bx-ax,y=-(by-ay)
    const len=Math.hypot(x,y)
    if(len>1e-6)return new THREE.Vector3(x/len,y/len,0)
  }
  return null
}

/** 零长度折线（桥接点）的坐标是父件平移之后的位置，而非展开位置 */
function isPointHinge(face){
  if(!Array.isArray(face.hingeLine)||face.hingeLine.length!==2)return false
  const [[ax,ay],[bx,by]]=face.hingeLine
  return Math.hypot(bx-ax,by-ay)<1e-6
}

function hingePivot(face,parent){
  if(Array.isArray(face.hingeLine)&&face.hingeLine.length===2){
    const [[ax,ay],[bx,by]]=face.hingeLine
    return {x:(ax+bx)/2,y:(ay+by)/2}
  }
  const pcx=parent.x+parent.w/2,pcy=parent.y+parent.h/2
  if(face.side==='top')return {x:pcx,y:parent.y}
  if(face.side==='bottom')return {x:pcx,y:parent.y+parent.h}
  if(face.side==='left')return {x:parent.x,y:pcy}
  return {x:parent.x+parent.w,y:pcy}
}

/**
 * @param {object} knife geomMode knife（含 faces / hinges / foldStages）
 * @param {{makeMesh:(face:object)=>THREE.Object3D, zOff?:number}} opts
 */
export function buildGeomRig(knife,{makeMesh,zOff=0}){
  const root=new THREE.Group()
  const faces=knife?.faces||[]
  const byName=Object.fromEntries(faces.map(f=>[f.name,f]))
  const hingeBy=Object.fromEntries((knife?.hinges||[]).map(h=>[h.child,h]))
  const nodes=new Map()

  const stages=Array.isArray(knife?.foldStages)?knife.foldStages:[]
  const moved=translatedFaces(stages)

  /** 面在刀版坐标中的累计平移；无自身平移步则随父面 */
  function worldMoves(trMap){
    const memo=new Map()
    const get=name=>{
      if(memo.has(name))return memo.get(name)
      const parent=byName[name]?.parent
      let v=ZERO
      if(moved.has(name))v=trMap.get(name)||ZERO
      else if(parent&&byName[parent])v=get(parent)
      memo.set(name,v)
      return v
    }
    return get
  }
  const finalMove=worldMoves(translationsAtProgress(stages,1))

  function attach(name){
    if(nodes.has(name))return nodes.get(name)
    const f=byName[name]
    if(!f)return null
    const parentFace=f.parent?byName[f.parent]:null
    const parentNode=parentFace?attach(f.parent):null
    const anchor=new THREE.Group()
    const mover=new THREE.Group()
    anchor.add(mover)
    const mesh=makeMesh(f)
    mover.add(mesh)
    const cx=f.x+f.w/2,cy=f.y+f.h/2
    let node
    if(!parentNode){
      anchor.position.set(cx,-cy,0)
      mesh.position.set(0,0,zOff)
      root.add(anchor)
      node={name,anchor,mover,mesh,parent:null,axis:null,side:null,finalRad:0,shift:ZERO}
    }else{
      const pcx=parentFace.x+parentFace.w/2,pcy=parentFace.y+parentFace.h/2
      const p=hingePivot(f,parentFace)
      const shift=isPointHinge(f)?finalMove(f.parent):ZERO
      anchor.position.set(p.x-shift.x-pcx,-(p.y-shift.y-pcy),shift.z)
      parentNode.mesh.add(anchor)
      mesh.position.set(cx-p.x,-(cy-p.y),zOff)
      const h=hingeBy[name]
      const deg=Number.isFinite(h?.angle)?h.angle:-90
      node={name,anchor,mover,mesh,parent:f.parent,axis:hingeAxis(f,h),side:f.side,finalRad:deg*Math.PI/180,shift}
    }
    nodes.set(name,node)
    return node
  }
  faces.forEach(f=>attach(f.name))

  /** t∈[0,1]：按阶段回放旋转与整件平移 */
  function apply(t){
    const clamped=Math.max(0,Math.min(1,Number(t)||0))
    const angMap=anglesAtProgress(stages,clamped)
    const s=smoothstep(clamped)
    const worldMove=worldMoves(translationsAtProgress(stages,clamped))
    for(const n of nodes.values()){
      const w=worldMove(n.name)
      const pw=n.parent?worldMove(n.parent):ZERO
      const dx=w.x-pw.x+n.shift.x,dy=w.y-pw.y+n.shift.y,dz=w.z-pw.z+n.shift.z
      n.mover.position.set(dx,-dy,-dz)
      if(!n.parent)continue
      // 有官方动画时，未出现在动画里的铰链不转（如只平移的隔板）
      let v
      if(angMap.has(n.name))v=angMap.get(n.name)
      else if(stages.length)v=0
      else v=s*n.finalRad
      if(n.axis){
        n.anchor.setRotationFromQuaternion(new THREE.Quaternion().setFromAxisAngle(n.axis,v))
      }else{
        const r=foldRotation(n.side,v)
        n.anchor.rotation.set(r.x,r.y,r.z)
      }
    }
  }

  return {root,nodes,apply,stageCount:stages.length}
}
