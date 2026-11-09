<script setup lang="ts">
import { computed, ref, watch, defineAsyncComponent, provide } from 'vue'
import { type Locale, messages, categoryKeys } from './i18n'
import { useCargo } from './shared/cargo/useCargo'
import { formatNumber } from './shared/format/number'
import { unitDefs } from './shared/units'
import CbmCalculator from './tools/cbm-calculator/CbmCalculator.vue'
import FreightComparison from './tools/freight-comparison/FreightComparison.vue'
import SheetNesting from './tools/sheet-nesting/SheetNesting.vue'
import CostCalculator from './tools/cost-calculator/CostCalculator.vue'
import PackingList from './tools/packing-list/PackingList.vue'
import CommercialInvoice from './tools/commercial-invoice/CommercialInvoice.vue'
import ShippingLabel from './tools/shipping-label/ShippingLabel.vue'
import DocumentChecker from './tools/document-checker/DocumentChecker.vue'

const DielineTool = defineAsyncComponent(() => import('./integrations/dieline/DielineTool.vue'))
const PalletOptimizer = defineAsyncComponent(() => import('./integrations/pallet/PalletOptimizer.vue'))
const ContainerLoading = defineAsyncComponent(() => import('./tools/container-loading/ContainerLoading.vue'))

type ToolId='cbm'|'container'|'freight'|'cost'|'labels'|'packing'|'audit'|'nesting'|'warehouse'|'invoice'|'units'|'dieline'|'pallet'
const locale=ref<Locale>('en')
provide('hostLocale', locale)
const t=(key:string)=>messages[locale.value][key]||key
const catLabel=(cat:string)=>t(categoryKeys[cat]||cat)
const titles:Record<ToolId,[string,string,string]>={
 cbm:['CBM & volumetric weight','CBM / 体积重计算','CBM / 부피중량 계산'],container:['Container loading','集装箱装柜优化','컨테이너 적재 최적화'],freight:['Freight comparison','物流运费比较','운임 비교'],cost:['Packaging cost','包装物流成本','포장·물류 비용'],labels:['Shipping labels','箱唛与标签','배송 라벨'],packing:['Packing list','装箱单生成','패킹리스트'],audit:['Shipment audit','出货资料核对','출하 자료 검증'],nesting:['Sheet nesting','纸板排版优化','원지 배치 최적화'],warehouse:['Warehouse capacity','仓库容量规划','창고 용량 계획'],invoice:['Commercial invoice','商业发票生成','상업송장 생성'],units:['Unit converter','单位换算','단위 변환'],dieline:['Dieline CAD','参数化刀版 CAD','칼선 CAD'],pallet:['Pallet optimizer','卡板装载优化','팔레트 적재 최적화']}
const descriptions:Record<ToolId,[string,string,string]>={
 cbm:['Volume, gross weight, chargeable weight','体积、毛重、计费重量','부피·총중량·운임중량'],container:['Heuristic 3D mixed-SKU loading','启发式多规格三维装柜','휴리스틱 다규격 3D 적재'],freight:['Compare configurable sample rates','可配置示例费率比较','설정 가능한 예시 운임 비교'],cost:['A/B cost with waste, storage and tax','损耗/仓储/税费的 A/B 成本对比','폐기·보관·세금 A/B 비용 비교'],labels:['Code128/QR marks with print size','Code128/QR 箱唛与打印尺寸','Code128/QR 마크·인쇄 크기'],packing:['Editable cartons with CSV/XLSX/PDF','可编辑箱规与 CSV/XLSX/PDF','편집 가능 카톤 CSV/XLSX/PDF'],audit:['Import two tables and diff by SKU/carton','双表导入按 SKU/箱号差异核对','SKU/카톤 이중표 대조'],nesting:['Multi-SKU MaxRects / Guillotine nesting','多规格 MaxRects / Guillotine 排版','다규격 MaxRects / Guillotine 배치'],warehouse:['Racking volume and floor use estimates','货架容量与地面利用率估算','랙 용량·면적 활용 추정'],invoice:['Incoterms, payment terms and PDF invoice','贸易术语/付款条件与 PDF 发票','인코텀즈·결제조건·PDF 송장'],units:['Length, mass and volume conversions','长度、质量与体积单位换算','길이·무게·부피 단위 변환'],dieline:['2D dieline, 3D fold preview and export','2D 刀版、3D 折叠预览与导出','2D 칼선·3D 접기 미리보기·내보내기'],pallet:['3D mixed-SKU pallet loading planner','三维多规格卡板装载规划','3D 다규격 팔레트 적재 계획']}
const idx=computed(()=>locale.value==='en'?0:locale.value==='zh'?1:2)
const tools:{id:ToolId;icon:string;category:string;paid:boolean}[]=[
 {id:'cbm',icon:'◫',category:'Freight',paid:false},{id:'container',icon:'▣',category:'Loading',paid:true},{id:'freight',icon:'⇄',category:'Freight',paid:false},{id:'cost',icon:'$',category:'Packaging',paid:false},{id:'labels',icon:'▤',category:'Documents',paid:false},{id:'packing',icon:'☷',category:'Documents',paid:false},{id:'audit',icon:'✓',category:'Documents',paid:true},{id:'nesting',icon:'▦',category:'Packaging',paid:true},{id:'warehouse',icon:'▥',category:'Warehouse',paid:false},{id:'invoice',icon:'▧',category:'Documents',paid:false},{id:'units',icon:'↔',category:'Freight',paid:false},{id:'dieline',icon:'◇',category:'Packaging',paid:true},{id:'pallet',icon:'▰',category:'Loading',paid:true}
]
const active=ref<ToolId|null>(null),search=ref(''),category=ref('All'),showData=ref(false),mobileNav=ref(false),showPricing=ref(false)
const categories=['All','Packaging','Loading','Freight','Documents','Warehouse']
const visibleTools=computed(()=>tools.filter(x=>(category.value==='All'||x.category===category.value)&&(`${titles[x.id].join(' ')} ${descriptions[x.id].join(' ')}`.toLowerCase().includes(search.value.toLowerCase()))))
const { cargo, cbm, gross, qty, goodsValue, addCargo, removeCargo, reset: resetCargo, exportCargo: exportCargoRows, n } = useCargo()
const format=(v:number,d=2)=>formatNumber(v, locale.value, d)
const reset=()=>{resetCargo()}
const exportCargo=()=>exportCargoRows([t('colSku'),t('lengthCm'),t('widthCm'),t('heightCm'),t('weightKg'),t('colQty'),t('unitPriceUsd')])
const heroContainerVol=1203*235*269/1e6
const volUtil=computed(()=>heroContainerVol?cbm.value/heroContainerVol*100:0)
const warehouseL=ref(30),warehouseW=ref(20),warehouseH=ref(6),aislePct=ref(35),rackLevels=ref(3),rackCapacity=ref(2.5)
const usableArea=computed(()=>n(warehouseL.value)*n(warehouseW.value)*(1-Math.min(100,n(aislePct.value))/100))
const warehousePositions=computed(()=>Math.floor(usableArea.value/Math.max(.1,n(rackCapacity.value)))*Math.max(1,Math.floor(n(rackLevels.value))))
const unitType=ref('length'),unitValue=ref(100),unitFrom=ref('cm'),unitTo=ref('in')
const converted=computed(()=>n(unitValue.value)*(unitDefs[unitType.value as 'length'|'mass'|'volume']?.[unitFrom.value]||1)/(unitDefs[unitType.value as 'length'|'mass'|'volume']?.[unitTo.value]||1))
watch(unitType,()=>{const keys=Object.keys(unitDefs[unitType.value as 'length'|'mass'|'volume']);unitFrom.value=keys[0];unitTo.value=keys[1]})
const pricingPlans=computed(()=>[
 {nameKey:'planFree',price:'$0',descKey:'planFreeDesc',features:['planFeatBasic','planFeatLocal','planFeatCsv']},
 {nameKey:'planPro',price:'$12',descKey:'planProDesc',features:['planFeatOpt','planFeatHistory','planFeatCad']},
 {nameKey:'planBusiness',price:'$39',descKey:'planBusinessDesc',features:['planFeatSeats','planFeatBatch','planFeatPriority']},
])
const openTool=(id:ToolId)=>{active.value=id;showData.value=false;mobileNav.value=false;showPricing.value=false;window.scrollTo({top:0,behavior:'smooth'})}
const back=()=>{active.value=null;showData.value=false;showPricing.value=false;mobileNav.value=false;window.scrollTo({top:0,behavior:'smooth'})}
const openSharedData=()=>{showData.value=true;active.value=null;showPricing.value=false;mobileNav.value=false}
const scrollToTools=()=>{category.value='All';requestAnimationFrame(()=>window.document.getElementById('tool-grid')?.scrollIntoView({behavior:'smooth'}))}
const activeCategory=computed(()=>tools.find(x=>x.id===active.value)?.category||'')
const activePaid=computed(()=>!!tools.find(x=>x.id===active.value)?.paid)
</script>

<template>
<div class="shell">
  <aside class="sidebar" :class="{open:mobileNav}">
    <div class="brand" @click="back"><div class="brand-mark">P<span>·</span></div><div><strong>PackFlow</strong><small>{{t('brandTag')}}</small></div></div>
    <div class="sidebar-caption">{{t('workspace')}}</div>
    <button class="nav-link" :class="{selected:!active&&!showData&&!showPricing}" @click="back"><span>▦</span>{{t('overview')}}</button>
    <button class="nav-link" :class="{selected:showData}" @click="showData=true;active=null;showPricing=false;mobileNav=false"><span>▤</span>{{t('shared')}}</button>
    <div class="sidebar-caption">{{t('categories')}}</div>
    <button v-for="cat in categories.slice(1)" :key="cat" class="nav-link" :class="{selected:active&&tools.find(x=>x.id===active)?.category===cat}" @click="category=cat;back()"><span>{{cat==='Packaging'?'◇':cat==='Loading'?'▣':cat==='Freight'?'⇄':cat==='Documents'?'☷':'▥'}}</span>{{catLabel(cat)}}</button>
    <div class="sidebar-bottom"><div class="plan-icon">✦</div><strong>{{t('sidebarTitle')}}</strong><p>{{t('sidebarDesc')}}</p><button class="side-plan" @click="showPricing=true;active=null;showData=false">{{t('pricing')}} ↗</button></div>
  </aside>
  <div class="main-wrap">
    <header class="topbar"><button class="hamburger" @click="mobileNav=!mobileNav">☰</button><div class="breadcrumbs"><span @click="back">{{t('home')}}</span><span class="slash">/</span><strong>{{active?titles[active][idx]:showPricing?t('pricing'):showData?t('shared'):t('tools')}}</strong></div><div class="top-actions"><span class="live-dot"></span><span class="top-status">{{t('status')}}</span><select v-model="locale" class="language"><option value="en">EN</option><option value="zh">中文</option><option value="ko">한국어</option></select><button class="login" @click="showPricing=true;active=null;showData=false">{{t('sign')}}</button></div></header>
    <main class="main">
      <template v-if="!active&&!showData&&!showPricing">
        <section class="hero"><div class="hero-content"><div class="eyebrow">✦ {{t('heroEyebrow')}}</div><h1>{{t('hero')}}</h1><p>{{t('subtitle')}}</p><button class="hero-btn" @click="scrollToTools">{{t('try')}} <span>↗</span></button><div class="hero-pills"><span>✓ 13 {{t('toolsCount')}}</span><span>✓ EN / 中文 / 한국어</span><span>✓ {{t('noInstall')}}</span></div></div><div class="hero-art"><div class="art-grid"></div><div class="floating-card card-a"><span>◫</span><div><small>{{t('volumeCalculated')}}</small><strong>{{format(cbm)}} m³</strong></div></div><div class="floating-card card-b"><span>▣</span><div><small>{{t('loadingAnalysis')}}</small><strong>{{format(volUtil,1)}}% {{t('capacityLabel')}}</strong></div></div><div class="art-box box-one"></div><div class="art-box box-two"></div><div class="art-box box-three"></div></div></section>
        <div class="stats"><div><span class="stat-symbol">◫</span><strong>13</strong><small>{{t('ready')}}</small></div><div><span class="stat-symbol">◇</span><strong>2</strong><small>{{t('tagPro')}}</small></div><div><span class="stat-symbol">◎</span><strong>3</strong><small>{{t('languages')}}</small></div><div><span class="stat-symbol">↗</span><strong>100%</strong><small>{{t('browserBased')}}</small></div></div>
        <div class="section-head" id="tool-grid"><div><div class="eyebrow dark">{{t('exploreCreate')}}</div><h2>{{t('library')}}</h2><p>{{t('librarySub')}}</p></div><div class="search-wrap"><span>⌕</span><input v-model="search" :placeholder="t('search')" /></div></div>
        <div class="chips"><button v-for="cat in categories" :key="cat" :class="{active:category===cat}" @click="category=cat">{{catLabel(cat)}}</button></div>
        <div class="tool-grid"><button v-for="tool in visibleTools" :key="tool.id" class="tool-card" @click="openTool(tool.id)"><div class="tool-card-top"><span class="tool-icon" :class="tool.category.toLowerCase()">{{tool.icon}}</span><span class="tag">{{tool.paid?t('tagPro'):t('tagFree')}}</span></div><h3>{{titles[tool.id][idx]}}</h3><p>{{descriptions[tool.id][idx]}}</p><div class="tool-card-bottom"><span>{{catLabel(tool.category)}}</span><strong>↗</strong></div></button></div><p v-if="!visibleTools.length" class="empty">{{t('empty')}}</p>
        <div class="bottom-banner"><div><span class="eyebrow">{{t('bannerEyebrow')}}</span><h2>{{t('bannerTitle')}}</h2><p>{{t('bannerDesc')}}</p></div><button @click="showPricing=true">{{t('pricing')}} →</button></div>
      </template>
      <template v-else-if="showPricing">
        <div class="page-heading"><button class="back" @click="back">← {{t('all')}}</button><div class="eyebrow dark">{{t('pricingEyebrow')}}</div><h1>{{t('pricing')}}</h1><p>{{t('billing')}}</p></div><div class="pricing-grid"><div v-for="plan in pricingPlans" :key="plan.nameKey" class="price-card"><h3>{{t(plan.nameKey)}}</h3><strong>{{plan.price}}<small> {{t('perMonth')}}</small></strong><p>{{t(plan.descKey)}}</p><ul><li v-for="f in plan.features" :key="f">✓ {{t(f)}}</li></ul><button disabled>{{t('comingLater')}}</button></div></div>
      </template>
      <template v-else-if="showData">
        <div class="page-heading"><button class="back" @click="back">← {{t('all')}}</button><div class="eyebrow dark">{{t('sharedEyebrow')}}</div><h1>{{t('shared')}}</h1><p>{{t('sharedDesc')}}</p></div><div class="panel"><div class="panel-heading"><h3>{{t('cargoItems')}}</h3><div class="btn-row"><button class="btn-secondary" @click="reset">{{t('reset')}}</button><button class="btn-secondary" @click="exportCargo">{{t('export')}}</button><button class="btn-primary" @click="addCargo">+ {{t('add')}}</button></div></div><div class="table-scroll"><table><thead><tr><th>{{t('name')}}</th><th>{{t('length')}} cm</th><th>{{t('width')}} cm</th><th>{{t('height')}} cm</th><th>{{t('weight')}} kg</th><th>{{t('quantity')}}</th><th>{{t('price')}} USD</th><th></th></tr></thead><tbody><tr v-for="(c,i) in cargo" :key="i"><td><input v-model="c.sku" class="cell-name" /></td><td><input v-model.number="c.length" type="number" min="0" /></td><td><input v-model.number="c.width" type="number" min="0" /></td><td><input v-model.number="c.height" type="number" min="0" /></td><td><input v-model.number="c.weight" type="number" min="0" step="0.1" /></td><td><input v-model.number="c.qty" type="number" min="0" step="1" /></td><td><input v-model.number="c.price" type="number" min="0" step="0.1" /></td><td><button class="remove" @click="removeCargo(i)">×</button></td></tr></tbody></table></div><div class="data-summary"><span>{{qty}} {{t('pcs')}}</span><span>{{format(cbm)}} m³</span><span>{{format(gross)}} kg</span><span>${{format(goodsValue)}}</span></div></div>
      </template>
      <template v-else-if="active">
        <div class="page-heading"><button class="back" @click="back">← {{t('all')}}</button><div class="eyebrow dark">{{catLabel(activeCategory)}} / {{activePaid?t('proTool'):t('freeTool')}}</div><h1>{{titles[active][idx]}}</h1><p>{{descriptions[active][idx]}}</p></div>
        <DielineTool v-if="active==='dieline'" />
        <PalletOptimizer v-else-if="active==='pallet'" />
        <CbmCalculator v-else-if="active==='cbm'" :t="t" @edit-cargo="openSharedData" />
        <FreightComparison v-else-if="active==='freight'" :t="t" @edit-cargo="openSharedData" />
        <SheetNesting v-else-if="active==='nesting'" :t="t" />
        <ContainerLoading v-else-if="active==='container'" :t="t" @edit-cargo="openSharedData" />
        <CostCalculator v-else-if="active==='cost'" :t="t" @edit-cargo="openSharedData" />
        <PackingList v-else-if="active==='packing'" :t="t" @edit-cargo="openSharedData" />
        <CommercialInvoice v-else-if="active==='invoice'" :t="t" @edit-cargo="openSharedData" />
        <ShippingLabel v-else-if="active==='labels'" :t="t" @edit-cargo="openSharedData" />
        <DocumentChecker v-else-if="active==='audit'" :t="t" @edit-cargo="openSharedData" />
        <template v-else>
          <div class="tool-layout"><div class="tool-settings"><div class="panel"><div class="panel-heading"><h3>{{t('settings')}}</h3><span class="small-badge">{{t('live')}}</span></div>
            <template v-if="active==='warehouse'"><label class="field">{{t('warehouseLength')}}<input v-model.number="warehouseL" type="number" min="0" /></label><label class="field">{{t('warehouseWidth')}}<input v-model.number="warehouseW" type="number" min="0" /></label><label class="field">{{t('warehouseHeight')}}<input v-model.number="warehouseH" type="number" min="0" /></label><label class="field">{{t('aislePct')}}<input v-model.number="aislePct" type="number" min="0" max="100" /></label><label class="field">{{t('rackLevels')}}<input v-model.number="rackLevels" type="number" min="1" /></label><label class="field">{{t('floorPerPosition')}}<input v-model.number="rackCapacity" type="number" min="0.1" step="0.1" /></label></template>
            <template v-if="active==='units'"><label class="field">{{t('quantityType')}}<select v-model="unitType"><option value="length">{{t('unitLength')}}</option><option value="mass">{{t('unitMass')}}</option><option value="volume">{{t('unitVolume')}}</option></select></label><label class="field">{{t('value')}}<input v-model.number="unitValue" type="number" /></label><label class="field">{{t('from')}}<select v-model="unitFrom"><option v-for="u in Object.keys(unitDefs[unitType as 'length'|'mass'|'volume'])" :key="u">{{u}}</option></select></label><label class="field">{{t('to')}}<select v-model="unitTo"><option v-for="u in Object.keys(unitDefs[unitType as 'length'|'mass'|'volume'])" :key="u">{{u}}</option></select></label></template>
          </div></div>
          <div class="tool-output"><div class="panel output-panel"><div class="panel-heading"><h3>{{t('results')}}</h3><span class="small-badge light">{{t('autoUpdated')}}</span></div>
            <template v-if="active==='warehouse'"><div class="metric-grid"><div class="metric primary"><span>{{t('usableStorage')}}</span><strong>{{format(usableArea)}}<small> m²</small></strong></div><div class="metric"><span>{{t('palletPositions')}}</span><strong>{{format(warehousePositions,0)}}</strong></div><div class="metric"><span>{{t('buildingVolume')}}</span><strong>{{format(warehouseL*warehouseW*warehouseH)}}<small> m³</small></strong></div><div class="metric"><span>{{t('grossFloorArea')}}</span><strong>{{format(warehouseL*warehouseW)}}<small> m²</small></strong></div></div><div class="warehouse-view"><div class="aisle">{{t('aisleOther')}}</div><div class="racks"><span v-for="i in 18" :key="i">▥</span></div></div><p class="field-hint">{{t('warehouseHint')}}</p></template>
            <template v-if="active==='units'"><div class="unit-answer"><small>{{t('convertedValue')}}</small><strong>{{format(converted,6)}}</strong><span>{{unitTo}}</span></div><div class="unit-formula">{{format(unitValue,4)}} {{unitFrom}} = {{format(converted,6)}} {{unitTo}}</div></template>
          </div><div class="hint-box">ⓘ {{t('disclaimer')}}</div></div></div>
        </template>
      </template>
    </main><footer class="footer"><span>{{t('footerCopy')}}</span><span>EN · 中文 · 한국어 &nbsp; | &nbsp; {{t('footerTagline')}}</span></footer>
  </div>
</div>
</template>
