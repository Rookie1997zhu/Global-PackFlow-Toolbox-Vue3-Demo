# Packative Studio 黑盒研究总览

**研究日期**：2026-11-10  
**范围**：仅逆向观察、功能规格、差距分析与独立开发方案；**未修改** PackFlow 业务代码。  
**取证优先级**：AI 设计 > 刀版几何 > 2D/3D 联动 > 生产导出。

## 研究边界（已验证）

| 项 | 结论 | 置信度 |
|----|------|--------|
| 营销站可达 | `https://packative.com/en/studio`、`https://packative.one/studio` 可访问 | 已验证 |
| 登录页 | `https://packative.com/en/login`；邮箱密码与 Google OAuth | 已验证 |
| Auth 后端 | Google OAuth → `zumxseuiallfcixygtch.supabase.co`（Supabase Auth） | 已验证 |
| 登录后账户页 | `/en/account` 可见 Logout / Personal Information（邮箱脱敏） | 已验证 |
| Store customer | 双轨：Supabase 账户页 ≠ Medusa store customer；社交登录后有 `_medusa_jwt` | 已验证 |
| robots.txt | 禁止爬取 `/editor/`、`/login`、`/my/`、`/checkout/` 等 | 已验证 |
| KO Studio 入口 | 桌面宽度下 PDP「실시간 간편 디자인」；CTA 进 `/editor/...` | 已验证 |
| Studio 深度编辑器 | store 社交登录后可进；URL 带 `designId`；工具 AI/背景/上传/文本/元素/图层；2D/3D | 已验证 |
| AI 文生图 | `studio-api.../v1/llm/prompt` → `/v1/editor/create` → CDN webp | 已验证 |
| AI 메인 영역 | `llm/prompt(designTheme)` → `/v1/editor/main-design-gen`（dieline+masks）→ `print/image_0.png`；`tool:design` | 已验证 |
| AI 后处理 | `image-tools/bg-remove`、`vectorize`、`/editor/edit` + `edit/history`；crop 本地；KO 无 upscale 入口 | 已验证 |
| 文本/元素 save | `canvas_data` v1.1：`konvaTexts` / `konvaElements`；메인 色多为生成态 | 已验证 |
| 多盒型 Studio | mailer/pillow editor 同构；CDN `dielines/{productCode}/{L_W_H}/`；sleeve 入口 Partial | 已验证 |
| 保存后复开 | 同 `designId` 离开/硬导航后 Konva 贴图与 CDN uploads/generated-images 仍在 | 已验证 |
| 英文 PDP Studio CTA | EN PDP **无** Easy Design DOM；Solutions→`/en/studio` 仅营销+Demo | 已验证 |
| 英文刀版下载 | `papi.../model?...&format=eps`；crashlock/mailerbox/sleeve/tray/pillowbox BB 已差分 | 已验证 |
| 3D UV / EngView | `cad.packative.com` Collada+TextureResource；GLSL designPos 矩阵 | 已验证 |
| 印前导出 | 白标可关 export；KO 编辑器无 Export 钮；购物车无 PDF 直链 | Partial/Blocked |
| 自有图上传 | `POST /v1/editor/upload` → CDN uploads/；Konva 贴板 | 已验证（picker Partial） |
| 大尺寸刀版 | crashlock 200/300 及多盒型 200×150×100 EPS BB | 已验证 |
| 非法尺寸 | crashlock calc-700 + UI 文案；mailer/pillow 抽样 | 已验证 |
| Mockup Studio | `/mockup-studio` 需登录 | 已验证 |

## 当前状态（store 登录后）

1. **Store customer 已打通**：`/api/customer` 有对象；`_medusa_jwt`；`store.packative.com/store/auth/*`。
2. **AI → 贴刀版 → 保存 → 购物车** 已验证（`evidence/phase3-*`）；**保存后同 designId 复开** Passed（`TC-STUDIO-04`）。
3. **AI 모드**：`이미지 생성`（`/editor/create`）与 **`메인 영역 디자인`**（`/editor/main-design-gen` + masks）均已验证（`TC-AI-01` / `TC-AI-03`）；后处理见 `TC-AI-04`。
4. **图层 save**：文本/形状写入 `canvas_data.konvaTexts|konvaElements`（`TC-STUDIO-05`）。
5. **多盒型 Studio**：mailer/pillow 与 crashlock 同构；sleeve 入口 Partial（`TC-STUDIO-06`）。
6. **3D/UV**：EngView Collada + `TextureResource1..4` + design-space GLSL；fold slider 0..5500；蒙版 `area/main/total_mask`。
7. **刀版**：SVG 参数化同拓扑异尺寸；`/v1/editor/dieline` 元数据已取证；多盒型 EPS BB 表见 05。
8. **导出**：bundle 确认「print-ready 邮件」；本会话未触发完整导出走件。

## 证据索引

| 文件 | 说明 |
|------|------|
| [evidence/phase0-login-page.png](evidence/phase0-login-page.png) | 登录页 |
| [evidence/phase0-google-oauth-supabase.png](evidence/phase0-google-oauth-supabase.png) | Google→Supabase OAuth |
| [evidence/phase0-products-catalog.png](evidence/phase0-products-catalog.png) | 产品目录 |
| [evidence/phase0-mockup-studio-login-required.png](evidence/phase0-mockup-studio-login-required.png) | Mockup Studio 登录墙 |
| [evidence/phase2-productbox-custom-100x80x50.png](evidence/phase2-productbox-custom-100x80x50.png) | Custom 尺寸输入 |
| [evidence/phase1-editor-login-wall.png](evidence/phase1-editor-login-wall.png) | `/editor` 登录墙 |
| [evidence/phase1-ko-desktop-nav.png](evidence/phase1-ko-desktop-nav.png) | KO 桌面导航 |
| [evidence/phase2-dieline-download-login-wall.png](evidence/phase2-dieline-download-login-wall.png) | 刀版下载触发登录墙 |
| [evidence/phase1-login-followup-notes.txt](evidence/phase1-login-followup-notes.txt) | 登录后复核笔记 |
| [evidence/phase2-en-dieline-model-api.txt](evidence/phase2-en-dieline-model-api.txt) | EN 刀版 model API 笔记 |
| [evidence/dieline-crashlock-100x80x50.eps](evidence/dieline-crashlock-100x80x50.eps) | EPS 样本 100×80×50 |
| [evidence/dieline-crashlock-120x90x60.eps](evidence/dieline-crashlock-120x90x60.eps) | EPS 样本 120×90×60 |
| [evidence/dieline-crashlock-55x55x75.eps](evidence/dieline-crashlock-55x55x75.eps) | EPS 样本 55×55×75 |
| [evidence/phase1-studio-ai-apis.txt](evidence/phase1-studio-ai-apis.txt) | AI API 链路 |
| [evidence/phase1-ai-generate-result.png](evidence/phase1-ai-generate-result.png) | AI 生成结果 |
| [evidence/phase3-ai-applied-to-dieline-2d.png](evidence/phase3-ai-applied-to-dieline-2d.png) | AI 贴到 2D 刀版 |
| [evidence/phase3-editor-3d-collada.png](evidence/phase3-editor-3d-collada.png) | 3D 预览 |
| [evidence/phase3-cart-with-design.png](evidence/phase3-cart-with-design.png) | 购物车含设计 |
| [evidence/phase3-editor-2d3d-save.txt](evidence/phase3-editor-2d3d-save.txt) | 2D/3D/保存笔记 |
| [evidence/phase3-save-reopen.txt](evidence/phase3-save-reopen.txt) | 保存→离开→同 designId 复开 |
| [evidence/phase3-save-reopen-before.png](evidence/phase3-save-reopen-before.png) | 复开前 |
| [evidence/phase3-save-reopen-after.png](evidence/phase3-save-reopen-after.png) | 复开后图层仍在 |
| [evidence/phase3-ai-main-area.txt](evidence/phase3-ai-main-area.txt) | 메인 영역 API 差分 |
| [evidence/phase3-ai-main-area-ui.png](evidence/phase3-ai-main-area-ui.png) | 메인 영역 UI |
| [test-cases/TC-STUDIO-04-save-reopen.md](test-cases/TC-STUDIO-04-save-reopen.md) | 保存复开用例 |
| [test-cases/TC-AI-03-main-area-regen.md](test-cases/TC-AI-03-main-area-regen.md) | 메인 영역 / 重生成用例 |
| [evidence/phase3-ai-postprocess.txt](evidence/phase3-ai-postprocess.txt) | AI 后处理 API |
| [test-cases/TC-AI-04-postprocess.md](test-cases/TC-AI-04-postprocess.md) | 后处理用例 |
| [evidence/phase3-text-elements-color-save.txt](evidence/phase3-text-elements-color-save.txt) | 文本/元素/色 → save |
| [test-cases/TC-STUDIO-05-text-elements-save.md](test-cases/TC-STUDIO-05-text-elements-save.md) | 文本元素 save 用例 |
| [evidence/phase3-multibox-studio.txt](evidence/phase3-multibox-studio.txt) | 多盒型 Studio 同构 |
| [test-cases/TC-STUDIO-06-multibox-editor.md](test-cases/TC-STUDIO-06-multibox-editor.md) | 多盒型 editor 用例 |
| [evidence/phase3-deepen-3d-export-boxes.txt](evidence/phase3-deepen-3d-export-boxes.txt) | 加深：UV/导出/多盒型 |
| [evidence/phase3-gapfill-export-sizes.txt](evidence/phase3-gapfill-export-sizes.txt) | 补洞：大尺寸/导出门控/上传 |
| [evidence/phase3-editor-upload-panel.png](evidence/phase3-editor-upload-panel.png) | 上传面板空态 |
| [test-cases/TC-EXPORT-01-print-ready.md](test-cases/TC-EXPORT-01-print-ready.md) | 印前导出用例 |
| [test-cases/TC-AI-02-upload-panel.md](test-cases/TC-AI-02-upload-panel.md) | 上传面板用例 |
| [test-cases/TC-DL-04-illegal-sizes.md](test-cases/TC-DL-04-illegal-sizes.md) | 非法尺寸矩阵 |
| [evidence/phase3-illegal-size-summary.txt](evidence/phase3-illegal-size-summary.txt) | 非法尺寸摘要 |
| [evidence/studio-api-dieline-100_80_80.meta.json](evidence/studio-api-dieline-100_80_80.meta.json) | dieline API 元数据（无 base64） |
| [evidence/cad-collada-bf9ac3b1.dae](evidence/cad-collada-bf9ac3b1.dae) | EngView Collada 样本 |
| [evidence/studio-dieline-100_80_80.svg](evidence/studio-dieline-100_80_80.svg) | 编辑器刀版 SVG |
| [evidence/rea-public-studio-summary.txt](evidence/rea-public-studio-summary.txt) | REA 公开页摘要 |
| [evidence/rea-papi-and-xhr.txt](evidence/rea-papi-and-xhr.txt) | XHR/`papi` 请求摘录 |

## 报告清单

1. [01-网站功能与技术识别报告.md](01-网站功能与技术识别报告.md)
2. [02-完整交互流程与截图证据.md](02-完整交互流程与截图证据.md)
3. [03-API与数据流分析.md](03-API与数据流分析.md)
4. [04-AI包装设计模块研究.md](04-AI包装设计模块研究.md)
5. [05-参数化刀版几何算法研究.md](05-参数化刀版几何算法研究.md)
6. [06-2D与3D联动技术研究.md](06-2D与3D联动技术研究.md)
7. [07-生产文件导出研究.md](07-生产文件导出研究.md)
8. [08-PackFlow现有代码差距分析.md](08-PackFlow现有代码差距分析.md)
9. [09-完整系统架构与数据库设计.md](09-完整系统架构与数据库设计.md)
10. [10-分阶段开发计划与验收标准.md](10-分阶段开发计划与验收标准.md)

另见：[diagrams/](diagrams/)、[test-cases/](test-cases/)。

## 置信度约定

- **已验证**：浏览器/REA 直接观察到
- **高置信推断**：多证据一致但未读到源码
- **待验证假设**：营销文案或逻辑外推
- **无法确认**：需完整 store 客户态或内部服务才能证明
