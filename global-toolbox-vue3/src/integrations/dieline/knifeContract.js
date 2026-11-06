import {estimateClosedCollisions} from './foldSim.js'
import {MAILER_FACE_ORDER} from './templates/mailerFlip.js'

/** 默认模板（翻盖邮寄盒）的稳定面序；其它模板的面序见 knife.topology.faceOrder */
export const FACE_ORDER=MAILER_FACE_ORDER

function finiteNum(n){return Number.isFinite(Number(n))}

function check(id,ok,message){return {id,ok:!!ok,message}}

/** 契约校验：拓扑与数值完整性决定 ok；合盖告警仅记录，不阻断 */
export function validateKnife(knife){
  const checks=[]
  const faces=knife?.faces||[]
  const hinges=knife?.hinges||[]
  const names=faces.map(f=>f.name)
  const nameSet=new Set(names)
  const order=knife?.topology?.faceOrder?.length?knife.topology.faceOrder:FACE_ORDER
  const rootName=knife?.topology?.root||'base'

  checks.push(check('faceCount',faces.length===order.length,`faces.length=${faces.length}, expected ${order.length}`))
  checks.push(check('hingeCount',hinges.length===order.length-1,`hinges.length=${hinges.length}, expected ${order.length-1}`))
  checks.push(check('faceOrder',
    names.length===order.length&&order.every((n,i)=>names[i]===n),
    'faces must follow topology.faceOrder'))
  checks.push(check('uniqueNames',nameSet.size===names.length,'face names unique'))

  const roots=faces.filter(f=>!f.parent)
  checks.push(check('singleRoot',roots.length===1&&roots[0]?.name===rootName,`single root ${rootName}`))

  let parentsOk=true,acyclic=true
  const byName=Object.fromEntries(faces.map(f=>[f.name,f]))
  for(const f of faces){
    if(!f.parent)continue
    if(!byName[f.parent])parentsOk=false
    const seen=new Set()
    let cur=f
    while(cur?.parent){
      if(seen.has(cur.name)){acyclic=false;break}
      seen.add(cur.name)
      cur=byName[cur.parent]
      if(!cur){parentsOk=false;break}
    }
  }
  checks.push(check('parents',parentsOk,'all parents exist'))
  checks.push(check('acyclic',acyclic,'topology acyclic'))

  const d=knife?.dimensions||{}
  const inner=d.inner||{},outer=d.outer||{},panel=d.panel||{}
  const dimsOk=finiteNum(d.thickness)
    &&['length','width','height'].every(k=>finiteNum(inner[k])&&finiteNum(outer[k])&&finiteNum(panel[k]))
    &&panel.length>=inner.length&&panel.width>=inner.width
  checks.push(check('dimensions',dimsOk,'inner/outer/panel finite and panel>=inner'))

  const L=knife?.layers||{}
  const layersOk=['trim','crease','bleed'].every(k=>L[k]&&Array.isArray(L[k].segments))
  checks.push(check('layers',layersOk,'layers.trim/crease/bleed.segments'))

  // 合盖：可运行即可；告警不阻断 validation.ok
  let foldOk=true,foldMsg='fold check skipped'
  try{
    const coll=estimateClosedCollisions(knife,d.thickness)
    foldOk=true
    foldMsg=coll.skipped?'closed check n/a for template':coll.ok?`closed ok`:`closed warnings=${coll.issues.length}`
    checks.push(check('foldClosed',coll.ok,foldMsg))
  }catch(e){
    foldOk=false
    foldMsg=String(e?.message||e)
    checks.push(check('foldClosed',false,foldMsg))
  }

  // 门禁：拓扑+数值+layers；foldClosed 告警不阻断；fold 抛错才阻断
  const gateIds=new Set(['faceCount','hingeCount','faceOrder','uniqueNames','singleRoot','parents','acyclic','dimensions','layers'])
  const ok=checks.filter(c=>gateIds.has(c.id)).every(c=>c.ok)&&foldOk
  return {ok,checks}
}

/** 两次 knife 的拓扑签名（name/parent/side）必须一致 */
export function assertStableTopology(a,b){
  const sig=k=>(k.faces||[]).map(f=>`${f.name}|${f.parent||''}|${f.side||''}`)
  const sa=sig(a),sb=sig(b)
  if(sa.length!==sb.length)throw new Error(`topology length ${sa.length}!==${sb.length}`)
  for(let i=0;i<sa.length;i++){
    if(sa[i]!==sb[i])throw new Error(`topology drift at ${i}: ${sa[i]} vs ${sb[i]}`)
  }
  return true
}

export function orderFaces(faces,order=FACE_ORDER){
  const byName=Object.fromEntries((faces||[]).map(f=>[f.name,f]))
  return order.map(n=>byName[n]).filter(Boolean)
}
