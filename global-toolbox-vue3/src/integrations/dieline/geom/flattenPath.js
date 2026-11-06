/**
 * 路径展平：SVG 圆弧 / 二次 / 三次贝塞尔 → 折线。
 * 编译期与运行期共用；三次贝塞尔经仿射变换后仍精确，故规格存 UV 三次段。
 */

const EPS=.05

/** SVG 端点弧参数 → 圆心参数（与 SVG A 一致；large=大弧，sweep=扫掠方向） */
export function arcCenter(x1,y1,x2,y2,rx,ry,angDeg,large,sweep){
  rx=Math.abs(rx);ry=Math.abs(ry)
  if(rx<.1||ry<.1)return null
  const phi=(angDeg||0)*Math.PI/180
  const cos=Math.cos(phi),sin=Math.sin(phi)
  const dx=(x1-x2)/2,dy=(y1-y2)/2
  const x1p=cos*dx+sin*dy,y1p=-sin*dx+cos*dy
  let rx2=rx*rx,ry2=ry*ry,x1p2=x1p*x1p,y1p2=y1p*y1p
  const lam=x1p2/rx2+y1p2/ry2
  if(lam>1){const s=Math.sqrt(lam);rx*=s;ry*=s;rx2=rx*rx;ry2=ry*ry}
  const sign=large===sweep?-1:1
  const num=rx2*ry2-rx2*y1p2-ry2*x1p2
  const den=rx2*y1p2+ry2*x1p2
  const c=sign*Math.sqrt(Math.max(0,num/den))
  const cxp=c*(rx*y1p)/ry,cyp=c*(-ry*x1p)/rx
  const cx=cos*cxp-sin*cyp+(x1+x2)/2
  const cy=sin*cxp+cos*cyp+(y1+y2)/2
  const a=(ux,uy,vx,vy)=>{
    const n=Math.hypot(ux,uy)*Math.hypot(vx,vy)||1
    let ang=Math.acos(Math.min(1,Math.max(-1,(ux*vx+uy*vy)/n)))
    if(ux*vy-uy*vx<0)ang=-ang
    return ang
  }
  const t1=a(1,0,(x1p-cxp)/rx,(y1p-cyp)/ry)
  let dt=a((x1p-cxp)/rx,(y1p-cyp)/ry,(-x1p-cxp)/rx,(-y1p-cyp)/ry)
  if(!sweep&&dt>0)dt-=2*Math.PI
  if(sweep&&dt<0)dt+=2*Math.PI
  return {cx,cy,rx,ry,phi,t1,dt}
}

/** 椭圆点（参数角 t，已含旋转） */
function ellipsePt(c,t){
  const cos=Math.cos(c.phi),sin=Math.sin(c.phi)
  const x=c.rx*Math.cos(t),y=c.ry*Math.sin(t)
  return [c.cx+cos*x-sin*y,c.cy+sin*x+cos*y]
}

/**
 * SVG 圆弧 → 每段 ≤90° 的三次贝塞尔控制点列。
 * 返回 [{c1x,c1y,c2x,c2y,x,y}, ...]
 */
export function arcToCubics(x1,y1,x2,y2,rx,ry,angDeg,large,sweep){
  const c=arcCenter(x1,y1,x2,y2,rx,ry,angDeg,!!large,!!sweep)
  if(!c)return [{c1x:x1,c1y:y1,c2x:x2,c2y:y2,x:x2,y:y2}]
  const segs=Math.max(1,Math.ceil(Math.abs(c.dt)/(Math.PI/2)))
  const out=[]
  let t0=c.t1
  let [px,py]=[x1,y1]
  const cos=Math.cos(c.phi),sin=Math.sin(c.phi)
  for(let i=1;i<=segs;i++){
    const t1=c.t1+c.dt*(i/segs)
    const [qx,qy]=ellipsePt(c,t1)
    // 切向量：d/dt = R·(-rx sin t, ry cos t)
    const alpha=Math.tan((t1-t0)/4)*4/3
    const tx0=-c.rx*Math.sin(t0),ty0=c.ry*Math.cos(t0)
    const tx1=-c.rx*Math.sin(t1),ty1=c.ry*Math.cos(t1)
    const dx0=cos*tx0-sin*ty0,dy0=sin*tx0+cos*ty0
    const dx1=cos*tx1-sin*ty1,dy1=sin*tx1+cos*ty1
    out.push({
      c1x:px+alpha*dx0,c1y:py+alpha*dy0,
      c2x:qx-alpha*dx1,c2y:qy-alpha*dy1,
      x:qx,y:qy
    })
    px=qx;py=qy;t0=t1
  }
  return out
}

/** 二次贝塞尔精确升阶为三次 */
export function quadToCubic(x0,y0,cx,cy,x1,y1){
  return {
    c1x:x0+(2/3)*(cx-x0),c1y:y0+(2/3)*(cy-y0),
    c2x:x1+(2/3)*(cx-x1),c2y:y1+(2/3)*(cy-y1),
    x:x1,y:y1
  }
}

function cubicAt(x0,y0,c1x,c1y,c2x,c2y,x1,y1,t){
  const u=1-t
  return [
    u*u*u*x0+3*u*u*t*c1x+3*u*t*t*c2x+t*t*t*x1,
    u*u*u*y0+3*u*u*t*c1y+3*u*t*t*c2y+t*t*t*y1
  ]
}

/** 弦高误差：中点到弦的距离 */
function cubicFlatness(x0,y0,c1x,c1y,c2x,c2y,x1,y1){
  const [mx,my]=cubicAt(x0,y0,c1x,c1y,c2x,c2y,x1,y1,.5)
  const dx=x1-x0,dy=y1-y0
  const len=Math.hypot(dx,dy)||1
  return Math.abs((mx-x0)*dy-(my-y0)*dx)/len
}

function subdivideCubic(x0,y0,c1x,c1y,c2x,c2y,x1,y1,tol,out,budget){
  if(budget<=0||cubicFlatness(x0,y0,c1x,c1y,c2x,c2y,x1,y1)<=tol){
    out.push([x1,y1])
    return
  }
  // de Casteljau 中点拆分
  const ax=(x0+c1x)/2,ay=(y0+c1y)/2
  const bx=(c1x+c2x)/2,by=(c1y+c2y)/2
  const cx=(c2x+x1)/2,cy=(c2y+y1)/2
  const dx=(ax+bx)/2,dy=(ay+by)/2
  const ex=(bx+cx)/2,ey=(by+cy)/2
  const fx=(dx+ex)/2,fy=(dy+ey)/2
  const half=Math.floor(budget/2)
  subdivideCubic(x0,y0,ax,ay,dx,dy,fx,fy,tol,out,half)
  subdivideCubic(fx,fy,ex,ey,cx,cy,x1,y1,tol,out,budget-half)
}

/**
 * 把命令列展平为折线。
 * cmds 支持两种形态：
 *   1) Pacdora 对象：{mtd:'M'|'L'|'A'|'Q'|'C'|'Z', x,y,...}
 *   2) 紧凑数组：['M',u,v] | ['L',u,v] | ['C',u1,v1,u2,v2,u,v] | ['Z']
 * @param {object[]|array[]} cmds
 * @param {{tol?:number,maxPts?:number}} [opts]
 */
export function flattenCubicPath(cmds,{tol=.25,maxPts=96}={}){
  if(!Array.isArray(cmds)||!cmds.length)return []
  const pts=[]
  let x=0,y=0,started=false

  const pushPt=(px,py)=>{
    if(!pts.length||Math.hypot(px-pts[pts.length-1][0],py-pts[pts.length-1][1])>EPS){
      pts.push([px,py])
    }
  }

  const emitCubic=(c1x,c1y,c2x,c2y,ex,ey)=>{
    const remain=Math.max(2,maxPts-pts.length)
    subdivideCubic(x,y,c1x,c1y,c2x,c2y,ex,ey,tol,pts,remain)
    // subdivide 末点可能与 push 重复；统一去重
    if(pts.length>=2){
      const a=pts[pts.length-1],b=pts[pts.length-2]
      if(Math.hypot(a[0]-b[0],a[1]-b[1])<=EPS)pts.pop()
    }
    pushPt(ex,ey)
    x=ex;y=ey
  }

  for(const c of cmds){
    const isArr=Array.isArray(c)
    const m=isArr?c[0]:c?.mtd
    if(m==='M'){
      x=Number(isArr?c[1]:c.x)||0
      y=Number(isArr?c[2]:c.y)||0
      if(!started||pts.length){pushPt(x,y);started=true}
      else{pts[0]=[x,y]}
    }else if(m==='L'){
      x=Number(isArr?c[1]:c.x)||0
      y=Number(isArr?c[2]:c.y)||0
      pushPt(x,y)
    }else if(m==='A'&&!isArr){
      for(const seg of arcToCubics(x,y,c.x,c.y,c.rx||0,c.ry||0,c.ang||0,!!c.arc,!!(c.dir??1))){
        emitCubic(seg.c1x,seg.c1y,seg.c2x,seg.c2y,seg.x,seg.y)
      }
    }else if(m==='Q'){
      const cx=Number(isArr?c[1]:c.cx)||0,cy=Number(isArr?c[2]:c.cy)||0
      const ex=Number(isArr?c[3]:c.x)||0,ey=Number(isArr?c[4]:c.y)||0
      const s=quadToCubic(x,y,cx,cy,ex,ey)
      emitCubic(s.c1x,s.c1y,s.c2x,s.c2y,s.x,s.y)
    }else if(m==='C'){
      let c1x,c1y,c2x,c2y,ex,ey
      if(isArr){
        c1x=+c[1]||0;c1y=+c[2]||0;c2x=+c[3]||0;c2y=+c[4]||0;ex=+c[5]||0;ey=+c[6]||0
      }else{
        c1x=c.cx1??c.cx??0;c1y=c.cy1??c.cy??0
        c2x=c.cx2??c.cx??0;c2y=c.cy2??c.cy??0
        ex=c.x||0;ey=c.y||0
      }
      emitCubic(c1x,c1y,c2x,c2y,ex,ey)
    }else if(m==='Z'){
      if(pts.length>=2){
        const a=pts[0],b=pts[pts.length-1]
        if(Math.hypot(a[0]-b[0],a[1]-b[1])<EPS)pts.pop()
      }
    }
  }

  // 超限均匀抽稀
  if(pts.length>maxPts){
    const step=pts.length/maxPts
    const slim=[]
    for(let i=0;i<maxPts;i++)slim.push(pts[Math.min(pts.length-1,Math.floor(i*step))])
    return slim
  }
  return pts
}

/** 兼容旧名：固定步数展平（孔位识别仍可用） */
export function flattenPath(cmds){
  return flattenCubicPath(cmds,{tol:.35,maxPts:64})
}
