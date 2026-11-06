// REA Aircraft：翻盖邮寄/飞机盒。公式见 docs/REA/Aircraft_openParams_反推公式.md
import {pdef,sideSlotHoles,aabb,CORRUGATED_SIZE_RULE,round,taperRoundFlap,withOutline} from './shared.js'

const FACE_ORDER=Object.freeze([
  'base','back','front','left','right',
  'leftBleed','rightBleed','innerLeft','innerRight',
  'lid','lidLeft','lidRight','lidFront','lidFrontLeft','lidFrontRight',
  'dustLeft','dustRight','rearFlap','rearDustLeft','rearDustRight'
])

export default {
  id:'rea-aircraft',
  label:'REA 飞机盒',
  labelEn:'REA Aircraft Mailer',
  standard:'Aircraft · REA',
  root:'base',
  faceOrder:FACE_ORDER,
  supportsClosedCheck:true,
  defaults:{length:300,width:200,height:60,thickness:1.5},
  limits:{length:[80,800],width:[60,600],height:[20,200]},
  sizeRule:CORRUGATED_SIZE_RULE,
  reaRef:{
    code:'Aircraft',
    sampleNum:'150010',
    // 只对文档已闭合的主面片做金样回归
    faceMap:{
      base:'H',front:'FB',dustLeft:'FBL',dustRight:'FBR',
      lidLeft:'FL',lidRight:'FR',innerLeft:'HL',innerRight:'HR',rearFlap:'HB'
    }
  },
  paramDefs:[
    pdef('N','摇盖宽','角部折翼',(p)=>round(0.4*p.width),{min:10,max:200}),
    pdef('NX','开槽厚 X','角部折翼',()=>3,{min:0,max:10}),
    pdef('NY','开槽厚 Y','角部折翼',()=>3,{min:0,max:10}),
    pdef('K','插孔数量','插脚插孔',()=>2,{min:1,max:4}),
    pdef('SW','插孔长','插脚插孔',(p)=>round(0.2*p.width),{min:5,max:120}),
    pdef('SP','孔距','插脚插孔',(p)=>round(0.4*p.width),{min:10,max:200}),
    pdef('SW1','插脚下宽','插脚插孔',(p)=>round(0.2*p.width-1),{min:4,max:120}),
    pdef('CR','插孔倒角','插脚插孔',()=>2.5,{min:0,max:10}),
    pdef('SX','X 收位','内侧壁',(p,T)=>T>=1?1.5:0.5,{min:0,max:10}),
    pdef('M','侧翼宽','盒盖侧翼',(p,T)=>round(p.height-(T>=1?1.5:0.5)),{min:5,max:200}),
    pdef('DC','内墙总高','内侧壁',(p)=>round(p.height+1.5),{min:10,max:250}),
    pdef('D2','插脚深','内侧壁',(p)=>round(p.height+1.5-3-0.75),{min:5,max:200}),
    pdef('MT','侧翼斜角','盒盖侧翼',()=>20,{min:0,max:45,unit:'°'}),
    pdef('MR','侧翼倒角','盒盖侧翼',()=>15,{min:0,max:40}),
    pdef('TRH','前盖翼高','前盖侧翼',(p)=>round(p.height-8),{min:5,max:200}),
    pdef('TRR','前盖倒角','前盖侧翼',()=>13,{min:0,max:40}),
    pdef('R','OF 倒角','倒角',()=>1.5,{min:0,max:10}),
    pdef('bleedSlot','槽深','插脚插孔',()=>5,{min:2,max:12})
  ],
  hingeAngles:{lid:88,lidFront:88,rearFlap:85,lidLeft:85,lidRight:85},
  closedCheck:{
    pairs:[
      ['lidLeft','left'],['lidRight','right'],
      ['lidFront','front'],['rearFlap','front'],
      ['dustLeft','left'],['dustRight','right']
    ],
    buildBoxes({panel,T}){
      const Lp=panel.length,Wp=panel.width,Hp=panel.height,t=T
      return {
        left:aabb(-Lp/2,0,Hp/2,t/2,Wp/2,Hp/2),
        right:aabb(Lp/2,0,Hp/2,t/2,Wp/2,Hp/2),
        front:aabb(0,Wp/2,Hp/2,Lp/2,t/2,Hp/2),
        back:aabb(0,-Wp/2,Hp/2,Lp/2,t/2,Hp/2),
        lidLeft:aabb(-Lp/2+t,0,Hp-t/2,Hp/2*.4,Wp/2*.9,t/2),
        lidRight:aabb(Lp/2-t,0,Hp-t/2,Hp/2*.4,Wp/2*.9,t/2),
        lidFront:aabb(0,Wp/2-t,Hp/2,Lp/2*.9,t/2,Math.min(Hp*.85,Wp*.4)),
        rearFlap:aabb(0,Wp/2-t,t*2,Lp/2*.5,t/2,Math.min(Hp*.35,20)),
        dustLeft:aabb(-Lp/2+t,Wp/4,Hp/2,t*.8,Hp/2*.7,t/2),
        dustRight:aabb(Lp/2-t,Wp/4,Hp/2,t*.8,Hp/2*.7,t/2)
      }
    }
  },
  layout({panel,T,params}){
    const Lk=panel.length,Wk=panel.width,Hk=panel.height
    const thin=T<1
    const {N,M,DC,NY,K,SW,SP,CR,SX,TRH,MT,MR,TRR}=params
    const bleedSlot=params.bleedSlot||5
    const lidW=thin?Lk-2:Lk-2*bleedSlot
    const lidH=thin?Wk:Wk+T
    const innerH=Math.max(Wk-NY,Wk*.85)
    const ox=DC+bleedSlot+15
    const oy=Hk+lidH+25
    const lidY=oy-Hk-lidH
    const lidFrontY=lidY-Hk
    const lfH=Math.max(Hk-SX,Hk*.8)
    const faces=[
      ['base',ox,oy,Lk,Wk,null,null],
      ['back',ox,oy-Hk,Lk,Hk,'base','top'],
      ['front',ox,oy+Wk,Lk,Hk,'base','bottom'],
      ['left',ox-Hk,oy,Hk,Wk,'base','left'],
      ['right',ox+Lk,oy,Hk,Wk,'base','right'],
      ['leftBleed',ox-Hk-bleedSlot,oy,bleedSlot,Wk,'left','left'],
      ['rightBleed',ox+Lk+Hk,oy,bleedSlot,Wk,'right','right'],
      ['innerLeft',ox-Hk-bleedSlot-DC,oy+(Wk-innerH)/2,DC,innerH,'leftBleed','left'],
      ['innerRight',ox+Lk+Hk+bleedSlot,oy+(Wk-innerH)/2,DC,innerH,'rightBleed','right'],
      ['lid',ox+(Lk-lidW)/2,lidY,lidW,lidH,'back','top'],
      withOutline(['lidLeft',ox+(Lk-lidW)/2-M,lidY,M,lidH,'lid','left'],
        taperRoundFlap(M,lidH,{angleDeg:MT,r:MR,hingeSide:'right'})),
      withOutline(['lidRight',ox+(Lk-lidW)/2+lidW,lidY,M,lidH,'lid','right'],
        taperRoundFlap(M,lidH,{angleDeg:MT,r:MR,hingeSide:'left'})),
      ['lidFront',ox+(Lk-lidW)/2,lidFrontY,lidW,Hk,'lid','top'],
      withOutline(['lidFrontLeft',ox+(Lk-lidW)/2-TRH,lidFrontY,TRH,lfH,'lidFront','left'],
        taperRoundFlap(TRH,lfH,{angleDeg:Math.min(MT,15),r:TRR,hingeSide:'right'})),
      withOutline(['lidFrontRight',ox+(Lk-lidW)/2+lidW,lidFrontY,TRH,lfH,'lidFront','right'],
        taperRoundFlap(TRH,lfH,{angleDeg:Math.min(MT,15),r:TRR,hingeSide:'left'})),
      withOutline(['dustLeft',ox-N,oy+Wk,N,Hk,'front','left'],
        taperRoundFlap(N,Hk,{angleDeg:MT,r:0,hingeSide:'right'})),
      withOutline(['dustRight',ox+Lk,oy+Wk,N,Hk,'front','right'],
        taperRoundFlap(N,Hk,{angleDeg:MT,r:0,hingeSide:'left'})),
      ['rearFlap',ox,oy+Wk+Hk,Lk,M,'front','bottom'],
      withOutline(['rearDustLeft',ox-N,oy+Wk+Hk,N,M,'rearFlap','left'],
        taperRoundFlap(N,M,{angleDeg:MT,r:0,hingeSide:'right'})),
      withOutline(['rearDustRight',ox+Lk,oy+Wk+Hk,N,M,'rearFlap','right'],
        taperRoundFlap(N,M,{angleDeg:MT,r:0,hingeSide:'left'}))
    ]
    const holes=thin?[]:sideSlotHoles({
      Hx:ox,Hy:oy,Lk,Wk,K,SW,SP,bleed:bleedSlot,r:CR
    })
    const arrows={
      length:[{x:ox,y:oy+Wk*.3},{x:ox+Lk,y:oy+Wk*.3}],
      width:[{x:ox+Lk*.7,y:oy},{x:ox+Lk*.7,y:oy+Wk}],
      height:[{x:ox,y:oy-Hk},{x:ox,y:oy}]
    }
    return {faces,arrows,holes}
  }
}
