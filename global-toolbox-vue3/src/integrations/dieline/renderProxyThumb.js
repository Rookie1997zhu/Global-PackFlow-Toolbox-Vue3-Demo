/**
 * modelOnly 替身缩略图：按名称/尺寸渲染圆柱 / 袋 / 圆角盒（无刀版）。
 */
import * as THREE from 'three'
import {renderSceneToDataUrl} from './thumbRenderer.js'

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

function pickKind(preset){
  const s=`${preset?.label||''} ${(preset?.subclassLabels||[]).join(' ')} ${preset?.structureCode||''}`
  if(/bottle|can|cup|round|cylind|tube|圆|罐|瓶|杯/i.test(s))return 'cylinder'
  if(/bag|袋|pouch/i.test(s))return 'bag'
  return 'box'
}

function buildProxy(preset){
  const L=Math.max(10,Number(preset.length)||80)
  const W=Math.max(10,Number(preset.width)||60)
  const H=Math.max(4,Number(preset.height)||40)
  const kind=pickKind(preset)
  const group=new THREE.Group()
  const mat=new THREE.MeshStandardMaterial({color:0xb7c4d4,roughness:.55,metalness:.05})
  if(kind==='cylinder'){
    const r=Math.min(L,W)/2
    const geo=new THREE.CylinderGeometry(r,r,H,48,1,false)
    const mesh=new THREE.Mesh(geo,mat)
    mesh.rotation.x=Math.PI/2
    group.add(mesh)
  }else if(kind==='bag'){
    const shape=new THREE.Shape()
    const hw=L/2,hh=H/2,top=W*.35
    shape.moveTo(-hw,-hh)
    shape.lineTo(hw,-hh)
    shape.lineTo(hw*.55,hh)
    shape.lineTo(-hw*.55,hh)
    shape.closePath()
    const geo=new THREE.ExtrudeGeometry(shape,{depth:Math.max(6,W*.25),bevelEnabled:false})
    const mesh=new THREE.Mesh(geo,mat)
    mesh.position.z=-Math.max(6,W*.25)/2
    group.add(mesh)
  }else{
    const r=Math.min(8,L,W,H)*.15
    const geo=new THREE.BoxGeometry(L,W,H)
    // 简易圆角感：稍缩小 + 边框线
    const mesh=new THREE.Mesh(geo,mat)
    group.add(mesh)
    const edges=new THREE.LineSegments(
      new THREE.EdgesGeometry(geo),
      new THREE.LineBasicMaterial({color:0x6a7a8c})
    )
    group.add(edges)
    void r
  }
  return group
}

/**
 * @param {object} preset
 * @returns {Promise<string>} dataURL
 */
export function renderProxyThumb(preset,{size=360}={}){
  const key=`${preset?.id||preset?.sourceNum}|v1|${size}`
  if(cache.has(key))return Promise.resolve(cache.get(key))
  return new Promise(resolve=>{
    try{
      const scene=new THREE.Scene()
      scene.background=new THREE.Color(0xf3f5f8)
      scene.add(new THREE.HemisphereLight(0xffffff,0x8a8d93,2.2))
      const sun=new THREE.DirectionalLight(0xffffff,1.6)
      sun.position.set(200,240,220)
      scene.add(sun)
      const wrap=buildProxy(preset)
      scene.add(wrap)
      const box=new THREE.Box3().setFromObject(wrap)
      const center=box.getCenter(new THREE.Vector3())
      const sphere=box.getBoundingSphere(new THREE.Sphere())
      const r=Math.max(sphere.radius,20)
      const fov=36
      const camera=new THREE.PerspectiveCamera(fov,1,.1,r*20)
      const dist=r/Math.sin(fov*Math.PI/360)*1.12
      camera.position.copy(center).addScaledVector(new THREE.Vector3(1.5,-1.6,1.3).normalize(),dist)
      camera.lookAt(center)
      const url=renderSceneToDataUrl(scene,camera,size)
      disposeTree(wrap)
      cache.set(key,url)
      resolve(url)
    }catch(e){
      console.warn('proxy thumb fail',preset?.id,e)
      resolve('')
    }
  })
}

export function clearProxyThumbCache(){cache.clear()}
