import type { Locale } from '../i18n'

export type ToolId =
  | 'cbm'
  | 'container'
  | 'freight'
  | 'cost'
  | 'labels'
  | 'packing'
  | 'audit'
  | 'nesting'
  | 'warehouse'
  | 'invoice'
  | 'units'
  | 'dieline'
  | 'pallet'

export type LocalizedTriple = Record<Locale, string>

export type ToolSeoEntry = {
  id: ToolId
  slug: string
  title: LocalizedTriple
  description: LocalizedTriple
  /** Visible crawlable body (no JS required). */
  body: LocalizedTriple
  priority: 'high' | 'normal'
}

export const TOOL_SEO: ToolSeoEntry[] = [
  {
    id: 'cbm',
    slug: 'cbm-calculator',
    priority: 'high',
    title: {
      en: 'CBM & volumetric weight calculator',
      zh: 'CBM / 体积重计算器',
      ko: 'CBM·부피중량 계산기',
    },
    description: {
      en: 'Calculate carton CBM, gross weight and chargeable weight with shipment / per-SKU / per-piece modes.',
      zh: '计算纸箱 CBM、毛重与计费重，支持整票/按SKU/逐件模式。',
      ko: '박스 CBM·총중량·운임중량을 전체/SKU/개별 모드로 계산합니다.',
    },
    body: {
      en: 'Input L×W×H (cm), weight (kg) and qty. Chargeable weight = max(gross, volumetric). Demo only — not a carrier quote.',
      zh: '输入长宽高(cm)、重量(kg)与数量。计费重=max(毛重,体积重)。演示用途，非承运商报价。',
      ko: '가로×세로×높이(cm), 중량(kg), 수량을 입력하세요. 운임중량=max(총중량,부피중량). 데모이며 운임 견적이 아닙니다.',
    },
  },
  {
    id: 'container',
    slug: 'container-loading',
    priority: 'high',
    title: {
      en: 'Container loading planner',
      zh: '集装箱装柜优化',
      ko: '컨테이너 적재 계산',
    },
    description: {
      en: 'Heuristic 3D mixed-SKU container packing with unload reasons and printable load guide.',
      zh: '多规格三维装柜启发式规划，含未装原因与可打印装载指导。',
      ko: '다규격 3D 컨테이너 적재, 미적재 사유와 인쇄용 가이드 제공.',
    },
    body: {
      en: 'Supports 20GP/40GP/40HQ. Geometry advice only — not compression or lashing certification. Import Korean Excel via shared mapping.',
      zh: '支持 20GP/40GP/40HQ。仅几何建议，非抗压/绑扎认证。可通过韩英表头导入 Excel。',
      ko: '20GP/40GP/40HQ 지원. 기하 제안만 해당(압축·고박 인증 아님). 한·영 엑셀 매핑으로 가져오기 가능.',
    },
  },
  {
    id: 'pallet',
    slug: 'pallet-loading',
    priority: 'high',
    title: {
      en: 'Pallet loading (T11/T12)',
      zh: '卡板装载（T11/T12）',
      ko: '파렛트 적재 계산기 (T11/T12)',
    },
    description: {
      en: 'Korea-first T11/T12 pallet presets with layered printable load guides.',
      zh: '韩国优先 T11/T12 卡板预设与分层装载报告。',
      ko: '한국형 T11/T12 프리셋과 층별 적재 가이드.',
    },
    body: {
      en: 'Default T11 1100×1100 mm. Checks bounds, support and weight only. Export PDF/CSV load guide for warehouse handoff.',
      zh: '默认 T11 1100×1100 mm。仅检查边界/支撑/重量。可导出 PDF/CSV 装载指导交给仓库。',
      ko: '기본 T11 1100×1100 mm. 경계·지지·중량만 검사. 창고 전달용 PDF/CSV 가이드 내보내기.',
    },
  },
  {
    id: 'packing',
    slug: 'packing-list',
    priority: 'high',
    title: {
      en: 'Packing list generator',
      zh: '装箱单生成',
      ko: '패킹리스트 작성',
    },
    description: {
      en: 'Editable packing list with Korean sample import and CSV/XLSX/PDF export.',
      zh: '可编辑装箱单，支持韩文样例导入与 CSV/XLSX/PDF 导出。',
      ko: '편집 가능한 패킹리스트, 한국어 샘플 가져오기 및 CSV/XLSX/PDF 내보내기.',
    },
    body: {
      en: 'Import 품명/수량/총중량 headers. Sync from shared cargo or lock imported lines. Not a customs filing system.',
      zh: '支持품명/수량/총중량 等表头导入。可从货表同步或锁定导入行。非报关系统。',
      ko: '품명/수량/총중량 헤더 가져오기. 화물표 동기화 또는 가져오기 잠금. 관세 신고 시스템이 아닙니다.',
    },
  },
  {
    id: 'audit',
    slug: 'packing-list-checker',
    priority: 'high',
    title: {
      en: 'Invoice / packing list checker',
      zh: '发票与装箱单核对',
      ko: '인보이스·패킹리스트 대조',
    },
    description: {
      en: 'Diff two tables by SKU/carton/PO with row-level fix hints.',
      zh: '按 SKU/箱号/PO 对比双表，输出带行号的修复提示。',
      ko: 'SKU/카톤/PO로 두 표를 대조하고 행 단위 수정 힌트를 제공합니다.',
    },
    body: {
      en: 'Load KR mismatch demo or import expected/actual CSV/XLSX. Export diff CSV/XLSX/PDF. Demo verification only.',
      zh: '可加载韩文差异演示或导入期望/实绩表。导出差异 CSV/XLSX/PDF。仅演示核对。',
      ko: '한국어 차이 데모 또는 기대/실적 CSV/XLSX 가져오기. 차이 CSV/XLSX/PDF 내보내기. 데모 검증용.',
    },
  },
  {
    id: 'invoice',
    slug: 'commercial-invoice',
    priority: 'high',
    title: {
      en: 'Commercial invoice',
      zh: '商业发票',
      ko: '상업송장 생성',
    },
    description: {
      en: 'Incoterms, payment terms and Korean-capable PDF invoice export.',
      zh: '贸易术语、付款条件与支持韩文的 PDF 发票导出。',
      ko: '인코텀즈·결제조건과 한국어 PDF 송장 내보내기.',
    },
    body: {
      en: 'Does not auto-generate customs declarations. Import lines from Korean Excel templates.',
      zh: '不自动生成报关单。可从韩文 Excel 模板导入明细。',
      ko: '관세 신고서를 자동 생성하지 않습니다. 한국어 엑셀 템플릿에서 행을 가져올 수 있습니다.',
    },
  },
  {
    id: 'freight',
    slug: 'freight-comparison',
    priority: 'normal',
    title: { en: 'Freight comparison', zh: '物流运费比较', ko: '운임 비교' },
    description: {
      en: 'Compare simulated quotes with FX-aware cheapest ranking.',
      zh: '比较模拟报价，跨币种需汇率后才排名最低价。',
      ko: '시뮬레이션 운임 비교, 환율 반영 후에만 최저가 순위.',
    },
    body: {
      en: 'User-entered sample rates only — not live carrier APIs.',
      zh: '仅用户录入的示例费率，非实时承运商接口。',
      ko: '사용자가 입력한 예시 운임만 사용합니다. 실시간 운임 API가 아닙니다.',
    },
  },
  {
    id: 'cost',
    slug: 'packaging-cost',
    priority: 'normal',
    title: { en: 'Packaging cost', zh: '包装物流成本', ko: '포장·물류 비용' },
    description: {
      en: 'A/B cost with waste, storage and tax.',
      zh: '含损耗、仓储与税费的 A/B 成本对比。',
      ko: '폐기·보관·세금 포함 A/B 비용 비교.',
    },
    body: {
      en: 'Planning estimates only.',
      zh: '仅供规划估算。',
      ko: '계획용 추정치입니다.',
    },
  },
  {
    id: 'labels',
    slug: 'shipping-labels',
    priority: 'normal',
    title: { en: 'Shipping labels', zh: '箱唛与标签', ko: '배송 라벨' },
    description: {
      en: 'Code128/QR carton marks with print size.',
      zh: 'Code128/QR 箱唛与打印尺寸。',
      ko: 'Code128/QR 마크와 인쇄 크기.',
    },
    body: {
      en: 'Browser print / PDF. Verify printer calibration.',
      zh: '浏览器打印/PDF。请核对打印机校准。',
      ko: '브라우저 인쇄/PDF. 프린터 보정을 확인하세요.',
    },
  },
  {
    id: 'nesting',
    slug: 'sheet-nesting',
    priority: 'normal',
    title: { en: 'Sheet nesting', zh: '纸板排版优化', ko: '원지 배치 최적화' },
    description: {
      en: 'Multi-SKU MaxRects / Guillotine nesting.',
      zh: '多规格 MaxRects / Guillotine 排版。',
      ko: '다규격 MaxRects / Guillotine 배치.',
    },
    body: {
      en: 'Rectangular nesting demo — not production die-line validation.',
      zh: '矩形排版演示，非生产刀版验证。',
      ko: '사각 배치 데모이며 생산 칼선 검증이 아닙니다.',
    },
  },
  {
    id: 'warehouse',
    slug: 'warehouse-capacity',
    priority: 'normal',
    title: { en: 'Warehouse capacity', zh: '仓库容量规划', ko: '창고 용량 계획' },
    description: {
      en: 'Racking volume and floor use estimates.',
      zh: '货架容量与地面利用率估算。',
      ko: '랙 용량·면적 활용 추정.',
    },
    body: {
      en: 'Rough capacity model only.',
      zh: '粗略容量模型。',
      ko: '대략적인 용량 모델입니다.',
    },
  },
  {
    id: 'units',
    slug: 'unit-converter',
    priority: 'normal',
    title: { en: 'Unit converter', zh: '单位换算', ko: '단위 변환' },
    description: {
      en: 'Length, mass and volume conversions.',
      zh: '长度、质量与体积单位换算。',
      ko: '길이·무게·부피 단위 변환.',
    },
    body: {
      en: 'Quick unit helpers for packaging workflows.',
      zh: '包装物流场景下的快速单位换算。',
      ko: '포장·물류 워크플로용 빠른 단위 변환.',
    },
  },
  {
    id: 'dieline',
    slug: 'dieline-designer',
    priority: 'normal',
    title: { en: 'Dieline CAD', zh: '参数化刀版 CAD', ko: '칼선 CAD' },
    description: {
      en: '2D dieline, 3D fold preview and export.',
      zh: '2D 刀版、3D 折叠预览与导出。',
      ko: '2D 칼선, 3D 접기 미리보기와 내보내기.',
    },
    body: {
      en: 'Design communication aid — not factory process approval.',
      zh: '设计沟通辅助，非工厂工艺签核。',
      ko: '디자인 소통 보조이며 공장 공정 승인이 아닙니다.',
    },
  },
]

export const TOOL_BY_ID: Record<ToolId, ToolSeoEntry> = Object.fromEntries(
  TOOL_SEO.map((t) => [t.id, t]),
) as Record<ToolId, ToolSeoEntry>

export const TOOL_BY_SLUG: Record<string, ToolSeoEntry> = Object.fromEntries(
  TOOL_SEO.map((t) => [t.slug, t]),
)

export function isLocale(v: string): v is Locale {
  return v === 'en' || v === 'zh' || v === 'ko'
}

export function toolIdFromSlug(slug: string): ToolId | null {
  return TOOL_BY_SLUG[slug]?.id ?? null
}

export function slugFromToolId(id: ToolId): string {
  return TOOL_BY_ID[id].slug
}

export function localeIndex(locale: Locale): 0 | 1 | 2 {
  return locale === 'en' ? 0 : locale === 'zh' ? 1 : 2
}

const LOCALE_KEY = 'packflow.locale'

export function readStoredLocale(): Locale | null {
  try {
    const v = localStorage.getItem(LOCALE_KEY)
    return v && isLocale(v) ? v : null
  } catch {
    return null
  }
}

export function storeLocale(locale: Locale): void {
  try {
    localStorage.setItem(LOCALE_KEY, locale)
  } catch {
    /* ignore */
  }
}

export function homeMeta(locale: Locale): { title: string; description: string } {
  const map: Record<Locale, { title: string; description: string }> = {
    en: {
      title: 'PackFlow Tools | Packaging & logistics calculators',
      description: 'Browser tools for CBM, container/pallet loading, packing lists and shipment checks. EN/中文/한국어.',
    },
    zh: {
      title: 'PackFlow Tools | 包装与物流在线工具',
      description: 'CBM、装柜/卡板、装箱单与出货核对等浏览器工具。支持中/英/韩。',
    },
    ko: {
      title: 'PackFlow Tools | 포장·물류 계산 도구',
      description: 'CBM, 컨테이너/파렛트 적재, 패킹리스트·서류 대조용 브라우저 도구. 한/중/영 지원.',
    },
  }
  return map[locale]
}
