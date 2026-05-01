# 智能食堂项目 K3S（k3d）部署方案（Windows 11）

本文面向你当前环境：

- 操作系统：Windows 11
- Kubernetes：`k3d + k3s`
- 集群：`mycluster`（已存在，已执行 `k3d cluster start mycluster`）
- Nacos：已在宿主机正确运行（`8848`）

目标是把后端微服务（gateway/user/menu/order/pickup）部署到 K3S，并保持与宿主机上的 Nacos/MySQL/Redis 联通。

> 推荐使用仓库中的独立目录 `k3s-version/` 实施部署，避免改动 `smart-canteen/` 与 `smart-canteen-web/`。

---

## 1. 部署架构说明

当前推荐架构（最小改动）：

- K3S 内运行：
  - `canteen-gateway`
  - `canteen-user-service`
  - `canteen-menu-service`
  - `canteen-order-service`
  - `canteen-pickup-service`
- 宿主机（Windows + Docker Desktop）继续运行：
  - Nacos（`8848`）
  - MySQL（`3320`）
  - Redis（`6379`）

关键点：

- 在 Pod 内**不能用** `127.0.0.1` 访问宿主机服务。
- k3d 场景下建议统一改为 `host.k3d.internal`，例如：
  - `host.k3d.internal:8848`（Nacos）
  - `host.k3d.internal:3320`（MySQL）
  - `host.k3d.internal:6379`（Redis）

---

## 2. 前置检查

在 PowerShell 执行：

```powershell
k3d cluster list
kubectl config current-context
kubectl get nodes
```

确认当前上下文是 `k3d-mycluster`，节点状态 `Ready`。

---

## 3. 配置改造策略（核心）

你当前各服务 `application.yml` 中大量使用 `127.0.0.1`。部署到 K3S 时，建议通过 **Nacos 配置中心** 覆盖（优先），避免改代码。

### 3.1 需要在 Nacos 中调整的配置项

以下 DataId（`DEFAULT_GROUP`）建议全部改为宿主机地址：

- `canteen-gateway.yml`
- `canteen-user-service.yml`
- `canteen-menu-service.yml`
- `canteen-order-service.yml`
- `canteen-pickup-service.yml`

示例（以用户服务为例）：

```yaml
spring:
  cloud:
    nacos:
      discovery:
        server-addr: host.k3d.internal:8848
      config:
        server-addr: host.k3d.internal:8848
  datasource:
    url: jdbc:mysql://host.k3d.internal:3320/canteen_user?useUnicode=true&characterEncoding=utf-8&serverTimezone=Asia/Shanghai
    username: root
    password: root
  redis:
    host: host.k3d.internal
    port: 6379
```

其他 3 个业务服务只需替换各自数据库名：

- `canteen_menu`
- `canteen_order`
- `canteen_pickup`

Gateway 也要把：

- `spring.cloud.nacos.discovery.server-addr`
- `spring.cloud.nacos.config.server-addr`
- `spring.redis.host`

改为 `host.k3d.internal` 方案。

> 若你暂时不想改 Nacos，也可通过 K8s `env` 强制注入 Spring 属性；但你项目已接入 Nacos，推荐把“运行时地址”统一维护在 Nacos。

---

## 4. 镜像构建与导入（k3d 必做）

项目当前建议使用 `k3s-version/dockerfiles/*.Dockerfile`（独立部署版），不修改原服务目录。

### 4.1 Dockerfile 位置（独立目录）

路径示例：`k3s-version/dockerfiles/user.Dockerfile`

```dockerfile
FROM eclipse-temurin:17-jre
WORKDIR /app
COPY target/*.jar app.jar
EXPOSE 8081
ENTRYPOINT ["java","-jar","/app/app.jar"]
```

按服务修改 `EXPOSE`：

- gateway: `8080`
- user: `8081`
- menu: `8082`
- order: `8083`
- pickup: `8084`

### 4.2 打包 Jar

```powershell
cd .\smart-canteen
mvn -DskipTests clean package
```

### 4.3 构建镜像

在项目根目录执行（示例版本 `v1`）：

```powershell
docker build -t canteen-gateway:v1 .\smart-canteen\canteen-gateway
docker build -t canteen-user-service:v1 .\smart-canteen\canteen-user-service
docker build -t canteen-menu-service:v1 .\smart-canteen\canteen-menu-service
docker build -t canteen-order-service:v1 .\smart-canteen\canteen-order-service
docker build -t canteen-pickup-service:v1 .\smart-canteen\canteen-pickup-service
```

### 4.4 导入到 k3d 集群

```powershell
k3d image import canteen-gateway:v1 -c mycluster
k3d image import canteen-user-service:v1 -c mycluster
k3d image import canteen-menu-service:v1 -c mycluster
k3d image import canteen-order-service:v1 -c mycluster
k3d image import canteen-pickup-service:v1 -c mycluster
```

---

## 5. K8S 资源编排建议

建议目录：

```text
k8s/
  namespace.yaml
  gateway.yaml
  user.yaml
  menu.yaml
  order.yaml
  pickup.yaml
```

### 5.1 Namespace

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: canteen
```

### 5.2 服务模板（Deployment + Service）

以下为 `canteen-user-service` 示例，其它服务同理替换名称、端口、镜像。

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: canteen-user-service
  namespace: canteen
spec:
  replicas: 1
  selector:
    matchLabels:
      app: canteen-user-service
  template:
    metadata:
      labels:
        app: canteen-user-service
    spec:
      containers:
        - name: canteen-user-service
          image: canteen-user-service:v1
          imagePullPolicy: IfNotPresent
          ports:
            - containerPort: 8081
          env:
            - name: SPRING_CLOUD_NACOS_DISCOVERY_SERVER_ADDR
              value: host.k3d.internal:8848
            - name: SPRING_CLOUD_NACOS_CONFIG_SERVER_ADDR
              value: host.k3d.internal:8848
---
apiVersion: v1
kind: Service
metadata:
  name: canteen-user-service
  namespace: canteen
spec:
  selector:
    app: canteen-user-service
  ports:
    - port: 8081
      targetPort: 8081
```

### 5.3 Gateway 暴露方式

推荐先用 `NodePort`（简单直接）：

```yaml
apiVersion: v1
kind: Service
metadata:
  name: canteen-gateway
  namespace: canteen
spec:
  type: NodePort
  selector:
    app: canteen-gateway
  ports:
    - port: 8080
      targetPort: 8080
      nodePort: 30080
```

访问地址：

- `http://localhost:30080`

> 后续可升级为 Ingress（traefik）+ 域名路由。

---

## 6. 一键部署步骤

```powershell
kubectl apply -f .\k8s\namespace.yaml
kubectl apply -f .\k8s\user.yaml
kubectl apply -f .\k8s\menu.yaml
kubectl apply -f .\k8s\order.yaml
kubectl apply -f .\k8s\pickup.yaml
kubectl apply -f .\k8s\gateway.yaml
```

检查状态：

```powershell
kubectl get pods -n canteen -o wide
kubectl get svc -n canteen
```

查看日志（示例）：

```powershell
kubectl logs -n canteen deploy/canteen-gateway --tail=200
kubectl logs -n canteen deploy/canteen-user-service --tail=200
```

---

## 7. 验收清单（最小可用）

- Pod 全部 `Running`，无 `CrashLoopBackOff`
- Nacos 控制台出现 5 个服务注册
- 通过 Gateway 成功访问：
  - `GET /api/user/*`
  - `GET /api/menu/*`
  - `GET /api/order/*`
  - `GET /api/pickup/*`
- 前端将 API 基地址指向 `http://localhost:30080`

---

## 8. 常见问题排查

### 8.1 服务启动后连不上 Nacos

排查顺序：

1. Pod 内地址是否仍是 `127.0.0.1:8848`
2. `host.k3d.internal` 是否可解析
3. Windows 防火墙是否拦截 8848 端口

可用以下命令快速验证：

```powershell
kubectl exec -it -n canteen deploy/canteen-user-service -- sh
# 进入后执行
nc -zv host.k3d.internal 8848
```

### 8.2 镜像拉取失败

- 确认已经执行 `k3d image import ... -c mycluster`
- Deployment 中 `imagePullPolicy` 使用 `IfNotPresent`

### 8.3 网关可用但下游 503

通常是下游服务未注册到 Nacos，或 Nacos 配置中的数据库地址仍是 `127.0.0.1`。

---

## 9. 后续优化建议（可选）

- 将 MySQL/Redis 也迁入 K3S（StatefulSet + PVC），形成完整集群内闭环
- Gateway 增加 `readinessProbe/livenessProbe`
- 使用 HPA 按 CPU/内存自动扩缩容
- 增加灰度发布策略（基于标签或网关权重）

---

如果你需要，我可以下一步直接帮你在仓库里补齐 `k8s/*.yaml` 与 5 个服务 Dockerfile，让这份方案变成可直接 `kubectl apply` 的落地版本。
