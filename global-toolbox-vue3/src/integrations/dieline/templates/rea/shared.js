/** REA 参数化模板公共件：参数定义、管式骨架、孔布局、合盖盒示意 */

export const round=n=>Math.round(n*1000)/1000
export const clamp=(n,a,b)=>Math.min(b,Math.max(a,n))

export function pdef(code,label,group,defFn,{min=0,max=2000,unit='mm'}={}){
  return {code,label,group,default:defFn,min,max,unit}
}

/** 左右对称孔行（Aircraft 底面插孔） */
export function sideSlotHoles({Hx,Hy,Lk,Wk,K,SW,SP,bleed,r=0}){
  const k=Math.max(1,Math.round(K)||1)
  const span=(k-1)*SP+SW
  const margin=(Wk-span)/2
  const holes=[]
  for(let i=0;i<k;i++){
    const y=Hy+margin+i*SP
    holes.push({x:Hx,y,w:bleed,h:SW,r})
    holes.push({x:Hx+Lk-bleed,y,w:bleed,h:SW,r})
  }
  return holes
}

/** 居中窗洞 */
export function centeredWindow({Fx,Fy,Fw,Fh,hw,hh,yRel,r=0}){
  const w=Math.min(hw,Fw*.98)
  const h=Math.min(hh,Fh*.98)
  return {
    x:Fx+(Fw-w)/2,
    y:Fy+clamp(yRel,0,Math.max(0,Fh-h)),
    w,h,r
  }
}

export function aabb(cx,cy,cz,hx,hy,hz){
  return {min:[cx-hx,cy-hy,cz-hz],max:[cx+hx,cy+hy,cz+hz]}
}

/** 管式插舌盒骨架（STE：上下盖均铰在后墙；RTE：上盖铰前墙、下盖铰后墙） */
export function layoutPairTube({panel,T,params,mode='ste',extra={}}){
  const Lp=panel.length,Wp=panel.width,Hp=panel.height
  const G=params.G??16
  const C=params.C??Lp*.14
  const A=params.A??Lp*.33
  const ATT=params.ATT??Hp*.09
  const R=params.R??1.5
  const MT=params.MT??params.OF??12
  const glueW=Math.max(6,Math.min(G,Lp*.3))
  const tuckD=Math.min(Math.max(A*.35,8),ATT>0?Math.max(ATT,10):25,Hp*.4,Wp*.5)
  const tuckInset=Math.max(1,2*T)
  const dustH=Math.min(C,Wp*.85,Lp*.45)
  const slot=Math.max(1.5,3*T)
  const glueInset=Math.min(3,Hp*.05)
  const x0=glueW+15,y0=Wp+tuckD+15
  const walls=[['front',Lp],['right',Wp],['back',Lp],['left',Wp]]
  const faces=[]
  const pos={}
  let x=x0
  walls.forEach(([name,w],i)=>{
    faces.push([name,x,y0,w,Hp,i?walls[i-1][0]:null,i?'right':null])
    pos[name]={x,w}
    x+=w
  })
  faces.push(['glueFlap',x0-glueW,y0+glueInset,glueW,Hp-2*glueInset,'front','left'])
  const bx=pos.back.x,rx=pos.right.x,lx=pos.left.x,fx=pos.front.x
  const bottomY=y0+Hp
  const topParent=mode==='rte'?'front':'back'
  const topX=mode==='rte'?fx:bx
  // 先 round 再贴边，避免 createKnife 二次 round 造成铰链缝隙
  const lidY=round(y0-Wp),lidH=round(Wp),tuckH=round(tuckD),tuckY=round(lidY-tuckH)
  const botLidY=round(bottomY),botTuckY=round(botLidY+lidH)
  const dustHt=round(dustH),dustTopY=round(y0-dustHt)
  const tuckW=Lp-2*tuckInset
  const dustW=Wp-slot
  faces.push(
    ['topLid',topX,lidY,Lp,lidH,topParent,'top'],
    // 插舌：side=top → 铰在相对 y=h；自由端在 y=0（roundRect 的 bl/br）
    withOutline(['topTuck',topX+tuckInset,tuckY,tuckW,tuckH,'topLid','top'],
      roundRect(tuckW,tuckH,{tl:0,tr:0,bl:R,br:R})),
    withOutline(['topDustRight',rx+slot/2,dustTopY,dustW,dustHt,'right','top'],
      taperFlap(dustW,dustHt,MT,'top')),
    withOutline(['topDustLeft',lx+slot/2,dustTopY,dustW,dustHt,'left','top'],
      taperFlap(dustW,dustHt,MT,'top')),
    ['bottomLid',bx,botLidY,Lp,lidH,'back','bottom'],
    // side=bottom → 铰在 y=0；自由端在 y=h（tl/tr）
    withOutline(['bottomTuck',bx+tuckInset,botTuckY,tuckW,tuckH,'bottomLid','bottom'],
      roundRect(tuckW,tuckH,{tl:R,tr:R,bl:0,br:0})),
    withOutline(['bottomDustRight',rx+slot/2,botLidY,dustW,dustHt,'right','bottom'],
      taperFlap(dustW,dustHt,MT,'bottom')),
    withOutline(['bottomDustLeft',lx+slot/2,botLidY,dustW,dustHt,'left','bottom'],
      taperFlap(dustW,dustHt,MT,'bottom'))
  )
  if(extra.hangTab){
    const ht=extra.hangTab
    faces.push(['hangTab',topX+(Lp-ht.w)/2,y0-Wp-tuckD-ht.h,ht.w,ht.h,'topTuck','top'])
  }
  const holes=[]
  if(extra.window){
    const win=extra.window
    holes.push(centeredWindow({
      Fx:fx,Fy:y0,Fw:Lp,Fh:Hp,
      hw:win.w,hh:win.h,yRel:win.yRel,r:win.r||0
    }))
  }
  if(extra.handleHoles){
    for(const hh of extra.handleHoles)holes.push(hh)
  }
  const lenY=y0+Hp*.3,widY=y0+Hp*.7
  const arrows={
    length:[{x:x0,y:lenY},{x:x0+Lp,y:lenY}],
    width:[{x:rx,y:widY},{x:rx+Wp,y:widY}],
    height:[{x:bx+Lp/2,y:y0},{x:bx+Lp/2,y:y0+Hp}]
  }
  return {faces,arrows,holes,pos:{front:pos.front,back:pos.back,left:pos.left,right:pos.right,y0}}
}

export const PAIR_FACE_ORDER=Object.freeze([
  'front','right','back','left','glueFlap',
  'topLid','topTuck','topDustRight','topDustLeft',
  'bottomLid','bottomTuck','bottomDustRight','bottomDustLeft'
])

export const PAIR_FACE_ORDER_HOOK=Object.freeze([
  ...PAIR_FACE_ORDER,'hangTab'
])

export function pairClosedCheck(){
  return {
    pairs:[
      ['topTuck','front'],
      ['bottomTuck','front'],
      ['topDustLeft','left'],
      ['topDustRight','right'],
      ['bottomDustLeft','left'],
      ['bottomDustRight','right']
    ],
    buildBoxes({panel,T}){
      const Lp=panel.length,Wp=panel.width,Hp=panel.height,t=T
      return {
        front:aabb(0,Wp/2,Hp/2,Lp/2,t/2,Hp/2),
        left:aabb(-Lp/2,0,Hp/2,t/2,Wp/2,Hp/2),
        right:aabb(Lp/2,0,Hp/2,t/2,Wp/2,Hp/2),
        topTuck:aabb(0,Wp/2-t,Hp-t*2,Lp/2*.8,t/2,Math.min(Hp*.25,Wp*.35)),
        bottomTuck:aabb(0,Wp/2-t,t*2,Lp/2*.8,t/2,Math.min(Hp*.25,Wp*.35)),
        topDustLeft:aabb(-Lp/2+t,0,Hp-t/2,t*.8,Wp/2*.7,t/2),
        topDustRight:aabb(Lp/2-t,0,Hp-t/2,t*.8,Wp/2*.7,t/2),
        bottomDustLeft:aabb(-Lp/2+t,0,t/2,t*.8,Wp/2*.7,t/2),
        bottomDustRight:aabb(Lp/2-t,0,t/2,t*.8,Wp/2*.7,t/2)
      }
    }
  }
}

export const PAIR_PARAM_DEFS=[
  pdef('G','粘舌宽','管式骨架',(p)=>16,{min:8,max:40}),
  pdef('GT','粘舌倒角','管式骨架',()=>15,{min:0,max:30}),
  pdef('C','防尘翼高','插锁防尘',(p)=>round(p.length*.14),{min:5,max:80}),
  pdef('CR','插锁倒角','插锁防尘',(p)=>round(p.length*.07),{min:1,max:40}),
  pdef('A','插舌相关宽','插锁防尘',(p)=>round(p.length*.33),{min:8,max:120}),
  pdef('ATT','插舌深','插锁防尘',(p)=>round(p.height*.09),{min:4,max:40}),
  pdef('AX','插锁槽 X','插锁防尘',(p)=>round(p.length*.03),{min:0,max:20}),
  pdef('AXX','插锁槽 XX','插锁防尘',(p)=>round(p.length*.04),{min:0,max:20}),
  pdef('NX','开槽厚 X','倒角',()=>3,{min:0,max:10}),
  pdef('NY','开槽厚 Y','倒角',()=>3,{min:0,max:10}),
  pdef('OF','外倒角','倒角',()=>1,{min:0,max:10}),
  pdef('R','倒角 R','倒角',()=>1.5,{min:0,max:10})
]

export const CORRUGATED_SIZE_RULE=Object.freeze({
  panelAdd:{length:2,width:2,height:2},
  outerAdd:{length:3,width:3,height:3}
})

export const BOARD_SIZE_RULE=Object.freeze({
  panelAdd:{length:1,width:1,height:2},
  outerAdd:{length:2,width:2,height:2}
})

/** 平板（无高度）尺寸规则 */
export const FLAT_SIZE_RULE=Object.freeze({
  panelAdd:{length:0,width:0,height:0},
  outerAdd:{length:0,width:0,height:0}
})

/** —— 面片相对轮廓工具（相对 bbox 左下角，弧已细分） —— */

function arcPts(cx,cy,r,a0,a1,seg=4){
  const pts=[]
  for(let i=0;i<=seg;i++){
    const t=a0+(a1-a0)*(i/seg)
    pts.push([round(cx+r*Math.cos(t)),round(cy+r*Math.sin(t))])
  }
  return pts
}

/**
 * 四角斜切矩形。c = 斜切边长（沿两边各切 c）。
 * @param {{tl?:number,tr?:number,bl?:number,br?:number}|number} c
 */
export function chamferRect(w,h,c=0){
  const o=typeof c==='number'?{tl:c,tr:c,bl:c,br:c}:c
  const tl=Math.max(0,Math.min(o.tl||0,w/2,h/2))
  const tr=Math.max(0,Math.min(o.tr||0,w/2,h/2))
  const br=Math.max(0,Math.min(o.br||0,w/2,h/2))
  const bl=Math.max(0,Math.min(o.bl||0,w/2,h/2))
  const raw=[
    [bl,0],
    [w-br,0],
    ...(br>0?[[w,br]]:[[w,0]]),
    [w,h-tr],
    ...(tr>0?[[w-tr,h]]:[[w,h]]),
    [tl,h],
    ...(tl>0?[[0,h-tl]]:[[0,h]]),
    [0,bl],
    ...(bl>0?[[bl,0]]:[])
  ]
  const clean=[]
  for(const p of raw){
    const last=clean[clean.length-1]
    if(!last||last[0]!==p[0]||last[1]!==p[1])clean.push([round(p[0]),round(p[1])])
  }
  if(clean.length>1&&clean[0][0]===clean[clean.length-1][0]&&clean[0][1]===clean[clean.length-1][1])clean.pop()
  return clean
}

/**
 * 圆角矩形。r 可为统一半径或 {tl,tr,bl,br}
 */
export function roundRect(w,h,r=0,arcSeg=4){
  const o=typeof r==='number'?{tl:r,tr:r,bl:r,br:r}:r
  const tl=Math.max(0,Math.min(o.tl||0,w/2,h/2))
  const tr=Math.max(0,Math.min(o.tr||0,w/2,h/2))
  const br=Math.max(0,Math.min(o.br||0,w/2,h/2))
  const bl=Math.max(0,Math.min(o.bl||0,w/2,h/2))
  if(tl+tr+br+bl<1e-6)return [[0,0],[w,0],[w,h],[0,h]]
  const pts=[]
  pts.push([bl,0])
  pts.push([w-br,0])
  if(br>0)pts.push(...arcPts(w-br,br,br,-Math.PI/2,0,arcSeg).slice(1))
  else pts.push([w,0])
  pts.push([w,h-tr])
  if(tr>0)pts.push(...arcPts(w-tr,h-tr,tr,0,Math.PI/2,arcSeg).slice(1))
  else pts.push([w,h])
  pts.push([tl,h])
  if(tl>0)pts.push(...arcPts(tl,h-tl,tl,Math.PI/2,Math.PI,arcSeg).slice(1))
  else pts.push([0,h])
  pts.push([0,bl])
  if(bl>0)pts.push(...arcPts(bl,bl,bl,Math.PI,Math.PI*1.5,arcSeg).slice(1))
  const clean=[]
  for(const p of pts){
    const last=clean[clean.length-1]
    if(!last||Math.hypot(last[0]-p[0],last[1]-p[1])>1e-6)clean.push([round(p[0]),round(p[1])])
  }
  return clean
}

/**
 * MT 梯形翼：铰链边为满宽，自由端按 angleDeg 内收。
 * side: 自由端朝向（相对 bbox）'top'|'bottom'|'left'|'right' —— 与铰链对边。
 * 例：lidLeft 铰在 right，自由端在 left → side='left'
 */
export function taperFlap(w,h,angleDeg=20,freeSide='left'){
  const a=Math.max(0,Math.min(80,Number(angleDeg)||0))*Math.PI/180
  const insetX=Math.min(w*.45,Math.tan(a)*h)
  const insetY=Math.min(h*.45,Math.tan(a)*w)
  if(freeSide==='left'){
    // 右=铰链满高；左端上下内收
    return [[insetX,0],[w,0],[w,h],[insetX,h]]
  }
  if(freeSide==='right'){
    return [[0,0],[w-insetX,0],[w-insetX,h],[0,h]]
  }
  if(freeSide==='top'){
    // 布局 y 向下：top 边是 y=0；铰在 bottom (y=h)
    return [[0,insetY],[w,insetY],[w,h],[0,h]]
  }
  // bottom free, hinge at top (y=0)
  return [[0,0],[w,0],[w,h-insetY],[0,h-insetY]]
}

/**
 * 在矩形一边用二次 Bezier 做内侧圆弧（不撑破 bbox）。
 * edge: top|bottom|left|right；sagitta 为弧矢高。
 */
export function arcEdge(w,h,sagitta=0,edge='top',arcSeg=6){
  const s=Math.max(0,Number(sagitta)||0)
  if(s<1e-6)return [[0,0],[w,0],[w,h],[0,h]]
  const bez=(a,ctrl,b)=>{
    const out=[]
    for(let i=0;i<=arcSeg;i++){
      const t=i/arcSeg
      const x=(1-t)*(1-t)*a[0]+2*(1-t)*t*ctrl[0]+t*t*b[0]
      const y=(1-t)*(1-t)*a[1]+2*(1-t)*t*ctrl[1]+t*t*b[1]
      out.push([round(x),round(y)])
    }
    return out
  }
  if(edge==='top'){
    const sag=Math.min(s,h*.45)
    return [...bez([0,0],[w/2,sag],[w,0]).slice(0,-1),[w,0],[w,h],[0,h]]
  }
  if(edge==='bottom'){
    const sag=Math.min(s,h*.45)
    return [[0,0],[w,0],...bez([w,h],[w/2,h-sag],[0,h]).slice(0,-1),[0,h]]
  }
  if(edge==='left'){
    const sag=Math.min(s,w*.45)
    return [[0,0],[w,0],[w,h],...bez([0,h],[sag,h/2],[0,0]).slice(0,-1)]
  }
  // right
  const sag=Math.min(s,w*.45)
  return [[0,0],...bez([w,0],[w-sag,h/2],[w,h]).slice(0,-1),[w,h],[0,h]]
}

/**
 * 侧翼：铰链满高 + 自由端梯形内收 + 自由端两角圆角（MT+MR）。
 * hingeSide: left|right|top|bottom（铰链在 bbox 哪一侧）
 */
export function taperRoundFlap(w,h,{angleDeg=20,r=0,hingeSide='right',arcSeg=4}={}){
  const free=hingeSide==='right'?'left':hingeSide==='left'?'right':hingeSide==='top'?'bottom':'top'
  let pts=taperFlap(w,h,angleDeg,free)
  const rr=Math.max(0,Number(r)||0)
  if(rr<1e-6)return pts
  // 仅在自由端两角做圆角：找到自由边两端点，用弧替换尖角
  // 简化：对整块用 roundRect 再与 taper 取「自由端内收」——对左右翼：
  if(free==='left'){
    const inset=pts[0][0]
    const rad=Math.min(rr,(h/2)-0.1,Math.max(0,w-inset-0.1))
    if(rad<1e-6)return pts
    return [
      [inset+rad,0],
      [w,0],[w,h],
      [inset+rad,h],
      ...arcPts(inset+rad,h-rad,rad,Math.PI/2,Math.PI,arcSeg).slice(1),
      [inset,rad],
      ...arcPts(inset+rad,rad,rad,Math.PI,Math.PI*1.5,arcSeg).slice(1)
    ]
  }
  if(free==='right'){
    const inset=w-pts[1][0]
    const edgeX=w-inset
    const rad=Math.min(rr,(h/2)-0.1,Math.max(0,edgeX-0.1))
    if(rad<1e-6)return pts
    return [
      [0,0],
      [edgeX-rad,0],
      ...arcPts(edgeX-rad,rad,rad,-Math.PI/2,0,arcSeg).slice(1),
      [edgeX,h-rad],
      ...arcPts(edgeX-rad,h-rad,rad,0,Math.PI/2,arcSeg).slice(1),
      [0,h]
    ]
  }
  return pts
}

/** 把相对轮廓挂到面元组第 8 项 */
export function withOutline(faceTuple,outline){
  if(!outline||outline.length<3)return faceTuple
  const shape=faceTuple[7]&&typeof faceTuple[7]==='object'?{...faceTuple[7]}:{}
  shape.outline=outline
  return [...faceTuple.slice(0,7),shape]
}

export function withHingeLine(faceTuple,hingeLineRel){
  const shape=faceTuple[7]&&typeof faceTuple[7]==='object'?{...faceTuple[7]}:{}
  shape.hingeLine=hingeLineRel
  return [...faceTuple.slice(0,7),shape]
}
