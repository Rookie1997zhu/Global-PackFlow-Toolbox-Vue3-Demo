// FEFCO 0427 翻盖邮寄盒：底板四墙 + 后墙铰接盖板 + 插舌，盖侧翼与前墙防尘舌。
// 比自研 mailer 更接近公开 FEFCO 结构；补偿系数为示意值，需打样校准。

export default {
  id:'fefco-0427',
  label:'铰盖邮寄盒',
  labelEn:'Hinged Lid Mailer',
  standard:'FEFCO 0427',
  root:'base',
  faceOrder:Object.freeze([
    'base','back','front','left','right',
    'lid','tuck','lidLeftWing','lidRightWing',
    'frontLeftTab','frontRightTab'
  ]),
  supportsClosedCheck:true,
  defaults:{length:250,width:180,height:60,thickness:1.5},
  limits:{length:[80,1200],width:[60,1000],height:[20,500]},
  sizeRule:{
    panelAdd:{length:2,width:2,height:1},
    outerAdd:{length:2,width:2,height:2}
  },
  hingeAngles:{tuck:88,lidLeftWing:85,lidRightWing:85},
  closedCheck:{
    pairs:[
      ['lidLeftWing','left'],
      ['lidRightWing','right'],
      ['tuck','front']
    ],
    buildBoxes({panel,T}){
      const Lp=panel.length,Wp=panel.width,Hp=panel.height,t=T
      const box=(cx,cy,cz,hx,hy,hz)=>({min:[cx-hx,cy-hy,cz-hz],max:[cx+hx,cy+hy,cz+hz]})
      return {
        left:box(-Lp/2,0,Hp/2,t/2,Wp/2,Hp/2),
        right:box(Lp/2,0,Hp/2,t/2,Wp/2,Hp/2),
        front:box(0,Wp/2,Hp/2,Lp/2,t/2,Hp/2),
        lidLeftWing:box(-Lp/2+t,0,Hp-t/2,Hp/2*.35,Wp/2*.9,t/2),
        lidRightWing:box(Lp/2-t,0,Hp-t/2,Hp/2*.35,Wp/2*.9,t/2),
        tuck:box(0,Wp/2-t,Hp/2,Lp/2*.9,t/2,Math.min(Hp*.85,Wp*.4))
      }
    }
  },
  layout({panel}){
    const Lp=panel.length,Wp=panel.width,Hp=panel.height
    const tuckH=Math.min(Hp*.9,Wp*.45)
    const tabW=Hp*.6
    const ox=Hp+25,oy=Wp+Hp+tuckH+25
    const lidY=oy-Hp-Wp,tuckY=lidY-tuckH
    const faces=[
      ['base',ox,oy,Lp,Wp,null,null],
      ['back',ox,oy-Hp,Lp,Hp,'base','top'],
      ['front',ox,oy+Wp,Lp,Hp,'base','bottom'],
      ['left',ox-Hp,oy,Hp,Wp,'base','left'],
      ['right',ox+Lp,oy,Hp,Wp,'base','right'],
      ['lid',ox,lidY,Lp,Wp,'back','top'],
      ['tuck',ox,tuckY,Lp,tuckH,'lid','top'],
      ['lidLeftWing',ox-Hp,lidY,Hp,Wp,'lid','left'],
      ['lidRightWing',ox+Lp,lidY,Hp,Wp,'lid','right'],
      ['frontLeftTab',ox-tabW,oy+Wp,tabW,Hp,'front','left'],
      ['frontRightTab',ox+Lp,oy+Wp,tabW,Hp,'front','right']
    ]
    const arrows={
      length:[{x:ox,y:oy+Wp*.3},{x:ox+Lp,y:oy+Wp*.3}],
      width:[{x:ox+Lp*.7,y:oy},{x:ox+Lp*.7,y:oy+Wp}],
      height:[{x:ox,y:oy-Hp},{x:ox,y:oy}]
    }
    return {faces,arrows}
  }
}
