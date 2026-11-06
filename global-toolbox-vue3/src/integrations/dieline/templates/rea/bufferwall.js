// REA Bufferwallbox：套筒与托盘缓冲墙
import {pdef,aabb,BOARD_SIZE_RULE,round} from './shared.js'

export default {
  id:'rea-bufferwall',
  label:'REA 缓冲托盘',
  labelEn:'REA Buffer Wall Tray',
  standard:'Bufferwallbox · REA',
  root:'base',
  faceOrder:Object.freeze([
    'base','front','back','left','right','glueLeft','glueRight'
  ]),
  supportsClosedCheck:true,
  defaults:{length:150,width:100,height:40,thickness:.5},
  limits:{length:[50,600],width:[40,400],height:[15,150]},
  sizeRule:BOARD_SIZE_RULE,
  reaRef:{
    code:'Bufferwallbox',
    sampleNum:'128010',
    faceMap:{base:'F',left:'FL',right:'FR'}
  },
  paramDefs:[
    pdef('L5','缓冲段','缓冲',(p)=>round(p.length*.37),{min:10,max:200}),
    pdef('G','粘舌','缓冲',(p)=>round(p.length*.039),{min:4,max:30}),
    pdef('SD','侧收','缓冲',()=>2,{min:0,max:15}),
    pdef('T1','壁厚余量','缓冲',()=>1,{min:0,max:10}),
    pdef('GR','圆角','缓冲',()=>2,{min:0,max:10}),
    pdef('R1','倒角','缓冲',()=>1,{min:0,max:10})
  ],
  hingeAngles:{front:88,back:88,left:88,right:88},
  closedCheck:{
    pairs:[['left','back'],['right','back'],['left','front'],['right','front']],
    buildBoxes({panel,T}){
      const Lp=panel.length,Wp=panel.width,Hp=panel.height,t=T
      return {
        front:aabb(0,Wp/2,Hp/2,Lp/2,t/2,Hp/2),
        back:aabb(0,-Wp/2,Hp/2,Lp/2,t/2,Hp/2),
        left:aabb(-Lp/2,0,Hp/2,t/2,Wp/2,Hp/2),
        right:aabb(Lp/2,0,Hp/2,t/2,Wp/2,Hp/2)
      }
    }
  },
  layout({panel,T,params}){
    const Lp=panel.length,Wp=panel.width,Hp=panel.height
    const G=params.G,L5=params.L5
    const wall=Math.max(Hp,L5*.15)
    const ox=G+20,oy=wall+20
    const faces=[
      ['base',ox,oy,Lp,Wp,null,null],
      ['front',ox,oy+Wp,Lp,wall,'base','bottom'],
      ['back',ox,oy-wall,Lp,wall,'base','top'],
      ['left',ox-wall,oy,wall,Wp,'base','left'],
      ['right',ox+Lp,oy,wall,Wp,'base','right'],
      ['glueLeft',ox-wall-G,oy+2,G,Wp-4,'left','left'],
      ['glueRight',ox+Lp+wall,oy+2,G,Wp-4,'right','right']
    ]
    const arrows={
      length:[{x:ox,y:oy+Wp*.3},{x:ox+Lp,y:oy+Wp*.3}],
      width:[{x:ox+Lp*.7,y:oy},{x:ox+Lp*.7,y:oy+Wp}],
      height:[{x:ox,y:oy-wall},{x:ox,y:oy}]
    }
    return {faces,arrows}
  }
}
