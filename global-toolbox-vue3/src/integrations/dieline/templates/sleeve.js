// 袖套/外管示意：四墙筒状展开（无底），侧接舌；与 drawer-tray 组成抽屉套。

export default {
  id:'sleeve',
  label:'袖套',
  labelEn:'Sleeve Tube',
  standard:'袖套示意',
  root:'front',
  faceOrder:Object.freeze(['front','right','back','left','glueFlap']),
  supportsClosedCheck:true,
  defaults:{length:200,width:120,height:40,thickness:1.5},
  limits:{length:[40,1200],width:[30,800],height:[15,400]},
  sizeRule:{
    panelAdd:{length:2,width:2,height:1},
    outerAdd:{length:2,width:2,height:2}
  },
  hingeAngles:{},
  closedCheck:{
    pairs:[['left','front'],['right','front'],['left','back'],['right','back']],
    buildBoxes({panel,T}){
      const Lp=panel.length,Wp=panel.width,Hp=panel.height,t=T
      const box=(cx,cy,cz,hx,hy,hz)=>({min:[cx-hx,cy-hy,cz-hz],max:[cx+hx,cy+hy,cz+hz]})
      return {
        front:box(0,Wp/2,Hp/2,Lp/2,t/2,Hp/2),
        back:box(0,-Wp/2,Hp/2,Lp/2,t/2,Hp/2),
        left:box(-Lp/2,0,Hp/2,t/2,Wp/2,Hp/2),
        right:box(Lp/2,0,Hp/2,t/2,Wp/2,Hp/2)
      }
    }
  },
  layout({panel,T}){
    const Lp=panel.length,Wp=panel.width,Hp=panel.height
    const glueW=Math.max(8,Math.min(18,Lp*.2))
    const glueInset=Math.min(2,Hp*.08)
    const x0=glueW+20,y0=20
    const walls=[['front',Lp],['right',Wp],['back',Lp],['left',Wp]]
    const faces=[]
    let x=x0
    walls.forEach(([name,w],i)=>{
      faces.push([name,x,y0,w,Hp,i?walls[i-1][0]:null,i?'right':null])
      x+=w
    })
    faces.push(['glueFlap',x0-glueW,y0+glueInset,glueW,Hp-2*glueInset,'front','left'])
    const arrows={
      length:[{x:x0,y:y0+Hp*.35},{x:x0+Lp,y:y0+Hp*.35}],
      width:[{x:x0+Lp,y:y0+Hp*.7},{x:x0+Lp+Wp,y:y0+Hp*.7}],
      height:[{x:x0+Lp/2,y:y0},{x:x0+Lp/2,y:y0+Hp}]
    }
    return {faces,arrows}
  }
}
