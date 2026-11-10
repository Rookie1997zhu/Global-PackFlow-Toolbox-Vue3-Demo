# TC-STUDIO-06 多盒型 Studio 同构

| 字段 | 内容 |
|------|------|
| 测试编号 | TC-STUDIO-06 |
| 测试目标 | mailer / sleeve / pillow 进 editor 后工具条与 dieline/mask CDN、main-design-gen 是否与 crashlock 同构 |
| 操作步骤 | 1. KO PDP 选 실시간 간편 디자인 进 editor 2. 记录 URL/designId/工具 3. 至少一盒跑 메인 영역 생성 4. 对照 mask 路径 |
| 输入数据 | mailerbox 160×160×70；pillowbox PI016 100×65×20；sleeve PDP |
| 预期结果 | `/editor/{productCode}/…&designId=`；CDN `dielines/{productCode}/{L}_{W}_{H}/`；main-design-gen 字段同构 |
| 实际结果 | **mailerbox Passed**：main-design-gen 使用 `…/dielines/mailerbox/160_160_70/{dieline,total_mask,area_mask}.png`。**pillowbox Passed（入口+资源）**：editor 工具同构；加载 `…/pillowbox/100_65_20/area_mask.png`。**sleeve Partial**：PDP 有 Easy Design，但本轮无法选到标准尺寸进入 editor。 |
| 截图 | `evidence/phase3-multibox-mailer-editor.png`；`phase3-multibox-pillow-editor.png`；`phase3-multibox-sleeve-pdp.png` |
| 网络请求证据 | `evidence/phase3-multibox-studio.txt` |
| 结论 | **Passed（mailer+pillow）**；sleeve **Partial** |
| 置信度 | 已验证（sleeve 入口未闭环） |
