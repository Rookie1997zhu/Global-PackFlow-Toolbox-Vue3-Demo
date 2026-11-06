// REA CoverBassetCardboardBox：露底对盖 / 天地盖向
import {pdef,aabb,BOARD_SIZE_RULE,round,chamferRect,withOutline} from './shared.js'

export default {
  id:'rea-cover-basset',
  label:'REA 天地盖',
  labelEn:'REA Cover Basset',
  standard:'CoverBassetCardboardBox · REA',
  root:'base',
  faceOrder:Object.freeze([
    'base','front','back','left','right',
    'frontDustL','frontDustR','backDustL','backDustR'
  ]),
  supportsClosedCheck:true,
  supportsPiece:true,
  defaults:{length:120,width:90,height:40,thickness:.5,lidClearance:2},
  limits:{length:[40,600],width:[30,500],height:[15,200]},
  sizeRule:BOARD_SIZE_RULE,
  reaRef:{
    code:'CoverBassetCardboardBox',
    sampleNum:'161012',
    faceMap:{base:'H',front:'HT',back:'HB'}
  },
  paramDefs:[
    pdef('W1','侧翼宽','盖盒',(p)=>round(p.width/3),{min:8,max:120}),
    pdef('OH','外沿余量','盖盒',()=>20,{min:5,max:40}),
    pdef('TC','顶倒角','盖盒',()=>15,{min:0,max:40}),
    pdef('TD','盖深相关','盖盒',(p)=>round(p.height*.75),{min:5,max:150}),
    pdef('OF','外倒角','倒角',()=>1,{min:0,max:10}),
    pdef('C','收位','倒角',()=>2,{min:0,max:20})
  ],
  hingeAngles:{front:88,back:88,left:88,right:88},
  closedCheck:{
    pairs:[['left','back'],['right','back'],['left','front'],['right','front']],
    buildBoxes({panel,T,piece='bottom',lidClearance=2}){
      const c=piece==='lid'?Math.max(0,Number(lidClearance)||0):0
      const Lp=panel.length+2*c,Wp=panel.width+2*c,Hp=panel.height,t=T
      return {
        base:aabb(0,0,0,Lp/2,Wp/2,t/2),
        back:aabb(0,-Wp/2,Hp/2,Lp/2,t/2,Hp/2),
        front:aabb(0,Wp/2,Hp/2,Lp/2,t/2,Hp/2),
        left:aabb(-Lp/2,0,Hp/2,t/2,Wp/2,Hp/2),
        right:aabb(Lp/2,0,Hp/2,t/2,Wp/2,Hp/2)
      }
    }
  },
  layout({panel,T,params,piece='bottom',lidClearance=2}){
    const Lp=panel.length,Wp=panel.width,Hp=panel.height
    const W1=params.W1,OH=params.OH
    const isLid=piece==='lid'
    const add=isLid?Math.max(0,lidClearance)+2:0
    const Lw=Lp+add,Ww=Wp+add
    const wallH=isLid?Math.min(params.TD||Hp*.75,Hp+5):Hp
    const ox=W1+20,oy=wallH+20
    const TC=params.TC||0
    const faces=[
      ['base',ox,oy,Lw,Ww,null,null],
      ['front',ox,oy+Ww,Lw,wallH,'base','bottom'],
      ['back',ox,oy-wallH,Lw,wallH,'base','top'],
      ['left',ox-W1,oy,W1,Ww,'base','left'],
      ['right',ox+Lw,oy,W1,Ww,'base','right'],
      // 防尘翼自由端两角斜切（铰链边保持满高）
      withOutline(['frontDustL',ox-W1,oy+Ww,W1,wallH,'front','left'],
        chamferRect(W1,wallH,{tl:TC,tr:0,bl:TC,br:0})),
      withOutline(['frontDustR',ox+Lw,oy+Ww,W1,wallH,'front','right'],
        chamferRect(W1,wallH,{tl:0,tr:TC,bl:0,br:TC})),
      withOutline(['backDustL',ox-W1,oy-wallH,W1,wallH,'back','left'],
        chamferRect(W1,wallH,{tl:TC,tr:0,bl:TC,br:0})),
      withOutline(['backDustR',ox+Lw,oy-wallH,W1,wallH,'back','right'],
        chamferRect(W1,wallH,{tl:0,tr:TC,bl:0,br:TC}))
    ]
    const arrows={
      length:[{x:ox,y:oy+Ww*.3},{x:ox+Lw,y:oy+Ww*.3}],
      width:[{x:ox+Lw*.7,y:oy},{x:ox+Lw*.7,y:oy+Ww}],
      height:[{x:ox,y:oy-wallH},{x:ox,y:oy}]
    }
    return {faces,arrows}
  }
}
