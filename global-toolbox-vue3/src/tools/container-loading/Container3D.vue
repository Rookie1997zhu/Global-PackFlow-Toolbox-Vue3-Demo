<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import type { ContainerConfig, Placement } from './packing'

const props = defineProps<{
  container: ContainerConfig
  placements: Placement[]
  t: (key: string) => string
}>()

const holder = ref<HTMLDivElement | null>(null)
const selectedBox = ref<Placement | null>(null)

let scene: THREE.Scene
let camera: THREE.PerspectiveCamera
let renderer: THREE.WebGLRenderer
let controls: OrbitControls
let observer: ResizeObserver
let frame = 0
const raycaster = new THREE.Raycaster()
const pointer = new THREE.Vector2()
const pickables: THREE.Mesh[] = []

function draw() {
  if (!scene) return
  while (scene.children.length) {
    const o = scene.children[0]
    scene.remove(o)
    o.traverse((x) => {
      if (x instanceof THREE.Mesh) {
        x.geometry.dispose()
        const materials = Array.isArray(x.material) ? x.material : [x.material]
        materials.forEach((m) => m.dispose())
      }
    })
  }
  pickables.length = 0
  scene.background = new THREE.Color('#f3f7fd')
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8593aa, 2.4))
  const light = new THREE.DirectionalLight(0xffffff, 2.3)
  light.position.set(1800, 2500, 1600)
  scene.add(light)

  const { length: l, width: w, height: h } = props.container
  const frameGeo = new THREE.BoxGeometry(l, h, w)
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(frameGeo),
    new THREE.LineBasicMaterial({ color: '#0e7490' }),
  )
  edges.position.set(l / 2, h / 2, w / 2)
  scene.add(edges)
  frameGeo.dispose()

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(l, w),
    new THREE.MeshStandardMaterial({ color: '#dbeafe', roughness: 0.9, transparent: true, opacity: 0.55 }),
  )
  floor.rotation.x = -Math.PI / 2
  floor.position.set(l / 2, 0, w / 2)
  scene.add(floor)

  for (const b of props.placements) {
    const material = new THREE.MeshStandardMaterial({ color: b.color, roughness: 0.76, transparent: true, opacity: 0.92 })
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(b.l, b.h, b.w), material)
    mesh.position.set(b.x + b.l / 2, b.z + b.h / 2, b.y + b.w / 2)
    mesh.userData.box = b
    scene.add(mesh)
    pickables.push(mesh)
    const border = new THREE.LineSegments(
      new THREE.EdgesGeometry(mesh.geometry),
      new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.5 }),
    )
    border.position.copy(mesh.position)
    scene.add(border)
  }

  const grid = new THREE.GridHelper(Math.max(l, w) * 1.4, 16, 0xc9d6e7, 0xdfe6f0)
  grid.position.set(l / 2, -2, w / 2)
  scene.add(grid)
}

function resize() {
  if (!holder.value || !renderer) return
  const width = holder.value.clientWidth
  const height = holder.value.clientHeight
  camera.aspect = width / Math.max(1, height)
  camera.updateProjectionMatrix()
  renderer.setSize(width, height, false)
}

function resetCamera() {
  const { length: l, width: w, height: h } = props.container
  const scale = Math.max(l, w, h)
  camera.position.set(l / 2 + scale * 1.05, scale * 0.85, w / 2 + scale * 1.15)
  controls.target.set(l / 2, h / 3, w / 2)
  controls.update()
}

function click(event: MouseEvent) {
  if (!holder.value) return
  const rect = holder.value.getBoundingClientRect()
  pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1)
  raycaster.setFromCamera(pointer, camera)
  const hit = raycaster.intersectObjects(pickables)[0]
  selectedBox.value = hit ? (hit.object.userData.box as Placement) : null
}

function animate() {
  frame = requestAnimationFrame(animate)
  controls.update()
  renderer.render(scene, camera)
}

onMounted(() => {
  if (!holder.value) return
  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(40, 1, 1, 50000)
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  holder.value.appendChild(renderer.domElement)
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.minDistance = 400
  controls.maxDistance = 40000
  resetCamera()
  draw()
  resize()
  observer = new ResizeObserver(resize)
  observer.observe(holder.value)
  holder.value.addEventListener('click', click)
  animate()
})

watch(
  () => [props.placements, props.container],
  () => {
    selectedBox.value = null
    draw()
  },
  { deep: true },
)

onBeforeUnmount(() => {
  cancelAnimationFrame(frame)
  observer?.disconnect()
  holder.value?.removeEventListener('click', click)
  controls?.dispose()
  if (scene) {
    while (scene.children.length) {
      const o = scene.children[0]
      scene.remove(o)
      o.traverse((x) => {
        if (x instanceof THREE.Mesh) {
          x.geometry.dispose()
          ;(Array.isArray(x.material) ? x.material : [x.material]).forEach((m) => m.dispose())
        }
      })
    }
  }
  renderer?.dispose()
  renderer?.domElement.remove()
})

defineExpose({ resetCamera })
</script>

<template>
  <div class="three-container">
    <div ref="holder" class="three-canvas"></div>
    <div class="three-hint">{{ t('container3dHint') }}</div>
    <div v-if="selectedBox" class="three-tooltip">
      <b>{{ selectedBox.name }}</b>
      <span>{{ selectedBox.l }} × {{ selectedBox.w }} × {{ selectedBox.h }} mm</span>
      <span>{{ selectedBox.weight }} kg · Z {{ selectedBox.z }} mm</span>
      <button type="button" @click="selectedBox = null">{{ t('clear') }}</button>
    </div>
    <button class="camera-reset" type="button" @click="resetCamera">{{ t('containerResetCamera') }}</button>
  </div>
</template>

<style scoped>
.three-container {
  position: relative;
  min-height: 360px;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  overflow: hidden;
  background: #f3f7fd;
}
.three-canvas {
  width: 100%;
  height: 360px;
}
.three-hint {
  position: absolute;
  left: 12px;
  bottom: 12px;
  font-size: 12px;
  color: #64748b;
  background: #ffffffcc;
  padding: 4px 8px;
  border-radius: 6px;
}
.three-tooltip {
  position: absolute;
  right: 12px;
  top: 12px;
  background: white;
  border: 1px solid #dbe3ee;
  border-radius: 10px;
  padding: 10px 12px;
  display: grid;
  gap: 4px;
  font-size: 12px;
  max-width: 220px;
}
.camera-reset {
  position: absolute;
  right: 12px;
  bottom: 12px;
  border: 1px solid #c9d6e7;
  background: white;
  border-radius: 8px;
  padding: 6px 10px;
  cursor: pointer;
  font-size: 12px;
}
</style>
