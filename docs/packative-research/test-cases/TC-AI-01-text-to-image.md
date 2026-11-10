# TC-AI-01 文生图端到端

| 字段 | 内容 |
|------|------|
| 测试编号 | TC-AI-01 |
| 测试目标 | 验证文字 prompt 生成包装图案 |
| 操作步骤 | 1. store 社交登录使 `/api/customer` 非空 2. 打开 `/editor/...` 3. AI 面板填 prompt 4. 点 생성 |
| 输入数据 | `minimal kraft paper geometric leaf pattern, soft beige background, no text, no logo, packaging panel artwork`；风格 Flat Illustration；1:1 |
| 预期结果 | 出现生成图；可在面板中查看 |
| 实际结果 | **Passed** — 按钮先显示 `생성중...`；随后生成图出现。链路：`POST /v1/llm/prompt`（改写）→ `POST /v1/editor/create`（返回 CDN webp）→ `GET /v1/editor/generated-images` |
| 截图 | `evidence/phase1-ai-generate-result.png` |
| 网络请求证据 | `evidence/phase1-studio-ai-apis.txt` |
| 结论 | Passed |
| 置信度 | 已验证 |
