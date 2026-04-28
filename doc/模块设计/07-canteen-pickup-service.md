# canteen-pickup-service 模块设计文档

> 智能食堂系统 —— 取餐与排队域微服务（实时交互中心）

---

## 1. 模块概述

### 1.1 定位与职责

`canteen-pickup-service` 是系统的**实时交互中心**，负责取餐排队队列管理、叫号通知、取餐核销以及食堂大屏的实时数据推送。

核心职责：
- 窗口级 FIFO 排队队列维护（Redis List）
- 商家叫号操作（队列出队 + WebSocket 广播）
- 用户取餐核销（取餐码/取餐号校验）
- 大屏实时显示（当前叫号、等待队列、窗口状态）
- WebSocket 长连接管理（大屏、商家端）

### 1.2 边界上下文

```
┌─────────────────────────────────────────────┐
│          取餐域 (Pickup Domain)              │
├─────────────────────────────────────────────┤
│  核心概念：窗口(Window)、队列(Queue)、        │
│           取餐号(PickupNo)、取餐码(PickupCode)│
│  聚合根：pickup_record + Redis List          │
│  对外暴露：REST API + WebSocket               │
│  依赖方：Order Service（状态回调）            │
│  被依赖方：Order Service（制作完成通知入队）  │
└─────────────────────────────────────────────┘
```

---

## 2. 功能清单

### 2.1 功能列表

| 编号 | 功能 | 接口路径 | 说明 |
|------|------|---------|------|
| P-001 | 订单入队 | `POST /pickup/enqueue` | Order Service 调用，制作完成时入队 |
| P-002 | 商家叫号 | `POST /pickup/{windowId}/call` | 窗口队列出队，广播叫号 |
| P-003 | 取餐核销 | `POST /pickup/verify` | 用户出示取餐码，校验后出库 |
| P-004 | 查询窗口队列 | `GET /pickup/{windowId}/queue` | 返回等待队列列表 |
| P-005 | 查询大屏数据 | `GET /pickup/{windowId}/display` | 当前叫号 + 等待人数 + 最近叫号历史 |
| P-006 | WebSocket 连接 | `ws://gateway/ws/pickup` | 大屏实时接收叫号推送 |
| P-007 | 查询窗口列表 | `GET /pickup/windows` | 返回所有营业窗口 |
| P-008 | 创建窗口 | `POST /pickup/window` | 管理员创建新窗口 |

### 2.2 非功能需求

| 类型 | 需求 | 实现 |
|------|------|------|
| 实时性 | 叫号到显示 < 100ms | WebSocket 推送 + 本地缓存 |
| 顺序性 | 严格 FIFO | Redis List 保证顺序 |
| 可靠性 | 队列数据不丢失 | Redis AOF 持久化 + MySQL 备份 |

---

## 3. 外部交互关系

### 3.1 上游依赖（Pickup Service 依赖谁）

```
┌─────────────────────────────────────────────┐
│       canteen-pickup-service :8084            │
├─────────────────────────────────────────────┤
│ 依赖方              │ 用途                    │
├─────────────────────┼───────────────────────┤
│ MySQL :3320/canteen │ 窗口信息、取餐记录持久化 │
│ Redis :6379         │ FIFO 队列、取餐号计数器  │
│ Nacos :8848         │ 服务注册                │
│ Order Service :8083 │ 核销后回调更新订单状态   │
│ canteen-common      │ Result, StatusCode      │
└─────────────────────────────────────────────┘
```

### 3.2 下游消费（谁调用 Pickup Service）

| 调用方 | 调用方式 | 场景 |
|--------|---------|------|
| Gateway | HTTP 路由 | 商家叫号、用户核销、查询队列 |
| Gateway | WebSocket 代理 | 大屏长连接接收实时推送 |
| Order Service | HTTP 回调 | 制作完成后通知入队 |

### 3.3 核心交互时序

#### 3.3.1 制作完成 → 入队 → 叫号 → 取餐（完整链路）

```text
OrderService       PickupService         Redis          WebSocket客户端
    │                  │                   │                  │
    │  POST /pickup/enqueue             │                  │
    │─────────────────>│                 │                  │
    │                  │  1. 生成取餐号   │                  │
    │                  │  → INCR window:{id}:counter        │
    │                  │────────────────>│                  │
    │                  │<────────────────│                  │
    │                  │  取餐号 = A + 序号(001)            │
    │                  │                 │                  │
    │                  │  2. 更新订单取餐号                 │
    │  返回 pickupNo   │                 │                  │
    │<─────────────────│                 │                  │
    │                  │                 │                  │
    │                  │  3. 入队        │                  │
    │                  │  LPUSH window:{id}:queue {orderId} │
    │                  │────────────────>│                  │
    │                  │                 │                  │
    │                  │  4. 持久化记录   │                  │
    │                  │  INSERT pickup_record ...         │
    │                  │                 │                  │
    │                  │                 │                  │
    │  [商家叫号]       │                 │                  │
    │                  │  POST /pickup/{id}/call            │
    │                  │────────────────>│                  │
    │                  │  5. 出队        │                  │
    │                  │  RPOP window:{id}:queue            │
    │                  │────────────────>│                  │
    │                  │<────────────────│  返回 orderId    │
    │                  │                 │                  │
    │                  │  6. 查询取餐信息 │                  │
    │                  │  7. WebSocket广播 │                 │
    │                  │─────────────────────────────────────>│
    │                  │  消息: {type:"CALL", pickupNo:"A001", windowId:1}│
    │                  │                 │                  │
    │  [用户取餐]       │                 │                  │
    │                  │  POST /pickup/verify               │
    │                  │  Body: {pickupCode:"384756"}       │
    │                  │────────────────>│                  │
    │                  │  8. 校验取餐码   │                  │
    │                  │  9. 更新 pickup_record 状态=已取餐  │
    │                  │  10. 回调 Order Service            │
    │  PUT /order/{id}/pickup            │                  │
    │<─────────────────│                 │                  │
    │                  │  11. WebSocket广播"已取餐"         │
    │                  │─────────────────────────────────────>│
```

---

## 4. 代码文件结构

```text
canteen-pickup-service/
├── pom.xml
└── src/
    ├── main/
    │   ├── java/
    │   │   └── com/
    │   │       └── canteen/
    │   │           └── pickup/
    │   │               ├── PickupServiceApplication.java
    │   │               ├── controller/
    │   │               │   ├── PickupController.java      ← 叫号/核销/查询API
    │   │               │   └── WindowController.java       ← 窗口管理API
    │   │               ├── service/
    │   │               │   ├── PickupService.java            ← 队列核心业务
    │   │               │   └── WindowService.java          ← 窗口管理
    │   │               ├── mapper/
    │   │               │   ├── PickupRecordMapper.java
    │   │               │   └── CanteenWindowMapper.java
    │   │               ├── entity/
    │   │               │   ├── PickupRecord.java
    │   │               │   └── CanteenWindow.java
    │   │               ├── vo/
    │   │               │   ├── QueueVO.java                ← 队列视图
    │   │               │   └── DisplayVO.java            ← 大屏数据视图
    │   │               ├── client/
    │   │               │   └── OrderClient.java            ← Feign调用Order
    │   │               └── websocket/
    │   │                   ├── QueueWebSocketHandler.java  ← WebSocket处理器
    │   │                   └── WebSocketConfig.java        ← 配置类
    │   └── resources/
    │       ├── application.yml
    │       └── mapper/
    │           ├── PickupRecordMapper.xml
    │           └── CanteenWindowMapper.xml
    └── test/
        └── java/
            └── com/
                └── canteen/
                    └── pickup/
                        └── service/
                            └── PickupServiceTest.java
```

---

## 5. 核心逻辑描述

### 5.1 数据库表结构

#### 5.1.1 窗口表 `canteen_window`

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | BIGINT UNSIGNED | PK, AUTO_INCREMENT | 窗口ID |
| `name` | VARCHAR(128) | NOT NULL | 窗口名称（如"1号档口-盖浇饭"） |
| `location` | VARCHAR(255) | | 物理位置描述 |
| `merchant_id` | BIGINT UNSIGNED | INDEX | 负责商家用户ID |
| `status` | TINYINT | DEFAULT 1 | 0=关闭，1=营业 |
| `create_time` | DATETIME | DEFAULT CURRENT_TIMESTAMP | |
| `update_time` | DATETIME | ON UPDATE CURRENT_TIMESTAMP | |
| `deleted` | TINYINT | DEFAULT 0 | 逻辑删除 |

#### 5.1.2 取餐记录表 `pickup_record`

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | BIGINT UNSIGNED | PK, AUTO_INCREMENT | 记录ID |
| `order_id` | BIGINT UNSIGNED | NOT NULL, INDEX | 订单ID |
| `window_id` | BIGINT UNSIGNED | NOT NULL, INDEX | 窗口ID |
| `pickup_no` | VARCHAR(16) | | 取餐号（如 A001） |
| `queue_status` | TINYINT | DEFAULT 0 | 0=排队中，1=已叫号，2=已取餐，3=已过号 |
| `queue_time` | DATETIME | | 进入队列时间 |
| `call_time` | DATETIME | | 叫号时间 |
| `pickup_time` | DATETIME | | 实际取餐时间 |
| `create_time` | DATETIME | DEFAULT CURRENT_TIMESTAMP | |
| `update_time` | DATETIME | ON UPDATE CURRENT_TIMESTAMP | |
| `deleted` | TINYINT | DEFAULT 0 | 逻辑删除 |

### 5.2 Redis 队列设计

**Key 命名规范**：

| Key | 类型 | 说明 |
|-----|------|------|
| `window:{windowId}:queue` | List | 窗口排队队列，元素为 orderId |
| `window:{windowId}:counter` | String | 取餐号自增计数器（每日重置或持续自增） |
| `window:{windowId}:current` | String | 当前叫号的 orderId |
| `window:{windowId}:history` | List | 最近叫号历史（保留最近 20 条） |

**队列操作**：

| 操作 | Redis 命令 | 说明 |
|------|-----------|------|
| 入队 | `LPUSH window:{id}:queue {orderId}` | 制作完成时从左侧入队 |
| 出队 | `RPOP window:{id}:queue` | 商家叫号时从右侧出队（FIFO） |
| 查询队列 | `LRANGE window:{id}:queue 0 -1` | 获取全部等待订单 |
| 队列长度 | `LLEN window:{id}:queue` | 等待人数 |

### 5.3 取餐号生成策略

**格式**：`{前缀}{序号}`
- 前缀：窗口自定义，如 "A"、"B"、"1"
- 序号：Redis 自增计数器，3 位补零（001, 002...）

**生成算法**：
```text
function 生成取餐号(windowId):
    counter = Redis.incr("window:" + windowId + ":counter")
    // 每日重置逻辑（可选）
    // if 是新的一天: Redis.set(counterKey, 0)

    prefix = windowMapper.selectById(windowId).prefix  // 如 "A"
    return prefix + String.format("%03d", counter)     // 如 "A001"
```

### 5.4 叫号广播机制

**WebSocket 消息格式**：
```json
{
  "type": "CALL",
  "windowId": 1,
  "pickupNo": "A001",
  "orderId": 10001,
  "timestamp": 1714291200000
}
```

**广播范围**：
- 所有连接到 `/ws/pickup` 的客户端都会收到
- 客户端根据 `windowId` 过滤显示自己关注的窗口

**实现方式**：
- 开发环境：单实例，直接内存广播
- 生产环境：多实例时通过 Redis Pub/Sub 跨实例广播（本作业简化处理）

### 5.5 取餐核销流程

1. **接收取餐码**：用户在前端出示 6 位数字（如 384756）
2. **查询订单**：`SELECT * FROM orders WHERE pickup_code = ? AND status = 3`
3. **校验窗口**：确认订单所属窗口与当前核销窗口一致
4. **更新状态**：
   - `pickup_record.queue_status = 2`（已取餐）
   - `pickup_record.pickup_time = NOW()`
   - 回调 Order Service：`PUT /order/{id}/pickup` → 订单状态变为 4（已取餐）
5. **广播通知**：WebSocket 推送 `"type": "PICKUP"` 到大屏
6. **返回结果**：核销成功

### 5.6 大屏数据组装

**DisplayVO 结构**：
```json
{
  "windowId": 1,
  "windowName": "1号档口-盖浇饭",
  "currentCall": {
    "pickupNo": "A001",
    "orderId": 10001,
    "callTime": "11:30:00"
  },
  "waitingCount": 5,
  "waitingList": [
    {"pickupNo": "A002", "orderId": 10002},
    {"pickupNo": "A003", "orderId": 10003}
  ],
  "recentHistory": [
    {"pickupNo": "A000", "status": "已取餐", "time": "11:25:00"}
  ]
}
```

---

## 6. 伪代码

### 6.1 订单入队

```text
function 入队(enqueueDTO):
    orderId = enqueueDTO.orderId
    windowId = enqueueDTO.windowId

    // 1. 校验窗口存在且营业
    window = windowMapper.selectById(windowId)
    if window == null 或 window.status != 1:
        return Result.error(WINDOW_NOT_FOUND)

    // 2. 生成取餐号
    pickupNo = 生成取餐号(windowId)

    // 3. Redis 入队
    Redis.lpush("window:" + windowId + ":queue", orderId)

    // 4. 持久化取餐记录
    record = new PickupRecord()
    record.orderId = orderId
    record.windowId = windowId
    record.pickupNo = pickupNo
    record.queueStatus = 0      // 排队中
    record.queueTime = 当前时间
    pickupRecordMapper.insert(record)

    // 5. 返回取餐号给 Order Service
    return Result.success(Map.of("pickupNo", pickupNo))
```

### 6.2 商家叫号

```text
function 叫号(windowId):
    // 1. 校验窗口
    window = windowMapper.selectById(windowId)
    if window == null:
        return Result.error(WINDOW_NOT_FOUND)

    // 2. 从队列出队（FIFO）
    orderId = Redis.rpop("window:" + windowId + ":queue")
    if orderId == null:
        return Result.error(QUEUE_EMPTY)

    // 3. 查询取餐号
    record = pickupRecordMapper.selectByOrderId(orderId)
    pickupNo = record.pickupNo

    // 4. 更新记录状态
    record.queueStatus = 1      // 已叫号
    record.callTime = 当前时间
    pickupRecordMapper.updateById(record)

    // 5. 更新当前叫号缓存
    Redis.set("window:" + windowId + ":current", orderId)
    Redis.lpush("window:" + windowId + ":history", orderId)
    Redis.ltrim("window:" + windowId + ":history", 0, 19)   // 保留最近20条

    // 6. WebSocket 广播
    message = new WebSocketMessage()
    message.type = "CALL"
    message.windowId = windowId
    message.pickupNo = pickupNo
    message.orderId = orderId
    webSocketHandler.broadcast(message)

    return Result.success(Map.of("pickupNo", pickupNo, "orderId", orderId))
```

### 6.3 取餐核销

```text
function 核销(verifyDTO):
    pickupCode = verifyDTO.pickupCode
    windowId = verifyDTO.windowId

    // 1. 查询订单（通过 Order Service 或本地关联查询）
    order = orderClient.getOrderByPickupCode(pickupCode)
    if order == null:
        return Result.error(PICKUP_CODE_ERROR)

    // 2. 校验状态
    if order.status != 3:    // 不是待取餐
        return Result.error(ORDER_STATUS_ERROR)

    // 3. 校验窗口一致性
    if order.windowId != windowId:
        return Result.error(PARAM_ERROR, "取餐码不属于本窗口")

    // 4. 更新取餐记录
    record = pickupRecordMapper.selectByOrderId(order.id)
    record.queueStatus = 2      // 已取餐
    record.pickupTime = 当前时间
    pickupRecordMapper.updateById(record)

    // 5. 回调 Order Service 更新订单状态
    orderClient.confirmPickup(order.id)

    // 6. WebSocket 广播
    message = new WebSocketMessage()
    message.type = "PICKUP"
    message.windowId = windowId
    message.pickupNo = record.pickupNo
    message.orderId = order.id
    webSocketHandler.broadcast(message)

    return Result.success("取餐成功")
```

### 6.4 大屏数据查询

```text
function 查询大屏数据(windowId):
    // 1. 窗口信息
    window = windowMapper.selectById(windowId)

    // 2. 当前叫号
    currentOrderId = Redis.get("window:" + windowId + ":current")
    currentCall = null
    if currentOrderId != null:
        record = pickupRecordMapper.selectByOrderId(currentOrderId)
        currentCall = Map.of(
            "pickupNo", record.pickupNo,
            "orderId", currentOrderId,
            "callTime", record.callTime
        )

    // 3. 等待队列
    waitingOrderIds = Redis.lrange("window:" + windowId + ":queue", 0, -1)
    waitingList = []
    for oid in waitingOrderIds:
        record = pickupRecordMapper.selectByOrderId(oid)
        waitingList.add(Map.of("pickupNo", record.pickupNo, "orderId", oid))

    // 4. 最近历史
    historyOrderIds = Redis.lrange("window:" + windowId + ":history", 0, 9)
    history = []
    for oid in historyOrderIds:
        record = pickupRecordMapper.selectByOrderId(oid)
        statusText = record.queueStatus == 2 ? "已取餐" : "已过号"
        history.add(Map.of(
            "pickupNo", record.pickupNo,
            "status", statusText,
            "time", record.callTime
        ))

    // 5. 组装 VO
    display = new DisplayVO()
    display.windowId = windowId
    display.windowName = window.name
    display.currentCall = currentCall
    display.waitingCount = waitingList.size()
    display.waitingList = waitingList
    display.recentHistory = history

    return Result.success(display)
```

---

## 7. 接口契约

### 7.1 REST API

| 方法 | 路径 | 鉴权 | 角色 | 说明 |
|------|------|------|------|------|
| POST | `/pickup/enqueue` | 是 | SYSTEM | 订单入队（Order调用） |
| POST | `/pickup/{windowId}/call` | 是 | MERCHANT | 商家叫号 |
| POST | `/pickup/verify` | 是 | USER/MERCHANT | 取餐核销 |
| GET | `/pickup/{windowId}/queue` | 否 | — | 查询等待队列 |
| GET | `/pickup/{windowId}/display` | 否 | — | 大屏数据 |
| GET | `/pickup/windows` | 否 | — | 窗口列表 |
| POST | `/pickup/window` | 是 | ADMIN | 创建窗口 |

### 7.2 WebSocket 消息

**连接地址**：`ws://localhost:8080/ws/pickup`（通过 Gateway 代理）

**上行消息**（客户端 → 服务端）：
```json
{
  "action": "SUBSCRIBE",
  "windowIds": [1, 2, 3]
}
```

**下行消息**（服务端 → 客户端）：

叫号推送：
```json
{
  "type": "CALL",
  "windowId": 1,
  "pickupNo": "A001",
  "orderId": 10001,
  "timestamp": 1714291200000
}
```

取餐完成推送：
```json
{
  "type": "PICKUP",
  "windowId": 1,
  "pickupNo": "A001",
  "orderId": 10001,
  "timestamp": 1714291200000
}
```

---

## 8. 配置说明

### 8.1 application.yml

```yaml
server:
  port: 8084

spring:
  application:
    name: canteen-pickup-service
  datasource:
    url: jdbc:mysql://127.0.0.1:3320/canteen?useUnicode=true&characterEncoding=utf-8&serverTimezone=Asia/Shanghai
    username: root
    password: root
    driver-class-name: com.mysql.cj.jdbc.Driver
  redis:
    host: 127.0.0.1
    port: 6379
  cloud:
    nacos:
      discovery:
        server-addr: 127.0.0.1:8848

mybatis-plus:
  configuration:
    log-impl: org.apache.ibatis.logging.stdout.StdOutImpl
  global-config:
    db-config:
      logic-delete-field: deleted
      logic-delete-value: 1
      logic-not-delete-value: 0
```

---

## 9. 依赖清单

### 9.1 Maven 依赖

```xml
<dependencies>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-web</artifactId>
    </dependency>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-websocket</artifactId>
    </dependency>
    <dependency>
        <groupId>com.alibaba.cloud</groupId>
        <artifactId>spring-cloud-starter-alibaba-nacos-discovery</artifactId>
    </dependency>
    <dependency>
        <groupId>org.springframework.cloud</groupId>
        <artifactId>spring-cloud-starter-openfeign</artifactId>
    </dependency>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-data-redis</artifactId>
    </dependency>
    <dependency>
        <groupId>com.baomidou</groupId>
        <artifactId>mybatis-plus-boot-starter</artifactId>
    </dependency>
    <dependency>
        <groupId>com.mysql</groupId>
        <artifactId>mysql-connector-j</artifactId>
    </dependency>
    <dependency>
        <groupId>com.canteen</groupId>
        <artifactId>canteen-common</artifactId>
    </dependency>
</dependencies>
```

---

> 本文档描述取餐与排队域微服务。其他模块详细设计请参见对应文档。
