# canteen-order-service 模块设计文档

> 智能食堂系统 —— 订单域微服务（交易核心）

---

## 1. 模块概述

### 1.1 定位与职责

`canteen-order-service` 是系统的**交易核心**，负责订单全生命周期管理。它是用户端与商家端交互的枢纽：用户在此提交订单、查看状态；商家在此接单、更新制作进度。

核心职责：
- 用户下单（预占库存、生成订单、生成取餐码）
- 订单状态机流转（已下单 → 已接单 → 制作中 → 待取餐 → 已取餐）
- 限时取消（用户主动取消、支付超时、商家超时未接单）
- 超时自动取消与库存恢复
- 订单明细与取餐号/取餐码管理

### 1.2 边界上下文

```
┌─────────────────────────────────────────────┐
│           订单域 (Order Domain)              │
├─────────────────────────────────────────────┤
│  核心概念：订单(Order)、订单明细(OrderItem)、  │
│           取餐码(PickupCode)、状态机          │
│  聚合根：orders 表                           │
│  对外暴露：REST API（通过 Gateway 路由）      │
│  依赖方：Menu Service（扣减/恢复库存）       │
│  被依赖方：Pickup Service（制作完成入队）     │
└─────────────────────────────────────────────┘
```

---

## 2. 功能清单

### 2.1 功能列表

| 编号 | 功能 | 接口路径 | 说明 |
|------|------|---------|------|
| O-001 | 提交订单 | `POST /order` | 用户下单，预占库存 |
| O-002 | 查询订单详情 | `GET /order/{id}` | 返回订单 + 明细 |
| O-003 | 查询我的订单 | `GET /order/my` | 分页查询当前用户订单 |
| O-004 | 商家接单 | `PUT /order/{id}/accept` | 商家确认接单 |
| O-005 | 开始制作 | `PUT /order/{id}/cook` | 商家标记制作中 |
| O-006 | 制作完成 | `PUT /order/{id}/ready` | 商家标记待取餐，通知Pickup入队 |
| O-007 | 用户取消 | `PUT /order/{id}/cancel` | 用户主动取消（限时） |
| O-008 | 超时自动取消 | 内部定时任务 | 扫描超时订单自动取消 |
| O-009 | 取餐核销回调 | `PUT /order/{id}/pickup` | Pickup Service核销后回调 |

### 2.2 非功能需求

| 类型 | 需求 | 实现 |
|------|------|------|
| 一致性 | 订单与库存强一致 | 先扣库存再建订单，失败回滚 |
| 可靠性 | 超时订单必被取消 | @Scheduled 定时扫描 + 补偿 |
| 可追溯 | 订单状态变更可追踪 | 状态字段 + 时间戳记录 |

---

## 3. 外部交互关系

### 3.1 上游依赖（Order Service 依赖谁）

```
┌─────────────────────────────────────────────┐
│        canteen-order-service :8083             │
├─────────────────────────────────────────────┤
│ 依赖方              │ 用途                    │
├─────────────────────┼───────────────────────┤
│ MySQL :3320/canteen │ 订单数据持久化          │
│ Redis :6379         │ 取餐码防重、超时队列    │
│ Nacos :8848         │ 服务注册                │
│ Menu Service :8082  │ 库存扣减/恢复           │
│ Pickup Service :8084│ 制作完成通知入队        │
│ canteen-common      │ Result, JwtUtil         │
└─────────────────────────────────────────────┘
```

### 3.2 下游消费（谁调用 Order Service）

| 调用方 | 调用方式 | 场景 |
|--------|---------|------|
| Gateway | HTTP 路由 | 用户下单、查询、取消；商家接单、制作 |
| Pickup Service | HTTP 回调 | 取餐核销后更新订单状态为"已取餐" |

### 3.3 跨服务交互时序

#### 3.3.1 下单流程

```text
客户端          Gateway         OrderService        MenuService
  │              │                  │                  │
  │  POST /api/order              │                  │
  │─────────────>│                 │                  │
  │              │  转发 + JWT    │                  │
  │              │  X-User-Id注入 │                  │
  │              │────────────────>│                  │
  │              │                 │  1. 参数校验     │
  │              │                 │  2. 校验菜单菜品存在│
  │              │                 │  3. 调用Menu扣减库存│
  │              │                 │─────────────────>│
  │              │                 │  乐观锁扣减       │
  │              │                 │  成功/失败        │
  │              │                 │<─────────────────│
  │              │                 │                  │
  │              │                 │  4. 扣减失败→抛异常│
  │              │                 │  5. 扣减成功→建订单 │
  │              │                 │  6. 生成取餐码     │
  │              │                 │  7. 设置超时时间   │
  │              │                 │  8. 插入订单+明细  │
  │              │                 │                  │
  │              │<────────────────│  返回订单信息      │
  │<─────────────│                 │                  │
```

#### 3.3.2 制作完成 → 通知 Pickup 入队

```text
商家端          Gateway         OrderService        PickupService
  │              │                  │                  │
  │  PUT /api/order/{id}/ready    │                  │
  │─────────────>│                 │                  │
  │              │────────────────>│                  │
  │              │                 │  1. 校验订单存在   │
  │              │                 │  2. 校验状态=制作中 │
  │              │                 │  3. 更新状态=待取餐 │
  │              │                 │  4. 通知Pickup入队  │
  │              │                 │─────────────────>│
  │              │                 │                  │  Redis LPUSH
  │              │                 │                  │  生成取餐号
  │              │                 │<─────────────────│
  │              │<────────────────│  返回成功          │
  │<─────────────│                 │                  │
```

#### 3.3.3 超时自动取消

```text
定时任务        OrderService        MenuService
  │              │                  │
  │  每30秒触发  │                  │
  │─────────────>│                  │
  │              │  1. 查询超时订单   │
  │              │  SELECT * FROM orders
  │              │  WHERE status=0
  │              │  AND pay_deadline < NOW()
  │              │                  │
  │              │  2. 批量更新状态=5(已取消)│
  │              │  cancel_type=2(支付超时) │
  │              │                  │
  │              │  3. 逐个恢复库存  │
  │              │─────────────────>│
  │              │  POST /menu/restore      │
  │              │<─────────────────│
  │              │                  │
```

---

## 4. 代码文件结构

```text
canteen-order-service/
├── pom.xml
└── src/
    ├── main/
    │   ├── java/
    │   │   └── com/
    │   │       └── canteen/
    │   │           └── order/
    │   │               ├── OrderServiceApplication.java
    │   │               ├── controller/
    │   │               │   └── OrderController.java
    │   │               │       ↑ 9个API端点
    │   │               ├── service/
    │   │               │   └── OrderService.java
    │   │               │       ↑ 下单/状态流转/超时取消
    │   │               ├── mapper/
    │   │               │   ├── OrderMapper.java
    │   │               │   └── OrderItemMapper.java
    │   │               ├── entity/
    │   │               │   ├── Order.java
    │   │               │   └── OrderItem.java
    │   │               ├── dto/
    │   │               │   ├── CreateOrderDTO.java
    │   │               │   └── OrderItemDTO.java
    │   │               ├── vo/
    │   │               │   └── OrderVO.java
    │   │               ├── client/
    │   │               │   └── MenuClient.java
    │   │               │       ↑ FeignClient 调用 Menu Service
    │   │               └── scheduler/
    │   │                   └── OrderTimeoutScheduler.java
    │   │                       ↑ 定时扫描超时订单
    │   └── resources/
    │       ├── application.yml
    │       └── mapper/
    │           ├── OrderMapper.xml
    │           └── OrderItemMapper.xml
    └── test/
        └── java/
            └── com/
                └── canteen/
                    └── order/
                        └── service/
                            └── OrderServiceTest.java
```

---

## 5. 核心逻辑描述

### 5.1 数据库表结构

#### 5.1.1 订单主表 `orders`

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | BIGINT UNSIGNED | PK, AUTO_INCREMENT | 订单ID |
| `order_no` | VARCHAR(32) | UNIQUE, NOT NULL | 订单编号（如 O202604270001） |
| `user_id` | BIGINT UNSIGNED | NOT NULL, INDEX | 下单用户ID |
| `window_id` | BIGINT UNSIGNED | NOT NULL, INDEX | 取餐窗口ID |
| `total_amount` | DECIMAL(10,2) | NOT NULL | 订单总金额 |
| `status` | TINYINT | DEFAULT 0 | 状态机：0已下单,1已接单,2制作中,3待取餐,4已取餐,5已取消 |
| `pickup_no` | VARCHAR(16) | | 取餐号（叫号用，如 A001） |
| `pickup_code` | VARCHAR(16) | UNIQUE | 取餐码（核销用，6位随机数字） |
| `remark` | VARCHAR(255) | | 用户备注 |
| `cancel_type` | TINYINT | | 取消类型：1用户取消,2支付超时,3商家超时未接单 |
| `cancel_time` | DATETIME | | 取消时间 |
| `pay_deadline` | DATETIME | INDEX | 支付截止时间（超时自动取消） |
| `accept_deadline` | DATETIME | INDEX | 商家接单截止时间 |
| `create_time` | DATETIME | DEFAULT CURRENT_TIMESTAMP | |
| `update_time` | DATETIME | ON UPDATE CURRENT_TIMESTAMP | |
| `deleted` | TINYINT | DEFAULT 0 | 逻辑删除 |

#### 5.1.2 订单明细表 `order_item`

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | BIGINT UNSIGNED | PK, AUTO_INCREMENT | 明细ID |
| `order_id` | BIGINT UNSIGNED | NOT NULL, INDEX | 订单ID |
| `dish_id` | BIGINT UNSIGNED | NOT NULL | 菜品ID |
| `menu_dish_id` | BIGINT UNSIGNED | | 当日菜单菜品ID（库存追溯） |
| `dish_name` | VARCHAR(128) | NOT NULL | 菜品名称（冗余，防改名） |
| `quantity` | INT UNSIGNED | NOT NULL | 数量 |
| `unit_price` | DECIMAL(10,2) | NOT NULL | 下单时单价 |
| `subtotal` | DECIMAL(10,2) | NOT NULL | 小计金额 |
| `create_time` | DATETIME | DEFAULT CURRENT_TIMESTAMP | |
| `deleted` | TINYINT | DEFAULT 0 | 逻辑删除 |

### 5.2 订单状态机

```
                    ┌─────────────┐
                    │   已下单(0)  │
                    └──────┬──────┘
                           │
            ┌──────────────┼──────────────┐
            │              │              │
            ▼              ▼              ▼
    ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
    │  已取消(5)   │ │  已接单(1)   │ │  已取消(5)   │
    │ 用户主动取消  │ │             │ │ 商家超时未接单│
    └─────────────┘ └──────┬──────┘ └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │  制作中(2)   │
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
                    │  待取餐(3)   │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
              ▼            ▼            ▼
       ┌─────────────┐         ┌─────────────┐
       │  已取餐(4)   │         │  已取消(5)   │
       │  用户核销    │         │  支付超时    │
       └─────────────┘         └─────────────┘
```

**状态流转规则**：

| 当前状态 | 允许操作 | 下一状态 | 触发条件 |
|---------|---------|---------|---------|
| 已下单(0) | 用户取消 | 已取消(5) | 用户主动点击取消 |
| 已下单(0) | 商家接单 | 已接单(1) | 商家确认接单 |
| 已下单(0) | 超时取消 | 已取消(5) | 超过 `accept_deadline` |
| 已接单(1) | 开始制作 | 制作中(2) | 商家标记开始制作 |
| 制作中(2) | 制作完成 | 待取餐(3) | 商家标记制作完成 |
| 待取餐(3) | 取餐核销 | 已取餐(4) | 用户出示取餐码，Pickup Service 核销 |

### 5.3 取餐码生成策略

**要求**：唯一、随机、6位数字、便于用户记忆和输入

**算法**：
```text
function 生成取餐码():
    while true:
        code = 随机生成6位数字(100000 ~ 999999)
        // 检查数据库唯一性
        existing = orderMapper.selectByPickupCode(code)
        if existing == null:
            return code
        // 冲突则重试（概率极低，10^6 空间）
```

**取餐号生成策略**（叫号显示，如 A001）：
- 由 Pickup Service 在入队时生成，格式：`{窗口前缀}{自增序号}`
- 存储在 `orders.pickup_no` 字段

### 5.4 超时控制策略

| 超时类型 | 触发条件 | 截止时间字段 | 处理方式 |
|---------|---------|------------|---------|
| 支付超时 | 下单后未支付 | `pay_deadline` = create_time + 15分钟 | 自动取消，恢复库存 |
| 商家接单超时 | 商家未接单 | `accept_deadline` = create_time + 30分钟 | 自动取消，恢复库存 |

**定时任务**：
- 频率：每 30 秒执行一次
- 扫描条件：`status = 0` AND (`pay_deadline < NOW()` OR `accept_deadline < NOW()`)
- 批量处理：一次最多处理 100 条，防止单次任务过重

### 5.5 库存一致性保障

**下单流程**：
1. 先调用 Menu Service 扣减库存（乐观锁）
2. 扣减成功 → 创建订单
3. 扣减失败 → 直接返回错误，不创建订单

**取消/超时流程**：
1. 更新订单状态为"已取消"
2. 调用 Menu Service 恢复库存
3. 如果恢复失败（Menu Service 不可用），记录日志，由补偿任务后续处理

> **设计权衡**：不引入分布式事务（Seata），采用"最终一致性 + 补偿"策略，降低复杂度。

---

## 6. 伪代码

### 6.1 提交订单

```text
function 提交订单(createOrderDTO, userId):
    // 1. 参数校验
    if createOrderDTO.items为空:
        return Result.error(PARAM_ERROR)
    if createOrderDTO.windowId为空:
        return Result.error(PARAM_ERROR)

    // 2. 计算总金额 + 扣减库存
    totalAmount = 0
    itemList = []

    for itemDTO in createOrderDTO.items:
        menuDish = menuClient.getMenuDish(itemDTO.menuDishId)
        if menuDish == null:
            return Result.error(MENU_NOT_FOUND)

        // 调用 Menu Service 扣减库存
        deductResult = menuClient.deductStock(itemDTO.menuDishId, itemDTO.quantity)
        if not deductResult.success:
            // 回滚已扣减的库存（补偿）
            for alreadyDeducted in itemList:
                menuClient.restoreStock(alreadyDeducted.menuDishId, alreadyDeducted.quantity)
            return Result.error(STOCK_NOT_ENOUGH)

        item = new OrderItem()
        item.dishId = menuDish.dishId
        item.menuDishId = menuDish.id
        item.dishName = menuDish.dishName
        item.quantity = itemDTO.quantity
        item.unitPrice = menuDish.salePrice
        item.subtotal = menuDish.salePrice * itemDTO.quantity
        itemList.add(item)

        totalAmount += item.subtotal

    // 3. 生成订单编号
    orderNo = 生成订单编号()   // 格式: O + yyyyMMdd + 4位自增

    // 4. 生成取餐码
    pickupCode = 生成取餐码()

    // 5. 设置超时时间
    now = 当前时间
    payDeadline = now + 15分钟
    acceptDeadline = now + 30分钟

    // 6. 创建订单
    order = new Order()
    order.orderNo = orderNo
    order.userId = userId
    order.windowId = createOrderDTO.windowId
    order.totalAmount = totalAmount
    order.status = 0          // 已下单
    order.pickupCode = pickupCode
    order.payDeadline = payDeadline
    order.acceptDeadline = acceptDeadline
    orderMapper.insert(order)

    // 7. 插入明细
    for item in itemList:
        item.orderId = order.id
        orderItemMapper.insert(item)

    // 8. 返回
    return Result.success(订单VO(order, itemList))
```

### 6.2 状态流转（通用）

```text
function 更新订单状态(orderId, newStatus, operatorRole):
    order = orderMapper.selectById(orderId)
    if order == null:
        return Result.error(ORDER_NOT_FOUND)

    currentStatus = order.status

    // 校验状态流转是否合法
    if not 状态流转合法(currentStatus, newStatus, operatorRole):
        return Result.error(ORDER_STATUS_ERROR)

    // 更新状态
    order.status = newStatus
    orderMapper.updateById(order)

    // 特殊处理：制作完成 → 通知 Pickup Service 入队
    if newStatus == 3:   // 待取餐
        pickupClient.enqueue(order.id, order.windowId)

    return Result.success()

function 状态流转合法(current, next, role):
    // 定义合法流转矩阵
    transitions = {
        0: { 1: ["MERCHANT"], 5: ["USER", "SYSTEM"] },   // 已下单 → 已接单(商家)/已取消(用户/系统)
        1: { 2: ["MERCHANT"] },                            // 已接单 → 制作中(商家)
        2: { 3: ["MERCHANT"] },                            // 制作中 → 待取餐(商家)
        3: { 4: ["SYSTEM"] }                              // 待取餐 → 已取餐(系统回调)
    }

    allowed = transitions[current][next]
    return allowed != null 且 role 在 allowed 中
```

### 6.3 超时自动取消（定时任务）

```text
function 扫描超时订单():
    now = 当前时间

    // 1. 查询超时订单
    timeoutOrders = orderMapper.selectTimeoutOrders(now, 批次大小=100)

    for order in timeoutOrders:
        // 2. 确定取消类型
        if order.payDeadline < now:
            cancelType = 2   // 支付超时
        else if order.acceptDeadline < now:
            cancelType = 3   // 商家超时未接单

        // 3. 更新订单状态
        order.status = 5          // 已取消
        order.cancelType = cancelType
        order.cancelTime = now
        orderMapper.updateById(order)

        // 4. 恢复库存（逐个明细）
        items = orderItemMapper.selectByOrderId(order.id)
        for item in items:
            try:
                menuClient.restoreStock(item.menuDishId, item.quantity)
            catch Exception e:
                log.error("库存恢复失败: order={}, menuDishId={}, qty={}", 
                          order.id, item.menuDishId, item.quantity)
                // 记录补偿日志，后续人工或自动补偿
```

---

## 7. 接口契约

### 7.1 API 列表

| 方法 | 路径 | 鉴权 | 角色 | 说明 |
|------|------|------|------|------|
| POST | `/order` | 是 | USER | 提交订单 |
| GET | `/order/{id}` | 是 | USER/MERCHANT | 查询订单详情 |
| GET | `/order/my` | 是 | USER | 查询我的订单（分页） |
| PUT | `/order/{id}/accept` | 是 | MERCHANT | 商家接单 |
| PUT | `/order/{id}/cook` | 是 | MERCHANT | 开始制作 |
| PUT | `/order/{id}/ready` | 是 | MERCHANT | 制作完成 |
| PUT | `/order/{id}/cancel` | 是 | USER | 用户取消 |
| PUT | `/order/{id}/pickup` | 是 | SYSTEM | 取餐核销回调（Pickup调用） |

### 7.2 DTO 定义

**CreateOrderDTO**：
```json
{
  "windowId": 1,
  "remark": "不要辣",
  "items": [
    {
      "menuDishId": 5,
      "quantity": 2
    },
    {
      "menuDishId": 8,
      "quantity": 1
    }
  ]
}
```

**OrderVO**：
```json
{
  "id": 10001,
  "orderNo": "O202604270001",
  "status": 2,
  "statusText": "制作中",
  "totalAmount": 42.00,
  "pickupCode": "384756",
  "pickupNo": "A001",
  "windowId": 1,
  "remark": "不要辣",
  "items": [
    {
      "dishName": "宫保鸡丁",
      "quantity": 2,
      "unitPrice": 15.00,
      "subtotal": 30.00
    }
  ],
  "createTime": "2026-04-27T11:00:00",
  "payDeadline": "2026-04-27T11:15:00"
}
```

---

## 8. 配置说明

### 8.1 application.yml

```yaml
server:
  port: 8083

spring:
  application:
    name: canteen-order-service
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

> 本文档描述订单域微服务。其他模块详细设计请参见对应文档。
