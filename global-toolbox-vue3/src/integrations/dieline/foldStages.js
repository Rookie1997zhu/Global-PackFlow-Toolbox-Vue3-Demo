/**
 * 合盖分步：进度 t∈[0,1] 按阶段推进，同 child 跨阶段累加转角。
 */

function smoothstep(x){
  const u=Math.max(0,Math.min(1,x))
  return u*u*(3-2*u)
}

/**
 * @param {Array<Array<{child:string,rotate:number}>>} foldStages 每段 rotate 为度（可带符号）
 * @param {number} t 0..1
 * @returns {Map<string, number>} child → 当前累计角（弧度）
 */
export function anglesAtProgress(foldStages,t){
  const map=new Map()
  if(!Array.isArray(foldStages)||!foldStages.length)return map
  const n=foldStages.length
  const clamped=Math.max(0,Math.min(1,Number(t)||0))

  if(clamped>=1){
    for(const stage of foldStages){
      for(const step of stage||[]){
        if(!step?.child)continue
        const deg=Number(step.rotate)
        if(!Number.isFinite(deg))continue
        map.set(step.child,(map.get(step.child)||0)+deg*Math.PI/180)
      }
    }
    return map
  }

  const u=clamped*n
  const si=Math.min(n-1,Math.floor(u))
  const local=smoothstep(u-si)

  for(let i=0;i<n;i++){
    const w=i<si?1:(i===si?local:0)
    if(w===0)continue
    for(const step of foldStages[i]||[]){
      if(!step?.child)continue
      const deg=Number(step.rotate)
      if(!Number.isFinite(deg))continue
      map.set(step.child,(map.get(step.child)||0)+deg*w*Math.PI/180)
    }
  }
  return map
}

/** 步骤指示：now 为 1..total；t=0 时亦为 1 */
export function stageIndexAt(t,stageCount){
  const n=Math.max(0,Number(stageCount)|0)
  if(!n)return {now:0,total:0}
  const clamped=Math.max(0,Math.min(1,Number(t)||0))
  if(clamped>=1)return {now:n,total:n}
  return {now:Math.floor(clamped*n)+1,total:n}
}

function faceDepth(facesByName,name){
  let d=0,n=name
  const seen=new Set()
  while(facesByName[n]?.parent){
    if(seen.has(n))break
    seen.add(n)
    n=facesByName[n].parent
    d++
  }
  return d
}

function isLateFoldFace(name){
  const s=String(name||'')
  return /^(HT|HL|HB|FT|FRT|FLT|FLB|FRB)/i.test(s)||/Hook|Lock|Tuck/i.test(s)
}

/**
 * 自有刀版：按父子深度分阶段；插舌/锁舌等到最后一层。
 * @param {Array<{name:string,parent?:string|null}>} faces
 * @param {Array<{child:string,angle:number}>} hinges angle 为度
 */
export function buildDepthFoldStages(faces,hinges){
  const facesByName=Object.fromEntries((faces||[]).map(f=>[f.name,f]))
  const angleBy=Object.fromEntries((hinges||[]).map(h=>[h.child,h.angle]))
  const kids=(faces||[]).filter(f=>f.parent)
  if(!kids.length)return []

  const byDepth=new Map()
  const late=[]
  for(const f of kids){
    const rotate=Number.isFinite(angleBy[f.name])?angleBy[f.name]:90
    const step={child:f.name,rotate}
    if(isLateFoldFace(f.name))late.push(step)
    else{
      const d=faceDepth(facesByName,f.name)
      if(!byDepth.has(d))byDepth.set(d,[])
      byDepth.get(d).push(step)
    }
  }
  const stages=[...byDepth.keys()].sort((a,b)=>a-b).map(d=>byDepth.get(d)).filter(s=>s?.length)
  if(late.length)stages.push(late)
  return stages.length?stages:[kids.map(f=>({child:f.name,rotate:Number.isFinite(angleBy[f.name])?angleBy[f.name]:90}))]
}

/**
 * 官方动画 → foldStages。
 * 旋转步：{child, rotate, vector}；平移步：{face, move:{x,y,z}}（刀版坐标系，y 向下）。
 * 多件款靠平移步把另一块刀版搬到拼合位置。
 */
export function foldStagesFromAnimation(animations){
  const stages=[]
  if(!Array.isArray(animations))return stages
  for(const stage of animations){
    if(!Array.isArray(stage))continue
    const steps=[]
    for(const step of stage){
      const name=String(step?.name||'')
      if(!name)continue
      const v=step.vector||{}
      if(step.action==='translate'){
        const amt=Number(step.translate)
        const vx=Number(v.x)||0,vy=Number(v.y)||0,vz=Number(v.z)||0
        const len=Math.hypot(vx,vy,vz)
        if(!Number.isFinite(amt)||len<1e-12)continue
        steps.push({face:name,move:{x:vx/len*amt,y:vy/len*amt,z:vz/len*amt}})
        continue
      }
      const i=name.indexOf('_')
      if(i<=0||i>=name.length-1)continue
      const child=name.slice(i+1)
      const rot=Number(step.rotate)
      if(!child||!Number.isFinite(rot))continue
      steps.push({child,rotate:rot,vector:{x:Number(v.x)||0,y:Number(v.y)||0,z:Number(v.z)||0}})
    }
    if(steps.length)stages.push(steps)
  }
  return stages
}

/** 有平移步的面（其位移为刀版坐标绝对量，不继承父面位移） */
export function translatedFaces(foldStages){
  const set=new Set()
  for(const stage of foldStages||[])for(const s of stage||[])if(s?.face&&s.move)set.add(s.face)
  return set
}

/**
 * @returns {Map<string,{x:number,y:number,z:number}>} face → 当前累计位移（刀版坐标）
 */
export function translationsAtProgress(foldStages,t){
  const map=new Map()
  if(!Array.isArray(foldStages)||!foldStages.length)return map
  const n=foldStages.length
  const clamped=Math.max(0,Math.min(1,Number(t)||0))
  const u=clamped*n
  const si=clamped>=1?n:Math.min(n-1,Math.floor(u))
  const local=clamped>=1?1:smoothstep(u-si)
  for(let i=0;i<n;i++){
    const w=i<si?1:(i===si?local:0)
    if(w===0)continue
    for(const s of foldStages[i]||[]){
      if(!s?.face||!s.move)continue
      const cur=map.get(s.face)||{x:0,y:0,z:0}
      map.set(s.face,{x:cur.x+s.move.x*w,y:cur.y+s.move.y*w,z:cur.z+s.move.z*w})
    }
  }
  return map
}
