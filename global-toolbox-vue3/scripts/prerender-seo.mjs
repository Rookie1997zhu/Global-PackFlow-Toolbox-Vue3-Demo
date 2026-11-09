import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const dist = path.join(root, 'dist')
const siteOrigin = (process.env.SITE_ORIGIN || 'https://example.com').replace(/\/$/, '')
const base = (process.env.VITE_BASE || '/').replace(/\/?$/, '/')

const locales = ['en', 'zh', 'ko']

/** Keep in sync with src/seo/toolRegistry.ts + guides.ts (build-time mirror). */
const tools = [
  {
    slug: 'cbm-calculator',
    title: { en: 'CBM & volumetric weight calculator', zh: 'CBM / 体积重计算器', ko: 'CBM·부피중량 계산기' },
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
    slug: 'container-loading',
    title: { en: 'Container loading planner', zh: '集装箱装柜优化', ko: '컨테이너 적재 계산' },
    description: {
      en: 'Heuristic 3D mixed-SKU container packing with unload reasons and printable load guide.',
      zh: '多规格三维装柜启发式规划，含未装原因与可打印装载指导。',
      ko: '다규격 3D 컨테이너 적재, 미적재 사유와 인쇄용 가이드 제공.',
    },
    body: {
      en: 'Supports 20GP/40GP/40HQ. Geometry advice only — not compression or lashing certification.',
      zh: '支持 20GP/40GP/40HQ。仅几何建议，非抗压/绑扎认证。',
      ko: '20GP/40GP/40HQ 지원. 기하 제안만 해당(압축·고박 인증 아님).',
    },
  },
  {
    slug: 'pallet-loading',
    title: { en: 'Pallet loading (T11/T12)', zh: '卡板装载（T11/T12）', ko: '파렛트 적재 계산기 (T11/T12)' },
    description: {
      en: 'Korea-first T11/T12 pallet presets with layered printable load guides.',
      zh: '韩国优先 T11/T12 卡板预设与分层装载报告。',
      ko: '한국형 T11/T12 프리셋과 층별 적재 가이드.',
    },
    body: {
      en: 'Default T11 1100×1100 mm. Checks bounds, support and weight only.',
      zh: '默认 T11 1100×1100 mm。仅检查边界/支撑/重量。',
      ko: '기본 T11 1100×1100 mm. 경계·지지·중량만 검사.',
    },
  },
  {
    slug: 'packing-list',
    title: { en: 'Packing list generator', zh: '装箱单生成', ko: '패킹리스트 작성' },
    description: {
      en: 'Editable packing list with Korean sample import and CSV/XLSX/PDF export.',
      zh: '可编辑装箱单，支持韩文样例导入与 CSV/XLSX/PDF 导出。',
      ko: '편집 가능한 패킹리스트, 한국어 샘플 가져오기 및 CSV/XLSX/PDF 내보내기.',
    },
    body: {
      en: 'Import Korean headers. Not a customs filing system.',
      zh: '支持韩文表头导入。非报关系统。',
      ko: '한국어 헤더 가져오기. 관세 신고 시스템이 아닙니다.',
    },
  },
  {
    slug: 'packing-list-checker',
    title: { en: 'Invoice / packing list checker', zh: '发票与装箱单核对', ko: '인보이스·패킹리스트 대조' },
    description: {
      en: 'Diff two tables by SKU/carton/PO with row-level fix hints.',
      zh: '按 SKU/箱号/PO 对比双表，输出带行号的修复提示。',
      ko: 'SKU/카톤/PO로 두 표를 대조하고 행 단위 수정 힌트를 제공합니다.',
    },
    body: {
      en: 'Structured Excel/CSV verification demo.',
      zh: '结构化 Excel/CSV 核对演示。',
      ko: '구조화 Excel/CSV 대조 데모.',
    },
  },
  {
    slug: 'commercial-invoice',
    title: { en: 'Commercial invoice', zh: '商业发票', ko: '상업송장 생성' },
    description: {
      en: 'Incoterms, payment terms and Korean-capable PDF invoice export.',
      zh: '贸易术语、付款条件与支持韩文的 PDF 发票导出。',
      ko: '인코텀즈·결제조건과 한국어 PDF 송장 내보내기.',
    },
    body: {
      en: 'Does not auto-generate customs declarations.',
      zh: '不自动生成报关单。',
      ko: '관세 신고서를 자동 생성하지 않습니다.',
    },
  },
  {
    slug: 'freight-comparison',
    title: { en: 'Freight comparison', zh: '物流运费比较', ko: '운임 비교' },
    description: {
      en: 'Compare simulated quotes with FX-aware cheapest ranking.',
      zh: '比较模拟报价，跨币种需汇率后才排名最低价。',
      ko: '시뮬레이션 운임 비교, 환율 반영 후에만 최저가 순위.',
    },
    body: { en: 'Sample rates only.', zh: '仅示例费率。', ko: '예시 운임만 사용.' },
  },
  {
    slug: 'packaging-cost',
    title: { en: 'Packaging cost', zh: '包装物流成本', ko: '포장·물류 비용' },
    description: {
      en: 'A/B cost with waste, storage and tax.',
      zh: '含损耗、仓储与税费的 A/B 成本对比。',
      ko: '폐기·보관·세금 포함 A/B 비용 비교.',
    },
    body: { en: 'Planning estimates.', zh: '规划估算。', ko: '계획용 추정치.' },
  },
  {
    slug: 'shipping-labels',
    title: { en: 'Shipping labels', zh: '箱唛与标签', ko: '배송 라벨' },
    description: {
      en: 'Code128/QR carton marks with print size.',
      zh: 'Code128/QR 箱唛与打印尺寸。',
      ko: 'Code128/QR 마크와 인쇄 크기.',
    },
    body: { en: 'Browser print / PDF.', zh: '浏览器打印/PDF。', ko: '브라우저 인쇄/PDF.' },
  },
  {
    slug: 'sheet-nesting',
    title: { en: 'Sheet nesting', zh: '纸板排版优化', ko: '원지 배치 최적화' },
    description: {
      en: 'Multi-SKU MaxRects / Guillotine nesting.',
      zh: '多规格 MaxRects / Guillotine 排版。',
      ko: '다규격 MaxRects / Guillotine 배치.',
    },
    body: { en: 'Rectangular nesting demo.', zh: '矩形排版演示。', ko: '사각 배치 데모.' },
  },
  {
    slug: 'warehouse-capacity',
    title: { en: 'Warehouse capacity', zh: '仓库容量规划', ko: '창고 용량 계획' },
    description: {
      en: 'Racking volume and floor use estimates.',
      zh: '货架容量与地面利用率估算。',
      ko: '랙 용량·면적 활용 추정.',
    },
    body: { en: 'Rough capacity model.', zh: '粗略容量模型。', ko: '대략 용량 모델.' },
  },
  {
    slug: 'unit-converter',
    title: { en: 'Unit converter', zh: '单位换算', ko: '단위 변환' },
    description: {
      en: 'Length, mass and volume conversions.',
      zh: '长度、质量与体积单位换算。',
      ko: '길이·무게·부피 단위 변환.',
    },
    body: { en: 'Quick unit helpers.', zh: '快速单位换算。', ko: '빠른 단위 변환.' },
  },
  {
    slug: 'dieline-designer',
    title: { en: 'Dieline CAD', zh: '参数화刀版 CAD', ko: '칼선 CAD' },
    description: {
      en: '2D dieline, 3D fold preview and export.',
      zh: '2D 刀版、3D 折叠预览与导出。',
      ko: '2D 칼선, 3D 접기 미리보기와 내보내기.',
    },
    body: { en: 'Design communication aid.', zh: '设计沟通辅助。', ko: '디자인 소통 보조.' },
  },
]

const guides = [
  {
    id: 'container-from-excel',
    title: { en: 'Excel → container loading plan', zh: 'Excel → 装柜规划', ko: '엑셀 → 컨테이너 적재 계획' },
    description: {
      en: 'Import a Korean cargo sheet and export a printable load guide.',
      zh: '导入韩文货表并导出可打印装载指导。',
      ko: '한국어 화물표를 가져와 인쇄용 가이드를 내보냅니다.',
    },
    body: {
      en: 'Open /ko/tools/container-loading, load sample, export PDF.',
      zh: '打开装柜工具，加载样例，导出 PDF。',
      ko: '컨테이너 도구를 열고 샘플을 불러와 PDF를 내보내세요.',
    },
  },
  {
    id: 'invoice-pl-check',
    title: { en: 'Invoice vs packing list check', zh: '发票与装箱单核对', ko: '인보이스·패킹리스트 대조' },
    description: {
      en: 'Load the KR mismatch demo and export fix hints.',
      zh: '加载韩文差异演示并导出修复提示。',
      ko: '한국어 차이 데모를 불러와 수정 힌트를 내보냅니다.',
    },
    body: {
      en: 'Use packing-list-checker with expected/actual samples.',
      zh: '使用核对工具与期望/实绩样例。',
      ko: '기대/실적 샘플로 대조 도구를 사용하세요.',
    },
  },
  {
    id: 't11-pallet',
    title: { en: 'T11 pallet plan for the floor', zh: 'T11 卡板现场说明', ko: 'T11 파렛트 현장 설명' },
    description: {
      en: 'Use T11 preset and explain geometry-only limits.',
      zh: '使用 T11 预设并说明仅几何建议。',
      ko: 'T11 프리셋을 쓰고 기하 제안 한계를 설명합니다.',
    },
    body: {
      en: 'Open pallet-loading, calculate, export layered PDF.',
      zh: '打开卡板工具，计算并导出分层 PDF。',
      ko: '파렛트 도구를 열고 계산 후 층별 PDF를 내보내세요.',
    },
  },
  {
    id: 'open-tool-from-link',
    title: { en: 'Open a tool from a Korean search link', zh: '从韩语搜索链接直达工具', ko: '한국어 검색 링크로 도구 바로 열기' },
    description: {
      en: 'Verify deep links work without the home page.',
      zh: '验证无需首页即可打开深链。',
      ko: '홈 없이 딥링크가 동작하는지 확인합니다.',
    },
    body: {
      en: 'Open /ko/tools/cbm-calculator and refresh.',
      zh: '打开 /ko/tools/cbm-calculator 并刷新。',
      ko: '/ko/tools/cbm-calculator 를 열고 새로고침하세요.',
    },
  },
]

const home = {
  title: {
    en: 'PackFlow Tools | Packaging & logistics calculators',
    zh: 'PackFlow Tools | 包装与物流在线工具',
    ko: 'PackFlow Tools | 포장·물류 계산 도구',
  },
  description: {
    en: 'Browser tools for CBM, container/pallet loading, packing lists and shipment checks.',
    zh: 'CBM、装柜/卡板、装箱单与出货核对等浏览器工具。',
    ko: 'CBM, 컨테이너/파렛트 적재, 패킹리스트·서류 대조용 브라우저 도구.',
  },
  body: {
    en: 'Start with CBM, container loading, packing-list checker, or T11 pallet tools.',
    zh: '可从 CBM、装柜、单据核对或 T11 卡板工具开始。',
    ko: 'CBM, 컨테이너, 서류 대조, T11 파렛트 도구부터 시작하세요.',
  },
}

function absUrl(pathname) {
  const p = pathname.replace(/^\//, '')
  return `${siteOrigin}${base}${p}`
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true })
}

function rewriteAssetPaths(html) {
  // Ensure nested pages can load /assets when base is absolute.
  if (base === './' || base === '.') return html
  return html
    .replace(/(href|src)="\.\/assets\//g, `$1="${base}assets/`)
    .replace(/(href|src)="\/assets\//g, `$1="${base}assets/`)
    .replace(/(href|src)="assets\//g, `$1="${base}assets/`)
}

function buildPage({ locale, title, description, body, pathSegments, linksHtml }) {
  const template = fs.readFileSync(path.join(dist, 'index.html'), 'utf8')
  const lang = locale === 'zh' ? 'zh-CN' : locale
  const pagePath = pathSegments.join('/') + '/'
  const canonical = absUrl(pagePath)
  const hreflang = locales
    .map((loc) => {
      const segs = [loc, ...pathSegments.slice(1)]
      return `<link rel="alternate" hreflang="${loc === 'zh' ? 'zh-CN' : loc}" href="${absUrl(segs.join('/') + '/')}" />`
    })
    .join('\n')

  const noscript = `
<main id="seo-static">
  <h1>${escapeHtml(title)}</h1>
  <p>${escapeHtml(description)}</p>
  <p>${escapeHtml(body)}</p>
  <nav>
    <p><strong>PackFlow Tools</strong></p>
    ${linksHtml}
  </nav>
  <p><a href="${absUrl(locale + '/')}">Home (${locale})</a></p>
</main>`

  let html = template
  html = html.replace(/<html[^>]*>/, `<html lang="${lang}">`)
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(title)} | PackFlow</title>`)
  if (html.includes('name="description"')) {
    html = html.replace(
      /<meta\s+name="description"[^>]*>/,
      `<meta name="description" content="${escapeAttr(description)}" />`,
    )
  } else {
    html = html.replace(
      '</head>',
      `<meta name="description" content="${escapeAttr(description)}" />\n</head>`,
    )
  }
  html = html.replace(
    '</head>',
    `${hreflang}\n<link rel="canonical" href="${canonical}" />\n</head>`,
  )
  html = html.replace('<div id="app"></div>', `<div id="app"></div>${noscript}`)
  return rewriteAssetPaths(html)
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/"/g, '&quot;')
}

function toolLinks(locale) {
  return tools
    .map((t) => `<a href="${absUrl(`${locale}/tools/${t.slug}/`)}">${escapeHtml(t.title[locale])}</a>`)
    .join(' · ')
}

if (!fs.existsSync(path.join(dist, 'index.html'))) {
  console.error('dist/index.html missing — run vite build first')
  process.exit(1)
}

const urls = []

for (const locale of locales) {
  const homeHtml = buildPage({
    locale,
    title: home.title[locale],
    description: home.description[locale],
    body: home.body[locale],
    pathSegments: [locale],
    linksHtml: toolLinks(locale),
  })
  const homeDir = path.join(dist, locale)
  ensureDir(homeDir)
  fs.writeFileSync(path.join(homeDir, 'index.html'), homeHtml)
  urls.push(absUrl(`${locale}/`))

  for (const tool of tools) {
    const segs = [locale, 'tools', tool.slug]
    const html = buildPage({
      locale,
      title: tool.title[locale],
      description: tool.description[locale],
      body: tool.body[locale],
      pathSegments: segs,
      linksHtml: toolLinks(locale),
    })
    const dir = path.join(dist, ...segs)
    ensureDir(dir)
    fs.writeFileSync(path.join(dir, 'index.html'), html)
    urls.push(absUrl(segs.join('/') + '/'))
  }

  for (const guide of guides) {
    const segs = [locale, 'guides', guide.id]
    const html = buildPage({
      locale,
      title: guide.title[locale],
      description: guide.description[locale],
      body: guide.body[locale],
      pathSegments: segs,
      linksHtml: toolLinks(locale),
    })
    const dir = path.join(dist, ...segs)
    ensureDir(dir)
    fs.writeFileSync(path.join(dir, 'index.html'), html)
    urls.push(absUrl(segs.join('/') + '/'))
  }

  for (const page of ['shared', 'pricing']) {
    const segs = [locale, page]
    const html = buildPage({
      locale,
      title: page === 'shared' ? 'Shared cargo' : 'Pricing',
      description: home.description[locale],
      body: home.body[locale],
      pathSegments: segs,
      linksHtml: toolLinks(locale),
    })
    const dir = path.join(dist, ...segs)
    ensureDir(dir)
    fs.writeFileSync(path.join(dir, 'index.html'), html)
    urls.push(absUrl(segs.join('/') + '/'))
  }
}

// SPA fallback for GitHub Pages deep links without prerender match
fs.copyFileSync(path.join(dist, 'index.html'), path.join(dist, '404.html'))

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u}</loc></url>`).join('\n')}
</urlset>
`
fs.writeFileSync(path.join(dist, 'sitemap.xml'), sitemap)

console.log(`Prerendered ${urls.length} URLs → dist/ (SITE_ORIGIN=${siteOrigin}, base=${base})`)
