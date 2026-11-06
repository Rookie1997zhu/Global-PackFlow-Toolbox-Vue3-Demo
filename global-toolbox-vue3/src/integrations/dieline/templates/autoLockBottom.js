// 锁底盒（示意 Crash / Auto-Lock Bottom）：上盖直插舌，底部四片互锁摇盖。
// 轴对齐矩形近似，未建模斜切锁舌与开槽；补偿系数为示意值，需打样校准。

export default {
  id:'auto-lock-bottom',
  label:'锁底盒',
  labelEn:'Auto Lock Bottom Box',
  standard:'锁底折叠纸盒',
  root:'front',
  faceOrder:Object.freeze([
    'front','right','back','left','glueFlap',
    'topLid','topTuck','topDustRight','topDustLeft',
    'bottomFront','bottomBack','bottomLeft','bottomRight'
  ]),
  supportsClosedCheck:true,
  defaults:{length:100,width:70,height:120,thickness:.6},
  limits:{length:[40,800],width:[30,500],height:[40,800]},
  sizeRule:{
    panelAdd:{length:1,width:1,height:2},
    outerAdd:{length:2,width:2,height:2}
  },
  hingeAngles:{topLid:88,bottomFront:88,bottomBack:88},
  closedCheck:{
    pairs:[
      ['topTuck','front'],
      ['topDustLeft','left'],
      ['topDustRight','right'],
      ['bottomLeft','bottomFront'],
      ['bottomRight','bottomBack'],
      ['bottomLeft','bottomBack'],
      ['bottomRight','bottomFront']
    ],
    buildBoxes({panel,T}){
      const Lp=panel.length,Wp=panel.width,Hp=panel.height,t=T
      const box=(cx,cy,cz,hx,hy,hz)=>({min:[cx-hx,cy-hy,cz-hz],max:[cx+hx,cy+hy,cz+hz]})
      // 上插舌入前墙；底部长/短摇盖交叉嵌入示意
      return {
        front:box(0,Wp/2,Hp/2,Lp/2,t/2,Hp/2),
        left:box(-Lp/2,0,Hp/2,t/2,Wp/2,Hp/2),
        right:box(Lp/2,0,Hp/2,t/2,Wp/2,Hp/2),
        topTuck:box(0,Wp/2-t,Hp-t*2,Lp/2*.8,t/2,Math.min(Hp*.25,Wp*.35)),
        topDustLeft:box(-Lp/2+t,0,Hp-t/2,t*.8,Wp/2*.7,t/2),
        topDustRight:box(Lp/2-t,0,Hp-t/2,t*.8,Wp/2*.7,t/2),
        bottomFront:box(0,Wp/4,t,Lp/2*.85,Wp/4,t/2),
        bottomBack:box(0,-Wp/4,t,Lp/2*.85,Wp/4,t/2),
        bottomLeft:box(-Lp/4,0,t*1.5,Lp/4*.8,Wp/2*.7,t/2),
        bottomRight:box(Lp/4,0,t*1.5,Lp/4*.8,Wp/2*.7,t/2)
      }
    }
  },
  layout({panel,T}){
    const Lp=panel.length,Wp=panel.width,Hp=panel.height
    const slot=Math.max(1.5,3*T)
    const tuckD=Math.min(Math.max(Wp*.35,10),25,Hp*.35)
    const tuckInset=Math.max(1,2*T)
    const dustH=Math.min(Lp*.4,Wp*.75)
    // 长边主摇盖约半宽对碰；短边次摇盖较短，示意先折入互锁
    const majorH=Wp*.48
    const minorH=Math.min(Lp*.42,Wp*.7)
    const glueW=Math.max(8,Math.min(15,Lp*.25))
    const glueInset=Math.min(3,Hp*.05)
    const x0=glueW+15,y0=Wp+tuckD+15
    const walls=[['front',Lp],['right',Wp],['back',Lp],['left',Wp]]
    const faces=[]
    const pos={}
    let x=x0
    walls.forEach(([name,w],i)=>{
      faces.push([name,x,y0,w,Hp,i?walls[i-1][0]:null,i?'right':null])
      pos[name]={x,w}
      x+=w
    })
    faces.push(['glueFlap',x0-glueW,y0+glueInset,glueW,Hp-2*glueInset,'front','left'])
    const fx=pos.front.x,bx=pos.back.x,rx=pos.right.x,lx=pos.left.x
    const bottomY=y0+Hp
    faces.push(
      ['topLid',bx,y0-Wp,Lp,Wp,'back','top'],
      ['topTuck',bx+tuckInset,y0-Wp-tuckD,Lp-2*tuckInset,tuckD,'topLid','top'],
      ['topDustRight',rx+slot/2,y0-dustH,Wp-slot,dustH,'right','top'],
      ['topDustLeft',lx+slot/2,y0-dustH,Wp-slot,dustH,'left','top'],
      ['bottomFront',fx+slot/2,bottomY,Lp-slot,majorH,'front','bottom'],
      ['bottomBack',bx+slot/2,bottomY,Lp-slot,majorH,'back','bottom'],
      ['bottomLeft',lx+slot/2,bottomY,Wp-slot,minorH,'left','bottom'],
      ['bottomRight',rx+slot/2,bottomY,Wp-slot,minorH,'right','bottom']
    )
    const lenY=y0+Hp*.3,widY=y0+Hp*.7
    const arrows={
      length:[{x:x0,y:lenY},{x:x0+Lp,y:lenY}],
      width:[{x:rx,y:widY},{x:rx+Wp,y:widY}],
      height:[{x:bx+Lp/2,y:y0},{x:bx+Lp/2,y:y0+Hp}]
    }
    return {faces,arrows}
  }
}
