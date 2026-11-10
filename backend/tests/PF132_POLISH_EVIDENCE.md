# V1.3.2 补强证据（UI / 多 sheet / 测试）

日期：2026-11-10 · Compose `localhost:8080` · **未 push**

## 结果表

| ID | 场景 | 层级 | 结果 |
|----|------|------|------|
| P1 | 出货列表/详情 i18n（en/zh/ko）+ 登录/empty/retry + 409 conflict 文案路径 | frontend | Passed |
| P2 | 窄屏工具条/chips/向导 CSS（style.css media） | frontend | Passed（构建纳入） |
| P3 | `parse_xlsx_bytes(sheet_index)` + preview/commit `sheetIndex` + `sheets` | backend | Passed |
| P4 | `SheetImportWizard` 选表透传 preview/commit | frontend | Passed（构建纳入） |
| T1 | `manage.py test tests.test_shipments tests.test_files_imports`（14） | API | Passed |
| T2 | Vitest `importsApi.spec.ts` + `xlsxSheets.spec.ts`（4） | frontend | Passed |
| S1 | health / 注册 / 建 Shipment / stale PUT → 409 | smoke | Passed |
| S2 | `/ko/shipments/` + detail SPA 200 | smoke | Passed |
| S3 | confirmed 后 PL/CI 同 `revisionNo` | smoke | Passed |
| S4 | 浏览器可视 KO 文案与冲突 banner 手测 | UI | Passed |
| S5 | 浏览器多 sheet：选 `1: Cargo` → 映射/审查/提交 → `SKU-MS` | UI | Passed |

## 韩文演示冒烟补充（2026-11-10，Compose `localhost:8080`，未删卷）

账号：`ko_smoke_1121732343@example.com`（locale=ko）

| 检查项 | 证据 | 结果 |
|--------|------|------|
| `GET /api/v1/health/ready/` | 200 | Passed |
| `/ko/shipments/` 列表 + 详情 KO tabs | `주문/상품/포장/서류/플랜/이력/가져오기`；样例 `shp_dc086501bc1f4d51` / `KO-301796822` | Passed |
| stale `rowVersion` PUT → 409 | API `SHIPMENT_VERSION_CONFLICT`；UI banner「충돌…」+ hint「서버 최신 데이터로…」于 `shp_97a2bb42740b4f32` | Passed |
| multi.xlsx 选 Cargo 提交 | 向导 2/5 见 `0: Ignore` / `1: Cargo`；完成后商品行 `SKU-MS` qty 24；rev 升至 4 | Passed |
| ready→confirmed→PL/CI 同源 revision | 先前 API：`S_plci=201/201 rev=3/3 same=True`（`shp_dc086501bc1f4d51`） | Passed |

fixture：`backend/tests/_smoke_multi.xlsx`（sheet0=Ignore，sheet1=Cargo+`SKU-MS`）

## 关键改动

- `ShipmentsPage.vue` / `ShipmentDetail.vue` / `i18n.ts` / `style.css`
- `backend/apps/imports/parsing.py` / `services.py` / `serializers.py` / `views.py`
- `api/imports.ts` / `SheetImportWizard.vue`
- 测试：`test_files_imports.py`（多 sheet）、`importsApi.spec.ts`、`xlsxSheets.spec.ts`
