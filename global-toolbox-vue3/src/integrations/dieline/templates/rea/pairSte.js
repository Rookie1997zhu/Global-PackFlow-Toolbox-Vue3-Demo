// REA Pair STE：直插管式插舌盒
import {
  PAIR_FACE_ORDER,PAIR_PARAM_DEFS,pairClosedCheck,layoutPairTube,BOARD_SIZE_RULE
} from './shared.js'

export default {
  id:'rea-pair-ste',
  label:'REA 直插插舌盒',
  labelEn:'REA Pair STE',
  standard:'Pair · STE · REA',
  root:'front',
  faceOrder:PAIR_FACE_ORDER,
  supportsClosedCheck:true,
  defaults:{length:120,width:60,height:160,thickness:.5},
  limits:{length:[40,500],width:[25,350],height:[40,600]},
  sizeRule:BOARD_SIZE_RULE,
  reaRef:{
    code:'Pair',
    sampleNum:'100010',
    faceMap:{front:'H',back:'F',right:'FR',left:'FL'}
  },
  paramDefs:PAIR_PARAM_DEFS,
  hingeAngles:{topLid:88,bottomLid:88},
  closedCheck:pairClosedCheck(),
  layout(args){
    return layoutPairTube({...args,mode:'ste'})
  }
}
