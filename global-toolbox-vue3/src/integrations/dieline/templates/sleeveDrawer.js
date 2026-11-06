// 抽屉 + 袖套成套：抽屉十字托盘，袖套四墙筒；件别切换；缩略图 sleeve 组装。

export default {
  id:'sleeve-drawer',
  label:'抽屉袖套',
  labelEn:'Drawer & Sleeve',
  standard:'抽屉+袖套示意',
  root:'base',
  faceOrder:Object.freeze(['base','back','front','left','right']),
  supportsClosedCheck:true,
  supportsPiece:true,
  assembly:'sleeve',
  pieces:Object.freeze([
    {id:'drawer',label:'抽屉',root:'base'},
    {id:'sleeve',label:'袖套',root:'front'}
  ]),
  defaults:{length:200,width:120,height:35,thickness:1.5,clearance:1.5},
  limits:{length:[40,1200],width:[30,800],height:[12,400]},
  sizeRule:{
    panelAdd:{length:2,width:2,height:1},
    outerAdd:{length:2,width:2,height:2}
  },
  hingeAngles:{},
  closedCheck:{
    pairs:[['left','back'],['right','back'],['left','front'],['right','front']],
    buildBoxes({panel,T,piece='drawer',clearance=1.5}){
      const c=piece==='sleeve'?Math.max(0,Number(clearance)||0):0
      const Lp=panel.length+2*c,Wp=panel.width+2*c,Hp=panel.height,t=T
      const box=(cx,cy,cz,hx,hy,hz)=>({min:[cx-hx,cy-hy,cz-hz],max:[cx+hx,cy+hy,cz+hz]})
      if(piece==='sleeve'){
        return {
          front:box(0,Wp/2,Hp/2,Lp/2,t/2,Hp/2),
          back:box(0,-Wp/2,Hp/2,Lp/2,t/2,Hp/2),
          left:box(-Lp/2,0,Hp/2,t/2,Wp/2,Hp/2),
          right:box(Lp/2,0,Hp/2,t/2,Wp/2,Hp/2)
        }
      }
      return {
        base:box(0,0,0,Lp/2,Wp/2,t/2),
        back:box(0,-Wp/2,Hp/2,Lp/2,t/2,Hp/2),
        front:box(0,Wp/2,Hp/2,Lp/2,t/2,Hp/2),
        left:box(-Lp/2,0,Hp/2,t/2,Wp/2,Hp/2),
        right:box(Lp/2,0,Hp/2,t/2,Wp/2,Hp/2)
      }
    }
  },
  layout({panel,T,piece='drawer',params}){
    const clear=Math.max(0,Number(params?.clearance??1.5)||0)
    if(piece==='sleeve'){
      // 袖套内尺寸 = 抽屉外尺寸 + clearance
      const Lp=panel.length+2*clear
      const Wp=panel.width+2*clear
      const Hp=panel.height
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
      return {
        faces,arrows,
        faceOrder:['front','right','back','left','glueFlap'],
        root:'front',
        piece:'sleeve'
      }
    }
    // 抽屉托盘
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
    return {
      faces,arrows,
      faceOrder:['base','back','front','left','right'],
      root:'base',
      piece:'drawer'
    }
  }
}
