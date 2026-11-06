// 飞机盒变体示意：0427 拓扑 + 侧翼锁舌加长 + 底前短锁舌（矩形近似）。

export default {
  id:'mailer-aircraft',
  label:'飞机盒',
  labelEn:'Aircraft Mailer',
  standard:'飞机盒示意',
  root:'base',
  faceOrder:Object.freeze([
    'base','back','front','left','right',
    'lid','tuck','lidLeftWing','lidRightWing',
    'frontLeftTab','frontRightTab','frontLock'
  ]),
  supportsClosedCheck:true,
  defaults:{length:280,width:200,height:70,thickness:1.5},
  limits:{length:[80,1200],width:[60,1000],height:[20,500]},
  sizeRule:{
    panelAdd:{length:2,width:2,height:1},
    outerAdd:{length:2,width:2,height:2}
  },
  hingeAngles:{tuck:88,lidLeftWing:85,lidRightWing:85,frontLock:88},
  closedCheck:{
    pairs:[
      ['lidLeftWing','left'],
      ['lidRightWing','right'],
      ['tuck','front'],
      ['frontLock','base']
    ],
    buildBoxes({panel,T}){
      const Lp=panel.length,Wp=panel.width,Hp=panel.height,t=T
      const box=(cx,cy,cz,hx,hy,hz)=>({min:[cx-hx,cy-hy,cz-hz],max:[cx+hx,cy+hy,cz+hz]})
      return {
        left:box(-Lp/2,0,Hp/2,t/2,Wp/2,Hp/2),
        right:box(Lp/2,0,Hp/2,t/2,Wp/2,Hp/2),
        front:box(0,Wp/2,Hp/2,Lp/2,t/2,Hp/2),
        base:box(0,0,0,Lp/2,Wp/2,t/2),
        lidLeftWing:box(-Lp/2+t,0,Hp-t/2,Hp/2*.4,Wp/2*.9,t/2),
        lidRightWing:box(Lp/2-t,0,Hp-t/2,Hp/2*.4,Wp/2*.9,t/2),
        tuck:box(0,Wp/2-t,Hp/2,Lp/2*.9,t/2,Math.min(Hp*.85,Wp*.4)),
        frontLock:box(0,Wp/2-t,t*2,Lp/2*.5,t/2,Math.min(Hp*.35,20))
      }
    }
  },
  layout({panel}){
    const Lp=panel.length,Wp=panel.width,Hp=panel.height
    const tuckH=Math.min(Hp*.9,Wp*.45)
    const tabW=Hp*.65
    const lockH=Math.min(Hp*.4,22)
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
      ['frontRightTab',ox+Lp,oy+Wp,tabW,Hp,'front','right'],
      ['frontLock',ox+(Lp-Lp*.55)/2,oy+Wp+Hp,Lp*.55,lockH,'front','bottom']
    ]
    const arrows={
      length:[{x:ox,y:oy+Wp*.3},{x:ox+Lp,y:oy+Wp*.3}],
      width:[{x:ox+Lp*.7,y:oy},{x:ox+Lp*.7,y:oy+Wp}],
      height:[{x:ox,y:oy-Hp},{x:ox,y:oy}]
    }
    return {faces,arrows}
  }
}
