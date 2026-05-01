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
| 服务调用 | Spring Cloud OpenFeign | 4.1.x |
| 服务治理 | Spring Cloud Alibaba | 2023.0.1.0 |
| 服务注册/配置 | Nacos | **2.2.3** |
| API 网关 | Spring Cloud Gateway | 4.1.x |
| 数据持久化 | MyBatis-Plus | 3.5.6 |
| 数据库 | MySQL | 8.0 |
| 缓存/队列 | Redis | 7.x |
| 鉴权 | JJWT | 0.12.5 |
| 前端框架 | Vue | 3.5.x |
| 前端构建 | Vite | 5.4.x |
| 前端语言 | TypeScript | 5.8.x |
| 前端路由 | Vue Router | 4.5.x |
| 前端状态管理 | Pinia | 2.3.x |
| 前端 UI 组件 | Element Plus | 2.9.x |
| 前端 HTTP 客户端 | Axios | 1.9.x |
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
| Nacos | http://127.0.0.1:8848/nacos | 控制台可访问（当前未开启鉴权） |
| MySQL | `127.0.0.1:3320` | 可被 JDBC 连接 |
| Redis | `127.0.0.1:6379` | 可被 Redis 客户端连接 |

### 3. 初始化业务数据库

当前仓库默认采用 **多库独立方案**（与 `database_init/init.sql` 一致）。

连接 MySQL（端口 `3320`），执行以下建库语句（或直接执行 `database_init/init.sql`）：

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

各服务数据库连接对应关系：

- `canteen-user-service` -> `jdbc:mysql://127.0.0.1:3320/canteen_user?...`
- `canteen-menu-service` -> `jdbc:mysql://127.0.0.1:3320/canteen_menu?...`
- `canteen-order-service` -> `jdbc:mysql://127.0.0.1:3320/canteen_order?...`
- `canteen-pickup-service` -> `jdbc:mysql://127.0.0.1:3320/canteen_pickup?...`

> 当前项目未开启自动建表，请通过初始化 SQL 脚本手动维护表结构。

### 3.2 导入 Nacos 配置中心模板

当前项目已启用 Nacos Config（`spring.config.import`），默认从 `DEFAULT_GROUP` 加载以下 DataId：

- `canteen-gateway.yml`
- `canteen-user-service.yml`
- `canteen-menu-service.yml`
- `canteen-order-service.yml`
- `canteen-pickup-service.yml`

模板文件已放在项目根目录 `nacos/`。

在 Nacos 控制台（配置管理 -> 配置列表）中手动新增配置：

- `DataId`：与文件名一致（如 `canteen-user-service.yml`）
- `Group`：`DEFAULT_GROUP`
- `配置格式`：`YAML`
- `配置内容`：复制对应 `nacos/*.yml` 文件内容

> 当前环境的 Nacos 暂未开启鉴权，不需要用户名密码；如后续开启鉴权，再补充 `spring.cloud.nacos.username/password`。

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

### 6. 启动前端（smart-canteen-web）

项目根目录已新增前端工程：`smart-canteen-web`（Vue 3 + Vite + TypeScript）。

```powershell
# 在项目根目录执行
cd smart-canteen-web
npm install
npm run dev
```

默认访问地址：`http://127.0.0.1:5173`

联调说明：

- 前端请求统一走 `/api/*`，由 Vite 代理到 `http://127.0.0.1:8080`。
- WebSocket 连接统一走 `/ws/*`，由 Vite 代理到 Gateway（`ws://127.0.0.1:8080`）。
- 后端返回采用统一响应体，前端需按 `code == 200` 判断业务成功（不能只看 HTTP 状态码）。

当前前端功能覆盖（持续迭代）：

- 通用：登录、退出、个人中心（查看个人信息、修改昵称/头像、刷新 Token）
- 学生端（P0）：今日菜单、下单、我的订单
- 商家端（P0/P1）：订单流转（接单/制作/完成）、叫号核销、菜品管理、菜单发布
- 管理员端（P0/P1）：窗口创建、窗口列表、用户列表
- 大屏端（P2）：窗口大屏数据、WebSocket 实时消息展示

## API 补齐清单（2026-04）

### P0 已补齐
- `GET /api/order/merchant`：商家订单分页查询，支持 `page,size,status,windowId,keyword,dateFrom,dateTo`
- `GET /api/menu/today`：返回增强字段 `merchantId,merchantName`（并保留菜单和菜品字段）
- `PUT /api/pickup/window/{id}`、`PUT /api/pickup/window/{id}/status`、`DELETE /api/pickup/window/{id}`
- `PUT /api/user/{id}/status`、`DELETE /api/user/{id}`

### P1 已补齐
- `GET /api/menu/list`：支持 `page,size,name,merchantId,saleDate,status,startDate,endDate`
- `GET /api/menu/{id}`：增强返回 `merchantId,merchantName,windowId,windowName,createTime,updateTime`
- `GET /api/menu/stock/merchant`：商家库存分页查询，支持 `page,size,keyword,status,menuId,dishId,saleDate`
- `GET /api/menu/stock/list`：管理员全局库存分页查询，支持 `page,size,merchantId,keyword,status,menuId,dishId,saleDate,lowStockOnly`
- `PUT /api/menu/stock/{menuDishId}`：库存操作接口，`op=SET|INCR|DECR`，请求体示例：`{"op":"DECR","value":2,"reason":"备餐损耗"}`
- `GET /api/dish/list`：支持 `page,size,merchantId,name,category,status,minPrice,maxPrice`
- `GET /api/pickup/windows`：支持 `page,size,status,merchantId,keyword`
- `GET /api/user/list`：支持 `page,size,role,status,phone,nickname,studentNo`
- `GET /api/order/list`：管理员全局订单，支持 `page,size,status,merchantId,windowId,userId,keyword,dateFrom,dateTo`
- 菜品接口业务约束：`PUT /api/dish/{id}`、`PUT /api/dish/{id}/status`、`DELETE /api/dish/{id}` 在“被生效菜单引用”时返回业务码 `3008`

### P2 已补齐
- `POST /api/order/{id}/remark`
- `POST /api/order/batch/status`
- `GET /api/stat/merchant/dashboard`
- `GET /api/stat/admin/dashboard`
- `GET /api/pickup/window/{id}/history`
- `POST /api/user/{id}/reset-password`：管理员重置指定用户密码，请求体 `{ "password": "新密码" }`（6–20 位，与注册一致）
- `PUT /api/user/me/password`：当前登录用户修改自己的密码，请求体 `{ "oldPassword": "原密码", "newPassword": "新密码" }`（新密码 6–20 位）

### 统一规范
- 分页返回结构：`records,total,current,size`
- 关键词参数：`keyword`
- 时间范围参数：`dateFrom,dateTo`（支持 ISO 或 `yyyy-MM-dd`）
- 常用错误语义：`403` 越权、`404` 资源不存在、库存冲突返回业务码（如 `2002/2004`）
- 业务码：`3008` 表示“菜品被生效菜单引用不可修改”
- 库存业务码：`2002` 库存不足、`2004` 库存状态冲突（例如 `SET` 小于已售）

### 大作业文档要求映射（前端视角）

| 文档要求模块 | 对应前端功能 | 说明 |
|---|---|---|
| 用户服务 | 注册、登录、个人中心、Token 刷新 | 对应 `/register`、`/login`、`/profile` 页面 |
| 菜品与菜单服务 | 菜品管理、菜单发布、库存预警展示 | 商家工作台支持 CRUD、发布菜单、低库存提醒 |
| 订单服务 | 下单、订单状态展示、订单详情 | 学生端下单与“我的订单”；商家端流转状态 |
| 取餐与排队服务 | 商家叫号、核销、按取餐码查单 | 对应商家“叫号与核销”面板 |
| 网关 + WebSocket | 大屏实时消息与取餐队列展示 | `/display` 页面连接 WebSocket 并展示消息 |

---

## 📁 项目结构

```text
Distributed_System_Architecture/
├── docker-compose.yml
├── README.md
├── smart-canteen-web/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── src/
│       ├── main.ts
│       ├── App.vue
│       ├── api/
│       │   └── user.ts
│       ├── router/
│       │   └── index.ts
│       ├── stores/
│       │   └── auth.ts
│       ├── utils/
│       │   └── request.ts
│       └── views/
│           ├── LoginView.vue
│           └── HomeView.vue
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

### 前端目录建议（后续扩展）

```text
smart-canteen-web/src/
├── api/            # 按模块拆分接口（user/menu/order/pickup/dish）
├── components/     # 可复用组件
├── router/         # 路由与鉴权守卫
├── stores/         # Pinia 状态管理
├── utils/          # request、token、ws 封装
├── views/          # 页面级组件
└── types/          # TypeScript 类型定义
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

### 数据库连接（按服务区分）

```yaml
# canteen-user-service
spring:
  datasource:
    url: jdbc:mysql://127.0.0.1:3320/canteen_user?useUnicode=true&characterEncoding=utf-8&serverTimezone=Asia/Shanghai
    username: root
    password: root
    driver-class-name: com.mysql.cj.jdbc.Driver
```

```yaml
# canteen-menu-service
spring:
  datasource:
    url: jdbc:mysql://127.0.0.1:3320/canteen_menu?useUnicode=true&characterEncoding=utf-8&serverTimezone=Asia/Shanghai
```

```yaml
# canteen-order-service
spring:
  datasource:
    url: jdbc:mysql://127.0.0.1:3320/canteen_order?useUnicode=true&characterEncoding=utf-8&serverTimezone=Asia/Shanghai
```

```yaml
# canteen-pickup-service
spring:
  datasource:
    url: jdbc:mysql://127.0.0.1:3320/canteen_pickup?useUnicode=true&characterEncoding=utf-8&serverTimezone=Asia/Shanghai
```

### Nacos 注册中心

```yaml
spring:
  config:
    import: optional:nacos:${spring.application.name}.yml?group=DEFAULT_GROUP&refreshEnabled=true
  cloud:
    nacos:
      discovery:
        server-addr: 127.0.0.1:8848
      config:
        server-addr: 127.0.0.1:8848
        file-extension: yml
        group: DEFAULT_GROUP
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
