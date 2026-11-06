// REA CanCylinder：官方金样为单面平板 F=L×W、H=0（非圆柱卷圆）
import {pdef,FLAT_SIZE_RULE,round,roundRect,withOutline} from './shared.js'

export default {
  id:'rea-flat-sheet',
  label:'REA 平板刀版',
  labelEn:'REA Flat Sheet',
  standard:'CanCylinder · flat sheet · REA',
  root:'sheet',
  faceOrder:Object.freeze(['sheet']),
  supportsClosedCheck:true,
  defaults:{length:100,width:95,height:0,thickness:.5},
  limits:{length:[20,1200],width:[20,1200],height:[0,0]},
  sizeRule:FLAT_SIZE_RULE,
  reaRef:{
    code:'CanCylinder',
    sampleNum:'501202',
    faceMap:{sheet:'F'}
  },
  paramDefs:[
    pdef('R','圆角','外形',()=>0,{min:0,max:80})
  ],
  hingeAngles:{},
  closedCheck:{
    pairs:[],
    buildBoxes(){return {}}
  },
  layout({panel,params}){
    const Lw=panel.length,Ww=panel.width
    const R=Math.max(0,Number(params.R)||0)
    const ox=20,oy=20
    const face=['sheet',ox,oy,Lw,Ww,null,null]
    const faces=[R>0?withOutline(face,roundRect(Lw,Ww,R)):face]
    const arrows={
      length:[{x:ox,y:oy+Ww*.35},{x:ox+Lw,y:oy+Ww*.35}],
      width:[{x:ox+Lw*.7,y:oy},{x:ox+Lw*.7,y:oy+Ww}],
      height:[{x:ox+4,y:oy},{x:ox+4,y:oy}]
    }
    return {faces,arrows}
  }
}
