# 智能食堂点餐与取餐微服务系统

> 面向校园/园区的智能食堂系统，支持在线点餐、商家接单备餐、扫码取餐、大屏实时显示取餐队列。

---

## 📋 项目概述

本项目为《分布式系统架构》课程大作业，基于 **Spring Cloud Alibaba** 微服务架构开发，包含以下核心能力：

- 用户注册/登录与 JWT 鉴权
- 菜品与菜单管理（库存、上下架、时段）
- 订单全流程（下单 → 接单 → 制作 → 待取餐 → 已取餐）
- 取餐排队叫号与 WebSocket 实时推送
- 统一网关入口（路由、JWT 校验、限流）

**交付物**：源码 + 架构设计文档 + K3S 部署方案 + 软件工程文档（需求/概要/详细设计/测试用例/测试报告）。

---

## 🛠️ 技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| 语言 | Java | **17 (LTS)** |
| 基础框架 | Spring Boot | 3.2.5 |
| 微服务 | Spring Cloud | 2023.0.1 |
| 服务治理 | Spring Cloud Alibaba | 2023.0.1.0 |
| 服务注册/配置 | Nacos | **2.2.3** |
| API 网关 | Spring Cloud Gateway | 4.1.x |
| 数据持久化 | MyBatis-Plus | 3.5.6 |
| 数据库 | MySQL | 8.0 |
| 缓存/队列 | Redis | 7.x |
| 鉴权 | JJWT | 0.12.5 |
| 容器编排 | K3S (k3d) | v1.31.5-k3s1 |
| 构建工具 | Maven | 3.9.x |
| 操作系统 | Windows 11 | — |

---

## 🏗️ 服务划分

| 服务名 | 端口 | 职责 |
|--------|------|------|
| **canteen-gateway** | `8080` | 统一入口、JWT 校验、限流、路由转发、WebSocket 代理 |
| **canteen-user-service** | `8081` | 用户注册/登录、JWT 颁发、Token 刷新、用户信息管理 |
| **canteen-menu-service** | `8082` | 菜品 CRUD、菜单发布、库存管理、上下架控制 |
| **canteen-order-service** | `8083` | 下单、状态机流转、超时自动取消、取餐码生成 |
| **canteen-pickup-service** | `8084` | 窗口 FIFO 队列、商家叫号、取餐核销、大屏数据 |
| **canteen-common** | — | 公共 DTO、工具类、异常定义、常量 |

---

## 🌐 端口总览

```
┌─────────────────────────────────────────────┐
│  外部访问端口                                  │
├─────────────────────────────────────────────┤
│  Gateway (用户入口)        →  8080           │
│  Nacos 控制台               →  8848           │
│  Nacos gRPC                 →  9848           │
│  MySQL (开发环境)            →  3320          │
│  Redis (开发环境)            →  6379          │
│  各服务直接访问 (调试用)      →  8081~8084     │
└─────────────────────────────────────────────┘
```

---

## 🚀 快速开始

### 1. 前置要求

- **JDK 17** 已安装且 `JAVA_HOME` 配置正确
  ```powershell
  java -version  # 应显示 openjdk version "17"
  ```
- **Maven 3.9+**
  ```powershell
  mvn -version
  ```
- **Docker Desktop**（Windows 11 + WSL2 后端）
- **IDEA**（推荐 Ultimate 或 Community）

### 2. 启动基础设施

在项目根目录执行：

```powershell
docker compose up -d
```

或指定项目名：

```powershell
docker compose -p k3s_mysql_nacos up -d
```

等待约 30~60 秒后，验证：

| 组件 | 验证地址 | 预期结果 |
|------|---------|---------|
| Nacos | http://127.0.0.1:8848/nacos | 登录页（账号/密码：`nacos`/`nacos`） |
| MySQL | `127.0.0.1:3320` | 可被 JDBC 连接 |
| Redis | `127.0.0.1:6379` | 可被 Redis 客户端连接 |

### 3. 初始化业务数据库

当前仓库代码默认采用 **单库方案**（所有服务连接同一个库 `canteen`）。

连接 MySQL（端口 `3320`），执行以下建库语句：

```sql
CREATE DATABASE IF NOT EXISTS canteen 
  DEFAULT CHARACTER SET utf8mb4 
  DEFAULT COLLATE utf8mb4_unicode_ci;
```

> 当前项目未开启自动建表，请通过初始化 SQL 脚本手动维护表结构。

### 3.1 可选：切换为微服务独立数据库（4 库）

如果你希望按更标准的微服务方式演示，也可以改成 4 个独立数据库：

```sql
CREATE DATABASE IF NOT EXISTS canteen_user
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

CREATE DATABASE IF NOT EXISTS canteen_menu
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

CREATE DATABASE IF NOT EXISTS canteen_order
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

CREATE DATABASE IF NOT EXISTS canteen_pickup
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;
```

对应修改各服务 `application.yml`：

- `canteen-user-service` -> `jdbc:mysql://127.0.0.1:3320/canteen_user?...`
- `canteen-menu-service` -> `jdbc:mysql://127.0.0.1:3320/canteen_menu?...`
- `canteen-order-service` -> `jdbc:mysql://127.0.0.1:3320/canteen_order?...`
- `canteen-pickup-service` -> `jdbc:mysql://127.0.0.1:3320/canteen_pickup?...`

### 4. 编译项目

```powershell
# 在 smart-canteen/ 根目录执行
mvn -DskipTests package
```

### 5. 启动服务

在 IDEA 中依次启动（**必须先启动 Nacos**）：

1. `GatewayApplication`（端口 8080）
2. `UserServiceApplication`（端口 8081）
3. `MenuServiceApplication`（端口 8082）
4. `OrderServiceApplication`（端口 8083）
5. `PickupServiceApplication`（端口 8084）

验证：进入 Nacos 控制台 → 服务管理 → 服务列表，应能看到 5 个服务全部注册成功。

---

## 📁 项目结构

```text
Distributed_System_Architecture/
├── docker-compose.yml
├── README.md
└── smart-canteen/
    ├── pom.xml
    ├── canteen-common/
    │   ├── pom.xml
    │   └── src/
    │       ├── main/java/com/canteen/common/
    │       └── test/java/
    ├── canteen-gateway/
    │   ├── pom.xml
    │   └── src/
    │       ├── main/java/com/canteen/gateway/
    │       │   ├── GatewayApplication.java
    │       │   └── filter/JwtAuthGlobalFilter.java
    │       ├── main/resources/application.yml
    │       └── test/java/
    ├── canteen-user-service/
    │   ├── pom.xml
    │   └── src/
    │       ├── main/java/com/canteen/user/
    │       │   ├── UserServiceApplication.java
    │       │   ├── controller/
    │       │   ├── service/
    │       │   ├── mapper/
    │       │   └── entity/
    │       ├── main/resources/application.yml
    │       └── test/java/
    ├── canteen-menu-service/
    │   ├── pom.xml
    │   └── src/
    │       ├── main/java/com/canteen/menu/MenuServiceApplication.java
    │       ├── main/resources/application.yml
    │       └── test/java/
    ├── canteen-order-service/
    │   ├── pom.xml
    │   └── src/
    │       ├── main/java/com/canteen/order/OrderServiceApplication.java
    │       ├── main/resources/application.yml
    │       └── test/java/
    └── canteen-pickup-service/
        ├── pom.xml
        └── src/
            ├── main/java/com/canteen/pickup/PickupServiceApplication.java
            ├── main/resources/application.yml
            └── test/java/
```

---

## 🐳 Docker Compose 配置

```yaml
version: '3.8'
services:
  nacos:
    image: nacos/nacos-server:v2.2.3
    container_name: nacos
    environment:
      - MODE=standalone
    ports:
      - "8848:8848"
      - "9848:9848"
    restart: unless-stopped

  mysql:
    image: mysql:8.0
    container_name: mysql
    environment:
      MYSQL_ROOT_PASSWORD: root
      MYSQL_DATABASE: canteen
    ports:
      - "3320:3306"
    volumes:
      - mysql_data:/var/lib/mysql
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    container_name: redis
    ports:
      - "6379:6379"
    restart: unless-stopped

volumes:
  mysql_data:
```

### 常用命令

```powershell
# 启动
docker compose up -d

# 查看日志
docker logs -f nacos --tail 50
docker logs -f mysql --tail 30

# 停止
docker compose down

# 彻底清理（含数据卷）
docker compose down -v
```

---

## 🔧 开发配置速查

### 数据库连接（各服务 application.yml 通用）

```yaml
spring:
  datasource:
    url: jdbc:mysql://127.0.0.1:3320/canteen?useUnicode=true&characterEncoding=utf-8&serverTimezone=Asia/Shanghai
    username: root
    password: root
    driver-class-name: com.mysql.cj.jdbc.Driver
```

> 说明：上面是当前仓库默认的单库配置；如果切换为多库方案，请把不同服务改成各自数据库名（`canteen_user/menu/order/pickup`）。

### Nacos 注册中心

```yaml
spring:
  cloud:
    nacos:
      discovery:
        server-addr: 127.0.0.1:8848
```

### Redis

```yaml
spring:
  redis:
    host: 127.0.0.1
    port: 6379
```

---

## ⚠️ 常见问题

### Nacos 控制台打不开

1. 等待 30~60 秒（首次启动较慢）
2. 使用 `http://127.0.0.1:8848/nacos` 访问（避免 `localhost` 解析问题）
3. 检查容器状态：`docker ps -a`
4. 查看日志：`docker logs nacos --tail 50`

### 服务注册不上 Nacos

1. 确认 Nacos 已完全启动（日志出现 `Nacos started successfully`）
2. 检查 `spring.cloud.nacos.discovery.server-addr` 是否为 `127.0.0.1:8848`
3. 确认没有防火墙拦截 8848/9848 端口

### K3d 部署时镜像无法拉取

K3d 默认无法直接访问本地 Docker 镜像，需手动导入：

```powershell
# 先本地构建
docker build -t canteen-user-service:1.0.0 ./canteen-user-service

# 导入到 k3d 集群
k3d image import canteen-user-service:1.0.0 -c mycluster
```

### MySQL 8.0 驱动兼容性

Spring Boot 3.x 使用 `com.mysql.cj.jdbc.Driver`，POM 中依赖 `mysql-connector-j`（非旧版 `mysql-connector-java`）。

---

## 📌 后续里程碑

| 阶段 | 目标 | 预估时间 |
|------|------|---------|
| ① 骨架搭建 | 5 个服务全部在 Nacos 注册成功 | 1 天 |
| ② 用户服务 | 注册/登录/JWT/Token 刷新 | 1~2 天 |
| ③ 菜品服务 | CRUD/库存/上下架/时段 | 1~2 天 |
| ④ 订单服务 | 下单/状态机/超时取消/取餐码 | 2 天 |
| ⑤ 取餐服务 | FIFO 队列/叫号/核销/WebSocket | 2 天 |
| ⑥ 网关完善 | JWT 统一校验/限流/WebSocket 代理 | 1 天 |
| ⑦ 测试覆盖 | 单元测试 + 集成测试 | 2 天 |
| ⑧ K3S 部署 | Dockerfile + K3S YAML + 验证 | 2 天 |
| ⑨ 文档编写 | 7 份交付文档 | 并行进行 |

---

## 👤 作者信息

- **课程**：《分布式系统架构》大作业
- **环境**：Windows 11 + Docker Desktop + k3d + Java 17
- **日期**：2026-04

---

> **提示**：本文档随项目迭代持续更新，最新版本以仓库内 `README.md` 为准。
