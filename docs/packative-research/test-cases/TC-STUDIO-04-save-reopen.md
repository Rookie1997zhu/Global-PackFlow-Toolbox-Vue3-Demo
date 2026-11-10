# TC-STUDIO-04 保存后同 designId 复开

| 字段 | 内容 |
|------|------|
| 测试编号 | TC-STUDIO-04 |
| 测试目标 | 证明「저장」后离开再进同一 `designId`，2D 贴图仍还原（非仅当次内存） |
| 操作步骤 | 1. 打开已有设计 editor，确认画布有贴图 2. 点「저장」 3. 导航到购物车或其他页 4. 硬刷新/重新打开同一 `designId` URL 5. 对照贴图与 CDN |
| 输入数据 | Crash Lock 100×80×80；`designId=46bfa110-18d3-4e6b-8ccb-f045268922dd`；store customer 会话 |
| 预期结果 | upload+save 成功；复开后 Konva 贴图仍在；uploads/generated-images CDN 可达 |
| 实际结果 | `POST /v1/editor/upload`（FormData: file, designId, skipDatabase）→200；`POST /v1/editor/save`（FormData: design_id, canvas_data, thumbnail, metadata, scene_svg, dieline_url, canvas_width, canvas_height, base_layer_url）→200 且回写 designId/save-point id；离开 `/cart` 后硬导航复开，Image 节点仍为 2 贴图+刀版 overlay，CDN HEAD/GET 均为 200 |
| 截图 | `evidence/phase3-save-reopen-before.png`；`evidence/phase3-save-reopen-after.png` |
| 网络请求证据 | `evidence/phase3-save-reopen.txt`（基线另见 `phase3-editor-2d3d-save.txt`） |
| 结论 | **Passed** |
| 置信度 | 已验证 |
