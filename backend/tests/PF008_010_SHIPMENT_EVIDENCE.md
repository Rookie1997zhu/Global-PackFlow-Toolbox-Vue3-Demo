# V1.3.2 Shipment MVP 证据（PF-008 / 009 / 010）

日期：2026-11-10 · 环境：Compose `localhost:8080` · **未 push**

## 命令与结果

| ID | 场景 | 层级 | 结果 |
|----|------|------|------|
| A1 | `docker compose build/up api worker frontend` + force-recreate caddy（不删卷） | deploy | Passed |
| A2 | `GET /api/v1/health/ready/` → 200 | smoke | Passed |
| T-ship | `manage.py test tests.test_shipments`（8 cases） | API | Passed |
| T-imp | `manage.py test tests.test_files_imports`（含 mapping 模板 + shipment commit） | API | Passed |
| S1 | 注册 → 创建 Shipment(120PCS/10CTN) → ready → confirmed | smoke | Passed |
| S2 | Shipment PL/CI XLSX，`shipmentRevision.revisionNo` 相同 (=1) | smoke | Passed |
| S3 | 刷新 `GET /shipments/{id}/` 恢复 pieceQty=120 / cartonCount=10 | smoke | Passed |
| S4 | `POST /import-mapping-templates/` 201 | smoke | Passed |
| S5 | `GET /ko/shipments/` 前端 200 | smoke | Passed |
| FE-unit | 独立 Vitest 组件单测 | frontend | Not Run（本轮以 API 客户端 + Compose 冒烟为主） |

## 关键交付

- `backend/apps/shipments/`：Shipment / Revision / Document / Plan / Event + 守恒校验 + rowVersion 409 + 状态机 + reports 挂文档
- 前端：`api/shipments.ts`、`ShipmentsPage`、`ShipmentDetail`、路由与 ko/en/zh i18n、侧栏入口
- PF-010：`SheetImportWizard`、`MappingTemplate` API、import commit `target=shipment`
