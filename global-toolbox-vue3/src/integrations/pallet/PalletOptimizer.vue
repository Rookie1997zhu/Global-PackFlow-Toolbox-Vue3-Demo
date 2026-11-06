<script setup lang="ts">
import {ref,computed,watch} from 'vue'
import {Package,Boxes,Plus,Trash2,RotateCcw,Calculator,Download,Layers3,Info,ChevronLeft,ChevronRight} from 'lucide-vue-next'
import {pack,type Carton,type Config} from './packing'
import Pallet3D from './Pallet3D.vue'
import './pallet.css'

const config=ref<Config>({l:1200,w:1000,h:150,maxHeight:1600,maxWeight:1000,palletKg:20})
const cartons=ref<Carton[]>([{id:1,name:'A · 电子配件',l:400,w:300,h:250,qty:30,kg:8,color:'#5385dc',stackable:true},{id:2,name:'B · 包装组件',l:300,w:250,h:200,qty:40,kg:5,color:'#33ad99',stackable:true},{id:3,name:'C · 展示配件',l:500,w:400,h:300,qty:15,kg:12,color:'#eead61',stackable:true}])
const palette=['#5385dc','#33ad99','#eead61','#ad85e9','#e9778e','#6ba7bd']
const mode=ref<'mixed'|'single'>('mixed')
const viewMode=ref<'2d'|'3d'>('3d')
const result=ref(pack(config.value,cartons.value))
const active=ref(0),level=ref(-1),computedAt=ref('')
const selected=computed(()=>result.value.pallets[active.value])
const layers=computed(()=>selected.value?[...new Set(selected.value.boxes.map(b=>b.z))].sort((a,b)=>a-b):[])
const shown=computed(()=>selected.value?.boxes.filter(b=>level.value===-1||b.z===level.value)||[])
const packedVolume=computed(()=>result.value.pallets.reduce((s,p)=>s+p.boxes.reduce((v,b)=>v+b.l*b.w*b.h/1e9,0),0))
const utilization=computed(()=>result.value.pallets.length?packedVolume.value/result.value.pallets.reduce((s,p)=>s+config.value.l*config.value.w*(config.value.maxHeight-config.value.h)/1e9,0)*100:0)
const hasChanged=ref(false)
watch([config,cartons,mode],()=>hasChanged.value=true,{deep:true})
function calculate(){const inputs=mode.value==='single'?cartons.value.slice(0,1):cartons.value;result.value=pack({...config.value},inputs.map(x=>({...x})));active.value=0;level.value=-1;hasChanged.value=false;computedAt.value=new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})}
function add(){cartons.value.push({id:Date.now(),name:`产品 ${cartons.value.length+1}`,l:400,w:300,h:200,qty:10,kg:5,color:palette[cartons.value.length%palette.length],stackable:true})}
function reset(){config.value={l:1200,w:1000,h:150,maxHeight:1600,maxWeight:1000,palletKg:20};cartons.value=[{id:1,name:'A · 电子配件',l:400,w:300,h:250,qty:30,kg:8,color:'#5385dc',stackable:true},{id:2,name:'B · 包装组件',l:300,w:250,h:200,qty:40,kg:5,color:'#33ad99',stackable:true},{id:3,name:'C · 展示配件',l:500,w:400,h:300,qty:15,kg:12,color:'#eead61',stackable:true}];mode.value='mixed';calculate()}
function download(){const payload={version:'DEMO-2.0',config:config.value,cartons:cartons.value,result:result.value};const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='rysen-pallet-plan.json';a.click();URL.revokeObjectURL(a.href)}
function boxStyle(b:any){return {left:`${b.x/config.value.l*100}%`,top:`${b.y/config.value.w*100}%`,width:`${b.l/config.value.l*100}%`,height:`${b.w/config.value.w*100}%`,background:b.color}}
calculate()
</script>

<template>
<div class="pallet-tool">
  <div class="headline">
    <div>
      <div class="eyebrow">LOGISTICS PLANNING / 装载规划</div>
      <h1>智能卡板装箱计算器 <span class="demo">DEMO</span></h1>
      <p>输入卡板与纸箱规格，快速生成装板建议方案。支持单规格与多规格上下堆叠。</p>
    </div>
    <div class="actions">
      <button class="btn secondary" @click="reset"><RotateCcw :size="15"/> 重置示例</button>
      <button class="btn secondary" @click="download"><Download :size="15"/> 导出 JSON</button>
    </div>
  </div>
  <div class="workspace">
    <section class="settings">
      <div class="panel">
        <div class="panelhead"><span class="step">01</span><div><h2>计算模式</h2><small>选择装载方式</small></div></div>
        <div class="modegroup">
          <button :class="['mode',mode==='single'?'selected':'']" @click="mode='single'"><Package :size="20"/><b>单规格装板</b><small>相同尺寸纸箱</small></button>
          <button :class="['mode',mode==='mixed'?'selected':'']" @click="mode='mixed'"><Boxes :size="20"/><b>多规格混装</b><small>不同产品上下堆叠</small></button>
        </div>
      </div>
      <div class="panel">
        <div class="panelhead"><span class="step">02</span><div><h2>卡板参数</h2><small>单位：mm / kg</small></div></div>
        <div class="formgrid three"><label>长度 (mm)<input type="number" v-model.number="config.l" min="1"/></label><label>宽度 (mm)<input type="number" v-model.number="config.w" min="1"/></label><label>板高 (mm)<input type="number" v-model.number="config.h" min="0"/></label></div>
        <div class="formgrid two"><label>最大总高度 (mm)<input type="number" v-model.number="config.maxHeight"/></label><label>最大总重量 (kg)<input type="number" v-model.number="config.maxWeight"/></label></div>
        <div class="formgrid two"><label>卡板自重 (kg)<input type="number" v-model.number="config.palletKg"/></label><div class="fieldnote">最大高度和重量均包含卡板本身。</div></div>
      </div>
      <div class="panel">
        <div class="panelhead row"><span class="step">03</span><div><h2>纸箱清单</h2><small>支持水平旋转 90°</small></div><button v-if="mode==='mixed'" class="textbtn" @click="add"><Plus :size="15"/> 添加规格</button></div>
        <div v-for="(c,i) in (mode==='single'?cartons.slice(0,1):cartons)" :key="c.id" class="carton">
          <div class="cartontop"><span class="color" :style="{background:c.color}"></span><input class="name" v-model="c.name"/><button v-if="cartons.length>1&&mode==='mixed'" class="delete" @click="cartons.splice(i,1)"><Trash2 :size="15"/></button></div>
          <div class="formgrid three"><label>长 (mm)<input type="number" v-model.number="c.l"/></label><label>宽 (mm)<input type="number" v-model.number="c.w"/></label><label>高 (mm)<input type="number" v-model.number="c.h"/></label></div>
          <div class="formgrid two"><label>箱数 (CTN)<input type="number" v-model.number="c.qty" min="0"/></label><label>单箱毛重 (kg)<input type="number" v-model.number="c.kg" min="0"/></label></div>
          <label class="check"><input type="checkbox" v-model="c.stackable"/> 允许在此规格纸箱上方堆叠</label>
        </div>
        <button v-if="mode==='mixed'" class="addline" @click="add"><Plus :size="16"/> 添加另一种纸箱</button>
      </div>
      <button class="calculate" @click="calculate"><Calculator :size="18"/> 开始计算装板方案 <span v-if="hasChanged">· 有修改</span></button>
    </section>
    <section class="results">
      <div class="stats">
        <div class="stat"><span>预计卡板数量</span><strong>{{result.pallets.length}} <small>PLT</small></strong><div class="statfoot">3D 极点候选 · 多策略优化</div></div>
        <div class="stat"><span>已安排纸箱</span><strong>{{result.packedBoxes}} <small>/ {{result.totalBoxes}} CTN</small></strong><div class="statfoot">{{result.unplaced.length?'存在未安排纸箱':'全部已安排'}}</div></div>
        <div class="stat"><span>空间体积利用率</span><strong>{{utilization.toFixed(1)}}<small>%</small></strong><div class="progress"><i :style="{width:Math.min(100,utilization)+'%'}"></i></div></div>
        <div class="stat"><span>货物总体积</span><strong>{{result.volume.toFixed(3)}} <small>m³</small></strong><div class="statfoot">仅纸箱外部体积</div></div>
      </div>
      <div class="panel visual">
        <div class="visualhead">
          <div><h2><Layers3 :size="19"/> 装板布局预览</h2><p>2D / 3D 一键切换 · 按颜色区分产品 · 分层查看</p></div>
          <div class="view-toggle"><button :class="{active:viewMode==='2d'}" @click="viewMode='2d'">2D 俯视</button><button :class="{active:viewMode==='3d'}" @click="viewMode='3d'">3D 立体</button></div>
        </div>
        <div class="toolbar">
          <div class="palnav">
            <button @click="active=Math.max(0,active-1);level=-1" :disabled="active===0"><ChevronLeft :size="16"/></button>
            <b>卡板 {{result.pallets.length?active+1:0}} / {{result.pallets.length}}</b>
            <button @click="active=Math.min(result.pallets.length-1,active+1);level=-1" :disabled="active>=result.pallets.length-1"><ChevronRight :size="16"/></button>
          </div>
          <div class="level"><span>查看层：</span><select v-model.number="level"><option :value="-1">全部层叠加</option><option v-for="(z,i) in layers" :key="z" :value="z">第 {{i+1}} 层 ({{z}}mm)</option></select></div>
        </div>
        <div class="visualbody">
          <div class="canvaswrap">
            <Pallet3D v-if="viewMode==='3d' && selected" :boxes="selected.boxes" :config="config" :selected-level="level"/>
            <div v-if="viewMode==='2d' && selected" class="board" :style="{aspectRatio:`${config.l}/${config.w}`}"><div v-for="(b,i) in shown" :key="i" class="box" :style="boxStyle(b)" :title="`${b.name} · ${b.l}×${b.w}×${b.h} mm · Z=${b.z}`"><span>{{b.name.split(' · ')[0]}}</span></div></div>
            <div v-if="!selected" class="empty">当前条件下没有可展示的装板结果</div>
            <div class="dimension">{{config.l}} × {{config.w}} mm · {{viewMode==='2d'?'俯视图':'三维视图'}}</div>
          </div>
          <div class="details">
            <h3>卡板明细</h3>
            <template v-if="selected">
              <div class="detailrow"><span>装载箱数</span><b>{{selected.boxes.length}} 箱</b></div>
              <div class="detailrow"><span>总重量（含板）</span><b>{{selected.weight.toFixed(1)}} kg</b></div>
              <div class="detailrow"><span>实际装载高度</span><b>{{selected.usedHeight}} mm</b></div>
              <div class="detailrow"><span>堆叠层数</span><b>{{layers.length}} 层</b></div>
              <div class="divider"></div>
              <h3>产品图例</h3>
              <div class="legend" v-for="c in cartons" :key="c.id"><i :style="{background:c.color}"></i><span>{{c.name}}</span><b>{{selected.boxes.filter(b=>b.id===c.id).length}}</b></div>
            </template>
            <div v-else class="mutedtxt">暂无装载数据</div>
          </div>
        </div>
      </div>
      <div class="notice"><Info :size="18"/><div><b>演示版本说明</b><p>当前采用三维候选点搜索、水平旋转、完整底面支撑校验和 8 轮排序优化，并非全局最优。支持不同规格纸箱上下堆叠；未验证抗压强度、重心与运输稳定性，实际装板前须人工复核。</p><p v-if="result.unplaced.length" class="error">未安排：{{result.unplaced.map(x=>x.name+' '+x.qty+'箱').join('、')}}</p><p v-if="hasChanged" class="pending">参数已修改，请点击“开始计算”更新结果。</p></div></div>
      <div class="footer">RYSEN WORKS · 3D Packing Engine V2 · {{result.attempts || 0}} 轮搜索 · {{result.strategy || "—"}} <span>最近计算：{{computedAt}}</span></div>
    </section>
  </div>
</div>
</template>
