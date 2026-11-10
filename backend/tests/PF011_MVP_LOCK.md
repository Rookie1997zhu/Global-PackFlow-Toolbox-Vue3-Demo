# PF-011 MVP 计划锁定（本轮不实现）

日期：2026-11-10 · 前置：韩文 `/ko/shipments/` 冒烟（见 `PF132_POLISH_EVIDENCE.md` S4/S5）**Passed**

票面：纸箱包装优化**纯算法** + Golden 测试（V1.4）。Shipment UI 写回属 **PF-012**，不在本卡。

## 范围锁定

| 做 | 不做（PF-011） |
|----|----------------|
| `global-toolbox-vue3/src/tools/cartonization/useCartonization.ts` | `engine-ts` 云端化 |
| `global-toolbox-vue3/src/tests/cartonization.spec.ts` Golden | Worker / 3D UI |
| 产品/箱内尺寸、正交姿态、边距、最大重量 | Shipment `cartonBatches` 写回（→ PF-012） |
| 双向：箱规→容量 / 目标件数→推荐箱规 | |
| 输出 `boxesNeeded`、`lastBoxUnits`、`placements`；不可行返回明确原因 | |

## Golden（批准实现时）

- 120/12、121/12
- `uprightOnly`
- 单箱重量上限
- 边界碰撞（不重叠、不越界）

## 可复用 / 缺口

- 已有：`shared/quantity/cartonize.ts`（件数语义）；Container `tools/container-loading/packing.ts`（碰撞/边界思路）
- 缺失：`tools/cartonization/` 整目录；件→箱内 `placements`

## 状态

**LOCKED** — 待单独实现会话按上表落地；本轮零算法代码。
