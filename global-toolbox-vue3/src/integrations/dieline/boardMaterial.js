/**
 * ambientCG 纸板/纸纹 PBR：kraft=Cardboard002，white/blue=Paper001+色调。
 * ExtrudeGeometry UV 单位为 mm，用 texture.repeat=1/tileMm 平铺。
 */
import * as THREE from 'three'
import {publicAssetUrl} from './assetUrl.js'

const FALLBACK={kraft:0xc6a47a,white:0xf4f0e7,blue:0x8aa6c8}

/** @type {Record<string,{dir:string,prefix:string,tint:number,roughness:number,tileMm:number,normalScale:number}>} */
const SPECS={
  kraft:{
    dir:'Cardboard002_1K-JPG',
    prefix:'Cardboard002_1K-JPG',
    tint:0xffffff,
    roughness:.92,
    tileMm:140,
    normalScale:.55
  },
  white:{
    dir:'Paper001_1K-JPG',
    prefix:'Paper001_1K-JPG',
    tint:0xf4f0e7,
    roughness:.88,
    tileMm:100,
    normalScale:.35
  },
  blue:{
    dir:'Paper001_1K-JPG',
    prefix:'Paper001_1K-JPG',
    tint:0x8aa6c8,
    roughness:.88,
    tileMm:100,
    normalScale:.35
  }
}

const loader=new THREE.TextureLoader()
/** @type {Map<string,Promise<{map:THREE.Texture,normalMap:THREE.Texture,roughnessMap:THREE.Texture}>>} */
const inflight=new Map()
/** @type {Map<string,{map:THREE.Texture,normalMap:THREE.Texture,roughnessMap:THREE.Texture}>} */
const settled=new Map()

function resolveId(materialId){
  return SPECS[materialId]?materialId:'kraft'
}

function packKey(materialId){
  const s=SPECS[resolveId(materialId)]
  return `${s.dir}|${s.tileMm}`
}

function loadMap(url,{color=false,repeat=1}={}){
  return new Promise((resolve,reject)=>{
    loader.load(
      url,
      tex=>{
        tex.wrapS=tex.wrapT=THREE.RepeatWrapping
        tex.repeat.set(repeat,repeat)
        tex.anisotropy=4
        tex.colorSpace=color?THREE.SRGBColorSpace:THREE.NoColorSpace
        tex.needsUpdate=true
        resolve(tex)
      },
      undefined,
      err=>reject(err||new Error(`texture load failed: ${url}`))
    )
  })
}

/**
 * 预加载材质包（可重复调用，结果缓存）。
 * @param {string} [materialId]
 */
export function ensureBoardPack(materialId='kraft'){
  const id=resolveId(materialId)
  const key=packKey(id)
  if(settled.has(key))return Promise.resolve(settled.get(key))
  if(inflight.has(key))return inflight.get(key)

  const s=SPECS[id]
  const base=publicAssetUrl(`materials/${s.dir}/${s.prefix}`)
  const repeat=1/s.tileMm
  const p=Promise.all([
    loadMap(`${base}_Color.jpg`,{color:true,repeat}),
    loadMap(`${base}_NormalGL.jpg`,{repeat}),
    loadMap(`${base}_Roughness.jpg`,{repeat})
  ]).then(([map,normalMap,roughnessMap])=>{
    const maps={map,normalMap,roughnessMap}
    settled.set(key,maps)
    inflight.delete(key)
    return maps
  }).catch(err=>{
    inflight.delete(key)
    console.warn('board material pack failed',id,err)
    throw err
  })
  inflight.set(key,p)
  return p
}

/**
 * 创建板材材质。贴图未就绪时退回纯色。
 * @param {string} [materialId]
 * @param {{flatShading?:boolean}} [opts]
 */
export function createBoardMaterial(materialId='kraft',{flatShading=false}={}){
  const id=resolveId(materialId)
  const s=SPECS[id]
  const maps=settled.get(packKey(id))
  if(!maps){
    return new THREE.MeshStandardMaterial({
      color:FALLBACK[id]??FALLBACK.kraft,
      side:THREE.DoubleSide,
      roughness:s.roughness,
      metalness:0,
      flatShading
    })
  }
  return new THREE.MeshStandardMaterial({
    color:s.tint,
    map:maps.map,
    normalMap:maps.normalMap,
    normalScale:new THREE.Vector2(s.normalScale,s.normalScale),
    roughnessMap:maps.roughnessMap,
    roughness:s.roughness,
    metalness:0,
    side:THREE.DoubleSide,
    flatShading
  })
}
