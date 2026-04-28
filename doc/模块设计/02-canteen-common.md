# canteen-common 模块设计文档

> 智能食堂系统 —— 公共基础设施模块

---

## 1. 模块概述

### 1.1 定位与职责

`canteen-common` 是整个微服务系统的**共享基础设施层**，不对外暴露 HTTP 接口，也不独立部署运行。它被所有业务服务（gateway、user、menu、order、pickup）以 Maven 依赖方式引入，提供：

- 统一响应契约（消除各服务接口返回格式不一致问题）
- 跨服务复用的工具类（JWT、日期、加密等）
- 基础实体与异常体系（支撑 MyBatis-Plus 逻辑删除、全局异常处理）

### 1.2 设计原则

| 原则 | 说明 |
|------|------|
| 零依赖业务 | common 不引用任何业务模块，只被业务模块引用 |
| 轻量级 | 不包含 Spring Web、数据库等重型依赖，避免传递污染 |
| 稳定接口 | 一旦发布，类名/方法签名不轻易变更，防止级联编译错误 |

---

## 2. 功能清单

### 2.1 功能列表

| 编号 | 功能 | 说明 |
|------|------|------|
| C-001 | 统一响应封装 | `Result<T>` 泛型响应体，所有 Controller 统一返回 |
| C-002 | 业务状态码定义 | `StatusCode` 枚举，覆盖通用 + 各域错误码 |
| C-003 | 业务异常体系 | `BusinessException` 运行时异常，支持携带 StatusCode |
| C-004 | JWT 工具 | Token 生成、解析、校验、提取 Claims |
| C-005 | 基础实体 | `BaseEntity` 含 id、时间戳、逻辑删除字段 |

### 2.2 非功能需求

- **线程安全**：JwtUtil 使用无状态方法，无共享可变变量
- **性能**：JWT 解析使用 HMAC-SHA256，单次耗时 < 1ms
- **兼容性**：支持 Java 17 + Spring Boot 3.x

---

## 3. 外部交互关系

### 3.1 上游依赖（common 依赖谁）

common 作为最底层模块，**仅依赖基础工具库**：

| 依赖 | 用途 |
|------|------|
| `jjwt-api` | JWT 接口定义（生成/解析 Token） |
| `lombok` | 注解生成 Getter/Setter/Constructor |

### 3.2 下游消费（谁依赖 common）

```
┌──────────────────────────────────────────────┐
│           canteen-common (公共模块)            │
│  ├─ Result<T>                                │
│  ├─ StatusCode                               │
│  ├─ BusinessException                        │
│  ├─ JwtUtil                                  │
│  └─ BaseEntity                               │
└──────────────┬───────────────────────────────┘
               │ 被所有业务模块依赖
    ┌──────────┼──────────┬──────────┐
    ▼          ▼          ▼          ▼
 Gateway    User      Menu      Order     Pickup
 Service   Service   Service   Service   Service
```

### 3.3 交互说明

- **编译期依赖**：各服务 `pom.xml` 引入 `<dependency><artifactId>canteen-common</artifactId></dependency>`
- **运行期无网络调用**：common 不是独立进程，类被加载到各服务 JVM 中本地使用
- **版本管理**：由父 POM 统一锁定 `canteen-common` 版本为 `${project.version}`

---

## 4. 代码文件结构

```text
canteen-common/
├── pom.xml
└── src/
    ├── main/
    │   └── java/
    │       └── com/
    │           └── canteen/
    │               └── common/
    │                   ├── entity/
    │                   │   └── BaseEntity.java          ← 基础实体
    │                   ├── result/
    │                   │   ├── Result.java              ← 统一响应体
    │                   │   └── StatusCode.java          ← 状态码枚举
    │                   ├── exception/
    │                   │   └── BusinessException.java    ← 业务异常
    │                   └── util/
    │                       └── JwtUtil.java             ← JWT工具
    └── test/
        └── java/
            └── com/
                └── canteen/
                    └── common/
                        └── util/
                            └── JwtUtilTest.java         ← JWT工具单元测试
```

### 4.2 关键文件说明

| 文件 | 职责 | 被谁使用 |
|------|------|---------|
| `BaseEntity.java` | 定义所有数据库实体的公共字段 | 各服务的 Entity 类继承 |
| `Result.java` | 包装 Controller 返回值 | 所有 Controller 方法 |
| `StatusCode.java` | 错误码中央仓库 | Result、BusinessException、全局异常处理器 |
| `BusinessException.java` | 区分"业务预期错误"与"系统异常" | Service 层抛出，ControllerAdvice 捕获 |
| `JwtUtil.java` | Token 全生命周期管理 | Gateway（校验）、UserService（生成） |

---

## 5. 核心逻辑描述

### 5.1 统一响应体 Result<T>

**设计目标**：消除各微服务接口返回格式不一致问题，前端/网关只需解析一种结构。

**结构定义**：
```json
{
  "code": 200,
  "msg": "操作成功",
  "data": { ... },
  "timestamp": 1714291200000
}
```

**字段说明**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `code` | Integer | 业务状态码，非 HTTP 状态码。200 为成功，其余为各类错误 |
| `msg` | String | 可读的错误描述 |
| `data` | T | 泛型载荷，成功时携带业务数据，失败时为 null |
| `timestamp` | Long | 服务端响应时间戳，用于日志对齐与排障 |

**工厂方法**：
- `Result.success()` —— 无数据成功
- `Result.success(T data)` —— 带数据成功
- `Result.error(StatusCode)` —— 标准错误
- `Result.error(int, String)` —— 自定义错误

### 5.2 业务状态码 StatusCode

**编码规则**：

| 区间 | 归属 | 示例 |
|------|------|------|
| 200 | 通用成功 | `SUCCESS(200, "操作成功")` |
| 400~499 | 通用客户端错误 | `PARAM_ERROR(400, "参数错误")` |
| 500 | 通用服务端错误 | `ERROR(500, "系统内部错误")` |
| 1000~1999 | 用户域 | `USER_NOT_FOUND(1002, "用户不存在")` |
| 2000~2999 | 菜品域 | `STOCK_NOT_ENOUGH(2002, "库存不足")` |
| 3000~3999 | 订单域 | `ORDER_STATUS_ERROR(3002, "订单状态不允许此操作")` |
| 4000~4999 | 取餐域 | `QUEUE_EMPTY(4002, "当前队列无订单")` |

**设计意图**：通过 code 前缀快速定位问题域，便于日志检索和监控告警。

### 5.3 JWT 工具 JwtUtil

**算法选择**：HMAC-SHA256（对称签名）
- 原因：微服务内部共享 secret，无需 RSA 公私钥管理的复杂度
- 密钥长度：secret 字符串经 `Keys.hmacShaKeyFor()` 转为 256-bit SecretKey

**Token 载荷 Claims**：

| Claim | 类型 | 说明 |
|-------|------|------|
| `sub` | String | 用户ID（JWT标准主题字段） |
| `userId` | Long | 冗余存储，方便直接提取 |
| `username` | String | 用户名 |
| `role` | String | 角色：USER / MERCHANT / ADMIN |
| `iat` | Date | 签发时间（自动） |
| `exp` | Date | 过期时间（自动） |

**方法语义**：

| 方法 | 输入 | 输出 | 异常 |
|------|------|------|------|
| `generateToken` | secret, expiration, userId, username, role | JWT String | 无 |
| `parseToken` | secret, token | Claims | `ExpiredJwtException`, `JwtException` |
| `validateToken` | secret, token | boolean | 内部捕获所有异常，返回 false |
| `getUserId` | secret, token | Long | 依赖 parseToken |
| `getUsername` | secret, token | String | 依赖 parseToken |
| `getRole` | secret, token | String | 依赖 parseToken |

### 5.4 基础实体 BaseEntity

**字段设计**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | Long | 主键，数据库自增 |
| `createTime` | LocalDateTime | 插入时自动填充 |
| `updateTime` | LocalDateTime | 更新时自动填充 |
| `deleted` | Integer | 逻辑删除标志：0-正常，1-已删除 |

**配合 MyBatis-Plus**：
- 各服务 `application.yml` 配置 `logic-delete-field: deleted`
- 所有查询自动附加 `WHERE deleted = 0`
- 删除操作变为 `UPDATE ... SET deleted = 1`

---

## 6. 伪代码

### 6.1 Result 构建流程

```text
function 构建成功响应(data):
    result = new Result()
    result.code = StatusCode.SUCCESS.code    // 200
    result.msg = StatusCode.SUCCESS.msg      // "操作成功"
    result.data = data
    result.timestamp = 当前系统时间毫秒数
    return result

function 构建错误响应(statusCode):
    result = new Result()
    result.code = statusCode.code
    result.msg = statusCode.msg
    result.data = null
    result.timestamp = 当前系统时间毫秒数
    return result
```

### 6.2 JWT 生成流程

```text
function 生成Token(secret, expiration, userId, username, role):
    // 1. 构造签名密钥
    key = HMAC-SHA256(secret字符串的字节数组)

    // 2. 构造 Claims
    claims = new Map()
    claims["userId"] = userId
    claims["username"] = username
    claims["role"] = role

    // 3. 构造时间
    now = 当前时间
    expiry = now + expiration毫秒

    // 4. 组装 JWT
    jwt = Jwts.builder()
             .claims(claims)
             .subject(userId.toString())
             .issuedAt(now)
             .expiration(expiry)
             .signWith(key, SignatureAlgorithm.HS256)
             .compact()

    return jwt
```

### 6.3 JWT 校验流程

```text
function 校验Token(secret, token):
    try:
        key = HMAC-SHA256(secret字符串的字节数组)
        Jwts.parser()
            .verifyWith(key)
            .build()
            .parseSignedClaims(token)
        return true                    // 签名正确且未过期
    catch ExpiredJwtException:
        log.warn("Token已过期")
        return false
    catch JwtException, IllegalArgumentException:
        log.warn("Token无效")
        return false
```

### 6.4 业务异常抛出与传播

```text
function 业务层检查库存(dishId, quantity):
    currentStock = 查询数据库(dishId)
    if currentStock < quantity:
        // 抛出业务异常，携带预定义错误码
        throw new BusinessException(StatusCode.STOCK_NOT_ENOUGH)

    // ControllerAdvice 捕获后统一包装为 Result.error(...)
```

---

## 7. 接口契约

common 模块**不对外暴露 HTTP 接口**，但提供以下编程接口（API）供其他模块调用：

### 7.1 Result 工厂方法

```java
// 成功响应
Result.success()
Result.success(T data)

// 错误响应
Result.error(StatusCode statusCode)
Result.error(int code, String msg)
```

### 7.2 JwtUtil 工具方法

```java
String generateToken(String secret, long expiration,
                     Long userId, String username, String role)

Claims parseToken(String secret, String token)
        throws ExpiredJwtException, JwtException

boolean validateToken(String secret, String token)

Long getUserId(String secret, String token)
String getUsername(String secret, String token)
String getRole(String secret, String token)
```

### 7.3 BusinessException 构造

```java
// 使用预定义状态码
new BusinessException(StatusCode.USER_NOT_FOUND)

// 使用自定义消息（不推荐，优先扩展 StatusCode）
new BusinessException("自定义错误信息")
```

---

## 8. 配置说明

common 模块无独立配置文件，但各服务使用 common 中的类时需关注以下配置：

### 8.1 JWT 配置（各服务 application.yml）

```yaml
jwt:
  secret: canteen-secret-key-2026-smart-canteen-jwt
  expiration: 86400000  # 24小时，单位毫秒
```

### 8.2 MyBatis-Plus 逻辑删除（各服务 application.yml）

```yaml
mybatis-plus:
  global-config:
    db-config:
      logic-delete-field: deleted      # 对应 BaseEntity.deleted
      logic-delete-value: 1             # 删除标记值
      logic-not-delete-value: 0         # 未删除标记值
```

---

## 9. 依赖清单

### 9.1 Maven 依赖（pom.xml）

```xml
<dependencies>
    <!-- JWT API（仅接口，运行时由 jjwt-impl + jjwt-jackson 提供实现） -->
    <dependency>
        <groupId>io.jsonwebtoken</groupId>
        <artifactId>jjwt-api</artifactId>
        <version>0.12.5</version>
    </dependency>

    <!-- Lombok（编译期注解处理，optional 避免传递） -->
    <dependency>
        <groupId>org.projectlombok</groupId>
        <artifactId>lombok</artifactId>
        <optional>true</optional>
    </dependency>
</dependencies>
```

### 9.2 运行时依赖传递说明

common 引入 `jjwt-api` 仅包含接口定义。实际运行时需要：
- `jjwt-impl`：JJWT 核心实现
- `jjwt-jackson`：JSON 序列化（基于 Jackson）

这两个依赖在 **Gateway 和 User Service** 的 pom.xml 中以 `runtime` scope 引入，common 本身不强制绑定具体实现，保持抽象。

---

> 本文档描述公共基础设施层。业务模块详细设计请参见对应服务文档。
