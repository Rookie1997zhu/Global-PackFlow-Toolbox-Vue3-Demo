# TC-DL-04 非法尺寸矩阵

| 字段 | 内容 |
|------|------|
| 测试编号 | TC-DL-04 |
| 测试目标 | 超限/关系违例尺寸被拒，并暴露可读约束 |
| 操作步骤 | 1) EN PDP Custom 填非法 L/W/H 2) `GET papi.../model?...&format=eps` 对照 |
| 输入数据 | 见 `evidence/phase3-illegal-size-boundaries.txt` |
| 预期结果 | API 400 + 稳定 message；UI 提示最小尺寸或通用不支持 |
| 实际结果 | **Passed**。crashlock API：`calc-700` 系列 `length/width/height-to-small\|to-big`、`length-2third-width`；`targetValue` 给出阈值（L/H 25–400，W 25–350）。UI：`Length/Height must be at least 25mm.`；其它违例 `Selected dimensions aren't supported...`。mailer/pillow 最小边提示不同（50/30）。 |
| 截图 | `phase3-illegal-size-ui-length-min.png`；`phase3-illegal-size-ui-unsupported.png` |
| 网络请求证据 | `phase3-illegal-size-api.txt`；`phase3-illegal-size-boundaries.txt`；`phase3-illegal-size-summary.txt` |
| 结论 | **Passed** |
| 置信度 | 已验证（crashlock 细）；其它盒型抽样 |
