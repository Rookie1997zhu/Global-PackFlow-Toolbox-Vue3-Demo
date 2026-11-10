# TC-EXPORT-01 印前导出

| 字段 | 内容 |
|------|------|
| 测试编号 | TC-EXPORT-01 |
| 测试目标 | 触发 print-ready / vectorize / upscale 并确认交付物 |
| 操作步骤 | 1. store 登录进 editor 2. 寻找 Export 3. 若有则选 DPI/格式并等待邮件或下载 |
| 输入数据 | 既有 Crash Lock 设计 |
| 预期结果 | 可见导出 UI；产出分层 PDF/邮件附件或明确错误 |
| 实际结果 | KO editor 顶栏仅「저장」「카트에 담기」，**无** Export。Bundle 有 export/vectorize/upscale 状态文案与 PostHog `design_studio:export_modal_*`。packative.one 写明 per-storefront 可关闭 export/600DPI/vectorize/upscale。购物车无 PDF 直链。Mockup Studio KO 仍登录墙。 |
| 截图 | editor chrome 截图系列；`packative.one/studio` 功能开关文案 |
| 网络请求证据 | `phase3-deepen-3d-export-boxes.txt`；`phase3-gapfill-export-sizes.txt` |
| 结论 | **Partial / Blocked** — 能力存在于产品线，本 B2C 租户未暴露可点入口；E2E 未跑通 |
| 置信度 | 已验证（入口缺失）；宣传级（CMYK/ICC 成品） |
