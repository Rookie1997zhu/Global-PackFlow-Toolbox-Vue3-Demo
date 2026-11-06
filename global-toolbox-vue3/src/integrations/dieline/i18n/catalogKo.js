/**
 * 韩文目录显示名 — 按稳定 id / sourceNum 映射（不改 presets 生成管线）
 */
export const CATALOG_KO={
  subclasses:{
    shipping:'운송 상자',
    mailer:'우편 상자',
    tuck:'끼움형 상자',
    folding:'접이식 상자',
    handle:'손잡이 상자',
    lid:'뚜껑 상자',
    square:'사각 상자',
    other:'기타'
  },
  categories:{
    shipping:'운송 상자'
  },
  ownedGroups:{
    mailer:'플립 우편',
    tuck:'끼움 혀 상자',
    rsc:'개조형 골판상자',
    autolock:'자물쇠 바닥',
    'lid-base':'천지개',
    drawer:'서랍·슬리브',
    food:'식품 플립',
    gift:'선물·진열',
    polygon:'다각형',
    rea:'REA 파라미터'
  },
  templates:{
    'mailer-parametric-demo':'플립 우편 상자',
    'fefco-0427':'힌지 우편 상자',
    'mailer-aircraft':'항공기형 상자',
    'tuck-end-straight':'직삽 끼움 상자',
    'tuck-end-reverse':'역삽 끼움 상자',
    'tuck-window':'창 끼움 상자',
    'hanging-tuck':'걸이구멍 끼움',
    'zipper-tuck':'지퍼 끼움 상자',
    'fefco-0201':'개조형 골판상자',
    'auto-lock-bottom':'자물쇠 바닥 상자',
    'handle-box':'손잡이 상자',
    'lid-base':'천지개',
    sleeve:'슬리브',
    'drawer-tray':'서랍 트레이',
    'pizza-clamshell':'식품 플립 상자',
    'magnetic-rigid':'자석 플립',
    'display-pdq':'진열 트레이',
    'polygon-tray':'다각형 트레이',
    'rea-aircraft':'REA 항공기형',
    'rea-carton-0201':'REA 개조형 골판상자',
    'rea-pair-ste':'REA 직삽 끼움',
    'rea-pair-rte':'REA 역삽 끼움',
    'rea-pair-window':'REA 창 끼움',
    'rea-pair-hook':'REA 걸이구멍 끼움',
    'rea-buckle-nail':'REA 버클 선물상자',
    'rea-cover-basset':'REA 천지개',
    'rea-bufferwall':'REA 완충 트레이',
    'rea-roofflat-handle':'REA 손잡이 상자',
    'rea-display-multi':'REA 다기능 진열',
    'rea-double-door-lock':'REA 양문 자물쇠',
    'rea-tear-self-lock':'REA 뜯기 자물쇠',
    'rea-curve-box':'REA 곡선 창 상자',
    'rea-flat-sheet':'REA 평판 전개도',
    'rea-star-box':'REA 별형 상자',
    'sleeve-drawer':'서랍·슬리브',
    'cylinder-box':'원통 상자'
  },
  pieces:{
    bottom:'하단',
    lid:'뚜껑',
    drawer:'서랍',
    sleeve:'슬리브',
    wall0:'벽면'
  },
  /** sourceNum → 韩文名；无专名时用通式 */
  presets:{
    '102040':'끼움형 제품 상자',
    '102041':'자동 바닥 삼중 우편 상자',
    '103020':'양면 개방 운송 상자',
    '103021':'양면 개방 운송 상자',
    '110171':'절취선 운송 상자',
    '110680':'사각 운송 상자',
    '110810':'끼움혀 운송 상자',
    '112010':'플랫 우편함',
    '112470':'버클 선물 운송 상자',
    '112471':'버클 운송 상자',
    '112480':'삼중 잠금 운송 상자',
    '112481':'역잠금 운송 상자',
    '112511':'끼움 운송 상자',
    '116200':'손잡이 상자',
    '152102':'맞춤 자물쇠 우편 상자',
    '153031':'플립 우편 상자',
    '156090':'개방형 골판상자',
    '156131':'비가착 측 장붓 운송 상자',
    '200010':'0201 운송 골판상자',
    '200012':'운반 구멍 운송 골판상자',
    '200013':'0209 일반 운송 골판상자',
    '200014':'신선 과일 운송 골판상자',
    '200015':'완충 운송 상자',
    '200016':'골판 운송 상자',
    '200017':'골판 운송 상자',
    '200020':'골판상자 0202 국제표준',
    '200030':'0203 국제표준 운송 골판상자',
    '200034':'지퍼 운송 상자',
    '200035':'지퍼 운송 상자',
    '200100':'평뚜껑 운송 골판상자',
    '200102':'운반 구멍 운송 골판상자 AB면',
    '200200':'접이식 운송 상자',
    '200210':'이동용 골판지',
    '200230':'육칸 운송 골판상자',
    '200240':'6칸 삽입물 운송 골판상자',
    '200250':'6칸 접이식 운송 상자',
    '200280':'잠금 삽입 운송 골판상자',
    '201012':'평구 운송 상자',
    '201013':'무바닥 골판 운송 상자',
    '201015':'무바닥 골판상자',
    '201080':'손잡이 운송 상자',
    '201081':'통기공 운송 골판상자',
    '205010':'판지 운송 상자',
    '205011':'판지 운송 상자',
    '206080':'접이식 배송 상자',
    '20001001':'사각 운송 상자',
    '20001002':'약상자'
  }
}

/** 按 preset 解析韩文名；无则通式「운송 상자 · {编号}」 */
export function koPresetLabel(preset){
  if(!preset)return ''
  const num=String(preset.sourceNum||'')
  if(num&&CATALOG_KO.presets[num])return CATALOG_KO.presets[num]
  if(preset.id&&CATALOG_KO.presets[preset.id])return CATALOG_KO.presets[preset.id]
  if(num)return `운송 상자 · ${num}`
  return ''
}

/** 收集某 preset 可搜索的韩文别名 */
export function koSearchAliases(preset){
  const out=[]
  const pl=koPresetLabel(preset)
  if(pl)out.push(pl)
  for(const id of preset.subclassIds||[]){
    const s=CATALOG_KO.subclasses[id]
    if(s)out.push(s)
  }
  const cat=CATALOG_KO.categories[preset.categoryId]
  if(cat)out.push(cat)
  if(preset.templateId){
    const tl=CATALOG_KO.templates[preset.templateId]
    if(tl)out.push(tl)
  }
  return out
}
