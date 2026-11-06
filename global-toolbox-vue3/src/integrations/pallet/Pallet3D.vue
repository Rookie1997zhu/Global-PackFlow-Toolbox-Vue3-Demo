<script setup lang="ts">
import {ref,onMounted,onBeforeUnmount,watch} from 'vue'
import * as THREE from 'three'
import {OrbitControls} from 'three/addons/controls/OrbitControls.js'
import type {Placed,Config} from './packing'
const props=defineProps<{boxes:Placed[],config:Config,selectedLevel:number}>()
const holder=ref<HTMLDivElement|null>(null)
const selectedBox=ref<Placed|null>(null)
let scene:THREE.Scene,camera:THREE.PerspectiveCamera,renderer:THREE.WebGLRenderer,controls:OrbitControls,observer:ResizeObserver
let frame=0
const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2()
const pickables:THREE.Mesh[]=[]
function draw(){
 if(!scene)return
 while(scene.children.length){const o=scene.children[0];scene.remove(o);o.traverse(x=>{if(x instanceof THREE.Mesh){x.geometry.dispose();const materials=Array.isArray(x.material)?x.material:[x.material];materials.forEach(m=>m.dispose())}})}
 pickables.length=0
 scene.background=new THREE.Color('#f3f7fd')
 scene.add(new THREE.HemisphereLight(0xffffff,0x8593aa,2.4))
 const light=new THREE.DirectionalLight(0xffffff,2.3);light.position.set(1800,2500,1600);scene.add(light)
 const {l,w,h}=props.config
 const board=new THREE.Mesh(new THREE.BoxGeometry(l,h,w),new THREE.MeshStandardMaterial({color:'#c89c6a',roughness:.86}));board.position.set(l/2,h/2,w/2);scene.add(board)
 const edges=new THREE.LineSegments(new THREE.EdgesGeometry(board.geometry),new THREE.LineBasicMaterial({color:'#936c41'}));edges.position.copy(board.position);scene.add(edges)
 for(const b of props.boxes){
  if(props.selectedLevel>=0&&b.z>props.selectedLevel)continue
  const material=new THREE.MeshStandardMaterial({color:b.color,roughness:.76,transparent:true,opacity:props.selectedLevel>=0&&b.z<props.selectedLevel?.22:1})
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(b.l,b.h,b.w),material)
  mesh.position.set(b.x+b.l/2,b.z+b.h/2,b.y+b.w/2)
  mesh.userData.box=b;scene.add(mesh);pickables.push(mesh)
  const border=new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry),new THREE.LineBasicMaterial({color:'#ffffff',transparent:true,opacity:.55}));border.position.copy(mesh.position);scene.add(border)
 }
 const grid=new THREE.GridHelper(Math.max(l,w)*1.7,16,0xc9d6e7,0xdfe6f0);grid.position.set(l/2,-5,w/2);scene.add(grid)
}
function resize(){if(!holder.value||!renderer)return;const width=holder.value.clientWidth,height=holder.value.clientHeight;camera.aspect=width/height;camera.updateProjectionMatrix();renderer.setSize(width,height,false)}
function resetCamera(){const {l,w,maxHeight}=props.config;const scale=Math.max(l,w,maxHeight);camera.position.set(l/2+scale*1.15,scale*1.05,w/2+scale*1.25);controls.target.set(l/2,Math.max(200,Math.min(maxHeight,props.config.h+450))/2,w/2);controls.update()}
function click(event:MouseEvent){if(!holder.value)return;const rect=holder.value.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);const hit=raycaster.intersectObjects(pickables)[0];selectedBox.value=hit?(hit.object.userData.box as Placed):null}
function animate(){frame=requestAnimationFrame(animate);controls.update();renderer.render(scene,camera)}
onMounted(()=>{if(!holder.value)return;scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(40,1,1,30000);renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;holder.value.appendChild(renderer.domElement);controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.minDistance=300;controls.maxDistance=14000;resetCamera();draw();resize();observer=new ResizeObserver(resize);observer.observe(holder.value);holder.value.addEventListener('click',click);animate()})
watch(()=>[props.boxes,props.selectedLevel,props.config],()=>{selectedBox.value=null;draw()},{deep:true})
onBeforeUnmount(()=>{cancelAnimationFrame(frame);observer?.disconnect();holder.value?.removeEventListener('click',click);controls?.dispose();if(scene){while(scene.children.length){const o=scene.children[0];scene.remove(o);o.traverse(x=>{if(x instanceof THREE.Mesh){x.geometry.dispose();(Array.isArray(x.material)?x.material:[x.material]).forEach(m=>m.dispose())}})}}renderer?.dispose();renderer?.domElement.remove()})
defineExpose({resetCamera})
</script>
<template>
<div class="three-container"><div ref="holder" class="three-canvas"></div><div class="three-hint">鼠标左键旋转 · 滚轮缩放 · 右键平移 · 点击纸箱查看</div><div v-if="selectedBox" class="three-tooltip"><b>{{selectedBox.name}}</b><span>{{selectedBox.l}} × {{selectedBox.w}} × {{selectedBox.h}} mm</span><span>重量 {{selectedBox.kg}} kg · 底部高度 {{selectedBox.z}} mm</span><button @click="selectedBox=null">关闭</button></div><button class="camera-reset" @click="resetCamera">重置视角</button></div>
</template>
