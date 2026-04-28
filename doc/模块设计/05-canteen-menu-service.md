# canteen-menu-service 模块设计文档

> 智能食堂系统 —— 菜品与菜单域微服务（商品中心）

---

## 1. 模块概述

### 1.1 定位与职责

`canteen-menu-service` 是系统的**商品中心**，负责菜品全生命周期管理与每日菜单运营。它是订单服务的前置依赖：用户只能浏览和购买本服务发布的有效菜单中的菜品。

核心职责：
- 菜品基础信息管理（增删改查、上下架）
- 每日菜单发布（含售卖时段、可选菜品、当日售价）
- 库存管理（下单扣减、取消恢复、低于阈值预警）
- 商家菜品上下架控制

### 1.2 边界上下文

```
┌─────────────────────────────────────────────┐
│           菜品域 (Menu Domain)              │
├─────────────────────────────────────────────┤
│  核心概念：菜品(Dish)、菜单(Menu)、菜单菜品  │
│           (MenuDish=当日库存+当日售价)       │
│  聚合根：dish（长期信息）+ menu（每日运营）   │
│  对外暴露：REST API（通过 Gateway 路由）      │
│  被依赖方：Order Service（查询库存、扣减）   │
└─────────────────────────────────────────────┘
```

---

## 2. 功能清单

### 2.1 功能列表

| 编号 | 功能 | 接口路径 | 说明 |
|------|------|---------|------|
| M-001 | 创建菜品 | `POST /dish` | 商家发布新菜品 |
| M-002 | 修改菜品 | `PUT /dish/{id}` | 修改名称、价格、描述等 |
| M-003 | 删除菜品 | `DELETE /dish/{id}` | 逻辑删除 |
| M-004 | 查询菜品详情 | `GET /dish/{id}` | 返回菜品基础信息 |
| M-005 | 查询菜品列表 | `GET /dish/list` | 分页 + 条件筛选 |
| M-006 | 菜品上下架 | `PUT /dish/{id}/status` | 0=下架，1=上架 |
| M-007 | 发布每日菜单 | `POST /menu` | 选择菜品 + 设置时段 + 当日售价 |
| M-008 | 查询当日菜单 | `GET /menu/today` | 返回今日有效菜单及菜品 |
| M-009 | 查询菜单详情 | `GET /menu/{id}` | 返回菜单及关联菜品列表 |
| M-010 | 库存扣减 | `POST /menu/deduct` | 内部接口，Order Service 调用 |
| M-011 | 库存恢复 | `POST /menu/restore` | 内部接口，订单取消时调用 |

### 2.2 非功能需求

| 类型 | 需求 | 实现 |
|------|------|------|
| 一致性 | 库存不能超卖 | 数据库乐观锁（条件更新） |
| 时效性 | 仅展示当前可售菜品 | 菜单时段过滤 + 库存 > 0 过滤 |
| 扩展性 | 支持多商家 | merchant_id 字段隔离 |

---

## 3. 外部交互关系

### 3.1 上游依赖（Menu Service 依赖谁）

```
┌─────────────────────────────────────────────┐
│        canteen-menu-service :8082            │
├─────────────────────────────────────────────┤
│ 依赖方              │ 用途                    │
├─────────────────────┼───────────────────────┤
│ MySQL :3320/canteen │ 菜品/菜单/库存数据持久化 │
│ Redis :6379         │ 当日菜单缓存            │
│ Nacos :8848         │ 服务注册                │
│ canteen-common      │ Result, StatusCode      │
└─────────────────────────────────────────────┘
```

### 3.2 下游消费（谁调用 Menu Service）

| 调用方 | 调用方式 | 场景 |
|--------|---------|------|
| Gateway | HTTP 路由 | 前端浏览菜单、商家管理菜品 |
| Order Service | HTTP Feign/OpenFeign | 下单时扣减库存、取消时恢复库存 |

### 3.3 与 Order Service 的交互

```
OrderService                    MenuService
    │                              │
    │  1. 下单前校验库存            │
    │  GET /menu/dish/{menuDishId} │
    │─────────────────────────────>│
    │  返回当前 stock               │
    │<─────────────────────────────│
    │                              │
    │  2. 扣减库存                  │
    │  POST /menu/deduct           │
    │  Body: {menuDishId, quantity}│
    │─────────────────────────────>│
    │  执行: UPDATE ... WHERE stock>=qty │
    │  返回: 影响行数（1=成功，0=失败）   │
    │<─────────────────────────────│
    │                              │
    │  [订单取消]                   │
    │  POST /menu/restore          │
    │  Body: {menuDishId, quantity}│
    │─────────────────────────────>│
    │  执行: UPDATE stock=stock+qty│
    │<─────────────────────────────│
```

> **注意**：库存扣减/恢复通过 HTTP 调用 Menu Service 实现，保持数据所有权在菜品域。

---

## 4. 代码文件结构

```text
canteen-menu-service/
├── pom.xml
└── src/
    ├── main/
    │   ├── java/
    │   │   └── com/
    │   │       └── canteen/
    │   │           └── menu/
    │   │               ├── MenuServiceApplication.java
    │   │               ├── controller/
    │   │               │   ├── DishController.java      ← 菜品管理API
    │   │               │   └── MenuController.java      ← 菜单管理API
    │   │               ├── service/
    │   │               │   ├── DishService.java         ← 菜品业务逻辑
    │   │               │   └── MenuService.java         ← 菜单业务逻辑
    │   │               ├── mapper/
    │   │               │   ├── DishMapper.java
    │   │               │   ├── MenuMapper.java
    │   │               │   └── MenuDishMapper.java
    │   │               └── entity/
    │   │                   ├── Dish.java                ← 菜品实体
    │   │                   ├── Menu.java                ← 菜单实体
    │   │                   └── MenuDish.java            ← 菜单菜品关联实体
    │   └── resources/
    │       ├── application.yml
    │       └── mapper/
    │           ├── DishMapper.xml
    │           ├── MenuMapper.xml
    │           └── MenuDishMapper.xml
    └── test/
        └── java/
            └── com/
                └── canteen/
                    └── menu/
                        └── service/
                            └── MenuServiceTest.java
```

---

## 5. 核心逻辑描述

### 5.1 数据库表结构

#### 5.1.1 菜品表 `dish`

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | BIGINT UNSIGNED | PK, AUTO_INCREMENT | 菜品ID |
| `merchant_id` | BIGINT UNSIGNED | NOT NULL, INDEX | 所属商家 |
| `name` | VARCHAR(128) | NOT NULL | 菜品名称 |
| `description` | TEXT | | 菜品描述 |
| `price` | DECIMAL(10,2) | NOT NULL | 基础售价（参考价） |
| `image` | VARCHAR(255) | | 图片URL |
| `category` | VARCHAR(64) | INDEX | 分类：主食/小吃/饮料 |
| `status` | TINYINT | DEFAULT 1 | 0=下架，1=上架 |
| `stock_threshold` | INT UNSIGNED | DEFAULT 10 | 库存预警阈值 |
| `create_time` | DATETIME | DEFAULT CURRENT_TIMESTAMP | |
| `update_time` | DATETIME | ON UPDATE CURRENT_TIMESTAMP | |
| `deleted` | TINYINT | DEFAULT 0 | 逻辑删除 |

#### 5.1.2 每日菜单表 `menu`

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | BIGINT UNSIGNED | PK, AUTO_INCREMENT | 菜单ID |
| `name` | VARCHAR(128) | NOT NULL | 菜单名称（如"今日午餐"） |
| `sale_date` | DATE | NOT NULL, INDEX | 售卖日期 |
| `start_time` | TIME | NOT NULL | 售卖开始时间 |
| `end_time` | TIME | NOT NULL | 售卖结束时间 |
| `status` | TINYINT | DEFAULT 1 | 0=失效，1=生效 |
| `create_time` | DATETIME | DEFAULT CURRENT_TIMESTAMP | |
| `update_time` | DATETIME | ON UPDATE CURRENT_TIMESTAMP | |
| `deleted` | TINYINT | DEFAULT 0 | 逻辑删除 |

#### 5.1.3 菜单菜品关联表 `menu_dish`

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | BIGINT UNSIGNED | PK, AUTO_INCREMENT | ID |
| `menu_id` | BIGINT UNSIGNED | NOT NULL, INDEX | 菜单ID |
| `dish_id` | BIGINT UNSIGNED | NOT NULL, INDEX | 菜品ID |
| `sale_price` | DECIMAL(10,2) | NOT NULL | **当日售价**（可不同于基础价） |
| `stock` | INT UNSIGNED | DEFAULT 0 | **当日库存余量** |
| `sold` | INT UNSIGNED | DEFAULT 0 | 当日已售数量 |
| `status` | TINYINT | DEFAULT 1 | 0=停售，1=可售 |
| `create_time` | DATETIME | DEFAULT CURRENT_TIMESTAMP | |
| `update_time` | DATETIME | ON UPDATE CURRENT_TIMESTAMP | |
| `deleted` | TINYINT | DEFAULT 0 | 逻辑删除 |

**唯一约束**：`UNIQUE KEY uk_menu_dish (menu_id, dish_id)` —— 同一菜单中同一菜品只能出现一次。

### 5.2 领域模型关系

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│    Dish     │◄───────│  MenuDish   │───────►│    Menu     │
│  (长期信息)  │  1:N   │ (当日运营)   │  N:1   │  (每日发布)  │
└─────────────┘         └─────────────┘         └─────────────┘
   merchant_id              menu_id
   name                     dish_id
   price (基础价)           sale_price (当日价)
   category                 stock (当日库存)
   status (上下架)          sold (当日销量)
```

**设计意图**：
- `dish` 存储长期不变的信息（名称、分类、图片）
- `menu` 定义每日的运营时段
- `menu_dish` 是运营核心：每日售价可灵活调整（促销），库存独立管理

### 5.3 库存扣减算法（乐观锁）

**问题**：高并发下多个用户同时下单同一菜品，如何避免超卖？

**方案**：数据库条件更新（乐观锁）

```sql
UPDATE menu_dish 
SET stock = stock - ?, sold = sold + ? 
WHERE id = ? AND stock >= ? AND deleted = 0;
```

**判断逻辑**：
- 返回 `影响行数 = 1` → 扣减成功
- 返回 `影响行数 = 0` → 库存不足（stock < quantity 或记录不存在）

**优点**：
- 无需分布式锁，性能高
- 数据库原子性保证一致性
- 失败时直接抛异常，上层回滚订单

### 5.4 库存恢复算法

订单取消/超时自动取消时，恢复库存：

```sql
UPDATE menu_dish 
SET stock = stock + ?, sold = sold - ? 
WHERE id = ? AND deleted = 0;
```

> 恢复不需要条件判断（sold 可能为 0，但不影响正确性），因为取消的订单一定之前扣减成功。

### 5.5 当日菜单查询逻辑

**查询条件**：
1. `sale_date = CURDATE()` —— 今日菜单
2. `start_time <= CURTIME() <= end_time` —— 当前在售卖时段内
3. `status = 1` —— 菜单生效
4. 关联查询 `menu_dish`，过滤 `stock > 0` 且 `status = 1`

**缓存策略**：
- 当日菜单查询结果缓存到 Redis，Key：`menu:today`，TTL：5 分钟
- 库存扣减后，主动删除缓存或等待 TTL 过期

### 5.6 库存预警逻辑

```text
function 检查库存预警(menuDishId):
    menuDish = 查询 menu_dish by id
    if menuDish.stock <= menuDish.dish.stock_threshold:
        // 触发预警（可扩展：发送消息给商家）
        log.warn("菜品 [{}] 库存预警，当前库存: {}, 阈值: {}", 
                 menuDish.dish.name, menuDish.stock, menuDish.dish.stock_threshold)
        // 可选：WebSocket 推送商家端
```

---

## 6. 伪代码

### 6.1 发布每日菜单

```text
function 发布菜单(menuDTO):
    // 1. 参数校验
    if menuDTO.sale_date < 今天:
        return Result.error(PARAM_ERROR, "售卖日期不能是过去")
    if menuDTO.start_time >= menuDTO.end_time:
        return Result.error(PARAM_ERROR, "结束时间必须晚于开始时间")

    // 2. 创建菜单主记录
    menu = new Menu()
    menu.name = menuDTO.name
    menu.saleDate = menuDTO.sale_date
    menu.startTime = menuDTO.start_time
    menu.endTime = menuDTO.end_time
    menu.status = 1
    menuMapper.insert(menu)

    // 3. 关联菜品
    for item in menuDTO.dishList:
        menuDish = new MenuDish()
        menuDish.menuId = menu.id
        menuDish.dishId = item.dishId
        menuDish.salePrice = item.salePrice    // 当日售价
        menuDish.stock = item.initialStock      // 初始库存
        menuDish.sold = 0
        menuDish.status = 1
        menuDishMapper.insert(menuDish)

    // 4. 清除缓存
    Redis.del("menu:today")

    return Result.success(menu.id)
```

### 6.2 库存扣减（核心）

```text
function 扣减库存(deductDTO):
    menuDishId = deductDTO.menuDishId
    quantity = deductDTO.quantity

    // 1. 参数校验
    if quantity <= 0:
        return Result.error(PARAM_ERROR)

    // 2. 乐观锁扣减
    affectedRows = menuDishMapper.deductStock(menuDishId, quantity)

    // SQL: UPDATE menu_dish SET stock=stock-?, sold=sold+? 
    //      WHERE id=? AND stock>=? AND deleted=0

    if affectedRows == 0:
        return Result.error(STOCK_NOT_ENOUGH)

    // 3. 检查预警
    menuDish = menuDishMapper.selectById(menuDishId)
    if menuDish.stock <= dishMapper.selectById(menuDish.dishId).stockThreshold:
        log.warn("库存预警: menuDish={}, stock={}", menuDishId, menuDish.stock)

    return Result.success()
```

### 6.3 查询当日菜单（带缓存）

```text
function 查询当日菜单():
    cacheKey = "menu:today"

    // 1. 查缓存
    cached = Redis.get(cacheKey)
    if cached != null:
        return Result.success(cached)

    // 2. 查数据库
    today = 当前日期
    now = 当前时间

    menu = menuMapper.selectTodayMenu(today, now)
    if menu == null:
        return Result.success(null)   // 今日无菜单

    // 3. 查询关联菜品（仅可售且库存>0）
    dishList = menuDishMapper.selectAvailableByMenuId(menu.id)

    // 4. 组装 VO
    result = new MenuVO()
    result.menu = menu
    result.dishes = dishList

    // 5. 写入缓存（TTL 5分钟）
    Redis.setex(cacheKey, 300, result)

    return Result.success(result)
```

---

## 7. 接口契约

### 7.1 对外 API（通过 Gateway）

| 方法 | 路径 | 鉴权 | 角色 | 说明 |
|------|------|------|------|------|
| POST | `/dish` | 是 | MERCHANT | 创建菜品 |
| PUT | `/dish/{id}` | 是 | MERCHANT | 修改菜品 |
| DELETE | `/dish/{id}` | 是 | MERCHANT | 删除菜品 |
| GET | `/dish/{id}` | 否 | — | 查询菜品详情 |
| GET | `/dish/list` | 否 | — | 分页查询菜品 |
| PUT | `/dish/{id}/status` | 是 | MERCHANT | 上下架 |
| POST | `/menu` | 是 | MERCHANT | 发布菜单 |
| GET | `/menu/today` | 否 | — | 查询今日菜单 |
| GET | `/menu/{id}` | 否 | — | 查询菜单详情 |

### 7.2 内部 API（服务间调用）

| 方法 | 路径 | 调用方 | 说明 |
|------|------|--------|------|
| POST | `/menu/deduct` | Order Service | 扣减库存 |
| POST | `/menu/restore` | Order Service | 恢复库存 |
| GET | `/menu/dish/{id}` | Order Service | 查询菜单菜品详情 |

### 7.3 DTO 定义

**发布菜单 DTO**：
```json
{
  "name": "今日午餐",
  "saleDate": "2026-04-28",
  "startTime": "10:30",
  "endTime": "13:30",
  "dishList": [
    {
      "dishId": 1,
      "salePrice": 15.00,
      "initialStock": 100
    },
    {
      "dishId": 2,
      "salePrice": 12.00,
      "initialStock": 80
    }
  ]
}
```

**扣减库存 DTO**：
```json
{
  "menuDishId": 5,
  "quantity": 2
}
```

---

## 8. 配置说明

### 8.1 application.yml

```yaml
server:
  port: 8082

spring:
  application:
    name: canteen-menu-service
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

> 本文档描述菜品与菜单域微服务。其他模块详细设计请参见对应文档。
