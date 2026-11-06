// FEFCO 0201 开槽纸箱（RSC）：四片墙板一字排开 + 接舌，上下各四片等高摇盖，外摇盖在中线对接。
// 补偿系数为示意值，需按实际瓦楞楞型打样校准。

export default {
  id:'fefco-0201',
  label:'开槽纸箱',
  labelEn:'Regular Slotted Container',
  standard:'FEFCO 0201',
  root:'front',
  faceOrder:Object.freeze([
    'front','right','back','left','glueFlap',
    'frontTop','rightTop','backTop','leftTop',
    'frontBottom','rightBottom','backBottom','leftBottom'
  ]),
  supportsClosedCheck:true,
  defaults:{length:300,width:200,height:150,thickness:3},
  limits:{length:[80,1500],width:[60,1200],height:[40,1200]},
  sizeRule:{
    panelAdd:{length:1,width:1,height:2},
    outerAdd:{length:2,width:2,height:4}
  },
  // 长边外摇盖略小于 90°，叠在短边内摇盖外侧
  hingeAngles:{frontTop:88,backTop:88,frontBottom:88,backBottom:88},
  closedCheck:{
    pairs:[
      ['frontTop','backTop'],
      ['frontBottom','backBottom'],
      ['leftTop','frontTop'],
      ['rightTop','frontTop'],
      ['leftBottom','frontBottom'],
      ['rightBottom','frontBottom']
    ],
    buildBoxes({panel,T}){
      const Lp=panel.length,Wp=panel.width,Hp=panel.height,t=T
      const box=(cx,cy,cz,hx,hy,hz)=>({min:[cx-hx,cy-hy,cz-hz],max:[cx+hx,cy+hy,cz+hz]})
      // 闭合后长边摇盖在中线对接；短边摇盖压在长边下方
      return {
        frontTop:box(0,Wp/4,Hp,Lp/2*.9,Wp/4,t/2),
        backTop:box(0,-Wp/4,Hp,Lp/2*.9,Wp/4,t/2),
        leftTop:box(-Lp/4,0,Hp-t,Lp/4*.9,Wp/2*.85,t/2),
        rightTop:box(Lp/4,0,Hp-t,Lp/4*.9,Wp/2*.85,t/2),
        frontBottom:box(0,Wp/4,0,Lp/2*.9,Wp/4,t/2),
        backBottom:box(0,-Wp/4,0,Lp/2*.9,Wp/4,t/2),
        leftBottom:box(-Lp/4,0,t,Lp/4*.9,Wp/2*.85,t/2),
        rightBottom:box(Lp/4,0,t,Lp/4*.9,Wp/2*.85,t/2)
      }
    }
  },
  layout({panel,T}){
    const Lp=panel.length,Wp=panel.width,Hp=panel.height
    const slot=Math.max(3,2*T)
    const flapH=Wp/2
    const glueW=Math.min(30,Lp*.25)
    const glueInset=Math.min(5,Hp*.08)
    const x0=glueW+20,y0=flapH+20
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
    for(const [name] of walls){
      const {x:px,w}=pos[name]
      faces.push([`${name}Top`,px+slot/2,y0-flapH,w-slot,flapH,name,'top'])
      faces.push([`${name}Bottom`,px+slot/2,y0+Hp,w-slot,flapH,name,'bottom'])
    }
    // 三个标注上下错开，窄面板上文字不互相覆盖
    const lenY=y0+Hp*.3,widY=y0+Hp*.7
    const arrows={
      length:[{x:x0,y:lenY},{x:x0+Lp,y:lenY}],
      width:[{x:x0+Lp,y:widY},{x:x0+Lp+Wp,y:widY}],
      height:[{x:x0+Lp+Wp+Lp/2,y:y0},{x:x0+Lp+Wp+Lp/2,y:y0+Hp}]
    }
    return {faces,arrows}
  }
}
