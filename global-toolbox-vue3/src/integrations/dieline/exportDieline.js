/** Export dieline from knife.layers (trim / crease / bleed). Demo only — not for die cutting. */
import {PDFDocument,rgb,StandardFonts} from 'pdf-lib'
import {buildDimAnnotations,dimAnnotationsToSvg,DIM_COLOR} from './dimAnnotations.js'

const LAYER_META={
  trim:{dxf:'TRIM',color:'#2028b0',aci:5},
  crease:{dxf:'CREASE',color:'#fa0000',aci:1,dash:true},
  bleed:{dxf:'BLEED',color:'#46ba00',aci:3}
}

/** PDF Helvetica (WinAnsi) cannot encode CJK; keep Chinese in SVG comments only */
const DISCLAIMER_EN='DEMO · NOT FOR DIE CUTTING'
const DISCLAIMER_NOTE='不可开模'

export function segmentsOf(knife,role){
  const segs=knife?.layers?.[role]?.segments
  if(!Array.isArray(segs))throw new Error(`missing layers.${role}.segments`)
  return segs
}

function boundsOf(knife){
  const b=knife?.bounds
  if(!b||![b.minX,b.minY,b.maxX,b.maxY].every(Number.isFinite))throw new Error('missing knife.bounds')
  return b
}

/** Knife Y-down → CAD Y-up; origin at bounds bottom-left */
function toCad(x,y,b){
  return {x:x-b.minX,y:b.maxY-y}
}

function hexToRgb01(hex){
  const h=String(hex||'#000000').replace('#','')
  const n=parseInt(h.length===3?h.split('').map(c=>c+c).join(''):h,16)
  return {r:((n>>16)&255)/255,g:((n>>8)&255)/255,b:(n&255)/255}
}

function validationNote(knife){
  return knife?.validation?.ok===false?'validation.ok=false':`validation.ok=${knife?.validation?.ok!==false}`
}

function pairPath(segs){
  return segs.map(s=>`M ${s.x1} ${s.y1} L ${s.x2} ${s.y2}`).join(' ')
}

/** ASCII DXF R12: layers TRIM / CREASE / BLEED, units mm, Y flipped */
export function toDxf(knife){
  const b=boundsOf(knife)
  const lines=[]
  const push=(code,value)=>{lines.push(String(code),String(value))}

  push(0,'SECTION');push(2,'HEADER')
  push(9,'$INSUNITS');push(70,4)
  push(9,'$MEASUREMENT');push(70,1)
  push(0,'ENDSEC')

  push(0,'SECTION');push(2,'TABLES')
  push(0,'TABLE');push(2,'LAYER');push(70,3)
  for(const role of ['trim','crease','bleed']){
    const m=LAYER_META[role]
    push(0,'LAYER');push(2,m.dxf);push(70,0);push(62,m.aci);push(6,'CONTINUOUS')
  }
  push(0,'ENDTAB')
  push(0,'ENDSEC')

  push(0,'SECTION');push(2,'ENTITIES')
  for(const role of ['trim','crease','bleed']){
    const m=LAYER_META[role]
    for(const s of segmentsOf(knife,role)){
      const p1=toCad(s.x1,s.y1,b),p2=toCad(s.x2,s.y2,b)
      push(0,'LINE');push(8,m.dxf)
      push(10,p1.x);push(20,p1.y);push(30,0)
      push(11,p2.x);push(21,p2.y);push(31,0)
    }
  }
  push(0,'ENDSEC')
  push(0,'EOF')
  return lines.join('\n')+'\n'
}

/** Offline SVG from layers (not DOM clone) */
export function toSvgDieline(knife,{includeDims=true,pad}={}){
  const b=boundsOf(knife)
  const bleedPad=Number.isFinite(pad)?pad:26+Number(knife.bleedEffective??((Number(knife.bleed)||0)+10))
  const vb=`${b.minX-bleedPad} ${b.minY-bleedPad} ${b.maxX-b.minX+2*bleedPad} ${b.maxY-b.minY+2*bleedPad}`
  const note=validationNote(knife)
  const anns=includeDims?buildDimAnnotations(knife):[]
  const dims=anns.length?`<g id="DIMENSIONS">${dimAnnotationsToSvg(anns,{fontSize:13})}</g>`:''
  const parts=[
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" fill="none">`,
    `<!-- ${DISCLAIMER_EN} / ${DISCLAIMER_NOTE}; ${note}; manufacturingReady=false -->`,
    `<path d="${pairPath(segmentsOf(knife,'bleed'))}" stroke="${LAYER_META.bleed.color}" stroke-width="1.2" opacity="0.65"/>`,
    `<path d="${pairPath(segmentsOf(knife,'trim'))}" stroke="${LAYER_META.trim.color}" stroke-width="1.8"/>`,
    `<g stroke="${LAYER_META.crease.color}" stroke-width="1.6" stroke-dasharray="6 4">`,
    ...segmentsOf(knife,'crease').map(s=>`<line x1="${s.x1}" y1="${s.y1}" x2="${s.x2}" y2="${s.y2}"/>`),
    `</g>`,
    dims,
    `</svg>`
  ]
  return parts.filter(Boolean).join('\n')
}

function pdfSafeLabel(s){
  // Helvetica / WinAnsi: drop non-latin; keep digits, letters, × as x
  return String(s||'')
    .replace(/×/g,'x')
    .replace(/[^\x20-\x7E]/g,'')
}

/** Vector proof PDF with disclaimer; returns Uint8Array */
export async function toPdf(knife,{includeDims=true,forAi=false}={}){
  const b=boundsOf(knife)
  const wMm=b.maxX-b.minX,hMm=b.maxY-b.minY
  const margin=36
  const headerH=54,footerH=36
  const pageW=Math.max(420,wMm+margin*2)
  const pageH=Math.max(594,hMm+margin*2+headerH+footerH)
  const doc=await PDFDocument.create()
  const page=doc.addPage([pageW,pageH])
  const font=await doc.embedFont(StandardFonts.Helvetica)
  const fontBold=await doc.embedFont(StandardFonts.HelveticaBold)

  const d=knife.dimensions||{}
  const mat=knife.material?.id||'-'
  const title=`${knife.template||'mailer'} · ${d.length}x${d.width}x${d.height} mm · ${mat}`
  page.drawText(pdfSafeLabel(title),{x:margin,y:pageH-28,size:11,font:fontBold,color:rgb(.15,.18,.22)})
  const sub=forAi
    ?`TRIM / CREASE / BLEED · DEMO · ${validationNote(knife)} · manufacturingReady=false`
    :`${validationNote(knife)} · manufacturingReady=false`
  page.drawText(pdfSafeLabel(sub),{
    x:margin,y:pageH-44,size:8,font,color:rgb(.4,.45,.5)
  })

  const drawW=pageW-margin*2,drawH=pageH-margin*2-headerH-footerH
  const scale=Math.min(drawW/Math.max(wMm,1),drawH/Math.max(hMm,1))
  const ox=margin+(drawW-wMm*scale)/2
  const oy=margin+footerH+(drawH-hMm*scale)/2

  const map=(x,y)=>({
    x:ox+(x-b.minX)*scale,
    y:oy+(b.maxY-y)*scale
  })

  for(const role of ['bleed','trim','crease']){
    const meta=LAYER_META[role]
    const c=hexToRgb01(meta.color)
    const color=rgb(c.r,c.g,c.b)
    for(const s of segmentsOf(knife,role)){
      const p1=map(s.x1,s.y1),p2=map(s.x2,s.y2)
      page.drawLine({
        start:p1,end:p2,thickness:role==='trim'?1.2:role==='bleed'?0.8:0.9,
        color,opacity:role==='bleed'?0.65:1
      })
    }
  }

  if(includeDims){
    const anns=buildDimAnnotations(knife)
    const dimRgb=hexToRgb01(DIM_COLOR)
    const dimColor=rgb(dimRgb.r,dimRgb.g,dimRgb.b)
    for(const a of anns){
      for(const L of a.lines||[]){
        const p1=map(L.x1,L.y1),p2=map(L.x2,L.y2)
        page.drawLine({start:p1,end:p2,thickness:0.7,color:dimColor})
      }
      for(const poly of a.polys||[]){
        if(poly.length<3)continue
        const [t0,t1,t2]=poly.map(([x,y])=>map(x,y))
        page.drawLine({start:t0,end:t1,thickness:0.6,color:dimColor})
        page.drawLine({start:t1,end:t2,thickness:0.6,color:dimColor})
        page.drawLine({start:t2,end:t0,thickness:0.6,color:dimColor})
      }
      if(a.text){
        const p=map(a.text.x,a.text.y)
        const size=a.kind==='face'?7:9
        const label=pdfSafeLabel(a.text.value)
        const tw=font.widthOfTextAtSize(label,size)
        page.drawText(label,{x:p.x-tw/2,y:p.y-size/3,size,font,color:dimColor})
      }
    }
  }

  page.drawText(`${DISCLAIMER_EN} / manufacturingReady=false`,{
    x:margin,y:18,size:9,font:fontBold,color:rgb(.75,.15,.1)
  })

  return doc.save()
}

/** PDF-compatible .ai (Illustrator opens as PDF); same payload as toPdf. */
export async function toAi(knife){
  return toPdf(knife,{includeDims:true,forAi:true})
}
