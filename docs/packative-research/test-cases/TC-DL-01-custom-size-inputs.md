# TC-DL-01 自定义尺寸输入

| 字段 | 内容 |
|------|------|
| 测试编号 | TC-DL-01 |
| 测试目标 | 产品页 Custom 模式接受 L/W/H |
| 操作步骤 | 打开 productbox-crashlock → Custom → 输入 100,80,50 |
| 输入数据 | 100×80×50 mm |
| 预期结果 | 输入框接受数值；刀版下载可点 |
| 实际结果 | 数值写入成功；Dieline 在尺寸齐全后可点；公开页无内嵌实时刀版几何面板（几何在 EPS/编辑器侧） |
| 截图 | evidence/phase2-productbox-custom-100x80x50.png |
| 网络请求证据 | POST papi.../public/online/price |
| 结论 | **Passed** |
| 置信度 | 已验证 |
