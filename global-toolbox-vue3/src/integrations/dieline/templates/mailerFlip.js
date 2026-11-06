// 翻盖邮寄盒（自研示意结构）。只描述面板布局与补偿规则，通用几何由 knife.js 生成。

/** 稳定面序：改尺寸只变坐标，不改 name/parent/side */
export const MAILER_FACE_ORDER=Object.freeze([
  'base','back','front','left','right',
  'lid','tuck','lidLeftWing','lidRightWing',
  'frontLeftTab','frontRightTab',
  'tuckLeft','tuckRight','lidInnerLeft','lidInnerRight',
  'leftExt','rightExt','leftLock','rightLock'
])

export default {
  id:'mailer-parametric-demo',
  label:'翻盖邮寄盒',
  labelEn:'Parametric Mailer Box',
  standard:'自研示意结构',
  root:'base',
  faceOrder:MAILER_FACE_ORDER,
  supportsClosedCheck:true,
  defaults:{length:315,width:202,height:62,thickness:1.5},
  limits:{length:[80,1200],width:[70,1200],height:[20,600]},
  /** 尺寸补偿（单位：板厚 T 的倍数）：panel=inner+panelAdd·T，outer=inner+outerAdd·T */
  sizeRule:{
    panelAdd:{length:2,width:2,height:1},
    outerAdd:{length:2,width:2,height:2}
  },
  hingeAngles:{tuck:88,tuckLeft:88,tuckRight:88,leftLock:85,rightLock:85},
  closedCheck:{
    pairs:[
      ['lidLeftWing','left'],
      ['lidRightWing','right'],
      ['tuck','front'],
      ['leftLock','right'],
      ['rightLock','left']
    ],
    buildBoxes({panel,T}){
      const Lp=panel.length,Wp=panel.width,Hp=panel.height,t=T
      const box=(cx,cy,cz,hx,hy,hz)=>({min:[cx-hx,cy-hy,cz-hz],max:[cx+hx,cy+hy,cz+hz]})
      return {
        base:box(0,0,0,Lp/2,Wp/2,t/2),
        left:box(-Lp/2,0,Hp/2,t/2,Wp/2,Hp/2),
        right:box(Lp/2,0,Hp/2,t/2,Wp/2,Hp/2),
        front:box(0,Wp/2,Hp/2,Lp/2,t/2,Hp/2),
        back:box(0,-Wp/2,Hp/2,Lp/2,t/2,Hp/2),
        lid:box(0,0,Hp,Lp/2,Wp/2,t/2),
        lidLeftWing:box(-Lp/2+t,0,Hp-t/2,Hp/2*.35,Wp/2*.9,t/2),
        lidRightWing:box(Lp/2-t,0,Hp-t/2,Hp/2*.35,Wp/2*.9,t/2),
        tuck:box(0,Wp/2-t,Hp/2,Lp/2*.9,t/2,Hp/2*.85),
        leftLock:box(Lp/2-t*1.2,0,Hp*.35,t*.8,Wp*.18,Hp*.18),
        rightLock:box(-Lp/2+t*1.2,0,Hp*.35,t*.8,Wp*.18,Hp*.18)
      }
    }
  },
  layout({panel}){
    const Lp=panel.length,Wp=panel.width,Hp=panel.height
    // 左侧预留 left + leftExt + leftLock；上侧为 lid+tuck
    const extW=Hp*.35,lockW=Hp*.25,tuckTabW=Hp*.45,innerW=Hp*.5,innerH=Wp*.35
    const ox=Hp+extW+lockW+45,oy=Wp+2*Hp+55
    const lidY=oy-Hp-Wp,tuckY=lidY-Hp
    const lockH=Wp*.45,lockY=oy+(Wp-lockH)/2
    const innerY=lidY+(Wp-innerH)/2
    const faces=[
      ['base',ox,oy,Lp,Wp,null,null],
      ['back',ox,oy-Hp,Lp,Hp,'base','top'],
      ['front',ox,oy+Wp,Lp,Hp,'base','bottom'],
      ['left',ox-Hp,oy,Hp,Wp,'base','left'],
      ['right',ox+Lp,oy,Hp,Wp,'base','right'],
      ['lid',ox,lidY,Lp,Wp,'back','top'],
      ['tuck',ox,tuckY,Lp,Hp,'lid','top'],
      ['lidLeftWing',ox-Hp,lidY,Hp,Wp,'lid','left'],
      ['lidRightWing',ox+Lp,lidY,Hp,Wp,'lid','right'],
      ['frontLeftTab',ox-Hp*.65,oy+Wp,Hp*.65,Hp,'front','left'],
      ['frontRightTab',ox+Lp,oy+Wp,Hp*.65,Hp,'front','right'],
      ['tuckLeft',ox-tuckTabW,tuckY,tuckTabW,Hp,'tuck','left'],
      ['tuckRight',ox+Lp,tuckY,tuckTabW,Hp,'tuck','right'],
      ['lidInnerLeft',ox-Hp-innerW,innerY,innerW,innerH,'lid','left'],
      ['lidInnerRight',ox+Lp+Hp,innerY,innerW,innerH,'lid','right'],
      ['leftExt',ox-Hp-extW,oy,extW,Wp,'left','left'],
      ['rightExt',ox+Lp+Hp,oy,extW,Wp,'right','right'],
      ['leftLock',ox-Hp-extW-lockW,lockY,lockW,lockH,'leftExt','left'],
      ['rightLock',ox+Lp+Hp+extW,lockY,lockW,lockH,'rightExt','right']
    ]
    const arrows={
      length:[{x:ox,y:oy+Wp*.3},{x:ox+Lp,y:oy+Wp*.3}],
      width:[{x:ox+Lp*.7,y:oy},{x:ox+Lp*.7,y:oy+Wp}],
      height:[{x:ox,y:oy-Hp},{x:ox,y:oy}]
    }
    return {faces,arrows}
  }
}
