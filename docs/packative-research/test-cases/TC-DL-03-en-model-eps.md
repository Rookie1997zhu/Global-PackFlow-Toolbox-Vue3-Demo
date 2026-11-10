# TC-DL-03 EN 刀版 model EPS

| 字段 | 内容 |
|------|------|
| 测试编号 | TC-DL-03 |
| 测试目标 | 验证英文 PDP 刀版下载 API 与尺寸差分 |
| 操作步骤 | 1. 登录 `/en/account` 2. 打开 `/en/products/productbox-crashlock` 3. Custom 填 LWH 4. 点 Dieline File 5. 另用 curl 拉多组尺寸 |
| 输入数据 | 100×80×50；120×90×60；55×55×75；format=eps |
| 预期结果 | 得到可下载刀版文件；尺寸变化反映在几何上 |
| 实际结果 | Passed — `GET /public/online/model?...&format=eps`；三组 BoundingBox 不同；非 eps 探测得 ~2KB PDF |
| 截图/文件 | `evidence/dieline-crashlock-*.eps`；`evidence/phase2-en-dieline-model-api.txt` |
| 网络请求证据 | `papi.packative.com/public/online/model`；`Content-Type: application/x-eps` |
| 结论 | Passed |
| 置信度 | 已验证 |
