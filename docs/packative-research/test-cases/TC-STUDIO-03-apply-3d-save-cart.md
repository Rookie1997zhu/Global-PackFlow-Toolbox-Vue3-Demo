# TC-STUDIO-03 贴图 / 3D / 保存 / 购物车

| 字段 | 内容 |
|------|------|
| 测试编号 | TC-STUDIO-03 |
| 测试目标 | AI 图应用到刀版、切换 3D、保存并加入购物车 |
| 操作步骤 | 1. 生成图后点缩略图 2. 切 3D 3. 저장 4. 카트에 담기 |
| 输入数据 | Crash Lock 100×80×80；designId 会话内生成 |
| 预期结果 | 2D 面板有图案；3D 盒体加载；保存成功；购物车有该设计 |
| 实际结果 | 2D 贴图+变换手柄；3D EngView Collada+TextureResource+fold slider；`/v1/editor/upload`+`/save`；购物车 thumbnail 与报价。UV/蒙版细节见 06 与 `phase3-deepen-*`。 |
| 截图 | `phase3-ai-applied-to-dieline-2d.png`；`phase3-editor-3d-collada.png`；`phase3-cart-with-design.png`；`phase3-editor-2d-after-apply.png` |
| 网络请求证据 | `phase3-editor-2d3d-save.txt`；`phase3-deepen-3d-export-boxes.txt` |
| 结论 | **Passed** |
| 置信度 | 已验证 |
