# TC-AUTH-01 Google + Supabase / Store 双轨

| 字段 | 内容 |
|------|------|
| 测试编号 | TC-AUTH-01 |
| 测试目标 | 确认登录依赖；区分账户会话与 store customer |
| 操作步骤 | 1) `/en/login` → Google/邮箱 → `/en/account` 2) `GET /api/customer` 3) KO 社交登录（Kakao/Naver/Google via store）后复测 customer 与 `/editor` |
| 输入数据 | 用户账号（人工；聊天不记密码） |
| 预期结果 | Supabase 账户可用；进编辑器需 Medusa store customer |
| 实际结果 | Supabase：`/en/account` Passed，Cookie `sb-*-auth-token`。仅此轨时 `customer:null`，editor/刀版登录墙。Store 社交登录后 `_medusa_jwt`，`/api/customer` 有对象，editor 可进。 |
| 截图 | `evidence/phase0-google-oauth-supabase.png`；`evidence/phase1-editor-login-wall.png` |
| 网络请求证据 | `zumxseuiallfcixygtch.supabase.co`；`store.packative.com/store/auth/*`；`/api/customer` |
| 结论 | **Passed（双轨边界已澄清）** — Auth 会话与 store customer 分流 |
| 置信度 | 已验证 |
