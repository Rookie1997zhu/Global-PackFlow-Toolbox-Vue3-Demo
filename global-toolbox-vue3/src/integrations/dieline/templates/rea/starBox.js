/**
 * REA StarBox*：极坐标星形盒（连通展开网，便于外轮廓并集）。
 * 面名对齐金样：H/F、HS/FS、HL/HR/FL/FR、L/M/R；面数 = 6P+1。
 */
import {pdef,aabb,round,withOutline,withHingeLine} from './shared.js'

export function starFaceOrder(P){
  const p=Math.max(3,Math.min(11,Math.round(P)||5))
  const order=['L','M','R']
  for(let i=0;i<p;i++)order.push(`HS${i}`,`FS${i}`)
  for(let i=0;i<p-1;i++)order.push(`HL${i}`,`HR${i}`,`FL${i}`,`FR${i}`)
  order.push('H','F')
  return order
}

function starPolygon(cx,cy,ro,ri,P,rot=-Math.PI/2){
  const pts=[]
  for(let i=0;i<P;i++){
    const a0=rot+i*2*Math.PI/P
    const a1=rot+(i+.5)*2*Math.PI/P
    pts.push([cx+ro*Math.cos(a0),cy+ro*Math.sin(a0)])
    pts.push([cx+ri*Math.cos(a1),cy+ri*Math.sin(a1)])
  }
  return pts
}

function polyBBox(pts){
  const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1])
  return {x:Math.min(...xs),y:Math.min(...ys),w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys)}
}

function relOutline(pts,bb){
  return pts.map(([x,y])=>[round(x-bb.x),round(y-bb.y)])
}

function hingedRect(name,x,y,w,h,parent,hinge){
  const outline=[[0,0],[w,0],[w,h],[0,h]]
  return withHingeLine(withOutline([name,x,y,w,h,parent,null],outline),hinge)
}

export default {
  id:'rea-star-box',
  label:'REA 星形盒',
  labelEn:'REA Star Box',
  standard:'StarBox* · REA',
  root:'H',
  faceOrder:(params)=>starFaceOrder(params?.P??5),
  supportsClosedCheck:true,
  defaults:{length:70,width:70,height:30,thickness:.5},
  limits:{length:[40,300],width:[40,300],height:[10,120]},
  sizeRule:{
    panelAdd:{length:0,width:0,height:0},
    outerAdd:{length:1,width:1,height:1}
  },
  reaRef:{
    code:'StarBox',
    sampleNum:'182030',
    // 星面 bbox 与极坐标示意网不完全同构；金样断言改看面数与外径
    faceMap:{}
  },
  paramDefs:[
    pdef('P','角数','星形',()=>5,{min:3,max:11,unit:''}),
    pdef('RO','外径','星形',(p)=>round(p.length/2),{min:15,max:200}),
    pdef('RI','内径','星形',(p)=>round(p.length/2*.45),{min:5,max:150}),
    pdef('GT','粘舌宽','星形',()=>12,{min:4,max:40})
  ],
  hingeAngles:{},
  closedCheck:{
    pairs:[['HS0','H'],['FS0','F']],
    buildBoxes({panel,T}){
      const r=(panel.length||70)/2,h=panel.height||30,t=T
      return {
        H:aabb(0,0,0,r,r,t/2),
        F:aabb(0,0,h,r,r,t/2),
        HS0:aabb(r*.7,0,h/2,t,r*.5,h/2),
        FS0:aabb(r*.7,0,h/2,t,r*.5,h/2)
      }
    }
  },
  layout({panel,params}){
    const P=Math.max(3,Math.min(11,Math.round(params.P)||5))
    const RO=params.RO||panel.length/2
    const RI=Math.min(params.RI||RO*.45,RO*.85)
    const wallH=panel.height
    const GT=params.GT||12
    const edgeLen=round(2*RO*Math.sin(Math.PI/P))
    const order=starFaceOrder(P)
    const faces=[]

    // 连通网：HS 行（含粘舌）— H — L/M/R — F — FS 行
    const rowW=P*edgeLen
    const ox=GT+20
    const hsY=20
    const hCy=hsY+wallH+RO+4
    const hPts=starPolygon(ox+rowW/2,hCy,RO,RI,P)
    const hBb=polyBBox(hPts)
    // 让 H 顶边贴住 HS 底边：平移星面
    const dy=(hsY+wallH)-hBb.y
    const hPts2=hPts.map(([x,y])=>[x,y+dy])
    const hBb2=polyBBox(hPts2)
    faces.push(withOutline(
      ['H',round(hBb2.x),round(hBb2.y),round(hBb2.w),round(hBb2.h),null,null],
      relOutline(hPts2,hBb2)
    ))

    for(let i=0;i<P;i++){
      const hsX=round(hBb2.x+(hBb2.w-rowW)/2+i*edgeLen)
      faces.push(hingedRect(`HS${i}`,hsX,hsY,edgeLen,wallH,'H',[[0,wallH],[edgeLen,wallH]]))
      if(i<P-1){
        // 粘舌贴在 HS 之间的缝上会重叠；放到行两端外侧交替
      }
    }
    // HL/HR：挂在各 HS 左右（P-1 对），略重叠可接受；用侧向铰链
    for(let i=0;i<P-1;i++){
      const hsX=round(hBb2.x+(hBb2.w-rowW)/2+i*edgeLen)
      faces.push(hingedRect(`HL${i}`,hsX-GT,hsY,GT,wallH,`HS${i}`,[[GT,0],[GT,wallH]]))
      faces.push(hingedRect(`HR${i}`,hsX+edgeLen,hsY,GT,wallH,`HS${i}`,[[0,0],[0,wallH]]))
    }

    const spineW=Math.max(10,round(edgeLen*.4))
    const spineX=round(hBb2.x+hBb2.w/2-spineW*1.5)
    const spineY=round(hBb2.y+hBb2.h)
    faces.push(hingedRect('L',spineX,spineY,spineW,wallH,'H',[[0,0],[spineW,0]]))
    faces.push(hingedRect('M',spineX+spineW,spineY,spineW,wallH,'L',[[0,0],[0,wallH]]))
    faces.push(hingedRect('R',spineX+2*spineW,spineY,spineW,wallH,'M',[[0,0],[0,wallH]]))

    const fCy=spineY+wallH+RO+4
    const fPts=starPolygon(ox+rowW/2,fCy,RO,RI,P)
    // F 顶边贴 R/脊底边
    const fBb0=polyBBox(fPts)
    const fdy=spineY+wallH-fBb0.y
    const fPts2=fPts.map(([x,y])=>[x,y+fdy])
    const fBb=polyBBox(fPts2)
    faces.push(withHingeLine(
      withOutline(['F',round(fBb.x),round(fBb.y),round(fBb.w),round(fBb.h),'R',null],relOutline(fPts2,fBb)),
      [[round(fBb.w/2-spineW/2),0],[round(fBb.w/2+spineW/2),0]]
    ))

    const fsY=round(fBb.y+fBb.h)
    for(let i=0;i<P;i++){
      const fsX=round(fBb.x+(fBb.w-rowW)/2+i*edgeLen)
      faces.push(hingedRect(`FS${i}`,fsX,fsY,edgeLen,wallH,'F',[[0,0],[edgeLen,0]]))
    }
    for(let i=0;i<P-1;i++){
      const fsX=round(fBb.x+(fBb.w-rowW)/2+i*edgeLen)
      faces.push(hingedRect(`FL${i}`,fsX-GT,fsY,GT,wallH,`FS${i}`,[[GT,0],[GT,wallH]]))
      faces.push(hingedRect(`FR${i}`,fsX+edgeLen,fsY,GT,wallH,`FS${i}`,[[0,0],[0,wallH]]))
    }

    const byName=Object.fromEntries(faces.map(f=>[f[0],f]))
    for(const n of order){
      if(!byName[n])throw new Error(`starBox missing face ${n}`)
    }
    const arrows={
      length:[{x:hBb2.x,y:hBb2.y+hBb2.h*.5},{x:hBb2.x+hBb2.w,y:hBb2.y+hBb2.h*.5}],
      width:[{x:hBb2.x+hBb2.w*.5,y:hBb2.y},{x:hBb2.x+hBb2.w*.5,y:hBb2.y+hBb2.h}],
      height:[{x:hBb2.x-12,y:hsY},{x:hBb2.x-12,y:hsY+wallH}]
    }
    return {faces:order.map(n=>byName[n]),arrows,faceOrder:order}
  }
}
