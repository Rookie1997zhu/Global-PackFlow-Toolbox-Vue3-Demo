// 反向插舌盒（Reverse Tuck End）：上盖铰在后墙、下盖铰在前墙，插舌方向相反。
// 适用于薄卡纸折叠纸盒；补偿系数为示意值，需打样校准。

export default {
  id:'tuck-end-reverse',
  label:'反向插舌盒',
  labelEn:'Reverse Tuck End Box',
  standard:'RTE 折叠纸盒',
  root:'front',
  faceOrder:Object.freeze([
    'front','right','back','left','glueFlap',
    'topLid','topTuck','topDustRight','topDustLeft',
    'bottomLid','bottomTuck','bottomDustRight','bottomDustLeft'
  ]),
  supportsClosedCheck:true,
  defaults:{length:80,width:50,height:150,thickness:.5},
  limits:{length:[30,600],width:[20,400],height:[30,800]},
  sizeRule:{
    panelAdd:{length:1,width:1,height:2},
    outerAdd:{length:2,width:2,height:2}
  },
  hingeAngles:{topLid:88,bottomLid:88},
  closedCheck:{
    pairs:[
      ['topTuck','front'],
      ['bottomTuck','back'],
      ['topDustLeft','left'],
      ['topDustRight','right'],
      ['bottomDustLeft','left'],
      ['bottomDustRight','right']
    ],
    buildBoxes({panel,T}){
      const Lp=panel.length,Wp=panel.width,Hp=panel.height,t=T
      const box=(cx,cy,cz,hx,hy,hz)=>({min:[cx-hx,cy-hy,cz-hz],max:[cx+hx,cy+hy,cz+hz]})
      // 上插舌入前墙，下插舌入后墙
      return {
        front:box(0,Wp/2,Hp/2,Lp/2,t/2,Hp/2),
        back:box(0,-Wp/2,Hp/2,Lp/2,t/2,Hp/2),
        left:box(-Lp/2,0,Hp/2,t/2,Wp/2,Hp/2),
        right:box(Lp/2,0,Hp/2,t/2,Wp/2,Hp/2),
        topTuck:box(0,Wp/2-t,Hp-t*2,Lp/2*.8,t/2,Math.min(Hp*.25,Wp*.35)),
        bottomTuck:box(0,-Wp/2+t,t*2,Lp/2*.8,t/2,Math.min(Hp*.25,Wp*.35)),
        topDustLeft:box(-Lp/2+t,0,Hp-t/2,t*.8,Wp/2*.7,t/2),
        topDustRight:box(Lp/2-t,0,Hp-t/2,t*.8,Wp/2*.7,t/2),
        bottomDustLeft:box(-Lp/2+t,0,t/2,t*.8,Wp/2*.7,t/2),
        bottomDustRight:box(Lp/2-t,0,t/2,t*.8,Wp/2*.7,t/2)
      }
    }
  },
  layout({panel,T}){
    const Lp=panel.length,Wp=panel.width,Hp=panel.height
    const slot=Math.max(1.5,3*T)
    const tuckD=Math.min(Math.max(Wp*.35,10),25,Hp*.4)
    const tuckInset=Math.max(1,2*T)
    const dustH=Math.min(Lp*.4,Wp*.8)
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
    // 上盖在后墙、下盖在前墙 → 插舌方向相反
    faces.push(
      ['topLid',bx,y0-Wp,Lp,Wp,'back','top'],
      ['topTuck',bx+tuckInset,y0-Wp-tuckD,Lp-2*tuckInset,tuckD,'topLid','top'],
      ['topDustRight',rx+slot/2,y0-dustH,Wp-slot,dustH,'right','top'],
      ['topDustLeft',lx+slot/2,y0-dustH,Wp-slot,dustH,'left','top'],
      ['bottomLid',fx,bottomY,Lp,Wp,'front','bottom'],
      ['bottomTuck',fx+tuckInset,bottomY+Wp,Lp-2*tuckInset,tuckD,'bottomLid','bottom'],
      ['bottomDustRight',rx+slot/2,bottomY,Wp-slot,dustH,'right','bottom'],
      ['bottomDustLeft',lx+slot/2,bottomY,Wp-slot,dustH,'left','bottom']
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
