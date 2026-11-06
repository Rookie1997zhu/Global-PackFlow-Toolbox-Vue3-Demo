// 磁吸翻盖硬盒示意：单层底板+墙+盖；磁吸仅合盖 AABB，无灰板/面纸图层。

export default {
  id:'magnetic-rigid',
  label:'磁吸翻盖',
  labelEn:'Magnetic Flip Box',
  standard:'磁吸翻盖硬盒示意',
  root:'base',
  faceOrder:Object.freeze([
    'base','back','front','left','right',
    'lid','lidFront'
  ]),
  supportsClosedCheck:true,
  defaults:{length:180,width:120,height:50,thickness:1.5},
  limits:{length:[50,800],width:[40,600],height:[20,300]},
  sizeRule:{
    panelAdd:{length:2,width:2,height:1},
    outerAdd:{length:3,width:3,height:2}
  },
  hingeAngles:{lidFront:88},
  closedCheck:{
    pairs:[
      ['lidFront','front'],
      ['left','back'],
      ['right','back'],
      ['left','front'],
      ['right','front']
    ],
    buildBoxes({panel,T}){
      const Lp=panel.length,Wp=panel.width,Hp=panel.height,t=T
      const box=(cx,cy,cz,hx,hy,hz)=>({min:[cx-hx,cy-hy,cz-hz],max:[cx+hx,cy+hy,cz+hz]})
      return {
        front:box(0,Wp/2,Hp/2,Lp/2,t/2,Hp/2),
        back:box(0,-Wp/2,Hp/2,Lp/2,t/2,Hp/2),
        left:box(-Lp/2,0,Hp/2,t/2,Wp/2,Hp/2),
        right:box(Lp/2,0,Hp/2,t/2,Wp/2,Hp/2),
        // 磁吸区示意：盖前缘与前墙顶缘嵌入
        lidFront:box(0,Wp/2-t,Hp-t/2,Lp/2*.7,t/2,Hp*.35)
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
      ['lidFront',ox,lidY-Hp,Lp,Hp,'lid','top']
    ]
    const arrows={
      length:[{x:ox,y:oy+Wp*.3},{x:ox+Lp,y:oy+Wp*.3}],
      width:[{x:ox+Lp*.7,y:oy},{x:ox+Lp*.7,y:oy+Wp}],
      height:[{x:ox,y:oy-Hp},{x:ox,y:oy}]
    }
    return {faces,arrows}
  }
}
