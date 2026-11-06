// 提手盒示意：锁底上盖插舌 + 前/后墙外伸提手片（无冲孔）。

export default {
  id:'handle-box',
  label:'提手盒',
  labelEn:'Handle Box',
  standard:'提手折叠纸盒示意',
  root:'front',
  faceOrder:Object.freeze([
    'front','right','back','left','glueFlap',
    'topLid','topTuck','handleLeft','handleRight','topDustRight','topDustLeft',
    'bottomFront','bottomBack','bottomLeft','bottomRight'
  ]),
  supportsClosedCheck:true,
  defaults:{length:120,width:80,height:140,thickness:.6},
  limits:{length:[50,600],width:[40,400],height:[60,600]},
  sizeRule:{
    panelAdd:{length:1,width:1,height:2},
    outerAdd:{length:2,width:2,height:2}
  },
  hingeAngles:{topLid:88,bottomFront:88,bottomBack:88,handleLeft:90,handleRight:90},
  closedCheck:{
    pairs:[
      ['topTuck','front'],
      ['topDustLeft','left'],
      ['topDustRight','right'],
      ['handleLeft','topLid'],
      ['handleRight','topLid'],
      ['bottomLeft','bottomFront'],
      ['bottomRight','bottomBack']
    ],
    buildBoxes({panel,T}){
      const Lp=panel.length,Wp=panel.width,Hp=panel.height,t=T
      const box=(cx,cy,cz,hx,hy,hz)=>({min:[cx-hx,cy-hy,cz-hz],max:[cx+hx,cy+hy,cz+hz]})
      return {
        front:box(0,Wp/2,Hp/2,Lp/2,t/2,Hp/2),
        left:box(-Lp/2,0,Hp/2,t/2,Wp/2,Hp/2),
        right:box(Lp/2,0,Hp/2,t/2,Wp/2,Hp/2),
        topLid:box(0,0,Hp,Lp/2,Wp/2,t/2),
        topTuck:box(0,Wp/2-t,Hp-t*2,Lp/2*.8,t/2,Math.min(Hp*.25,Wp*.35)),
        topDustLeft:box(-Lp/2+t,0,Hp-t/2,t*.8,Wp/2*.7,t/2),
        topDustRight:box(Lp/2-t,0,Hp-t/2,t*.8,Wp/2*.7,t/2),
        handleLeft:box(-Lp/2+t,0,Hp,Math.min(20,Lp*.2),Wp/2*.4,t/2),
        handleRight:box(Lp/2-t,0,Hp,Math.min(20,Lp*.2),Wp/2*.4,t/2),
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
    const majorH=Wp*.48,minorH=Math.min(Lp*.42,Wp*.7)
    const handleW=Math.min(28,Lp*.28)
    const glueW=Math.max(8,Math.min(15,Lp*.25))
    const glueInset=Math.min(3,Hp*.05)
    const x0=glueW+handleW+15,y0=Wp+tuckD+15
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
    const lidY=y0-Wp
    faces.push(
      ['topLid',bx,lidY,Lp,Wp,'back','top'],
      ['topTuck',bx+tuckInset,lidY-tuckD,Lp-2*tuckInset,tuckD,'topLid','top'],
      ['handleLeft',bx-handleW,lidY+Wp*.15,handleW,Wp*.7,'topLid','left'],
      ['handleRight',bx+Lp,lidY+Wp*.15,handleW,Wp*.7,'topLid','right'],
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
