// 抽屉内托盘：十字底板+四墙，略小于袖套以便滑入。

export default {
  id:'drawer-tray',
  label:'抽屉托盘',
  labelEn:'Drawer Tray',
  standard:'抽屉托盘示意',
  root:'base',
  faceOrder:Object.freeze(['base','back','front','left','right']),
  supportsClosedCheck:true,
  defaults:{length:200,width:120,height:35,thickness:1.5},
  limits:{length:[40,1200],width:[30,800],height:[12,400]},
  sizeRule:{
    panelAdd:{length:2,width:2,height:1},
    outerAdd:{length:2,width:2,height:2}
  },
  hingeAngles:{},
  closedCheck:{
    pairs:[['left','back'],['right','back'],['left','front'],['right','front']],
    buildBoxes({panel,T}){
      const Lp=panel.length,Wp=panel.width,Hp=panel.height,t=T
      const box=(cx,cy,cz,hx,hy,hz)=>({min:[cx-hx,cy-hy,cz-hz],max:[cx+hx,cy+hy,cz+hz]})
      return {
        base:box(0,0,0,Lp/2,Wp/2,t/2),
        back:box(0,-Wp/2,Hp/2,Lp/2,t/2,Hp/2),
        front:box(0,Wp/2,Hp/2,Lp/2,t/2,Hp/2),
        left:box(-Lp/2,0,Hp/2,t/2,Wp/2,Hp/2),
        right:box(Lp/2,0,Hp/2,t/2,Wp/2,Hp/2)
      }
    }
  },
  layout({panel}){
    const Lp=panel.length,Wp=panel.width,Hp=panel.height
    const ox=Hp+20,oy=Hp+20
    const faces=[
      ['base',ox,oy,Lp,Wp,null,null],
      ['back',ox,oy-Hp,Lp,Hp,'base','top'],
      ['front',ox,oy+Wp,Lp,Hp,'base','bottom'],
      ['left',ox-Hp,oy,Hp,Wp,'base','left'],
      ['right',ox+Lp,oy,Hp,Wp,'base','right']
    ]
    const arrows={
      length:[{x:ox,y:oy+Wp*.3},{x:ox+Lp,y:oy+Wp*.3}],
      width:[{x:ox+Lp*.7,y:oy},{x:ox+Lp*.7,y:oy+Wp}],
      height:[{x:ox,y:oy-Hp},{x:ox,y:oy}]
    }
    return {faces,arrows}
  }
}
