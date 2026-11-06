// REA PairWithHook：管式插舌 + 挂舌/挂孔
import {
  PAIR_FACE_ORDER_HOOK,PAIR_PARAM_DEFS,pairClosedCheck,layoutPairTube,BOARD_SIZE_RULE,pdef,aabb,round
} from './shared.js'

export default {
  id:'rea-pair-hook',
  label:'REA 挂孔插舌盒',
  labelEn:'REA Pair With Hook',
  standard:'PairWithHook · REA',
  root:'front',
  faceOrder:PAIR_FACE_ORDER_HOOK,
  supportsClosedCheck:true,
  defaults:{length:80,width:40,height:150,thickness:.5},
  limits:{length:[30,400],width:[20,250],height:[40,500]},
  sizeRule:BOARD_SIZE_RULE,
  reaRef:{
    code:'PairWithHook',
    sampleNum:'100020',
    faceMap:{front:'H',back:'F',right:'FR',left:'FL'}
  },
  paramDefs:[
    ...PAIR_PARAM_DEFS,
    pdef('AXX1','挂孔增量','挂孔',(p)=>round(p.length*.009),{min:0,max:10}),
    pdef('hangW','挂舌宽','挂孔',(p)=>round(p.length*.45),{min:10,max:120}),
    pdef('hangH','挂舌高','挂孔',(p)=>round(Math.min(25,p.width*.5)),{min:8,max:50}),
    pdef('holeR','挂孔半径','挂孔',()=>4,{min:2,max:12})
  ],
  hingeAngles:{topLid:88,bottomLid:88},
  closedCheck:pairClosedCheck(),
  layout(args){
    const {panel,params}=args
    const hangW=params.hangW,hangH=params.hangH,holeR=params.holeR
    const out=layoutPairTube({
      ...args,
      mode:'ste',
      extra:{hangTab:{w:hangW,h:hangH}}
    })
    // 挂孔：在 hangTab 中心挖圆孔（用圆角近似正方形）
    const hang=out.faces.find(f=>f[0]==='hangTab')
    if(hang){
      const [,x,y,w,h]=hang
      const d=holeR*2
      out.holes.push({
        x:x+(w-d)/2,
        y:y+(h-d)/2,
        w:d,h:d,r:holeR
      })
    }
    return out
  }
}
