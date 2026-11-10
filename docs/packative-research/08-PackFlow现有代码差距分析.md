# 08 — PackFlow 现有代码差距分析

## 1. 仓库事实基线

| 层 | 路径 / 组件 | 状态 |
|----|-------------|------|
| 前端 | `global-toolbox-vue3/` Vue3+TS+Vite | 有 |
| 刀版 | `src/integrations/dieline/` ~36 模板 + Three.js + 导出 | 有（DEMO） |
| 装柜 | `tools/container-loading`、`integrations/pallet`、`engine-ts` | 有 |
| 后端 | Django DRF：accounts/organizations/schemes/calculations/documents/files/imports/health | 有 |
| 异步 | Celery + Redis + worker 容器 | 有 |
| 部署 | `deploy/compose.yml` + Caddy | 有 |
| Konva/Fabric | package.json | **无** |
| AI 生成 | — | **无** |
| 设计云端模型 | schemes 仅货物方案 | **无 designs app** |

## 2. 差距矩阵

| 能力 | Packative（公开/宣传） | PackFlow | 判定 |
|------|------------------------|----------|------|
| 参数化刀版 | 产品页尺寸+下载 | 多模板实时 2D/3D | **部分实现**（PackFlow 几何更完整；缺对方盒型覆盖验证） |
| AI 文生图 | 宣传核心 | 无 | **尚未实现** → 需新增服务 |
| 图案编辑器图层 | 宣传 | 无独立 artwork 层 | **尚未实现** |
| 2D/3D 联动（结构） | 宣传 | 有 fold 预览 | **部分实现** |
| 图案↔3D 贴图 | 宣传 | 无 | **尚未实现** |
| 设计持久化/多租户 | Supabase Auth + store customer 门禁（已验证 customer 可为空） | 无 designs；已有 org/team | **尚未实现**（应对齐「认证用户 ≠ 业务主体」显式建模） |
| DXF/SVG 导出 | 刀版下载（格式未确认） | 有 DEMO 导出 | **部分实现** → 需重构去 DEMO/补校验 |
| CMYK 分层 PDF | 宣传 | pdf-lib RGB DEMO | **尚未实现**（需新增印前） |
| 装柜/卡板/报告 | 非对方焦点 | 完整 SaaS 链路 | **已实现**（勿破坏） |
| White-label 嵌入 | packative.one | 无 | 低优先级候选 |

## 3. 需要重构 vs 新增

**重构（小步）**

- `exportDieline.js`：制造门禁与真实 disclaimer 策略
- `DielineTool.vue`：拆出 Studio 壳（结构预览 vs 设计编辑）
- knife 契约：扩展 bleed/safe/glue 语义字段

**新增**

- Django `designs` app（Design / Revision / AiJob / ExportJob / Asset）
- AI Provider 适配 + Celery tasks
- Artwork 图层模型与面板 UV 映射
- 印前导出 Worker（可选独立镜像）
- i18n 文案与路由 `/tools/packaging-studio`

## 4. 风险

- 与 `schemes`/`calculations` 混表会导致权限与计费混乱 → **独立 app**
- 在前端伪装「已完成 AI」违反项目质量边界 → 禁止
- 复制 Packative 素材/品牌违法 → 禁止
