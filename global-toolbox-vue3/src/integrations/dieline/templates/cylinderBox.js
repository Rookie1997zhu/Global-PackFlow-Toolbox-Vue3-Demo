// 圆筒 / 椭圆筒：L×W 椭圆截面 N 边近似；围边链式右铰（smooth 虚折）+ 糊边 + 底/盖片 + 可选底部锯齿舌。
import {pdef} from './rea/shared.js'

function buildPiece({panel,T,piece='bottom',lidClearance=2,lidHeight,sides=24,tabs=true}){
  const isLid=piece==='lid'
  const c=isLid?Math.max(0,Number(lidClearance)||0):0
  const a=(panel.length+2*c)/2
  const b=(panel.width+2*c)/2
  const Hp=isLid
    ?Math.max(8,Number(lidHeight)||panel.height*.3)
    :panel.height
  const n=Math.min(48,Math.max(12,Math.round(Number(sides)||24)))
  const angles=[]
  for(let i=0;i<n;i++)angles.push(2*Math.PI*i/n-Math.PI/2)
  const chord=(i)=>{
    const t0=angles[i],t1=angles[(i+1)%n]
    const x0=a*Math.cos(t0),y0=b*Math.sin(t0)
    const x1=a*Math.cos(t1),y1=b*Math.sin(t1)
    return Math.hypot(x1-x0,y1-y0)
  }
  const widths=Array.from({length:n},(_,i)=>Math.max(1.5,chord(i)))
  const turn=360/n
  const hingeAngles={}
  for(let i=1;i<n;i++)hingeAngles[`wall${i}`]=turn
  hingeAngles.glueFlap=turn
  hingeAngles.disk=90

  const glueW=Math.max(8,Math.min(16,widths[0]*.6))
  const glueInset=Math.min(2,Hp*.08)
  const tabH=tabs?Math.max(4,Math.min(10,Math.min(...widths)*.35)):0
  const x0=glueW+20,y0=20+Math.max(a,b)*2+20+tabH
  const faces=[]
  const faceOrder=[]
  // 锯齿舌放在围边上沿（与底片相对的一边），与 disk 共边不冲突；宽=墙宽精确共边
  let x=x0
  for(let i=0;i<n;i++){
    const name=`wall${i}`
    const w=widths[i]
    const shape=i?{smooth:true}:undefined
    faces.push(shape
      ?[name,x,y0,w,Hp,i?`wall${i-1}`:null,i?'right':null,shape]
      :[name,x,y0,w,Hp,i?`wall${i-1}`:null,i?'right':null]
    )
    faceOrder.push(name)
    // 锯齿舌与墙同宽共边（顶边，与 disk 相对）
    if(tabs&&!isLid&&tabH>0){
      const tname=`tab${i}`
      faces.push([tname,x,y0-tabH,w,tabH,name,'top',{smooth:true}])
      faceOrder.push(tname)
      hingeAngles[tname]=90
    }
    x+=w
  }
  faces.push(['glueFlap',x0-glueW,y0+glueInset,glueW,Hp-2*glueInset,'wall0','left',{smooth:true}])
  faceOrder.push('glueFlap')

  // 底/盖片：N 边形，铰边强制与 wall0 底边共点共长（保证并集连通）
  const wall0w=widths[0]
  const scale=isLid?Math.max(.85,1-Math.min(2,c)*.02):1
  const diskPts=[]
  const tA=angles[0],tB=angles[1]
  const mid=(tA+tB)/2
  const rot=-mid+Math.PI/2
  for(let i=0;i<n;i++){
    const t=angles[i]+rot
    diskPts.push([a*Math.cos(t)*scale,b*Math.sin(t)*scale])
  }
  // 找「顶边」：旋转后 y 最小的边
  let hi=0,hj=1,bestY=Infinity
  for(let i=0;i<n;i++){
    const p=diskPts[i],q=diskPts[(i+1)%n]
    const my=(p[1]+q[1])/2
    if(my<bestY){bestY=my;hi=i;hj=(i+1)%n}
  }
  const p0=diskPts[hi],p1=diskPts[hj]
  const curLen=Math.hypot(p1[0]-p0[0],p1[1]-p0[1])||1
  // 仿射：把铰边映射到 (0,0)-(wall0w,0)，其余点随转缩放
  const ang0=Math.atan2(p1[1]-p0[1],p1[0]-p0[0])
  const sc=wall0w/curLen
  const mapped=diskPts.map(([px,py])=>{
    const dx=px-p0[0],dy=py-p0[1]
    const rx=(dx*Math.cos(ang0)+dy*Math.sin(ang0))*sc
    const ry=(-dx*Math.sin(ang0)+dy*Math.cos(ang0))*sc
    return [rx,ry]
  })
  // 若盘在铰边上侧（y<0），整体翻到 y≥0
  if(mapped.every(([,y])=>y<=1e-6)){
    for(const p of mapped)p[1]*=-1
  }
  // 强制铰边两端精确
  mapped[hi]=[0,0]
  mapped[hj]=[wall0w,0]
  const xs=mapped.map(p=>p[0]),ys=mapped.map(p=>p[1])
  const minX=Math.min(...xs),minY=Math.min(...ys)
  const maxX=Math.max(...xs),maxY=Math.max(...ys)
  const rel=mapped.map(([px,py])=>[px-minX,py-minY])
  const hl=[[0-minX,0-minY],[wall0w-minX,0-minY]]
  const diskX=x0+minX // minX 通常≤0；使铰边落在 x0..x0+wall0w
  const diskY=y0+Hp+minY
  // 校正：铰边绝对 y 应为 y0+Hp
  const hlAbsY=diskY+hl[0][1]
  const dyFix=y0+Hp-hlAbsY
  faces.push(['disk',diskX,diskY+dyFix,maxX-minX,maxY-minY,'wall0',null,{
    outline:rel,
    hingeLine:hl
  }])
  faceOrder.push('disk')

  const arrows={
    length:[{x:x0,y:y0+Hp*.3},{x:x0+widths[0],y:y0+Hp*.3}],
    width:[{x:x0+widths[0],y:y0+Hp*.65},{x:x0+widths[0]+(widths[1]||widths[0]),y:y0+Hp*.65}],
    height:[{x:x0+wall0w*.5,y:y0},{x:x0+wall0w*.5,y:y0+Hp}]
  }
  return {faces,arrows,faceOrder,root:'wall0',hingeAngles,piece:isLid?'lid':'bottom'}
}

export default {
  id:'cylinder-box',
  label:'圆筒盒',
  labelEn:'Cylinder / Oval Tube',
  standard:'圆筒/椭圆筒示意',
  root:'wall0',
  faceOrder:Object.freeze(['wall0']),
  supportsClosedCheck:false,
  supportsPiece:true,
  assembly:'stack',
  pieces:Object.freeze([
    {id:'bottom',label:'筒身',root:'wall0'},
    {id:'lid',label:'筒盖',root:'wall0'}
  ]),
  defaults:{length:80,width:80,height:120,thickness:1.5,lidClearance:2,lidHeight:36,sides:24},
  limits:{length:[30,400],width:[30,400],height:[20,500]},
  sizeRule:{
    panelAdd:{length:1,width:1,height:1},
    outerAdd:{length:2,width:2,height:2}
  },
  hingeAngles:{},
  paramDefs:[
    pdef('lidHeight','筒盖高度','结构参数',(panel)=>Math.max(8,(panel?.height||120)*.3),{min:8,max:200}),
    pdef('lidClearance','盖间隙','结构参数',()=>2,{min:0,max:10}),
    pdef('sides','围边段数','结构参数',()=>24,{min:12,max:48})
  ],
  closedCheck:{
    pairs:[],
    buildBoxes(){return {}}
  },
  layout({panel,T,piece='bottom',lidClearance=2,params}){
    const lidHeight=params?.lidHeight??Math.max(8,panel.height*.3)
    const clear=params?.lidClearance??lidClearance
    const sides=params?.sides??36
    return buildPiece({panel,T,piece,lidClearance:clear,lidHeight,sides,tabs:true})
  }
}
