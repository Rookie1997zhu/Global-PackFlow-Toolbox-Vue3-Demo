/** RYSEN 3D packing v2: candidate-corner search, horizontal rotations, exact geometry,
 * full-base support and conservative no-stack restrictions. NOT a compression/stability certification. */
export type Carton={id:number,name:string,l:number,w:number,h:number,qty:number,kg:number,color:string,stackable:boolean}
export type Placed={id:number,name:string,x:number,y:number,z:number,l:number,w:number,h:number,kg:number,color:string,unitId:string}
export type Pallet={boxes:Placed[],weight:number,usedHeight:number}
export type Result={pallets:Pallet[],unplaced:{name:string,qty:number}[],warnings:string[],totalBoxes:number,packedBoxes:number,volume:number,strategy?:string,attempts?:number}
export type Config={l:number,w:number,h:number,maxHeight:number,maxWeight:number,palletKg:number}
type Unit=Carton&{unitId:string}
type Point={x:number,y:number,z:number}
const EPS=1e-7
const MAX_UNITS=150
const MAX_ATTEMPTS=8
const key=(p:Point)=>`${p.x}|${p.y}|${p.z}`
const overlap=(a:number,al:number,b:number,bl:number)=>Math.min(a+al,b+bl)-Math.max(a,b)>EPS
export function collides(a:Placed,b:Placed){return overlap(a.x,a.l,b.x,b.l)&&overlap(a.y,a.w,b.y,b.w)&&overlap(a.z,a.h,b.z,b.h)}
export function inBounds(b:Placed,c:Config){return b.x>=-EPS&&b.y>=-EPS&&b.z>=c.h-EPS&&b.x+b.l<=c.l+EPS&&b.y+b.w<=c.w+EPS&&b.z+b.h<=c.maxHeight+EPS}
function areaUnion(rects:{x1:number;y1:number;x2:number;y2:number}[]):number{
 if(!rects.length)return 0
 const xs=[...new Set(rects.flatMap(r=>[r.x1,r.x2]))].sort((a,b)=>a-b)
 let area=0
 for(let i=0;i<xs.length-1;i++){
  const lo=xs[i],hi=xs[i+1];if(hi-lo<EPS)continue
  const spans=rects.filter(r=>r.x1<hi-EPS&&r.x2>lo+EPS).map(r=>[r.y1,r.y2] as const).sort((a,b)=>a[0]-b[0])
  let begin=0,end=0,covered=0
  for(const [s,e] of spans){if(e<=end)continue;if(s>end){covered+=Math.max(0,end-begin);begin=s}end=e}
  covered+=Math.max(0,end-begin);area+=(hi-lo)*covered
 }
 return area
}
/** Strictly require complete base coverage. If any supporting carton disallows stacking, reject. */
export function supported(b:Placed,placed:Placed[],floor:number){
 if(Math.abs(b.z-floor)<EPS)return true
 const contacts=placed.filter(p=>Math.abs(p.z+p.h-b.z)<EPS&&overlap(p.x,p.l,b.x,b.l)&&overlap(p.y,p.w,b.y,b.w))
 if(!contacts.length||contacts.some(p=>p.unitId.endsWith('!')))return false
 const rects=contacts.map(p=>({x1:Math.max(p.x,b.x),x2:Math.min(p.x+p.l,b.x+b.l),y1:Math.max(p.y,b.y),y2:Math.min(p.y+p.w,b.y+b.w)}))
 return areaUnion(rects)>=b.l*b.w-EPS
}
function orientations(u:Unit){return u.l===u.w?[[u.l,u.w]]:[[u.l,u.w],[u.w,u.l]]}
function candidates(placed:Placed[],c:Config):Point[]{
 const xs=[0,...placed.map(b=>b.x+b.l)],ys=[0,...placed.map(b=>b.y+b.w)],zs=[c.h,...placed.map(b=>b.z+b.h)]
 // Edge combinations are important for mixed sizes; bounded to keep browser responsive.
 const points:Point[]=[];const seen=new Set<string>()
 const push=(p:Point)=>{if(p.x>=0&&p.y>=0&&p.z>=c.h&&p.x<c.l&&p.y<c.w&&p.z<c.maxHeight){const k=key(p);if(!seen.has(k)){seen.add(k);points.push(p)}}}
 for(const x of xs)for(const y of ys)push({x,y,z:c.h})
 for(const z of zs){if(z===c.h)continue;for(const b of placed){if(Math.abs(b.z+b.h-z)>EPS)continue;push({x:b.x,y:b.y,z});for(const x of xs)push({x,y:b.y,z});for(const y of ys)push({x:b.x,y,z})}}
 return points.sort((a,b)=>a.z-b.z||a.y-b.y||a.x-b.x).slice(0,450)
}
function score(b:Placed,c:Config,placed:Placed[],variant:number){
 const height=(b.z+b.h-c.h)/(c.maxHeight-c.h)
 const center=Math.abs(b.x+b.l/2-c.l/2)/c.l+Math.abs(b.y+b.w/2-c.w/2)/c.w
 const edge=(b.x/c.l+b.y/c.w)
 const neighbors=placed.reduce((n,p)=>n+(Math.abs(p.x+p.l-b.x)<EPS?1:0)+(Math.abs(p.y+p.w-b.y)<EPS?1:0),0)
 return variant%2===0?height*100+center*8+edge*2-neighbors*.3:height*100+edge*6+center*2-neighbors*.5
}
function pick(u:Unit,p:Pallet,c:Config,variant:number):Placed|null{
 if(p.weight+u.kg>c.maxWeight+EPS)return null
 let best:Placed|null=null,bestScore=Infinity
 const pts=candidates(p.boxes,c)
 for(const pt of pts)for(const [l,w] of orientations(u)){
  const b:Placed={id:u.id,name:u.name,x:pt.x,y:pt.y,z:pt.z,l,w,h:u.h,kg:u.kg,color:u.color,unitId:u.unitId+(u.stackable?'':'!')}
  if(!inBounds(b,c)||p.boxes.some(q=>collides(b,q))||!supported(b,p.boxes,c.h))continue
  // Non-stackable boxes cannot have any box touching their top; enforced by supported().
  const s=score(b,c,p.boxes,variant)
  if(s<bestScore-EPS){bestScore=s;best=b}
 }
 return best
}
function ordering(units:Unit[],variant:number):Unit[]{
 const arr=[...units];const seed=(id:string)=>{let h=2166136261;for(let i=0;i<id.length;i++)h=Math.imul(h^id.charCodeAt(i),16777619);return (h>>>0)/4294967295}
 return arr.sort((a,b)=>{
  const volume=(u:Unit)=>u.l*u.w*u.h,foot=(u:Unit)=>u.l*u.w
  let diff=0
  switch(variant){case 0:diff=volume(b)-volume(a);break;case 1:diff=foot(b)-foot(a);break;case 2:diff=b.kg-a.kg;break;case 3:diff=b.h-a.h;break;case 4:diff=(b.stackable?1:0)-(a.stackable?1:0)||volume(b)-volume(a);break;case 5:diff=(b.stackable?1:0)-(a.stackable?1:0)||foot(b)-foot(a);break;default:diff=(volume(b)*(0.75+seed(b.unitId+variant)*.5))-(volume(a)*(0.75+seed(a.unitId+variant)*.5))}
  return diff||a.unitId.localeCompare(b.unitId)
 })
}
function attempt(units:Unit[],c:Config,variant:number){
 const pallets:Pallet[]=[];const missing:Unit[]=[]
 for(const u of ordering(units,variant)){
  let chosen:Placed|null=null,target:Pallet|null=null
  for(const p of pallets){const b=pick(u,p,c,variant);if(b){chosen=b;target=p;break}}
  if(!chosen){const p:Pallet={boxes:[],weight:c.palletKg,usedHeight:c.h};const b=pick(u,p,c,variant);if(b){pallets.push(p);chosen=b;target=p}}
  if(chosen&&target){target.boxes.push(chosen);target.weight+=u.kg;target.usedHeight=Math.max(target.usedHeight,chosen.z+chosen.h)}else missing.push(u)
 }
 return {pallets,missing}
}
export function validate(pallets:Pallet[],c:Config):string[]{
 const errors:string[]=[]
 pallets.forEach((p,i)=>{
  const weight=c.palletKg+p.boxes.reduce((s,b)=>s+b.kg,0)
  if(weight>c.maxWeight+EPS)errors.push(`卡板 ${i+1} 超重`)
  for(let j=0;j<p.boxes.length;j++){
   const b=p.boxes[j]
   if(!inBounds(b,c))errors.push(`卡板 ${i+1} 箱 ${j+1} 超界`)
   if(!supported(b,p.boxes.filter((_,k)=>k!==j),c.h))errors.push(`卡板 ${i+1} 箱 ${j+1} 支撑不足`)
   for(let k=0;k<j;k++)if(collides(b,p.boxes[k]))errors.push(`卡板 ${i+1} 箱 ${j+1} 与 ${k+1} 重叠`)
  }
 })
 return errors
}
export function pack(config:Config,cartons:Carton[]):Result{
 const totalBoxes=cartons.reduce((s,u)=>s+(Number.isFinite(u.qty)?Math.max(0,Math.floor(u.qty)):0),0)
 const volume=cartons.reduce((s,u)=>s+(Number.isFinite(u.qty)?Math.max(0,Math.floor(u.qty))*u.l*u.w*u.h/1e9:0),0)
 const invalid=Object.values(config).some(v=>!Number.isFinite(v)||v<0)||config.l<=0||config.w<=0||config.maxHeight<=config.h||config.maxWeight<=config.palletKg
 const base={totalBoxes,volume}
 if(invalid)return {...base,pallets:[],packedBoxes:0,unplaced:cartons.map(c=>({name:c.name,qty:c.qty})),warnings:['卡板参数无效，请检查尺寸、最大高度及重量']}
 const warnings:string[]=[];const units:Unit[]=[];const unplaced=new Map<string,number>()
 const miss=(name:string,n=1)=>unplaced.set(name,(unplaced.get(name)||0)+n)
 for(const u of cartons){
  const n=Number.isFinite(u.qty)?Math.max(0,Math.floor(u.qty)):0
  if(![u.l,u.w,u.h,u.kg].every(v=>Number.isFinite(v)&&v>0)){miss(u.name,n);continue}
  const allowed=Math.max(0,Math.min(n,MAX_UNITS-units.length))
  for(let i=0;i<allowed;i++)units.push({...u,unitId:`${u.id}-${i}`})
  if(n>allowed)miss(u.name,n-allowed)
 }
 if(totalBoxes>MAX_UNITS)warnings.push(`浏览器演示版最多优化 ${MAX_UNITS} 箱，超出数量已计入未装载`)
 let best:{pallets:Pallet[],missing:Unit[]}|null=null;let bestVariant=0
 const attempts=units.length>100?4:MAX_ATTEMPTS
 for(let variant=0;variant<attempts;variant++){
  const trial=attempt(units,config,variant)
  const better=!best||trial.missing.length<best.missing.length||(trial.missing.length===best.missing.length&&(trial.pallets.length<best.pallets.length||(trial.pallets.length===best.pallets.length&&trial.pallets.reduce((s,p)=>s+p.usedHeight,0)<best.pallets.reduce((s,p)=>s+p.usedHeight,0))))
  if(better){best=trial;bestVariant=variant}
 }
 for(const u of best?.missing||[])miss(u.name)
 const pallets=best?.pallets||[]
 const errors=validate(pallets,config);if(errors.length)warnings.push(`几何校验失败：${errors.slice(0,3).join('；')}`)
 if(unplaced.size)warnings.push('部分纸箱未能安排，可能因尺寸、承重或完整支撑要求受限')
 warnings.push('安全提示：仅检查几何、完整底面支撑、禁止叠放和总重量；未验证纸箱抗压、重心及运输稳定性，请人工复核')
 return {...base,pallets,unplaced:[...unplaced].map(([name,qty])=>({name,qty})),warnings,packedBoxes:pallets.reduce((s,p)=>s+p.boxes.length,0),strategy:['体积优先','底面积优先','重量优先','高度优先','不可堆叠优先+体积','不可堆叠优先+底面积','扰动搜索 A','扰动搜索 B'][bestVariant],attempts}
}
