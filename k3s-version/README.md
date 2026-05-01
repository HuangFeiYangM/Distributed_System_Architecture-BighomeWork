# k3s-version 离线独立部署包（方式 B）

本目录可做成“单文件夹迁移部署包”。

- 源电脑（有完整项目源码）执行一次打包脚本，产出：
  - `artifacts/`（jar + 前端 dist）
  - `images/*.tar`（6 个镜像离线包）
- 目标电脑只需要拿到 `k3s-version/` 目录，即可部署，不依赖原仓库源码。

适用环境：

- Windows 11
- k3d/k3s
- 宿主机已运行：Nacos(`8848`)、MySQL(`3320`)、Redis(`6379`)

---

## A. 源电脑（制作离线包）

要求：源电脑上有完整项目目录（含 `smart-canteen/`、`smart-canteen-web/`）。

在项目根目录执行：

```powershell
powershell -ExecutionPolicy Bypass -File .\k3s-version\scripts\prepare-offline-bundle.ps1 -ImageTag v1
```

执行完成后，`k3s-version/` 内会包含：

- `artifacts/backend/*.jar`
- `artifacts/web/dist/*`
- `images/*.tar`

把整个 `k3s-version/` 文件夹复制到目标电脑即可。

---

## B. 目标电脑（离线部署）

要求：

- 已安装 Docker Desktop、k3d、kubectl
- 已创建或启动集群（例如 `mycluster`）
- 宿主机上 Nacos/MySQL/Redis 可访问

在 `k3s-version` 的上级目录执行：

```powershell
powershell -ExecutionPolicy Bypass -File .\k3s-version\scripts\deploy-offline.ps1 -ClusterName mycluster -ImageTag v1
```

脚本会自动执行：

1. `docker load` 载入离线镜像
2. `k3d image import` 导入集群
3. `kubectl apply` 部署前后端

---

## C. 原电脑启动方式（共用现有依赖）

如果你在源电脑直接演练（不拷贝到其他电脑），按以下步骤执行即可。

前提：

- 宿主机依赖已启动：Nacos(`8848`)、MySQL(`3320`)、Redis(`6379`)
- 已准备好离线包（已执行过 `prepare-offline-bundle.ps1`）

命令：

```powershell
k3d cluster start mycluster
kubectl config use-context k3d-mycluster
kubectl get nodes

powershell -ExecutionPolicy Bypass -File .\k3s-version\scripts\deploy-offline.ps1 -ClusterName mycluster -ImageTag v1
```

> 说明：当前部署使用独立命名空间 `canteen-offline`，不会覆盖原先 `canteen` 命名空间的 K8S 资源；但会共用同一套 MySQL/Redis/Nacos 数据。

---

## D. 手动启动方式（不走 deploy-offline.ps1）

若你希望逐条命令手动执行，可按以下顺序：

```powershell
# 1) 启动集群
k3d cluster start mycluster
kubectl config use-context k3d-mycluster

# 2) 载入离线镜像到 Docker
docker load -i .\k3s-version\images\canteen-gateway-v1.tar
docker load -i .\k3s-version\images\canteen-user-service-v1.tar
docker load -i .\k3s-version\images\canteen-menu-service-v1.tar
docker load -i .\k3s-version\images\canteen-order-service-v1.tar
docker load -i .\k3s-version\images\canteen-pickup-service-v1.tar
docker load -i .\k3s-version\images\smart-canteen-web-v1.tar

# 3) 导入镜像到 k3d
k3d image import canteen-gateway:v1 -c mycluster
k3d image import canteen-user-service:v1 -c mycluster
k3d image import canteen-menu-service:v1 -c mycluster
k3d image import canteen-order-service:v1 -c mycluster
k3d image import canteen-pickup-service:v1 -c mycluster
k3d image import smart-canteen-web:v1 -c mycluster

# 4) 部署资源
kubectl apply -f .\k3s-version\k8s\namespace.yaml
kubectl apply -f .\k3s-version\k8s\user.yaml
kubectl apply -f .\k3s-version\k8s\menu.yaml
kubectl apply -f .\k3s-version\k8s\order.yaml
kubectl apply -f .\k3s-version\k8s\pickup.yaml
kubectl apply -f .\k3s-version\k8s\gateway.yaml
kubectl apply -f .\k3s-version\k8s\web.yaml
```

如果镜像 tag 不是 `v1`（例如 `v2`），额外执行：

```powershell
kubectl set image deployment/canteen-gateway canteen-gateway=canteen-gateway:v2 -n canteen-offline
kubectl set image deployment/canteen-user-service canteen-user-service=canteen-user-service:v2 -n canteen-offline
kubectl set image deployment/canteen-menu-service canteen-menu-service=canteen-menu-service:v2 -n canteen-offline
kubectl set image deployment/canteen-order-service canteen-order-service=canteen-order-service:v2 -n canteen-offline
kubectl set image deployment/canteen-pickup-service canteen-pickup-service=canteen-pickup-service:v2 -n canteen-offline
kubectl set image deployment/smart-canteen-web smart-canteen-web=smart-canteen-web:v2 -n canteen-offline
```

---

## E. 验证

```powershell
kubectl get pods -n canteen-offline
kubectl get svc -n canteen-offline
```

访问地址：

- 后端网关：`http://localhost:30080`
- 前端页面：`http://localhost:30173`

---

## F. k3d 下访问说明（重要）

在 k3d 环境中，`NodePort` 不一定会自动映射到宿主机 `localhost`。

如果你发现：

- Pod 全部 `Running`
- `kubectl get svc` 正常
- 但浏览器访问 `http://localhost:30173` 或 `http://localhost:30080` 无法连接

请使用 `port-forward` 作为标准访问方式：

```powershell
# 前端
kubectl port-forward -n canteen-offline svc/smart-canteen-web 30173:80

# 网关（可选，另开一个终端）
kubectl port-forward -n canteen-offline svc/canteen-gateway 30080:8080
```

然后访问：

- 前端：`http://localhost:30173`
- 网关：`http://localhost:30080`

> 注意：`port-forward` 命令窗口必须保持运行，关闭后转发会失效。

---

## G. 关键实现说明

- `k8s/*.yaml` 中默认镜像 tag 是 `v1`。
- 若你传入其他 tag（如 `v2`），`deploy-offline.ps1` 会自动执行 `kubectl set image` 更新 deployment。
- 后端通过环境变量覆盖配置，不改原工程：
  - Nacos：`host.k3d.internal:8848`
  - MySQL：`host.k3d.internal:3320`
  - Redis：`host.k3d.internal:6379`
- 前端镜像使用 `nginx/default.conf`，在集群内转发：
  - `/api` -> `canteen-gateway.canteen-offline.svc.cluster.local:8080`
  - `/ws` -> `canteen-gateway.canteen-offline.svc.cluster.local:8080`

---

## H. 停止与清理部署

### H.1 只停止/清理 k3s-version 这套资源（推荐）

本方案所有资源都在命名空间 `canteen-offline`，直接删除该命名空间即可：

```powershell
kubectl delete namespace canteen-offline
```

验证：

```powershell
kubectl get ns
kubectl get pods -n canteen-offline
```

> 若提示命名空间不存在，说明已清理完成。

### H.2 停止整个 k3d 集群

如果你想把整套 k8s 都停掉（不仅是本项目）：

```powershell
k3d cluster stop mycluster
```

后续可恢复：

```powershell
k3d cluster start mycluster
```

### H.3 关闭本地端口转发（如有）

若你使用了 `port-forward`，在对应命令窗口按 `Ctrl + C` 或直接关闭窗口即可。
