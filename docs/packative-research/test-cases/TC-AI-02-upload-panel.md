# TC-AI-02 自有图上传贴板

| 字段 | 内容 |
|------|------|
| 测试编号 | TC-AI-02 |
| 测试目标 | 自有 PNG 上传并落到刀版画布 |
| 操作步骤 | 1. store 登录 editor 2. 上传面板「이미지 업로드」或等价 `POST /v1/editor/upload` 3. 将返回 CDN 图贴到 2D |
| 输入数据 | `evidence/own-upload-pf-sample.png`（自研样本，非对方品牌） |
| 预期结果 | 上传成功；画布出现该图 |
| 实际结果 | **API Passed**：`POST studio-api.../v1/editor/upload` → 200，CDN `.../uploads/{cus}/{designId}/{uuid}.png`（本地回拉一致）。**贴板 Passed**：用返回 URL 在 Konva 舞台添加 `Image`（截图可见）。原生 OS 文件选择器路径因自动化限制未完整点通（面板空态 UI 此前已证）。 |
| 截图 | `evidence/phase3-editor-upload-panel.png`；`evidence/phase3-own-upload-on-dieline.png`；`evidence/own-upload-pf-sample.png` |
| 网络请求证据 | `evidence/phase3-own-upload-apis.txt`；`evidence/own-upload-cdn-copy.png` |
| 结论 | **Passed（上传 API + 贴板）**；原生 picker **Partial** |
| 置信度 | 已验证 / 部分 |
