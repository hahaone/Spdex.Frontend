# Web 节点运维手册

日期：2026-06-10

## 1. 当前拓扑

- 公网入口：阿里云 ALB `alb-o6t5310kd8qw84hrny`
- HTTPS 监听：`443`
- HTTP 监听：`80`，重定向到 HTTPS
- Web 服务器组：`sgp-x79oz7rkqi69qcas5v | Web2026服务器组`
- 当前 Web 节点：
  - `web1`：`10.111.0.64`，`web_node_id=1`
  - `web2`：`10.111.1.136`，`web_node_id=2`
- 后端 API：
  - SPdex WebApi：`http://10.28.23.149:5000`
  - Quantilearn API：`http://10.28.23.149:5015`

Web 节点只运行 Nuxt 前端容器和 Nginx，不运行 Redis、数据库或后端 API。

## 2. 文件边界

生产 Web 多节点发布只使用本仓库的 Ansible：

```text
Spdex.Frontend/deploy/web/ansible/
```

`Spdex.Core/deploy/web/` 只保留标准镜像/手工部署参考文件，不参与 CI 发布。

## 3. 自动发布规则

### 3.1 提交触发

```text
git commit -m "feat: xxx [build]"   -> 只构建变更前端镜像
git commit -m "feat: xxx [deploy]"  -> 构建并部署变更前端服务
```

`[deploy]` 拼写必须准确；`[depoly]` 不会触发部署。

### 3.2 增量发布

默认发布模式是增量发布：

- 只构建当前提交涉及的前端子项目。
- 只重启变更服务对应的容器。
- 未变更服务继续使用节点上当前正在运行的镜像引用。
- 发布后仍会校验所有 Web 节点的关键路由和响应头。

以下变更会触发全量构建：

- `.github/workflows/deploy.yml`
- `deploy/web/ansible/**`
- 手动触发时选择 `release_scope=all`

### 3.3 手动触发参数

在 GitHub Actions `Build & Deploy Frontend` 中手动运行：

- `deploy=true`：构建后部署到所有 Web 节点。
- `deploy=false`：只构建，不部署。
- `release_scope=changed`：只处理当前提交涉及的前端子项目。
- `release_scope=all`：全量构建并部署 5 个前端子项目。
- `image_distribution=archive`：默认方式，经 `image_source` 主机中转镜像。
- `image_distribution=pull`：Web ECS 可直接访问 ACR 时使用。

新 Web 节点第一次加入发布体系时必须用 `release_scope=all` 建立完整基线。

## 4. 响应头

每个 Web 节点都会由本机 Nginx 添加：

```http
X-SPdex-Web-Node: 1
X-SPdex-Web-Release: <git-sha>
```

`X-SPdex-Web-Node` 来自 Ansible inventory 中的 `web_node_id`。如果没有配置，会根据 inventory 主机名推导，例如 `web1` 推导为 `1`。

`X-SPdex-Web-Release` 来自 GitHub Actions 当前提交 SHA。发布后的 `verify-web-node.yml` 会逐台校验这两个响应头。

公网验证：

```bash
for i in $(seq 1 10); do
  curl -skI "https://new.spdex.com/login?node_check=$i" | grep -i '^x-spdex-web-'
done
```

如果只想验证某台节点本机：

```bash
curl -i -H 'Host: new.spdex.com' http://10.111.0.64/login | grep -i '^x-spdex-web-'
curl -i -H 'Host: new.spdex.com' http://10.111.1.136/login | grep -i '^x-spdex-web-'
```

## 5. 发布后校验

GitHub Actions 已自动执行：

- `ansible-playbook playbooks/verify-web-node.yml`
- 公网 ALB 路由冒烟验证

人工复核可执行：

```bash
curl -skI https://new.spdex.com/login
curl -skI https://2026.spdex.com/login
curl -skI https://fjcx.spdex.com/
curl -skI https://ql.spdex.com/
curl -skI https://admin2026.spdex.com/login
curl -I http://new.spdex.com/login
```

期望：

- HTTPS 页面返回 `200` 或业务允许的 `302`/`403`。
- HTTP 返回 `301` 或 `302` 到 HTTPS。
- 响应头里能看到 `X-SPdex-Web-Node` 和 `X-SPdex-Web-Release`。
- ALB 服务器组健康检查正常。

## 6. 判断命中哪台 Web 服务器

优先看响应头：

```bash
curl -skI https://new.spdex.com/login | grep -i '^x-spdex-web-node'
```

也可以在节点上看 Nginx 访问日志：

```bash
ssh root@10.111.0.64
tail -f /var/log/nginx/access.log
```

如果需要强制制造不同请求，给 URL 加随机查询参数，避免浏览器或中间层缓存影响观察：

```bash
curl -skI "https://new.spdex.com/login?t=$(date +%s%N)"
```

## 7. 新增 Web 节点

推荐流程：

1. 用标准 Web 镜像创建 ECS。
2. 选择同一个 VPC：`vpc-m5etfgxfe5134muv9b5wo`。
3. 尽量选择与已有节点不同的可用区。
4. 不分配公网 IP。
5. 确认跳板机能 SSH 到新节点。
6. 确认节点具备 Docker、Docker Compose plugin、Nginx 和 `/home/spdex/web`。
7. 在 GitHub Secret `WEB_ANSIBLE_INVENTORY` 中增加一行：

```ini
web3 ansible_host=10.111.x.x web_node_id=3 ansible_user=root ansible_ssh_private_key_file=~/.ssh/id_rsa ansible_ssh_common_args='-F ~/.ssh/config'
```

8. 手动触发 `Build & Deploy Frontend`：
   - `deploy=true`
   - `release_scope=all`
   - `image_distribution=archive`
9. 等 Actions 验证通过后，再把新 ECS 加入 ALB 服务器组：
   - 后端协议：HTTP
   - 后端端口：`80`
   - 权重：`100`
   - 健康检查路径：`/__alb_health`
10. 等 ALB 健康检查正常，再做公网响应头验证。

如果新节点已提前加入 ALB，发布前建议先将权重调为 `0` 或临时移出服务器组，验证通过后再恢复权重。

## 8. 版本同步原则

- 发布版本以 GitHub commit SHA 为准。
- 增量发布时，变更服务使用新 SHA 镜像，未变更服务保留节点上当前镜像引用。
- 全量发布时，全部 5 个前端服务都切到同一个新 SHA。
- 新节点必须先做一次全量发布，否则增量发布无法知道未变更服务应该使用哪个镜像。
- `/home/spdex/web/.env` 默认不会被覆盖，避免密钥和本地长期配置被 CI 改掉。

如果确实需要更新所有节点的 `.env`，应先确认变更内容，再在 Ansible 变量中显式设置 `web_env_force_update=true`。

## 9. 回滚

优先使用上一个已知正常的 Git SHA 回滚。

如果只是某个前端子项目出问题，可以回滚该服务对应镜像；如果无法判断影响范围，执行全量回滚。

本地或控制节点执行：

```bash
cd deploy/web/ansible
ansible-playbook \
  -i inventory/production.ini \
  playbooks/web-node.yml \
  --extra-vars @group_vars/all.yml \
  --extra-vars @group_vars/web_nodes.yml \
  --extra-vars "web_image_tag=<previous-sha>" \
  --extra-vars "web_image_distribution=pull"

ansible-playbook \
  -i inventory/production.ini \
  playbooks/verify-web-node.yml \
  --extra-vars @group_vars/all.yml \
  --extra-vars @group_vars/web_nodes.yml \
  --extra-vars "web_release_sha=<previous-sha>"
```

当前 GitHub Actions 没有暴露“指定旧 SHA 回滚”的输入项；紧急回滚可以先用 Ansible 执行，后续再补充 workflow 手动回滚入口。

## 10. 常见故障

### 10.1 增量部署失败

错误类似：

```text
Incremental deploy cannot find existing image refs for unchanged services
```

原因：新节点没有完整基线镜像。处理方式：手动触发 `release_scope=all`。

### 10.2 节点健康检查失败

在目标节点执行：

```bash
curl -i http://127.0.0.1/__alb_health
nginx -t
docker compose -f /home/spdex/web/docker-compose.yml ps
```

常见原因：

- Nginx 未启动或配置错误。
- 容器未启动。
- 安全组未允许 ALB 访问 TCP `80`。
- 节点没有加入正确的 ALB 服务器组。

### 10.3 NewSpdex 登录异常

检查内部 API 桥：

```bash
curl -i http://127.0.0.1:5000/api/newspdex/auth/me
```

未登录时返回 `401` 是正常结果，表示 Web 节点能打到后端鉴权接口。

如果连接失败，检查：

- `/etc/nginx/conf.d/spdex-web.conf`
- `SPDEX_BACKEND_PRIVATE_BASE_URL`
- 后端 `10.28.23.149:5000` 是否可从 Web 节点访问

### 10.4 发布耗时过长

优先确认本次是否触发了全量构建：

- workflow 自身变更会全量构建。
- Ansible 编排变更会全量构建。
- 手动 `release_scope=all` 会全量构建。

日常业务改动应保持在具体子项目目录内，让 CI 走增量部署。
