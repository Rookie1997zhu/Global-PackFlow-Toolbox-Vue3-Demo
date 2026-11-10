# TC-DL-02 刀版下载 Generating 态

| 字段 | 内容 |
|------|------|
| 测试编号 | TC-DL-02 |
| 测试目标 | 点击 Dieline File 出现异步生成并得到文件 |
| 操作步骤 | Custom/Standard → Dieline File；对照 `papi.../model?format=eps` |
| 输入数据 | 含 PR019 55×55×75 与 Custom 100×80×50 等 |
| 预期结果 | Generating 态后产出可用刀版文件 |
| 实际结果 | 按钮 Generating...；`GET .../model?...&format=eps` → `application/x-eps`（poppler）。多尺寸 BoundingBox 已记录。非 eps format 多为 ~2KB PDF stub。 |
| 截图 | 会话 Generating 态；`evidence/dieline-crashlock-*.eps` |
| 网络请求证据 | `phase2-en-dieline-model-api.txt`；TC-DL-03 |
| 结论 | **Passed** |
| 置信度 | 已验证 |
