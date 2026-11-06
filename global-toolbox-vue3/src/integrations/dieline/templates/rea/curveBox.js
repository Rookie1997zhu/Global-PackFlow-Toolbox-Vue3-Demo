// REA CurveBox：曲线开窗面板盒入口（非 Star 极坐标）
import {pdef,aabb,centeredWindow,BOARD_SIZE_RULE,round} from './shared.js'

export default {
  id:'rea-curve-box',
  label:'REA 曲线开窗盒',
  labelEn:'REA Curve Box Panel',
  standard:'CurveBox · REA',
  root:'base',
  faceOrder:Object.freeze([
    'base','lid','front','back','left','right','glueFlap'
  ]),
  supportsClosedCheck:true,
  defaults:{length:150,width:100,height:50,thickness:.5},
  limits:{length:[50,500],width:[40,350],height:[20,200]},
  sizeRule:BOARD_SIZE_RULE,
  reaRef:{
    code:'CurveBox',
    sampleNum:'18700001',
    faceMap:{base:'H',lid:'F'}
  },
  paramDefs:[
    pdef('G','粘舌高','面板',()=>15,{min:8,max:40}),
    pdef('X','曲线 X','曲线',(p)=>round(p.length*.1),{min:2,max:60}),
    pdef('Y','曲线 Y','曲线',(p)=>round(p.length*.05),{min:1,max:40}),
    pdef('WW','窗宽','开窗',(p)=>round(p.width*.6),{min:10,max:300}),
    pdef('WL','窗长','开窗',(p)=>round(p.length*.62),{min:10,max:400}),
    pdef('WR','窗倒角','开窗',(p)=>round(p.length*.03),{min:0,max:30})
  ],
  hingeAngles:{lid:88,front:88,back:88,left:88,right:88},
  closedCheck:{
    pairs:[['left','back'],['right','back'],['left','front'],['right','front'],['lid','base']],
    buildBoxes({panel,T}){
      const Lp=panel.length,Wp=panel.width,Hp=panel.height,t=T
      return {
        base:aabb(0,0,0,Lp/2,Wp/2,t/2),
        lid:aabb(0,0,t,Lp/2*.9,Wp/2*.9,t/2),
        front:aabb(0,Wp/2,Hp/2,Lp/2,t/2,Hp/2),
        back:aabb(0,-Wp/2,Hp/2,Lp/2,t/2,Hp/2),
        left:aabb(-Lp/2,0,Hp/2,t/2,Wp/2,Hp/2),
        right:aabb(Lp/2,0,Hp/2,t/2,Wp/2,Hp/2)
      }
    }
  },
  layout({panel,T,params}){
    const Lp=panel.length,Wp=panel.width,Hp=panel.height
    const G=params.G
    const ox=G+20,oy=Hp+20
    const faces=[
      ['base',ox,oy,Lp,Wp,null,null],
      ['lid',ox,oy-Wp-Hp,Lp,Wp,'back','top'],
      ['front',ox,oy+Wp,Lp,Hp,'base','bottom'],
      ['back',ox,oy-Hp,Lp,Hp,'base','top'],
      ['left',ox-Hp,oy,Hp,Wp,'base','left'],
      ['right',ox+Lp,oy,Hp,Wp,'base','right'],
      ['glueFlap',ox,oy-Hp-G,Lp,G,'back','top']
    ]
    // glueFlap 与 lid 都可能冲突：改粘舌挂 left
    const faces2=faces.filter(f=>f[0]!=='glueFlap'&&f[0]!=='lid')
    faces2.push(
      ['lid',ox,oy-Hp-Wp,Lp,Wp,'back','top'],
      ['glueFlap',ox-Hp-G,oy+2,G,Wp-4,'left','left']
    )
    const holes=[centeredWindow({
      Fx:ox,Fy:oy-Hp-Wp,Fw:Lp,Fh:Wp,
      hw:params.WL,hh:params.WW,
      yRel:(Wp-params.WW)/2,
      r:params.WR
    })]
    const arrows={
      length:[{x:ox,y:oy+Wp*.3},{x:ox+Lp,y:oy+Wp*.3}],
      width:[{x:ox+Lp*.7,y:oy},{x:ox+Lp*.7,y:oy+Wp}],
      height:[{x:ox,y:oy-Hp},{x:ox,y:oy}]
    }
    return {faces:faces2,arrows,holes}
  }
}
