// 多边形托盘示意：N 片等宽墙板一字排开 + 接舌 + 各墙下摇盖（开顶）；轴对齐近似，非真六角底。

export default {
  id:'polygon-tray',
  label:'多边形托盘',
  labelEn:'Polygonal Tray',
  standard:'多边形开顶示意',
  root:'wall0',
  faceOrder:Object.freeze([
    'wall0','wall1','wall2','wall3','wall4','wall5','glueFlap',
    'flap0','flap1','flap2','flap3','flap4','flap5'
  ]),
  supportsClosedCheck:true,
  defaults:{length:60,width:60,height:50,thickness:1.5,sides:6},
  limits:{length:[25,400],width:[25,400],height:[15,300]},
  sizeRule:{
    panelAdd:{length:1,width:1,height:1},
    outerAdd:{length:2,width:2,height:2}
  },
  hingeAngles:{},
  closedCheck:{
    pairs:[
      ['wall0','wall1'],['wall1','wall2'],['wall2','wall3'],
      ['wall3','wall4'],['wall4','wall5'],['wall5','wall0'],
      ['flap0','flap1'],['flap2','flap3'],['flap4','flap5']
    ],
    buildBoxes({panel,T}){
      const face=panel.length,Hp=panel.height,t=T,n=6
      // 轴对齐示意：邻墙/底摇盖 AABB 故意加厚，保证对接重叠（非旋转墙物理）
      const R=face*.35
      const box=(cx,cy,cz,hx,hy,hz)=>({min:[cx-hx,cy-hy,cz-hz],max:[cx+hx,cy+hy,cz+hz]})
      const out={}
      for(let i=0;i<n;i++){
        const a=(i+.5)*2*Math.PI/n-Math.PI/2
        const cx=Math.cos(a)*R,cy=Math.sin(a)*R
        out[`wall${i}`]=box(cx,cy,Hp/2,face*.35,face*.35,Hp/2)
        out[`flap${i}`]=box(cx*.4,cy*.4,t,face*.45,face*.45,t/2)
      }
      return out
    }
  },
  layout({panel,T}){
    const face=panel.length,Hp=panel.height
    const n=6
    const flapH=Math.min(face*.45,panel.width*.5,40)
    const slot=Math.max(1.5,2*T)
    const glueW=Math.max(8,Math.min(16,face*.28))
    const glueInset=Math.min(2,Hp*.08)
    const x0=glueW+20,y0=flapH+20
    const faces=[]
    const pos=[]
    let x=x0
    for(let i=0;i<n;i++){
      const name=`wall${i}`
      faces.push([name,x,y0,face,Hp,i?`wall${i-1}`:null,i?'right':null])
      pos.push({x,w:face})
      x+=face
    }
    faces.push(['glueFlap',x0-glueW,y0+glueInset,glueW,Hp-2*glueInset,'wall0','left'])
    for(let i=0;i<n;i++){
      const {x:px,w}=pos[i]
      faces.push([`flap${i}`,px+slot/2,y0+Hp,w-slot,flapH,`wall${i}`,'bottom'])
    }
    const arrows={
      length:[{x:x0,y:y0+Hp*.3},{x:x0+face,y:y0+Hp*.3}],
      width:[{x:x0+face,y:y0+Hp*.65},{x:x0+face*2,y:y0+Hp*.65}],
      height:[{x:x0+face*2.5,y:y0},{x:x0+face*2.5,y:y0+Hp}]
    }
    return {faces,arrows}
  }
}
