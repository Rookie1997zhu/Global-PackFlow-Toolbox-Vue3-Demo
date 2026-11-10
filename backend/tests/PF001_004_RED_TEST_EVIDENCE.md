# V1.3.1 PF-001～004 测试证据（实现后 · 2026-11-10）

实现轮完成后复跑；业务修复已落地。

## 命令与环境

| 层 | 命令 | 环境 |
|----|------|------|
| 前端 | `npm test -- --run src/tests/pf001 src/tests/pf002 src/tests/pf003 src/tests/packing.spec.ts` | 本地 vitest |
| 后端 | Compose `exec api python manage.py test …`（`docker cp` 同步 apps/tests） | Compose Postgres |
| engine-ts | `npx tsx --test src/packing.test.ts` | 本地 |

## 结果表

| ID | 用例 | 状态 | 备注 |
|----|------|------|------|
| PF-001 / T-001 | cartonize 120/12→10 | **Passed** | |
| PF-001 / T-002 | 121/12 末箱 | **Passed** | |
| PF-001 / T-001负 | bare qty 不猜 CTN | **Passed** | |
| PF-001 / T-003 | 禁止 GW×0.92 | **Passed** | |
| PF-001 formal | formal 拒绝模糊 qty | **Passed** | 400 |
| PF-001 fixture | builders 120/12、末箱 | **Passed** | |
| PF-002 / T-004 | confirmed lines→snapshot+xlsx | **Passed** | |
| PF-002 | CI unitPrice 13.75 | **Passed** | |
| PF-002 | scheme-only formal | **Passed** | 400 |
| PF-002 FE | buildConfirmedReportBody | **Passed** | |
| PF-003 FE | price / per-SKU params | **Passed** | |
| PF-003 BE | adapters per-SKU | **Passed** | |
| PF-003 engine | mixed constraints | **Passed** | |
| PF-004 / T-008 | 真并发 PUT | **Passed** | `[200,409]` |
| 相关 | 幂等不同 payload | **Passed** | 409 IDEMPOTENCY_KEY_REUSE |
| 相关 | 自然月配额 | **Passed** | |
| 相关 | CP949 | **Passed** | |
| 相关 | XLSX 公式注入 | **Passed** | |

## 兼容说明

- Cargo JSON 增加可选字段：`quantityBasis` / `pieceQty` / `piecesPerCarton` / `netKg` / `allowRotate` / `stackable`；无破坏性 DB migration。
- 报告 `sourceMode=confirmed_lines` + `formal`；默认 `formal=false` 仍可生成，模糊数据带 `needsReview`。
- 未 push。
