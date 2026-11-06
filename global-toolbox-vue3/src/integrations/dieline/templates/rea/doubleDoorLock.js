// REA DoubleDoorLockBottomBoxP1：双开门锁底（非多边形）
import {pdef,aabb,BOARD_SIZE_RULE,round} from './shared.js'

export default {
  id:'rea-double-door-lock',
  label:'REA 双开门锁底',
  labelEn:'REA Double Door Lock Bottom',
  standard:'DoubleDoorLockBottomBoxP1 · REA',
  root:'front',
  faceOrder:Object.freeze([
    'front','right','back','left','glueFlap',
    'topLeft','topRight','bottomLeft','bottomRight',
    'dustTL','dustTR','dustBL','dustBR'
  ]),
  supportsClosedCheck:true,
  defaults:{length:150,width:80,height:100,thickness:.5},
  limits:{length:[50,500],width:[30,300],height:[40,400]},
  sizeRule:BOARD_SIZE_RULE,
  reaRef:{
    code:'DoubleDoorLockBottomBoxP1',
    sampleNum:'184110',
    faceMap:{front:'H'}
  },
  paramDefs:[
    pdef('W1','粘舌宽','锁底',(p)=>round(p.length*.16),{min:8,max:50}),
    pdef('N','翼宽','锁底',(p)=>round(p.length*.4),{min:15,max:120}),
    pdef('SW','锁舌宽','锁底',(p)=>round(p.length*.2),{min:8,max:80}),
    pdef('SW1','锁舌宽2','锁底',(p)=>round(p.length*.2),{min:8,max:80}),
    pdef('SP','锁距','锁底',(p)=>round(p.length*.4),{min:10,max:160}),
    pdef('N1','副翼','锁底',(p)=>round(p.length*.2),{min:5,max:80})
  ],
  hingeAngles:{topLeft:88,topRight:88,bottomLeft:88,bottomRight:88},
  closedCheck:{
    pairs:[
      ['topLeft','topRight'],['bottomLeft','bottomRight'],
      ['dustTL','left'],['dustTR','right'],['dustBL','left'],['dustBR','right']
    ],
    buildBoxes({panel,T}){
      const Lp=panel.length,Wp=panel.width,Hp=panel.height,t=T
      // 双门在中线略重叠
      return {
        topLeft:aabb(-Lp/4+t,Wp/2-t,Hp-t,Lp/4,t/2,Wp*.35),
        topRight:aabb(Lp/4-t,Wp/2-t,Hp-t,Lp/4,t/2,Wp*.35),
        bottomLeft:aabb(-Lp/4+t,Wp/2-t,t,Lp/4,t/2,Wp*.35),
        bottomRight:aabb(Lp/4-t,Wp/2-t,t,Lp/4,t/2,Wp*.35),
        dustTL:aabb(-Lp/2+t,0,Hp-t/2,t*.8,Wp/2*.7,t/2),
        dustTR:aabb(Lp/2-t,0,Hp-t/2,t*.8,Wp/2*.7,t/2),
        dustBL:aabb(-Lp/2+t,0,t/2,t*.8,Wp/2*.7,t/2),
        dustBR:aabb(Lp/2-t,0,t/2,t*.8,Wp/2*.7,t/2),
        left:aabb(-Lp/2,0,Hp/2,t/2,Wp/2,Hp/2),
        right:aabb(Lp/2,0,Hp/2,t/2,Wp/2,Hp/2)
      }
    }
  },
  layout({panel,T,params}){
    const Lp=panel.length,Wp=panel.width,Hp=panel.height
    const W1=params.W1,N=params.N
    const doorW=Lp/2
    const slot=Math.max(1.5,2*T)
    const dustH=Math.min(N*.5,Wp*.7)
    const x0=W1+15,y0=dustH+15
    const walls=[['front',Lp],['right',Wp],['back',Lp],['left',Wp]]
    const faces=[]
    const pos={}
    let x=x0
    walls.forEach(([name,w],i)=>{
      faces.push([name,x,y0,w,Hp,i?walls[i-1][0]:null,i?'right':null])
      pos[name]={x,w}
      x+=w
    })
    faces.push(['glueFlap',x0-W1,y0+2,W1,Hp-4,'front','left'])
    const fx=pos.front.x,bx=pos.back.x,rx=pos.right.x,lx=pos.left.x
    faces.push(
      ['topLeft',fx,y0-doorW,doorW-slot/2,doorW,'front','top'],
      ['topRight',fx+doorW+slot/2,y0-doorW,doorW-slot/2,doorW,'front','top'],
      ['bottomLeft',fx,y0+Hp,doorW-slot/2,doorW,'front','bottom'],
      ['bottomRight',fx+doorW+slot/2,y0+Hp,doorW-slot/2,doorW,'front','bottom'],
      ['dustTL',lx+slot/2,y0-dustH,Wp-slot,dustH,'left','top'],
      ['dustTR',rx+slot/2,y0-dustH,Wp-slot,dustH,'right','top'],
      ['dustBL',lx+slot/2,y0+Hp,Wp-slot,dustH,'left','bottom'],
      ['dustBR',rx+slot/2,y0+Hp,Wp-slot,dustH,'right','bottom']
    )
    const arrows={
      length:[{x:x0,y:y0+Hp*.3},{x:x0+Lp,y:y0+Hp*.3}],
      width:[{x:rx,y:y0+Hp*.7},{x:rx+Wp,y:y0+Hp*.7}],
      height:[{x:bx+Lp/2,y:y0},{x:bx+Lp/2,y:y0+Hp}]
    }
    return {faces,arrows}
  }
}
