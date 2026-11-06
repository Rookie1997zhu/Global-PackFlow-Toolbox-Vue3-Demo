/** Dimension annotations for dieline (overall L/W/H + face w×h). Knife Y-down. */

const DIM_COLOR='#667085'
const MIN_FACE=12
const OFFSET=10
const EXTEND=3
const ARROW=4

function round(n){return Math.round(Number(n)*100)/100}
function fmtLen(n){return String(Math.round(Number(n)||0))}

function normalizeArrows(sizeArrowData){
  if(!Array.isArray(sizeArrowData))return []
  return sizeArrowData.filter(d=>d?.p1&&d?.p2
    &&Number.isFinite(d.p1.x)&&Number.isFinite(d.p1.y)
    &&Number.isFinite(d.p2.x)&&Number.isFinite(d.p2.y))
}

/** When sizeArrowData empty (e.g. geom), invent L/W/H along bounds edges. */
export function fallbackSizeArrowData(knife){
  const b=knife?.bounds
  const d=knife?.dimensions||{}
  if(!b||![b.minX,b.minY,b.maxX,b.maxY].every(Number.isFinite))return []
  const mode=d.sizeMode||'inner'
  const L=Number(d.length)||0,W=Number(d.width)||0,H=Number(d.height)||0
  if(!(L>0||W>0||H>0))return []
  const pad=OFFSET+6
  const out=[]
  if(L>0)out.push({
    lineName:`L(${mode})`,lineLength:L,
    p1:{x:b.minX,y:b.maxY+pad},p2:{x:b.minX+L,y:b.maxY+pad}
  })
  if(W>0)out.push({
    lineName:`W(${mode})`,lineLength:W,
    p1:{x:b.maxX+pad,y:b.minY},p2:{x:b.maxX+pad,y:b.minY+W}
  })
  if(H>0){
    const hx=b.minX-pad
    out.push({
      lineName:`H(${mode})`,lineLength:H,
      p1:{x:hx,y:b.maxY},p2:{x:hx,y:b.maxY-H}
    })
  }
  return out
}

/** Build sizeArrowData for geom knives from dimensions + bounds. */
export function sizeArrowDataFromBounds(bounds,dimensions){
  return fallbackSizeArrowData({bounds,dimensions})
}

function overallFromArrow(d){
  const x1=d.p1.x,y1=d.p1.y,x2=d.p2.x,y2=d.p2.y
  const dx=x2-x1,dy=y2-y1
  const len=Math.hypot(dx,dy)||1
  const ux=dx/len,uy=dy/len
  // outward normal (prefer away from origin of segment mid → use rotated)
  let nx=-uy,ny=ux
  // bias: if horizontal-ish, offset upward (smaller y); if vertical, offset left
  if(Math.abs(dx)>=Math.abs(dy)){
    if(ny>0){nx=-nx;ny=-ny}
  }else if(nx>0){nx=-nx;ny=-ny}

  const ox=nx*OFFSET,oy=ny*OFFSET
  const ex=nx*EXTEND,ey=ny*EXTEND
  const a1x=x1+ox,a1y=y1+oy,a2x=x2+ox,a2y=y2+oy
  const label=`${d.lineName} ${fmtLen(d.lineLength)}`
  const mx=(a1x+a2x)/2,my=(a1y+a2y)/2
  // arrow tips along dimension line
  const tip=ARROW
  const leftPoly=[
    [a1x,a1y],
    [a1x+ux*tip+nx*tip*.35,a1y+uy*tip+ny*tip*.35],
    [a1x+ux*tip-nx*tip*.35,a1y+uy*tip-ny*tip*.35]
  ]
  const rightPoly=[
    [a2x,a2y],
    [a2x-ux*tip+nx*tip*.35,a2y-uy*tip+ny*tip*.35],
    [a2x-ux*tip-nx*tip*.35,a2y-uy*tip-ny*tip*.35]
  ]
  return {
    kind:'overall',
    label,
    color:DIM_COLOR,
    lines:[
      {x1,y1,x2:a1x+ex,y2:a1y+ey},
      {x1:x2,y1:y2,x2:a2x+ex,y2:a2y+ey},
      {x1:a1x,y1:a1y,x2:a2x,y2:a2y}
    ],
    polys:[leftPoly,rightPoly],
    text:{x:mx+nx*4,y:my+ny*4,anchor:'middle',value:label}
  }
}

function faceLabel(f){
  const w=Number(f.w),h=Number(f.h)
  if(!(w>=MIN_FACE&&h>=MIN_FACE))return null
  return {
    kind:'face',
    face:f.name,
    label:`${fmtLen(w)}×${fmtLen(h)}`,
    color:DIM_COLOR,
    lines:[],
    polys:[],
    text:{
      x:Number(f.x)+w/2,
      y:Number(f.y)+h/2,
      anchor:'middle',
      value:`${fmtLen(w)}×${fmtLen(h)}`
    }
  }
}

/**
 * @returns {{kind:string,label:string,color:string,lines:{x1,y1,x2,y2}[],polys:number[][][],text?:{x,y,anchor,value}}[]}
 */
export function buildDimAnnotations(knife,{minFace=MIN_FACE}={}){
  const arrows=normalizeArrows(knife?.sizeArrowData)
  const overallSrc=arrows.length?arrows:fallbackSizeArrowData(knife)
  const out=[]
  for(const d of overallSrc)out.push(overallFromArrow(d))
  for(const f of knife?.faces||[]){
    const w=Number(f.w),h=Number(f.h)
    if(!(w>=minFace&&h>=minFace))continue
    if(!Number.isFinite(f.x)||!Number.isFinite(f.y))continue
    const ann=faceLabel(f)
    if(ann)out.push(ann)
  }
  return out
}

/** Serialize annotations to SVG fragment (inside a parent <g>). */
export function dimAnnotationsToSvg(anns,{fontSize=13}={}){
  if(!anns?.length)return ''
  const parts=[]
  for(const a of anns){
    parts.push(`<g fill="none" stroke="${a.color}" stroke-width="0.9">`)
    for(const L of a.lines||[]){
      parts.push(`<line x1="${round(L.x1)}" y1="${round(L.y1)}" x2="${round(L.x2)}" y2="${round(L.y2)}"/>`)
    }
    for(const poly of a.polys||[]){
      const pts=poly.map(p=>`${round(p[0])},${round(p[1])}`).join(' ')
      parts.push(`<polygon points="${pts}" fill="${a.color}" stroke="none"/>`)
    }
    if(a.text){
      const dy=a.kind==='face'?'0.35em':'-0.35em'
      parts.push(`<text x="${round(a.text.x)}" y="${round(a.text.y)}" fill="${a.color}" stroke="none" font-size="${fontSize}" text-anchor="${a.text.anchor||'middle'}" dominant-baseline="middle" dy="${dy}">${escapeXml(a.text.value)}</text>`)
    }
    parts.push('</g>')
  }
  return parts.join('')
}

function escapeXml(s){
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

export {DIM_COLOR,MIN_FACE}
