// REA PairWithWindow：管式插舌 + 前板开窗
import {
  PAIR_FACE_ORDER,PAIR_PARAM_DEFS,pairClosedCheck,layoutPairTube,BOARD_SIZE_RULE,pdef,round
} from './shared.js'

export default {
  id:'rea-pair-window',
  label:'REA 开窗插舌盒',
  labelEn:'REA Pair With Window',
  standard:'PairWithWindow · REA',
  root:'front',
  faceOrder:PAIR_FACE_ORDER,
  supportsClosedCheck:true,
  defaults:{length:120,width:60,height:160,thickness:.5},
  limits:{length:[40,500],width:[25,350],height:[40,600]},
  sizeRule:BOARD_SIZE_RULE,
  reaRef:{
    code:'PairWithWindow',
    sampleNum:'100014',
    faceMap:{front:'F',back:'H',right:'FR',left:'FL'}
  },
  paramDefs:[
    ...PAIR_PARAM_DEFS,
    pdef('X2','开窗宽','开窗',(p)=>round(p.width),{min:10,max:400}),
    pdef('Y3','开窗 Y 定位','开窗',(p)=>round(p.height*.22),{min:5,max:200}),
    pdef('Y4','开窗高','开窗',(p)=>round(p.height*.44),{min:10,max:300}),
    pdef('XR','开窗倒角','开窗',()=>5,{min:0,max:20})
  ],
  hingeAngles:{topLid:88,bottomLid:88},
  closedCheck:pairClosedCheck(),
  layout(args){
    const {params}=args
    return layoutPairTube({
      ...args,
      mode:'ste',
      extra:{
        window:{w:params.X2,h:params.Y4,yRel:params.Y3,r:params.XR}
      }
    })
  }
}
