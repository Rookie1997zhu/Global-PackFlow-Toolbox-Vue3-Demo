/**
 * 缩略图共用的离屏 WebGL 渲染器。
 * 浏览器对同时存在的 WebGL 上下文有上限（Chrome 约 16 个），超出会回收最早的上下文——
 * 也就是工位的 3D 预览。所以所有缩略图必须复用同一个上下文，不能每张新建。
 */
import * as THREE from 'three'

let renderer=null

function getThumbRenderer(){
  if(renderer&&!renderer.getContext().isContextLost())return renderer
  renderer?.dispose()
  renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true,alpha:false})
  renderer.setPixelRatio(1)
  return renderer
}

/**
 * @param {THREE.Scene} scene
 * @param {THREE.Camera} camera
 * @param {number} size 边长（px）
 * @returns {string} dataURL png
 */
export function renderSceneToDataUrl(scene,camera,size){
  const r=getThumbRenderer()
  r.setSize(size,size,false)
  r.render(scene,camera)
  const url=r.domElement.toDataURL('image/png')
  r.renderLists.dispose()
  return url
}
