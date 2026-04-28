# canteen-gateway 模块设计文档

> 智能食堂系统 —— 统一入口网关服务

---

## 1. 模块概述

### 1.1 定位与职责

`canteen-gateway` 是整个微服务系统的**唯一外部入口**，承担以下核心职责：

| 职责 | 说明 |
|------|------|
| **请求路由** | 根据 URL 路径将请求转发到对应微服务（如 `/api/user/**` → User Service） |
| **统一鉴权** | 提取并校验 JWT Token，拒绝未授权请求，阻止非法流量进入后端 |
| **用户身份透传** | 校验通过后，将 `userId`、`role` 写入请求 Header，供下游服务使用 |
| **限流控制** | IP 级 + 用户级限流，防止突发流量击垮后端 |
| **WebSocket 代理** | 将大屏 WebSocket 连接代理到 Pickup Service |

### 1.2 为什么需要网关

在微服务架构中，如果客户端直接访问各服务：
- 每个服务都需要实现 JWT 校验（代码重复）
- 客户端需要维护多个地址和端口（8081~8084）
- 无法统一做限流、日志、灰度发布

Gateway 作为**反向代理 + 边缘服务**，将所有横切关注点收敛到单一节点。

---

## 2. 功能清单

### 2.1 功能列表

| 编号 | 功能 | 优先级 | 说明 |
|------|------|--------|------|
| G-001 | 动态路由 | 必须 | 基于 Nacos 服务发现自动路由 |
| G-002 | JWT 统一校验 | 必须 | 全局过滤器，白名单除外 |
| G-003 | 用户身份透传 | 必须 | 校验通过后写入 X-User-Id / X-Role |
| G-004 | IP 级限流 | 必须 | 基于 Redis 的滑动窗口限流 |
| G-005 | 用户级限流 | 必须 | 基于 Token 解析用户 ID 限流 |
| G-006 | WebSocket 代理 | 必须 | 代理 `/ws/pickup` 到 Pickup Service |
| G-007 | 跨域处理 | 必须 | 允许前端跨域访问 |
| G-008 | 路径重写 | 必须 | `StripPrefix=1` 去掉 `/api` 前缀 |

### 2.2 非功能需求

| 类型 | 需求 | 实现 |
|------|------|------|
| 性能 | 网关转发延迟 < 5ms | 异步非阻塞（WebFlux + Netty） |
| 可用性 | 网关不依赖业务服务 | 独立部署，故障隔离 |
| 安全 | Token 泄露不影响其他用户 | 每个 Token 绑定唯一 userId + 签名 |

---

## 3. 外部交互关系

### 3.1 上游依赖（Gateway 依赖谁）

```
┌─────────────────────────────────────────────┐
│           canteen-gateway :8080              │
├─────────────────────────────────────────────┤
│ 依赖方          │ 用途                        │
├─────────────────┼───────────────────────────┤
│ Nacos :8848     │ 服务发现（lb://serviceName）│
│ Redis :6379     │ 限流计数器存储              │
│ canteen-common  │ JwtUtil, Result, StatusCode │
└─────────────────────────────────────────────┘
```

### 3.2 下游消费（谁调用 Gateway）

| 调用方 | 调用方式 | 说明 |
|--------|---------|------|
| 前端/客户端 | HTTP/WebSocket | 唯一入口，所有请求先发 Gateway |
| 测试脚本（Postman） | HTTP | 调试接口 |

### 3.3 与下游服务的交互

```
客户端请求
    │
    ▼
┌─────────────┐
│  Gateway    │
│  1. 限流检查 │
│  2. JWT校验  │ ← 白名单路径跳过（登录/注册）
│  3. 路由匹配 │
│  4. Header注入│ ← X-User-Id, X-Role, X-Username
└──────┬──────┘
       │
       ├─────────────┬─────────────┬─────────────┐
       ▼             ▼             ▼             ▼
   User:8081    Menu:8082    Order:8083   Pickup:8084
```

### 3.4 核心时序 —— 请求处理流程

```text
客户端          Gateway                    Nacos          Redis         下游服务
  │              │                          │              │              │
  │  POST /api/order/create               │              │              │
  │─────────────>│                        │              │              │
  │              │  1. IP限流检查          │              │              │
  │              │  → Redis INCR ip:{ip}   │              │              │
  │              │  → 检查是否超过阈值      │              │              │
  │              │─────────────────────────>│              │              │
  │              │<─────────────────────────│              │              │
  │              │                        │              │              │
  │              │  2. 提取 Authorization Header        │              │
  │              │  3. 校验 JWT 签名/过期                │              │
  │              │  → 失败: 返回 401                     │              │
  │              │  → 成功: 解析 Claims                   │              │
  │              │                        │              │              │
  │              │  4. 用户级限流检查      │              │              │
  │              │  → Redis INCR user:{userId}:{path}    │              │
  │              │───────────────────────────────────────>│              │
  │              │<───────────────────────────────────────│              │
  │              │                        │              │              │
  │              │  5. 写入请求头         │              │              │
  │              │  X-User-Id: 10001      │              │              │
  │              │  X-Role: USER          │              │              │
  │              │  X-Username: zhangsan  │              │              │
  │              │                        │              │              │
  │              │  6. 路由匹配 /api/order/**             │              │
  │              │  → 匹配规则: StripPrefix=1           │              │
  │              │  → 目标: lb://canteen-order-service   │              │
  │              │                        │              │              │
  │              │  7. 从 Nacos 获取服务实例列表          │              │
  │              │────────────────────────>│              │              │
  │              │<────────────────────────│              │              │
  │              │                        │              │              │
  │              │  8. 负载均衡选择一个实例               │              │
  │              │  9. 转发 HTTP 请求                     │              │
  │              │───────────────────────────────────────────────────────>│
  │              │                        │              │              │
  │              │<───────────────────────────────────────────────────────│
  │              │  10. 透传响应给客户端                   │              │
  │<─────────────│                        │              │              │
```

---

## 4. 代码文件结构

```text
canteen-gateway/
├── pom.xml
└── src/
    ├── main/
    │   ├── java/
    │   │   └── com/
    │   │       └── canteen/
    │   │           └── gateway/
    │   │               ├── GatewayApplication.java
    │   │               │       ↑ 启动类：@EnableDiscoveryClient
    │   │               ├── filter/
    │   │               │   └── JwtAuthGlobalFilter.java
    │   │               │       ↑ 全局过滤器：JWT校验 + 限流 + 透传
    │   │               └── config/
    │   │                   └── GatewayConfig.java
    │   │                       ↑ 跨域配置、自定义路由规则
    │   └── resources/
    │       └── application.yml
    │           ↑ 路由规则、Nacos地址、Redis地址、JWT密钥
    └── test/
        └── java/
            └── com/
                └── canteen/
                    └── gateway/
                        └── filter/
                            └── JwtAuthGlobalFilterTest.java
```

### 4.2 关键文件说明

| 文件 | 职责 | 核心逻辑 |
|------|------|---------|
| `GatewayApplication.java` | 网关启动入口 | `@SpringBootApplication` + `@EnableDiscoveryClient` |
| `JwtAuthGlobalFilter.java` | 全局过滤器（核心） | 实现 `GlobalFilter, Ordered`，处理所有进入网关的请求 |
| `GatewayConfig.java` | 配置类 | `@Configuration` 定义跨域规则、自定义 Bean |
| `application.yml` | 外部化配置 | 路由、Nacos、Redis、JWT、限流阈值 |

---

## 5. 核心逻辑描述

### 5.1 路由规则设计

**路由表**（application.yml）：

| ID | 路径匹配 | 目标服务 | 过滤器 | 说明 |
|----|---------|---------|--------|------|
| user-service | `/api/user/**` | `lb://canteen-user-service` | StripPrefix=1 | 用户域 |
| menu-service | `/api/menu/**` | `lb://canteen-menu-service` | StripPrefix=1 | 菜品域 |
| order-service | `/api/order/**` | `lb://canteen-order-service` | StripPrefix=1 | 订单域 |
| pickup-service | `/api/pickup/**` | `lb://canteen-pickup-service` | StripPrefix=1 | 取餐域 |

**路径重写示例**：
- 客户端请求：`POST http://localhost:8080/api/order/create`
- StripPrefix=1 去掉 `/api` → `POST http://canteen-order-service:8083/order/create`

### 5.2 JWT 校验过滤器逻辑

**白名单机制**：以下路径跳过 JWT 校验：
- `/api/user/register`
- `/api/user/login`
- `/api/user/refresh`
- `/api/menu/list`（菜品浏览允许匿名）

**校验流程**：
1. 提取 `Authorization: Bearer <token>` Header
2. 去掉 `Bearer ` 前缀，获得纯 Token
3. 调用 `JwtUtil.validateToken(secret, token)`
4. 校验失败 → 直接返回 `Result.error(UNAUTHORIZED)`，不进入下游
5. 校验成功 → 解析 Claims，将 `userId`、`role`、`username` 写入新 Header

**Header 透传约定**：

| Header 名 | 值 | 下游使用方式 |
|-----------|-----|-------------|
| `X-User-Id` | userId | 订单服务记录下单人 |
| `X-Role` | role | 权限校验（如商家才能接单） |
| `X-Username` | username | 日志追踪 |

### 5.3 限流策略

**双层限流**：

| 层级 | Key 生成规则 | 阈值 | 窗口 |
|------|-------------|------|------|
| IP 级 | `rate:ip:{clientIp}:{path}` | 100 次/分钟 | 60 秒 |
| 用户级 | `rate:user:{userId}:{path}` | 30 次/分钟 | 60 秒 |

**实现方式**：Redis `String` + `EXPIRE`
- 首次请求：`SET rate:ip:192.168.1.1:/api/order/create 1 EX 60`
- 后续请求：`INCR rate:ip:192.168.1.1:/api/order/create`
- 超过阈值：返回 `429 Too Many Requests`

### 5.4 WebSocket 代理

Gateway 配置 WebSocket 路由：
- 路径：`/ws/pickup`
- 目标：`lb:ws://canteen-pickup-service`
- 作用：将前端大屏的长连接代理到 Pickup Service 的 WebSocket 处理器

---

## 6. 伪代码

### 6.1 全局过滤器主流程

```text
function 全局过滤器(exchange, chain):
    request = exchange.getRequest()
    path = request.getPath().value

    // 1. 白名单检查
    if 路径在白名单中(path):
        return chain.filter(exchange)   // 直接放行

    // 2. IP 限流检查
    clientIp = 提取客户端IP(request)
    ipKey = "rate:ip:" + clientIp + ":" + path
    ipCount = Redis.incr(ipKey)
    if ipCount == 1:
        Redis.expire(ipKey, 60)
    if ipCount > IP_LIMIT:
        return 返回429响应("IP请求过于频繁")

    // 3. JWT 提取与校验
    authHeader = request.getHeaders().getFirst("Authorization")
    if authHeader为空 或 不以"Bearer "开头:
        return 返回401响应("缺少Token")

    token = authHeader.substring(7)   // 去掉 "Bearer "

    if not JwtUtil.validateToken(secret, token):
        return 返回401响应("Token无效或已过期")

    // 4. 解析用户信息
    userId = JwtUtil.getUserId(secret, token)
    username = JwtUtil.getUsername(secret, token)
    role = JwtUtil.getRole(secret, token)

    // 5. 用户级限流检查
    userKey = "rate:user:" + userId + ":" + path
    userCount = Redis.incr(userKey)
    if userCount == 1:
        Redis.expire(userKey, 60)
    if userCount > USER_LIMIT:
        return 返回429响应("用户请求过于频繁")

    // 6. 构建新请求，注入用户Header
    newRequest = request.mutate()
        .header("X-User-Id", userId)
        .header("X-Username", username)
        .header("X-Role", role)
        .build()

    newExchange = exchange.mutate().request(newRequest).build()

    // 7. 放行到下游服务
    return chain.filter(newExchange)
```

### 6.2 路由匹配与转发

```text
function 路由转发(exchange):
    path = exchange.getRequest().getPath()

    if path 匹配 "/api/user/**":
        serviceName = "canteen-user-service"
        strippedPath = path.replace("/api", "")
    else if path 匹配 "/api/menu/**":
        serviceName = "canteen-menu-service"
        strippedPath = path.replace("/api", "")
    else if path 匹配 "/api/order/**":
        serviceName = "canteen-order-service"
        strippedPath = path.replace("/api", "")
    else if path 匹配 "/api/pickup/**":
        serviceName = "canteen-pickup-service"
        strippedPath = path.replace("/api", "")
    else:
        return 返回404响应("路径不存在")

    // 从 Nacos 获取健康实例列表
    instances = NacosDiscoveryClient.getInstances(serviceName)
    if instances为空:
        return 返回503响应("服务不可用")

    // 负载均衡（默认轮询）
    targetInstance = LoadBalancer.choose(instances)

    // 转发请求
    return 转发HTTP请求(targetInstance, strippedPath, exchange)
```

---

## 7. 接口契约

### 7.1 对外暴露的入口（客户端视角）

| 入口地址 | 协议 | 说明 |
|---------|------|------|
| `http://localhost:8080/api/**` | HTTP | 所有业务 API |
| `ws://localhost:8080/ws/pickup` | WebSocket | 大屏实时推送 |

### 7.2 请求/响应格式

**请求规范**：
- 鉴权接口需携带 Header：`Authorization: Bearer <jwt_token>`
- Content-Type：`application/json`

**响应格式**（统一由下游服务返回，Gateway 透传）：
```json
{
  "code": 200,
  "msg": "操作成功",
  "data": { },
  "timestamp": 1714291200000
}
```

**错误响应**（Gateway 直接返回）：
```json
// 401 未授权
{ "code": 401, "msg": "Token无效或已过期", "data": null, "timestamp": ... }

// 429 限流
{ "code": 429, "msg": "请求过于频繁", "data": null, "timestamp": ... }

// 503 服务不可用
{ "code": 503, "msg": "服务暂时不可用", "data": null, "timestamp": ... }
```

---

## 8. 配置说明

### 8.1 application.yml 核心配置

```yaml
server:
  port: 8080

spring:
  application:
    name: canteen-gateway
  cloud:
    nacos:
      discovery:
        server-addr: 127.0.0.1:8848
    gateway:
      discovery:
        locator:
          enabled: true   # 开启基于服务发现的路由
      routes:
        - id: user-service
          uri: lb://canteen-user-service
          predicates:
            - Path=/api/user/**
          filters:
            - StripPrefix=1
        - id: menu-service
          uri: lb://canteen-menu-service
          predicates:
            - Path=/api/menu/**
          filters:
            - StripPrefix=1
        - id: order-service
          uri: lb://canteen-order-service
          predicates:
            - Path=/api/order/**
          filters:
            - StripPrefix=1
        - id: pickup-service
          uri: lb://canteen-pickup-service
          predicates:
            - Path=/api/pickup/**
          filters:
            - StripPrefix=1
  redis:
    host: 127.0.0.1
    port: 6379

# JWT 配置
jwt:
  secret: canteen-secret-key-2026-smart-canteen-jwt
  expiration: 86400000

# 限流阈值
rate-limiter:
  ip-limit: 100      # IP级：每分钟100次
  user-limit: 30    # 用户级：每分钟30次
```

---

## 9. 依赖清单

### 9.1 Maven 依赖

```xml
<dependencies>
    <!-- Spring Cloud Gateway（基于 WebFlux，非 Servlet） -->
    <dependency>
        <groupId>org.springframework.cloud</groupId>
        <artifactId>spring-cloud-starter-gateway</artifactId>
    </dependency>

    <!-- Nacos 服务发现 -->
    <dependency>
        <groupId>com.alibaba.cloud</groupId>
        <artifactId>spring-cloud-starter-alibaba-nacos-discovery</artifactId>
    </dependency>

    <!-- Nacos 配置中心（可选，用于动态路由） -->
    <dependency>
        <groupId>com.alibaba.cloud</groupId>
        <artifactId>spring-cloud-starter-alibaba-nacos-config</artifactId>
    </dependency>

    <!-- 负载均衡 -->
    <dependency>
        <groupId>org.springframework.cloud</groupId>
        <artifactId>spring-cloud-starter-loadbalancer</artifactId>
    </dependency>

    <!-- Redis Reactive（Gateway 基于 WebFlux，需 reactive 客户端） -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-data-redis-reactive</artifactId>
    </dependency>

    <!-- JJWT 运行时实现 -->
    <dependency>
        <groupId>io.jsonwebtoken</groupId>
        <artifactId>jjwt-impl</artifactId>
        <scope>runtime</scope>
    </dependency>
    <dependency>
        <groupId>io.jsonwebtoken</groupId>
        <artifactId>jjwt-jackson</artifactId>
        <scope>runtime</scope>
    </dependency>

    <!-- 公共模块 -->
    <dependency>
        <groupId>com.canteen</groupId>
        <artifactId>canteen-common</artifactId>
    </dependency>
</dependencies>
```

### 9.2 外部服务依赖

| 服务 | 地址 | 用途 | 故障影响 |
|------|------|------|---------|
| Nacos | 127.0.0.1:8848 | 服务发现、配置 | 无法路由，系统不可用 |
| Redis | 127.0.0.1:6379 | 限流计数器 | 限流失效，但不影响主流程 |

---

> 本文档描述统一入口网关层。业务模块详细设计请参见对应服务文档。
