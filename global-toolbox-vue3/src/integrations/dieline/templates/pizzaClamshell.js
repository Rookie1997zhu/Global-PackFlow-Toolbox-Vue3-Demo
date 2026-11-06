// 披萨/食品翻盖：底盘+四矮墙，后墙铰接盖盘+盖墙。

export default {
  id:'pizza-clamshell',
  label:'食品翻盖盒',
  labelEn:'Food Clamshell',
  standard:'披萨/食品翻盖示意',
  root:'base',
  faceOrder:Object.freeze([
    'base','back','front','left','right',
    'lid','lidFront','lidLeft','lidRight'
  ]),
  supportsClosedCheck:true,
  defaults:{length:280,width:280,height:40,thickness:1.5},
  limits:{length:[80,800],width:[80,800],height:[15,120]},
  sizeRule:{
    panelAdd:{length:2,width:2,height:1},
    outerAdd:{length:2,width:2,height:2}
  },
  hingeAngles:{lidFront:88,lidLeft:85,lidRight:85},
  closedCheck:{
    pairs:[
      ['lidFront','front'],
      ['lidLeft','left'],
      ['lidRight','right'],
      ['left','back'],
      ['right','back']
    ],
    buildBoxes({panel,T}){
      const Lp=panel.length,Wp=panel.width,Hp=panel.height,t=T
      const box=(cx,cy,cz,hx,hy,hz)=>({min:[cx-hx,cy-hy,cz-hz],max:[cx+hx,cy+hy,cz+hz]})
      return {
        front:box(0,Wp/2,Hp/2,Lp/2,t/2,Hp/2),
        left:box(-Lp/2,0,Hp/2,t/2,Wp/2,Hp/2),
        right:box(Lp/2,0,Hp/2,t/2,Wp/2,Hp/2),
        back:box(0,-Wp/2,Hp/2,Lp/2,t/2,Hp/2),
        lidFront:box(0,Wp/2-t,Hp-t/2,Lp/2*.9,t/2,Hp*.5),
        lidLeft:box(-Lp/2+t,0,Hp-t/2,t/2,Wp/2*.85,Hp*.4),
        lidRight:box(Lp/2-t,0,Hp-t/2,t/2,Wp/2*.85,Hp*.4)
      }
    }
  },
  layout({panel}){
    const Lp=panel.length,Wp=panel.width,Hp=panel.height
    const ox=Hp+25,oy=Wp+Hp+25
    const lidY=oy-Hp-Wp
    const faces=[
      ['base',ox,oy,Lp,Wp,null,null],
      ['back',ox,oy-Hp,Lp,Hp,'base','top'],
      ['front',ox,oy+Wp,Lp,Hp,'base','bottom'],
      ['left',ox-Hp,oy,Hp,Wp,'base','left'],
      ['right',ox+Lp,oy,Hp,Wp,'base','right'],
      ['lid',ox,lidY,Lp,Wp,'back','top'],
      ['lidFront',ox,lidY-Hp,Lp,Hp,'lid','top'],
      ['lidLeft',ox-Hp,lidY,Hp,Wp,'lid','left'],
      ['lidRight',ox+Lp,lidY,Hp,Wp,'lid','right']
    ]
    const arrows={
      length:[{x:ox,y:oy+Wp*.3},{x:ox+Lp,y:oy+Wp*.3}],
      width:[{x:ox+Lp*.7,y:oy},{x:ox+Lp*.7,y:oy+Wp}],
      height:[{x:ox,y:oy-Hp},{x:ox,y:oy}]
    }
    return {faces,arrows}
  }
}
