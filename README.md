# PackFlow Toolbox (Vue3 + Django SaaS)

韩国优先的包装 / 物流工具箱。前端在 `global-toolbox-vue3/`；后端 Django DRF；Compose 网关固定 **Caddy**。前端由 Compose **多阶段构建**进命名卷，无需宿主机先 `npm run build`。

## 当前能力

| 部分 | 状态 |
|------|------|
| Vue3 工具箱（SEO 路由、本地 IndexedDB） | Compose 静态交付 |
| API health + 邮箱注册登录 + Team 多租户 | TASK 01–02 |
| 云端 Scheme v1 + Revision | TASK 03–04 |
| Vue 登录 + CloudSchemeAdapter | TASK 05 |
| 文件上传 + Excel 映射 | TASK 06 |
| 单据报告（P/L · CI · Diff） | TASK 07 |
| Celery + engine-ts 装柜可信计算 | TASK 08 |
| CI / 备份 / SEO / request_id / 隐私占位 | TASK 09 |

**TLS：** 本地 Compose 默认 **HTTP `8080:80`**，未启用 Let’s Encrypt。生产示例见 `deploy/caddy/Caddyfile.prod.example`。

## 本地 Compose

```bash
cp .env.example .env
# 编辑 .env：DJANGO_SECRET_KEY、POSTGRES_PASSWORD；可选 SITE_ORIGIN=http://localhost:8080

docker compose -f deploy/compose.yml --env-file .env up -d --build
```

| 服务 | 作用 |
|------|------|
| `frontend` | `npm run build`（含 prerender）→ 卷 `frontend_dist` 后退出 |
| `caddy` | 静态 + `/api` 反代（唯一公网口） |
| `api` | Django/Gunicorn |
| `worker` | Celery（计算任务） |
| `engine_ts` | Node 装柜引擎（内网） |
| `redis` | Celery broker（内网） |
| `postgres` | 数据（内网） |

### 健康

```bash
curl http://localhost:8080/api/v1/health/ready/
curl -sI http://localhost:8080/api/v1/health/live/ | grep -i x-request-id
curl -s http://localhost:8080/ko/legal/privacy/ | head
```

### 云端装柜验证（需登录）

```bash
# 创建 scheme 后：
# POST /api/v1/calculations/jobs/  Header: Idempotency-Key
# GET  /api/v1/calculations/jobs/{id}/result/  → serverVerified + engineVersion
```

### 备份 / 恢复

```bash
sh deploy/scripts/backup.sh
# → backups/packflow-<UTC>/postgres.dump + media.tar

sh deploy/scripts/restore.sh backups/packflow-<UTC>
# 停 api/worker → 恢复 DB/media → 再起。禁止用 down -v 当恢复。
# Redis 不备份（仅 broker）。
```

### 测试

```bash
docker compose -f deploy/compose.yml --env-file .env exec api python manage.py test tests
cd global-toolbox-vue3 && npm test -- --run && npm run build
```

### CI / Pages

- PR：`.github/workflows/ci.yml`（前端 test+build；后端 Postgres + Django test）
- Pages：`.github/workflows/deploy-pages.yml` 使用 **`npm run build`**（含 prerender）。可用 repo `vars.SITE_ORIGIN` / `VITE_BASE`。
- **Pages 无后端 API**；完整 SaaS 用 Compose。

### 日志

```bash
docker compose -f deploy/compose.yml --env-file .env logs --tail=200 api worker
```

响应头与 JSON 均含 `requestId` / `X-Request-Id`。

## 目录

```
backend/                 # Django DRF
engine-ts/               # 装柜可信计算（container）
global-toolbox-vue3/     # Vue3 前端
deploy/compose.yml
deploy/scripts/backup.sh
deploy/scripts/restore.sh
deploy/caddy/Caddyfile
deploy/caddy/Caddyfile.prod.example
```
