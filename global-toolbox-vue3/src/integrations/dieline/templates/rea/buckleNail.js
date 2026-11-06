// REA BuckleWithNailOne：礼盒钉扣/插锁路径（Pair 族，G/GT 随 H）
import {
  PAIR_FACE_ORDER,pairClosedCheck,layoutPairTube,BOARD_SIZE_RULE,pdef,round
} from './shared.js'

export default {
  id:'rea-buckle-nail',
  label:'REA 钉扣礼盒',
  labelEn:'REA Buckle With Nail',
  standard:'BuckleWithNailOne · REA',
  root:'front',
  faceOrder:PAIR_FACE_ORDER,
  supportsClosedCheck:true,
  defaults:{length:100,width:70,height:120,thickness:.5},
  limits:{length:[40,400],width:[30,300],height:[40,400]},
  sizeRule:BOARD_SIZE_RULE,
  reaRef:{
    code:'BuckleWithNailOne',
    sampleNum:'10201102',
    faceMap:{front:'H',back:'F',right:'FR',left:'FL'}
  },
  paramDefs:[
    pdef('G','粘舌宽','管式骨架',(p)=>round(Math.min(20,8+p.height*.05)),{min:8,max:40}),
    pdef('GT','粘舌倒角','管式骨架',(p)=>round(Math.min(18,6+p.height*.04)),{min:0,max:30}),
    pdef('C','防尘翼高','插锁防尘',(p)=>round(p.length*.14),{min:5,max:80}),
    pdef('CR','插锁倒角','插锁防尘',(p)=>round(p.length*.07),{min:1,max:40}),
    pdef('A','插舌相关宽','插锁防尘',(p)=>round(p.length*.33),{min:8,max:120}),
    pdef('ATT','插舌深','插锁防尘',(p)=>round(p.height*.09),{min:4,max:40})
  ],
  hingeAngles:{topLid:88,bottomLid:88},
  closedCheck:pairClosedCheck(),
  layout(args){
    return layoutPairTube({...args,mode:'ste'})
  }
}
