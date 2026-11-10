# TC-AI-04 AI 后处理工具链

| 字段 | 内容 |
|------|------|
| 测试编号 | TC-AI-04 |
| 测试目标 | 验证生成图上的 편집 / 배경 제거 / 벡터화 / 자르기（及是否有 upscale）真实 API |
| 操作步骤 | 1. 打开 생성된 이미지 gallery 2. 依次点 자르기 / 배경 제거 / 벡터화 / 편집+생성 3. 记录网络与版本链 |
| 输入数据 | 已有 AI webp；中性 edit prompt；Crash Lock designId |
| 预期结果 | credits 动作有 studio-api；结果写入 generated-images / edit history |
| 实际结果 | **자르기** 仅本地 적용/취소，无 API。**배경 제거** `POST /v1/editor/image-tools/bg-remove` → png；`tool:image_remove_bg`。**벡터화** `POST /v1/editor/image-tools/vectorize` → svg；`tool:image_vectorize`。**편집** 刷选+prompt → `POST /v1/editor/edit`（FormData: prompt, reference_image_url, design_id, original_image_id, parent_image_id）；`tool:edit`。共用 `POST/GET /v1/editor/edit/history`。KO gallery **无** upscale 入口。 |
| 截图 | `evidence/phase3-ai-postprocess-actions.png`；`phase3-ai-postprocess-bg-remove.png`；`phase3-ai-postprocess-edit-ui.png` |
| 网络请求证据 | `evidence/phase3-ai-postprocess.txt` |
| 结论 | **Passed**（去背/矢量化/编辑）；crop **Partial**；upscale **Not Found** |
| 置信度 | 已验证 |
