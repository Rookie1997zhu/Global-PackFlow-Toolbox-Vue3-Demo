import type { Locale } from '../i18n'

export type GuideId =
  | 'container-from-excel'
  | 'invoice-pl-check'
  | 't11-pallet'
  | 'open-tool-from-link'

export type GuideEntry = {
  id: GuideId
  title: Record<Locale, string>
  summary: Record<Locale, string>
  steps: Record<Locale, string[]>
  samplePath?: string
  relatedToolSlug?: string
  limits: Record<Locale, string>
}

export const GUIDES: GuideEntry[] = [
  {
    id: 'container-from-excel',
    relatedToolSlug: 'container-loading',
    samplePath: '/samples/kr-container-cargo.csv',
    title: {
      en: 'Excel → container loading plan',
      zh: 'Excel → 装柜规划',
      ko: '엑셀 → 컨테이너 적재 계획',
    },
    summary: {
      en: 'Import a Korean cargo sheet, run container packing, and export a printable load guide.',
      zh: '导入韩文货表，运行装柜，导出可打印装载指导。',
      ko: '한국어 화물표를 가져와 적재를 실행하고 인쇄용 가이드를 내보냅니다.',
    },
    steps: {
      en: [
        'Open /ko/tools/container-loading',
        'Click Load Korean sample or import your CSV/XLSX',
        'Review unplaced reasons and volume/payload utilization',
        'Export load guide PDF for warehouse handoff',
      ],
      zh: [
        '打开 /ko/tools/container-loading',
        '点击加载韩文样例或导入 CSV/XLSX',
        '查看未装原因与体积/载重利用率',
        '导出装载 PDF 交给仓库',
      ],
      ko: [
        '/ko/tools/container-loading 열기',
        '한국어 샘플 불러오기 또는 CSV/XLSX 가져오기',
        '미적재 사유와 부피/중량 활용률 확인',
        '창고 전달용 적재 PDF 내보내기',
      ],
    },
    limits: {
      en: 'Demo packs up to 400 units. Geometry only — not safety certification.',
      zh: '演示最多 400 件。仅几何建议，非安全认证。',
      ko: '데모는 최대 400개. 기하 제안만 해당하며 안전 인증이 아닙니다.',
    },
  },
  {
    id: 'invoice-pl-check',
    relatedToolSlug: 'packing-list-checker',
    samplePath: '/samples/kr-expected.csv',
    title: {
      en: 'Invoice vs packing list check',
      zh: '发票与装箱单核对',
      ko: '인보이스·패킹리스트 대조',
    },
    summary: {
      en: 'Load the KR mismatch demo and export a fix-hint report.',
      zh: '加载韩文差异演示并导出带修复提示的报告。',
      ko: '한국어 차이 데모를 불러와 수정 힌트 보고서를 내보냅니다.',
    },
    steps: {
      en: [
        'Open /ko/tools/packing-list-checker',
        'Click Load KR mismatch demo',
        'Read qty/weight/amount/unit mismatches with row numbers',
        'Export CSV/XLSX/PDF diff report',
      ],
      zh: [
        '打开 /ko/tools/packing-list-checker',
        '点击加载韩文差异演示',
        '阅读带行号的数量/重量/金额/单位差异',
        '导出 CSV/XLSX/PDF 差异报告',
      ],
      ko: [
        '/ko/tools/packing-list-checker 열기',
        '한국어 차이 데모 불러오기',
        '행 번호가 있는 수량/중량/금액/단위 차이 확인',
        'CSV/XLSX/PDF 차이 보고서 내보내기',
      ],
    },
    limits: {
      en: 'Structured Excel/CSV only — no OCR of scanned PDFs.',
      zh: '仅结构化 Excel/CSV，不含扫描件 OCR。',
      ko: '구조화 Excel/CSV만 지원하며 스캔 PDF OCR은 없습니다.',
    },
  },
  {
    id: 't11-pallet',
    relatedToolSlug: 'pallet-loading',
    samplePath: '/samples/kr-pallet-cargo.csv',
    title: {
      en: 'T11 pallet plan for the floor',
      zh: 'T11 卡板现场说明',
      ko: 'T11 파렛트 현장 설명',
    },
    summary: {
      en: 'Use T11 preset, load Korean cartons, explain layers and safety limits.',
      zh: '使用 T11 预设，加载韩文箱规，解释分层与安全边界。',
      ko: 'T11 프리셋과 한국어 박스 규격으로 층과 안전 한계를 설명합니다.',
    },
    steps: {
      en: [
        'Open /ko/tools/pallet-loading (default T11)',
        'Load Korean sample and calculate',
        'Switch layers in the preview',
        'Export load guide PDF; note geometry-only disclaimer',
      ],
      zh: [
        '打开 /ko/tools/pallet-loading（默认 T11）',
        '加载韩文样例并计算',
        '在预览中切换层',
        '导出装载 PDF，并说明仅几何建议',
      ],
      ko: [
        '/ko/tools/pallet-loading 열기(기본 T11)',
        '한국어 샘플 불러오기 후 계산',
        '미리보기에서 층 전환',
        '적재 PDF 내보내기, 기하 제안만임을 안내',
      ],
    },
    limits: {
      en: 'No carton compression / CG / transit stability certification.',
      zh: '不含纸箱抗压、重心与运输稳定性认证。',
      ko: '박스 압축·무게중심·운송 안정성 인증은 포함하지 않습니다.',
    },
  },
  {
    id: 'open-tool-from-link',
    relatedToolSlug: 'cbm-calculator',
    title: {
      en: 'Open a tool from a Korean search link',
      zh: '从韩语搜索链接直达工具',
      ko: '한국어 검색 링크로 도구 바로 열기',
    },
    summary: {
      en: 'Verify deep links work without visiting the home page first.',
      zh: '验证无需先经首页即可打开深链。',
      ko: '홈을 거치지 않고 딥링크로 도구가 열리는지 확인합니다.',
    },
    steps: {
      en: [
        'Paste /ko/tools/cbm-calculator into the address bar',
        'Confirm the CBM tool opens and language is Korean',
        'Refresh — the same tool should remain',
        'Switch language to EN and confirm URL becomes /en/tools/...',
      ],
      zh: [
        '地址栏打开 /ko/tools/cbm-calculator',
        '确认进入 CBM 工具且语言为韩语',
        '刷新后仍停留在同一工具',
        '切换到 EN，URL 变为 /en/tools/...',
      ],
      ko: [
        '주소창에 /ko/tools/cbm-calculator 입력',
        'CBM 도구가 한국어로 열리는지 확인',
        '새로고침 후에도 동일 도구 유지',
        'EN으로 전환 시 URL이 /en/tools/... 인지 확인',
      ],
    },
    limits: {
      en: 'Search ranking is not guaranteed; this checks product deep-link UX only.',
      zh: '不保证搜索排名；本任务只验证产品深链体验。',
      ko: '검색 순위를 보장하지 않으며 딥링크 UX만 검증합니다.',
    },
  },
]

export const GUIDE_BY_ID: Record<GuideId, GuideEntry> = Object.fromEntries(
  GUIDES.map((g) => [g.id, g]),
) as Record<GuideId, GuideEntry>

export function isGuideId(v: string): v is GuideId {
  return v in GUIDE_BY_ID
}
