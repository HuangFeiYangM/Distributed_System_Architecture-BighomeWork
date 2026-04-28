# smart-canteen 项目架构总览文档

> 智能食堂点餐与取餐微服务系统 —— 顶层架构设计

---

## 1. 项目概述

### 1.1 项目背景与目标

本项目为《分布式系统架构》课程大作业，旨在构建一套面向校园/园区的智能食堂系统。系统采用 **Spring Cloud Alibaba** 微服务架构，将单体应用按业务领域拆分为多个独立部署的服务单元，通过服务注册发现、统一网关、分布式缓存等技术实现高内聚、低耦合的系统架构。

核心目标：
- 支持用户在线点餐、商家接单备餐、扫码/取餐码取餐
- 食堂大屏实时显示取餐队列与叫号信息
- 演示微服务拆分、服务治理、JWT 统一鉴权、容器化部署等分布式核心技术

### 1.2 架构风格

| 维度 | 选型 |
|------|------|
| 架构模式 | 微服务架构（Microservices） |
| 服务拆分策略 | 按业务领域拆分（DDD 限界上下文） |
| 通信方式 | 同步 HTTP REST（服务间调用）+ 异步 WebSocket（大屏推送） |
| 服务治理 | Spring Cloud Alibaba + Nacos |
| 数据策略 | 单库逻辑隔离（默认）/ 多库物理隔离（可选） |
| 部署方式 | K3S (k3d) 容器编排 |

---

## 2. 顶层功能清单

### 2.1 系统用例

```
┌─────────────────────────────────────────────────────────────┐
│                         智能食堂系统                          │
├─────────────────────────────────────────────────────────────┤
│  用户端              商家端              系统端              │
│  ├─ 注册/登录         ├─ 菜品管理          ├─ JWT 统一鉴权      │
│  ├─ 浏览菜单          ├─ 菜单发布          ├─ 服务路由转发      │
│  ├─ 下单/取消         ├─ 接单/制作         ├─ 限流控制          │
│  ├─ 查看订单          ├─ 叫号通知          ├─ 超时自动取消      │
│  ├─ 扫码取餐          ├─ 核销取餐码        ├─ 大屏实时推送      │
│  └─ Token 刷新        └─ 窗口队列管理      └─ 库存预警          │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 非功能需求

| 类型 | 需求 | 实现策略 |
|------|------|---------|
| 性能 | 接口响应 < 500ms | Redis 缓存热点数据、数据库索引优化 |
| 可用性 | 单服务故障不影响全局 | 服务独立部署、网关熔断降级 |
| 安全性 | 接口防未授权访问 | Gateway 统一 JWT 校验、用户级限流 |
| 扩展性 | 支持新增窗口/菜品 | 微服务独立水平扩展 |

---

## 3. 模块交互全景图

### 3.1 服务拓扑

```
                    ┌─────────────────┐
                    │   客户端/Web    │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  Gateway :8080  │  ← 统一入口、JWT校验、限流
                    │  (canteen-gateway)│
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
┌───────▼───────┐  ┌────────▼────────┐  ┌───────▼───────┐
│ User :8081    │  │ Menu :8082      │  │ Order :8083   │
│ 注册/登录/JWT  │  │ 菜品/菜单/库存  │  │ 下单/状态/超时  │
└───────┬───────┘  └────────┬────────┘  └───────┬───────┘
        │                   │                   │
        └───────────────────┼───────────────────┘
                            │
                   ┌────────▼────────┐
                   │ Pickup :8084    │  ← 队列/叫号/大屏
                   │ 取餐/排队/WebSocket│
                   └─────────────────┘
                             │
                    ┌────────▼────────┐
                    │  Nacos :8848    │  ← 服务注册/发现/配置
                    └─────────────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
       ┌──────▼──────┐ ┌───▼────┐  ┌─────▼─────┐
       │  MySQL :3320 │ │ Redis  │  │  WebSocket │
       │  业务数据持久化│ │ 缓存/队列│  │  大屏实时  │
       └─────────────┘ └────────┘  └───────────┘
```

### 3.2 跨模块调用链路

| 链路 | 调用方 | 被调用方 | 通信方式 | 数据流向 |
|------|--------|---------|---------|---------|
| 用户注册 | Gateway | User Service | HTTP | 用户信息持久化 |
| 用户登录 | Gateway | User Service | HTTP | 返回 JWT Token |
| 浏览菜品 | Gateway | Menu Service | HTTP | 返回菜品列表 |
| 提交订单 | Gateway | Order Service | HTTP | Order → Menu（扣减库存） |
| 商家接单 | Gateway | Order Service | HTTP | 状态机流转 |
| 订单完成制作 | Order Service | Pickup Service | HTTP | 订单入队列 |
| 商家叫号 | Gateway | Pickup Service | HTTP | 队列出队 + WebSocket 推送 |
| 用户取餐 | Gateway | Pickup Service | HTTP | 核销 → Order（状态变更） |
| Token 刷新 | Gateway | User Service | HTTP | 颁发新 Access Token |

### 3.3 核心时序 —— 下单到取餐全流程

```text
用户          Gateway        OrderService      MenuService      PickupService      商家端
 │              │                │                 │                 │                │
 │  POST /api/order/create      │                 │                 │                │
 │─────────────>│                │                 │                 │                │
 │              │  转发 + JWT校验 │                 │                 │                │
 │              │───────────────>│                 │                 │                │
 │              │                │  1. 校验库存      │                 │                │
 │              │                │─────────────────>│                 │                │
 │              │                │  2. 乐观锁扣减库存 │                 │                │
 │              │                │<─────────────────│                 │                │
 │              │                │  3. 创建订单      │                 │                │
 │              │                │  4. 生成取餐码    │                 │                │
 │              │                │  5. 设置超时定时器 │                 │                │
 │              │<───────────────│                 │                 │                │
 │<─────────────│  返回订单+取餐码 │                 │                 │                │
 │              │                │                 │                 │                │
 │              │                │  [商家接单]       │                 │                │
 │              │                │<──────────────────────────────────────────────────────│
 │              │                │  状态: 已下单→已接单│                │                │
 │              │                │                 │                 │                │
 │              │                │  [制作完成]       │                 │                │
 │              │                │<──────────────────────────────────────────────────────│
 │              │                │  状态: 制作中→待取餐│                │                │
 │              │                │  通知Pickup入队  │                 │                │
 │              │                │─────────────────────────────────────>│                │
 │              │                │                 │                 │  Redis LPUSH 窗口队列│
 │              │                │                 │                 │                │
 │              │                │  [商家叫号]       │                 │                │
 │              │                │                 │                 │<───────────────│
 │              │                │                 │                 │  Redis RPOP + WS推送│
 │              │                │                 │                 │                │
 │              │                │                 │                 │  WebSocket → 大屏  │
 │              │                │                 │                 │────────────────>│
 │              │                │                 │                 │                │
 │  出示取餐码   │                │                 │                 │                │
 │─────────────>│                │                 │                 │                │
 │              │  POST /api/pickup/verify         │                 │                │
 │              │─────────────────────────────────────────────────────>│                │
 │              │                │                 │                 │  校验取餐码+出库    │
 │              │                │                 │                 │  通知Order状态变更  │
 │              │                │<──────────────────────────────────────────────────────│
 │              │                │  状态: 待取餐→已取餐│                │                │
 │<─────────────│  取餐成功       │                 │                 │                │
```

---

## 4. 项目文件结构总览

```text
smart-canteen/
├── pom.xml                              ← 父POM：统一依赖版本管理
├── canteen-common/
│   ├── pom.xml
│   └── src/main/java/com/canteen/common/
│       ├── entity/BaseEntity.java       ← 基础实体（id, createTime, updateTime, deleted）
│       ├── result/
│       │   ├── Result.java              ← 统一响应体 {code, msg, data, timestamp}
│       │   └── StatusCode.java          ← 业务状态码枚举
│       ├── exception/
│       │   └── BusinessException.java   ← 业务异常（携带 StatusCode）
│       └── util/
│           └── JwtUtil.java             ← JWT 生成/解析/校验工具
├── canteen-gateway/
│   ├── pom.xml
│   └── src/main/java/com/canteen/gateway/
│       ├── GatewayApplication.java
│       ├── filter/
│       │   └── JwtAuthGlobalFilter.java ← 网关全局JWT校验过滤器
│       └── config/
│           └── GatewayConfig.java       ← 路由/跨域/限流配置
├── canteen-user-service/
│   ├── pom.xml
│   └── src/main/java/com/canteen/user/
│       ├── UserServiceApplication.java
│       ├── controller/UserController.java
│       ├── service/UserService.java
│       ├── mapper/UserMapper.java
│       └── entity/User.java
├── canteen-menu-service/
│   ├── pom.xml
│   └── src/main/java/com/canteen/menu/
│       ├── MenuServiceApplication.java
│       ├── controller/
│       │   ├── DishController.java
│       │   └── MenuController.java
│       ├── service/
│       ├── mapper/
│       └── entity/
│           ├── Dish.java
│           ├── Menu.java
│           └── MenuDish.java
├── canteen-order-service/
│   ├── pom.xml
│   └── src/main/java/com/canteen/order/
│       ├── OrderServiceApplication.java
│       ├── controller/OrderController.java
│       ├── service/OrderService.java
│       ├── mapper/
│       │   ├── OrderMapper.java
│       │   └── OrderItemMapper.java
│       └── entity/
│           ├── Order.java
│           └── OrderItem.java
└── canteen-pickup-service/
    ├── pom.xml
    └── src/main/java/com/canteen/pickup/
        ├── PickupServiceApplication.java
        ├── controller/PickupController.java
        ├── service/PickupService.java
        ├── mapper/PickupRecordMapper.java
        ├── entity/PickupRecord.java
        └── websocket/
            ├── QueueWebSocketHandler.java    ← WebSocket 大屏推送
            └── WebSocketConfig.java
```

---

## 5. 数据架构总览

### 5.1 数据库设计原则

- **默认方案**：单库 `canteen`，所有服务表逻辑隔离，通过表前缀区分领域
- **可选方案**：4 个独立数据库（`canteen_user/menu/order/pickup`），物理隔离
- **缓存策略**：Redis 承担热点缓存 + 分布式队列（取餐排队）+ Token 黑名单

### 5.2 核心实体关系

```text
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│   sys_user  │       │    dish     │◄──────┤   menu      │
│  (用户域)   │       │   (菜品基)   │  1:N  │  (每日菜单)  │
└──────┬──────┘       └──────┬──────┘       └──────┬──────┘
       │                     │                     │
       │              ┌──────▼──────┐       ┌──────▼──────┐
       │              │  menu_dish  │       │ menu_dish   │
       │              │ (菜单菜品关联)│       │ (库存/当日价) │
       │              └─────────────┘       └─────────────┘
       │
       │       ┌─────────────┐       ┌─────────────┐
       └──────►│   orders    │◄──────┤ order_item  │
               │  (订单主表)  │  1:N  │  (订单明细)  │
               └──────┬──────┘       └─────────────┘
                      │
                      │       ┌─────────────┐
                      └──────►│pickup_record│
                              │ (取餐记录)   │
                              └──────┬──────┘
                                     │
                              ┌──────▼──────┐
                              │canteen_window│
                              │  (窗口信息)  │
                              └─────────────┘
```

---

## 6. 关键技术决策

### 6.1 JWT 鉴权架构

```
┌─────────┐     ┌─────────────┐     ┌─────────────┐
│  客户端  │────►│   Gateway   │────►│  各微服务   │
└─────────┘     └──────┬──────┘     └─────────────┘
                       │
              ┌────────▼────────┐
              │ JwtAuthFilter   │
              │ 1. 提取Token    │
              │ 2. 校验签名/过期 │
              │ 3. 解析userId   │
              │ 4. 写入Header   │
              │ 5. 放行/拒绝    │
              └─────────────────┘
```

**策略**：Gateway 统一校验，下游服务信任 Header 中的 `X-User-Id`

### 6.2 库存扣减并发控制

采用 **数据库乐观锁**（条件更新），而非分布式锁：
- 原因：食堂场景并发量有限，乐观锁足够且性能更好
- 实现：`UPDATE menu_dish SET stock = stock - ?, sold = sold + ? WHERE id = ? AND stock >= ?`

### 6.3 订单超时取消

采用 **Spring @Scheduled + 数据库轮询**：
- 每 30 秒扫描 `orders` 表中 `pay_deadline < NOW()` 且 `status = 0` 的订单
- 批量取消并恢复库存
- 简化实现，不引入 MQ 降低复杂度

### 6.4 取餐队列

采用 **Redis List** 实现窗口级 FIFO 队列：
- `LPUSH window:{windowId}:queue {orderId}` —— 订单入队（制作完成时）
- `RPOP window:{windowId}:queue` —— 商家叫号出队
- `LRANGE window:{windowId}:queue 0 -1` —— 大屏查询等待队列

---

## 7. 配置总览

### 7.1 版本锁定

| 组件 | 版本 | 说明 |
|------|------|------|
| Java | 17 | LTS |
| Spring Boot | 3.2.5 | 基线 |
| Spring Cloud | 2023.0.1 | Kelvin |
| Spring Cloud Alibaba | 2023.0.1.0 | Nacos 2.x 适配 |
| MyBatis-Plus | 3.5.6 | Boot 3 兼容 |
| MySQL Driver | 8.0.33 | `com.mysql.cj.jdbc.Driver` |
| JJWT | 0.12.5 | JWT 生成与校验 |

### 7.2 端口分配

| 服务 | 端口 | 说明 |
|------|------|------|
| Gateway | 8080 | 唯一外部入口 |
| User Service | 8081 | 用户域 |
| Menu Service | 8082 | 菜品域 |
| Order Service | 8083 | 订单域 |
| Pickup Service | 8084 | 取餐域 |
| Nacos | 8848/9848 | 注册/配置/gRPC |
| MySQL | 3320 | 开发环境映射 |
| Redis | 6379 | 缓存/队列 |

---

## 8. 伪代码 —— 系统启动流程

```text
function 系统启动():
    并行启动:
        线程1: DockerCompose启动(Nacos, MySQL, Redis)
        线程2: 等待Nacos就绪

    当 Nacos 健康检查通过:
        顺序启动:
            1. canteen-common 编译安装到本地Maven仓库
            2. canteen-gateway 注册到Nacos :8080
            3. canteen-user-service 注册到Nacos :8081
            4. canteen-menu-service 注册到Nacos :8082
            5. canteen-order-service 注册到Nacos :8083
            6. canteen-pickup-service 注册到Nacos :8084

    当 所有服务在Nacos服务列表可见:
        返回 "系统启动完成"
        用户可通过 http://127.0.0.1:8080 访问网关入口
```

---

## 9. 风险与应对

| 风险 | 影响 | 应对策略 |
|------|------|---------|
| Nacos 1.3.1 与 Java 17 不兼容 | 服务注册失败 | 已升级至 Nacos 2.2.3 |
| 库存超卖 | 数据不一致 | 乐观锁 + 数据库条件更新 |
| Token 泄露 | 越权访问 | Gateway 统一校验 + 短期 Token + Refresh 机制 |
| WebSocket 多实例会话 | 大屏消息丢失 | 开发环境单实例部署；生产环境用 Redis Pub/Sub 广播 |

---

> 本文档为顶层架构设计，各模块详细设计请参见对应模块文档。
