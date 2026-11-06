// 天地盖托盘示意：底板 + 四墙十字展开；piece=bottom|lid，天盖四周加间隙以便套合。
// 单层示意，不做灰板/面纸多图层；补偿系数为示意值，需打样校准。

export default {
  id:'lid-base',
  label:'天地盖',
  labelEn:'Lid & Base Tray',
  standard:'天地盖托盘示意',
  root:'base',
  faceOrder:Object.freeze(['base','back','front','left','right']),
  supportsClosedCheck:true,
  supportsPiece:true,
  assembly:'stack',
  pieces:Object.freeze([
    {id:'bottom',label:'底盖',root:'base'},
    {id:'lid',label:'天盖',root:'base'}
  ]),
  defaults:{length:300,width:200,height:60,thickness:1.5,lidClearance:2},
  limits:{length:[60,1500],width:[40,1200],height:[15,600]},
  sizeRule:{
    panelAdd:{length:2,width:2,height:1},
    outerAdd:{length:2,width:2,height:2}
  },
  hingeAngles:{},
  closedCheck:{
    // 托盘立起后邻墙在转角嵌入对接
    pairs:[
      ['left','back'],
      ['right','back'],
      ['left','front'],
      ['right','front']
    ],
    buildBoxes({panel,T,piece='bottom',lidClearance=2}){
      const c=piece==='lid'?Math.max(0,Number(lidClearance)||0):0
      const Lp=panel.length+2*c,Wp=panel.width+2*c,Hp=panel.height,t=T
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
  layout({panel,piece='bottom',lidClearance=2}){
    const c=Math.max(0,Number(lidClearance)||0)
    const isLid=piece==='lid'
    const Lp=panel.length+(isLid?2*c:0)
    const Wp=panel.width+(isLid?2*c:0)
    const Hp=panel.height
    const ox=Hp+20,oy=Hp+20
    const faces=[
      ['base',ox,oy,Lp,Wp,null,null],
      ['back',ox,oy-Hp,Lp,Hp,'base','top'],
      ['front',ox,oy+Wp,Lp,Hp,'base','bottom'],
      ['left',ox-Hp,oy,Hp,Wp,'base','left'],
      ['right',ox+Lp,oy,Hp,Wp,'base','right']
    ]
    const midY=oy+Wp/2
    const arrows={
      length:[{x:ox,y:oy+Wp*.3},{x:ox+Lp,y:oy+Wp*.3}],
      width:[{x:ox+Lp*.7,y:oy},{x:ox+Lp*.7,y:oy+Wp}],
      height:[{x:ox,y:oy-Hp},{x:ox,y:oy}]
    }
    return {faces,arrows,piece:isLid?'lid':'bottom',lidClearance:c,tray:{length:Lp,width:Wp,height:Hp}}
  }
}
