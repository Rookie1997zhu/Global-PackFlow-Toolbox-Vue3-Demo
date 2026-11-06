// REA MultiFunctionDisplayBox：展示盒示意
import {pdef,aabb,sideSlotHoles,BOARD_SIZE_RULE,round} from './shared.js'

export default {
  id:'rea-display-multi',
  label:'REA 多功能展示盒',
  labelEn:'REA Multi Function Display',
  standard:'MultiFunctionDisplayBox · REA',
  root:'base',
  faceOrder:Object.freeze([
    'base','front','back','left','right',
    'frontFlap','frontDustL','frontDustR','header'
  ]),
  supportsClosedCheck:true,
  defaults:{length:200,width:120,height:80,thickness:.5},
  limits:{length:[60,600],width:[40,400],height:[30,250]},
  sizeRule:BOARD_SIZE_RULE,
  reaRef:{
    code:'MultiFunctionDisplayBox',
    sampleNum:'17031101',
    faceMap:{base:'F',front:'FB'}
  },
  paramDefs:[
    pdef('N','前翼宽','展示',(p)=>round(p.length*.24),{min:8,max:120}),
    pdef('C','顶板高','展示',(p)=>round(p.height*.98),{min:10,max:200}),
    pdef('SW','孔长','展示',(p)=>round(p.length*.14),{min:5,max:80}),
    pdef('SP','孔距','展示',(p)=>round(p.length*.28),{min:10,max:160}),
    pdef('K','孔数','展示',()=>2,{min:1,max:4}),
    pdef('L1','侧延','展示',(p)=>round(p.length*.2),{min:5,max:100})
  ],
  hingeAngles:{front:88,back:88,frontFlap:85,header:70},
  closedCheck:{
    pairs:[['left','back'],['right','back'],['left','front'],['right','front'],['frontDustL','left'],['frontDustR','right']],
    buildBoxes({panel,T}){
      const Lp=panel.length,Wp=panel.width,Hp=panel.height,t=T
      return {
        front:aabb(0,Wp/2,Hp/2,Lp/2,t/2,Hp/2),
        back:aabb(0,-Wp/2,Hp/2,Lp/2,t/2,Hp/2),
        left:aabb(-Lp/2,0,Hp/2,t/2,Wp/2,Hp/2),
        right:aabb(Lp/2,0,Hp/2,t/2,Wp/2,Hp/2),
        frontDustL:aabb(-Lp/2+t,Wp/4,Hp/2,t*.8,Hp/2*.6,t/2),
        frontDustR:aabb(Lp/2-t,Wp/4,Hp/2,t*.8,Hp/2*.6,t/2)
      }
    }
  },
  layout({panel,T,params}){
    const Lp=panel.length,Wp=panel.width,Hp=panel.height
    const N=params.N,C=params.C,SW=params.SW,SP=params.SP,K=params.K
    const ox=N+20,oy=C+20
    const faces=[
      ['base',ox,oy,Lp,Wp,null,null],
      ['front',ox,oy+Wp,Lp,Hp,'base','bottom'],
      ['back',ox,oy-Hp,Lp,Hp,'base','top'],
      ['left',ox-Hp,oy,Hp,Wp,'base','left'],
      ['right',ox+Lp,oy,Hp,Wp,'base','right'],
      ['frontFlap',ox,oy+Wp+Hp,Lp,Math.min(Hp*.5,30),'front','bottom'],
      ['frontDustL',ox-N,oy+Wp,N,Hp,'front','left'],
      ['frontDustR',ox+Lp,oy+Wp,N,Hp,'front','right'],
      ['header',ox,oy-Hp-C,Lp,C,'back','top']
    ]
    // 展示孔：底面前缘示意（非 Aircraft 公式）
    const holes=sideSlotHoles({
      Hx:ox,Hy:oy,Lk:Lp,Wk:Wp,K,SW,SP:Math.min(SP,Wp/2),bleed:Math.min(5,SW*.3),r:2
    })
    const arrows={
      length:[{x:ox,y:oy+Wp*.3},{x:ox+Lp,y:oy+Wp*.3}],
      width:[{x:ox+Lp*.7,y:oy},{x:ox+Lp*.7,y:oy+Wp}],
      height:[{x:ox,y:oy-Hp},{x:ox,y:oy}]
    }
    return {faces,arrows,holes}
  }
}
