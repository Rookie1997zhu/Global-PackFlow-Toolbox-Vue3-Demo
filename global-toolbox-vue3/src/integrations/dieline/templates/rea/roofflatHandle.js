// REA RoofflatHandleBuckle：带手柄管式盒
import {
  PAIR_FACE_ORDER,PAIR_PARAM_DEFS,pairClosedCheck,layoutPairTube,BOARD_SIZE_RULE,pdef,round
} from './shared.js'

export default {
  id:'rea-roofflat-handle',
  label:'REA 提手盒',
  labelEn:'REA Roof Flat Handle',
  standard:'RoofflatHandleBuckle · REA',
  root:'front',
  faceOrder:PAIR_FACE_ORDER,
  supportsClosedCheck:true,
  defaults:{length:200,width:100,height:120,thickness:1.5},
  limits:{length:[60,600],width:[40,400],height:[40,400]},
  sizeRule:BOARD_SIZE_RULE,
  reaRef:{
    code:'RoofflatHandleBuckle',
    sampleNum:'112470',
    faceMap:{front:'H',back:'F'}
  },
  paramDefs:[
    ...PAIR_PARAM_DEFS,
    pdef('D1','顶板延伸','提手',(p)=>round(p.length*.2),{min:10,max:120}),
    pdef('C','提手孔长','提手',(p)=>round(p.length*.1),{min:8,max:80}),
    pdef('CR','提手孔倒角','提手',(p)=>round(p.length*.05),{min:1,max:30}),
    pdef('BR','提手倒角','提手',()=>2,{min:0,max:10}),
    pdef('RY','提手 Y','提手',()=>5,{min:0,max:30})
  ],
  hingeAngles:{topLid:88,bottomLid:88},
  closedCheck:pairClosedCheck(),
  layout(args){
    const {panel,params,T}=args
    const out=layoutPairTube({...args,mode:'ste'})
    const top=out.faces.find(f=>f[0]==='topLid')
    if(top){
      const [,x,y,w,h]=top
      const hw=params.C,hh=Math.min(14,params.CR*2+4),r=params.CR
      out.holes.push({
        x:x+(w-hw)/2,
        y:y+(h-hh)/2,
        w:hw,h:hh,r
      })
    }
    return out
  }
}
