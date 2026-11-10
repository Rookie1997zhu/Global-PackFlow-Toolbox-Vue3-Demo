# TC-STUDIO-02 KO 编辑器入口

| 字段 | 内容 |
|------|------|
| 测试编号 | TC-STUDIO-02 |
| 测试目标 | 验证「실시간 간편 디자인」可达可操作 `/editor` |
| 操作步骤 | 1. 视口 ≥768px 2. KO crash-lock PDP 3. 自定义 LWH 4. Studio radio 5. CTA；前置 store customer |
| 输入数据 | length=100 width=80 height=80 quantity=250 coating=matte |
| 预期结果 | 进入可操作编辑器画布（AI/2D/3D） |
| 实际结果 | URL `/editor/productbox-crashlock/{prodId}?LWH&qty&coating&hash`（后续可带 `designId`/`itemId`）。customer=null 时登录墙；store 登录后画布可用（Konva + 工具栏）。 |
| 截图 | `evidence/phase1-editor-login-wall.png`；`evidence/phase1-editor-ai-panel.png` |
| 网络请求证据 | `evidence/phase1-login-followup-notes.txt`；GA `go_to_editor` |
| 结论 | **Passed** |
| 置信度 | 已验证 |
