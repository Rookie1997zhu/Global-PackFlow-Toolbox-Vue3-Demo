# TC-AI-03 메인 영역 디자인 / 重生成

| 字段 | 内容 |
|------|------|
| 测试编号 | TC-AI-03 |
| 测试目标 | 验证 AI 下拉「메인 영역 디자인」生成链路、与文生图差异、贴到刀版；并尝试重生成 |
| 操作步骤 | 1. AI 下拉选「메인 영역 디자인」 2. 自有中性 prompt + Flat Illustration →「생성」 3. 点缩略图贴刀版 4. 改 prompt 再点「생성」作第二轮 5. 对照网络字段 |
| 输入数据 | Crash Lock 100×80×80；`designId=46bfa110-...`；中性英文 prompt（无品牌素材） |
| 预期结果 | 走 mask 感知生成；CDN 出图；可贴画布；可再次生成变体 |
| 实际结果 | **Passed**。`POST /v1/llm/prompt`（body:`designTheme`）→ `POST /v1/editor/main-design-gen`（`prompt,main_pixel,dieline_url,total_mask_url,area_mask_url,user_id,uuid,design_id`）→ CDN `.../print/image_0.png` → `POST /v1/editor/work-history`（`tool:"design"`）→ `GET generated-images`。点击缩略图后 Konva 出现 ~2048×1216 全刀版贴图。缩略图旁无独立「재생성」控件；改 prompt 再点「생성」第二次仍走 `main-design-gen`，gallery 出现 2 张。 |
| 截图 | `evidence/phase3-ai-main-area-ui.png`；`phase3-ai-main-area-result.png`；`phase3-ai-main-area-gallery.png`；`phase3-ai-main-area-applied.png`；`phase3-ai-main-area-on-dieline.png` |
| 网络请求证据 | `evidence/phase3-ai-main-area.txt`（对照 `phase1-studio-ai-apis.txt`） |
| 结论 | **Passed**（主区域生成+贴板+再生成）；独立缩略图再生成入口 **Not Found** |
| 置信度 | 已验证 |
