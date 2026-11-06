// REA Carton / FEFCO 0201 向。公式：F=W/2+1, F1=F+2, G≈45
import {pdef,aabb,CORRUGATED_SIZE_RULE,round} from './shared.js'

export default {
  id:'rea-carton-0201',
  label:'REA 开槽纸箱',
  labelEn:'REA Carton RSC',
  standard:'Carton · FEFCO:0201 · REA',
  root:'front',
  faceOrder:Object.freeze([
    'front','right','back','left','glueFlap',
    'frontTop','rightTop','backTop','leftTop',
    'frontBottom','rightBottom','backBottom','leftBottom'
  ]),
  supportsClosedCheck:true,
  defaults:{length:300,width:200,height:150,thickness:3},
  limits:{length:[80,1200],width:[60,1000],height:[40,1000]},
  sizeRule:CORRUGATED_SIZE_RULE,
  reaRef:{
    code:'Carton',
    sampleNum:'200010',
    faceMap:{front:'H',back:'F',right:'FR',left:'FL'}
  },
  paramDefs:[
    pdef('F','外摇盖高','摇盖',(p)=>round(p.width/2+1),{min:10,max:400}),
    pdef('F1','内摇盖高','摇盖',(p)=>round(p.width/2+1+2),{min:10,max:400}),
    pdef('G','接舌宽','接舌',()=>45,{min:15,max:80}),
    pdef('GT','接舌倒角','接舌',()=>5,{min:0,max:20}),
    pdef('OF','外倒角','倒角',()=>1,{min:0,max:10}),
    pdef('R','倒角 R','倒角',()=>1.5,{min:0,max:10})
  ],
  hingeAngles:{frontTop:88,backTop:88,frontBottom:88,backBottom:88},
  closedCheck:{
    pairs:[
      ['frontTop','backTop'],['frontBottom','backBottom'],
      ['leftTop','frontTop'],['rightTop','frontTop'],
      ['leftBottom','frontBottom'],['rightBottom','frontBottom']
    ],
    buildBoxes({panel,T}){
      const Lp=panel.length,Wp=panel.width,Hp=panel.height,t=T
      return {
        frontTop:aabb(0,Wp/4,Hp,Lp/2*.9,Wp/4,t/2),
        backTop:aabb(0,-Wp/4,Hp,Lp/2*.9,Wp/4,t/2),
        leftTop:aabb(-Lp/4,0,Hp-t,Lp/4*.9,Wp/2*.85,t/2),
        rightTop:aabb(Lp/4,0,Hp-t,Lp/4*.9,Wp/2*.85,t/2),
        frontBottom:aabb(0,Wp/4,0,Lp/2*.9,Wp/4,t/2),
        backBottom:aabb(0,-Wp/4,0,Lp/2*.9,Wp/4,t/2),
        leftBottom:aabb(-Lp/4,0,t,Lp/4*.9,Wp/2*.85,t/2),
        rightBottom:aabb(Lp/4,0,t,Lp/4*.9,Wp/2*.85,t/2)
      }
    }
  },
  layout({panel,T,params}){
    const Lp=panel.length,Wp=panel.width,Hp=panel.height
    const F=params.F,F1=params.F1,G=params.G
    const slot=Math.max(3,2*T)
    const glueInset=Math.min(5,Hp*.08)
    const x0=G+20,y0=Math.max(F,F1)+20
    const walls=[['front',Lp],['right',Wp],['back',Lp],['left',Wp]]
    const faces=[]
    const pos={}
    let x=x0
    walls.forEach(([name,w],i)=>{
      faces.push([name,x,y0,w,Hp,i?walls[i-1][0]:null,i?'right':null])
      pos[name]={x,w}
      x+=w
    })
    faces.push(['glueFlap',x0-G,y0+glueInset,G,Hp-2*glueInset,'front','left'])
    for(const [name] of walls){
      const {x:px,w}=pos[name]
      const isLong=name==='front'||name==='back'
      const flapH=isLong?F:Math.min(F1,w/2+2)
      faces.push([`${name}Top`,px+slot/2,y0-flapH,w-slot,flapH,name,'top'])
      faces.push([`${name}Bottom`,px+slot/2,y0+Hp,w-slot,flapH,name,'bottom'])
    }
    const lenY=y0+Hp*.3,widY=y0+Hp*.7
    const arrows={
      length:[{x:x0,y:lenY},{x:x0+Lp,y:lenY}],
      width:[{x:x0+Lp,y:widY},{x:x0+Lp+Wp,y:widY}],
      height:[{x:x0+Lp+Wp+Lp/2,y:y0},{x:x0+Lp+Wp+Lp/2,y:y0+Hp}]
    }
    return {faces,arrows}
  }
}
