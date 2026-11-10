# TC-STUDIO-05 텍스트 / 요소 / 색상 → save

| 字段 | 内容 |
|------|------|
| 测试编号 | TC-STUDIO-05 |
| 测试目标 | 文本与形状写入 `canvas_data`；메인 영역色是否进入 save |
| 操作步骤 | 1. 텍스트 상자 추가 2. 요소 Circle 3. 메인 영역选 Beige 4. 저장并解析 FormData |
| 输入数据 | Crash Lock designId；中性文本/形状 |
| 预期结果 | save 含 text/element 结构；色字段可追踪 |
| 实际结果 | **Passed（文本+形状）**：`canvas_data` v1.1 含 `konvaTexts` / `konvaElements`（circle）/ `konvaImages`；`backgroundColor` 键存在但为 `null`。**Partial（色）**：UI「선택: Beige」无网络、未写入本次 save；色预计只在 AI 生成的 `generationInfo.backgroundColorHex` 出现。`metadata` 主要为 editorUrl/papiOptions。 |
| 截图 | `evidence/phase3-text-elements-ui.png`；`phase3-main-area-color-selected.png` |
| 网络请求证据 | `evidence/phase3-text-elements-color-save.txt` |
| 结论 | **Passed**（text/elements）；色 **Partial** |
| 置信度 | 已验证 |
