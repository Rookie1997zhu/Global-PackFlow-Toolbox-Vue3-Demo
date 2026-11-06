// 拉链/易撕插舌盒：STE + 顶盖撕拉齿示意（短裁切段列）。

export default {
  id:'zipper-tuck',
  label:'拉链插舌盒',
  labelEn:'Zipper Tuck Box',
  standard:'拉链/易撕示意',
  root:'front',
  faceOrder:Object.freeze([
    'front','right','back','left','glueFlap',
    'topLid','topTuck','topDustRight','topDustLeft',
    'bottomLid','bottomTuck','bottomDustRight','bottomDustLeft'
  ]),
  supportsClosedCheck:true,
  defaults:{length:90,width:55,height:140,thickness:.5},
  limits:{length:[30,600],width:[20,400],height:[40,800]},
  sizeRule:{
    panelAdd:{length:1,width:1,height:2},
    outerAdd:{length:2,width:2,height:2}
  },
  hingeAngles:{topLid:88,bottomLid:88},
  closedCheck:{
    pairs:[
      ['topTuck','front'],
      ['bottomTuck','front'],
      ['topDustLeft','left'],
      ['topDustRight','right'],
      ['bottomDustLeft','left'],
      ['bottomDustRight','right']
    ],
    buildBoxes({panel,T}){
      const Lp=panel.length,Wp=panel.width,Hp=panel.height,t=T
      const box=(cx,cy,cz,hx,hy,hz)=>({min:[cx-hx,cy-hy,cz-hz],max:[cx+hx,cy+hy,cz+hz]})
      return {
        front:box(0,Wp/2,Hp/2,Lp/2,t/2,Hp/2),
        left:box(-Lp/2,0,Hp/2,t/2,Wp/2,Hp/2),
        right:box(Lp/2,0,Hp/2,t/2,Wp/2,Hp/2),
        topTuck:box(0,Wp/2-t,Hp-t*2,Lp/2*.8,t/2,Math.min(Hp*.25,Wp*.35)),
        bottomTuck:box(0,Wp/2-t,t*2,Lp/2*.8,t/2,Math.min(Hp*.25,Wp*.35)),
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
    const bx=pos.back.x,rx=pos.right.x,lx=pos.left.x
    const bottomY=y0+Hp
    faces.push(
      ['topLid',bx,y0-Wp,Lp,Wp,'back','top'],
      ['topTuck',bx+tuckInset,y0-Wp-tuckD,Lp-2*tuckInset,tuckD,'topLid','top'],
      ['topDustRight',rx+slot/2,y0-dustH,Wp-slot,dustH,'right','top'],
      ['topDustLeft',lx+slot/2,y0-dustH,Wp-slot,dustH,'left','top'],
      ['bottomLid',bx,bottomY,Lp,Wp,'back','bottom'],
      ['bottomTuck',bx+tuckInset,bottomY+Wp,Lp-2*tuckInset,tuckD,'bottomLid','bottom'],
      ['bottomDustRight',rx+slot/2,bottomY,Wp-slot,dustH,'right','bottom'],
      ['bottomDustLeft',lx+slot/2,bottomY,Wp-slot,dustH,'left','bottom']
    )
    // 撕拉齿：沿顶盖与后墙铰线上方一排细孔矩形
    const zipY=y0-Wp+Math.max(4,Wp*.08)
    const tooth=3,gap=2,zipH=1.2
    const holes=[]
    let zx=bx+4
    while(zx+tooth<bx+Lp-4){
      holes.push({x:zx,y:zipY,w:tooth,h:zipH})
      zx+=tooth+gap
    }
    const lenY=y0+Hp*.3,widY=y0+Hp*.7
    const arrows={
      length:[{x:x0,y:lenY},{x:x0+Lp,y:lenY}],
      width:[{x:rx,y:widY},{x:rx+Wp,y:widY}],
      height:[{x:bx+Lp/2,y:y0},{x:bx+Lp/2,y:y0+Hp}]
    }
    return {faces,arrows,holes}
  }
}
