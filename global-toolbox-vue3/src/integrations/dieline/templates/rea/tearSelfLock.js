// REA FullCoverSelfLockingTearFlatStickyBox：撕口自锁示意
import {
  PAIR_FACE_ORDER,pairClosedCheck,layoutPairTube,BOARD_SIZE_RULE,pdef,round
} from './shared.js'

export default {
  id:'rea-tear-self-lock',
  label:'REA 撕口自锁盒',
  labelEn:'REA Tear Self Lock',
  standard:'FullCoverSelfLockingTearFlatStickyBox · REA',
  root:'front',
  faceOrder:PAIR_FACE_ORDER,
  supportsClosedCheck:true,
  defaults:{length:120,width:70,height:140,thickness:.5},
  limits:{length:[40,400],width:[25,250],height:[40,400]},
  sizeRule:BOARD_SIZE_RULE,
  reaRef:{
    code:'FullCoverSelfLockingTearFlatStickyBox',
    sampleNum:'105210',
    faceMap:{front:'H',back:'F'}
  },
  paramDefs:[
    pdef('G','粘舌宽','撕口',(p)=>round(p.length*.085),{min:6,max:40}),
    pdef('F1','撕口段','撕口',(p)=>round(p.length*.32),{min:10,max:120}),
    pdef('SP','撕口间距','撕口',(p)=>round(p.length*.16),{min:5,max:80}),
    pdef('ST','撕口厚','撕口',()=>1.5,{min:0.5,max:5}),
    pdef('SL','撕口左','撕口',()=>3,{min:0,max:20}),
    pdef('SR','撕口右','撕口',()=>3,{min:0,max:20}),
    pdef('WW','撕口窗宽','撕口',(p)=>round(p.width*.5),{min:8,max:150}),
    pdef('C','防尘翼高','管式',(p)=>round(p.length*.14),{min:5,max:80}),
    pdef('A','插舌宽','管式',(p)=>round(p.length*.3),{min:8,max:100}),
    pdef('ATT','插舌深','管式',(p)=>round(p.height*.09),{min:4,max:40})
  ],
  hingeAngles:{topLid:88,bottomLid:88},
  closedCheck:pairClosedCheck(),
  layout(args){
    const {panel,params}=args
    const out=layoutPairTube({...args,mode:'ste'})
    const front=out.faces.find(f=>f[0]==='front')
    if(front){
      const [,x,y,w,h]=front
      const tw=params.WW,th=Math.max(2,params.ST*3),sp=params.SP
      // 撕口示意：一排细长孔
      const n=Math.max(2,Math.min(6,Math.round(w/sp)))
      const total=n*tw+(n-1)*Math.max(2,sp-tw)
      let cx=x+(w-total)/2
      for(let i=0;i<n;i++){
        out.holes.push({x:cx,y:y+h*.35,w:Math.min(tw,w*.2),h:th,r:1})
        cx+=tw+Math.max(2,sp-tw)
      }
    }
    return out
  }
}
