# canteen-user-service 模块设计文档

> 智能食堂系统 —— 用户域微服务（身份认证中心）

---

## 1. 模块概述

### 1.1 定位与职责

`canteen-user-service` 是系统的**身份认证中心**，负责所有与用户身份相关的操作。它是其他业务服务安全访问的基石：只有经过本服务颁发的 JWT Token，才能通过 Gateway 校验并访问后续接口。

核心职责：
- 用户注册（学工号 / 手机号）
- 用户登录（密码校验 → JWT 颁发）
- Token 刷新（Access Token 过期后换取新 Token）
- 用户信息查询与修改

### 1.2 边界上下文

```
┌─────────────────────────────────────────────┐
│           用户域 (User Domain)              │
├─────────────────────────────────────────────┤
│  核心概念：用户 (User)、角色 (Role)、Token    │
│  聚合根：sys_user 表                         │
│  对外暴露：REST API（通过 Gateway 路由）      │
│  不依赖其他业务服务（纯基础域）               │
└─────────────────────────────────────────────┘
```

---

## 2. 功能清单

### 2.1 功能列表

| 编号 | 功能 | 接口路径 | 说明 |
|------|------|---------|------|
| U-001 | 用户注册 | `POST /user/register` | 学工号/手机号 + 密码 |
| U-002 | 用户登录 | `POST /user/login` | 密码校验 → 颁发 JWT |
| U-003 | Token 刷新 | `POST /user/refresh` | 用旧 Token 换新 Token |
| U-004 | 查询当前用户 | `GET /user/me` | 根据 Token 解析 userId 查询 |
| U-005 | 修改用户信息 | `PUT /user/me` | 修改昵称、头像等 |
| U-006 | 查询用户列表 | `GET /user/list` | 管理员功能（分页） |

### 2.2 非功能需求

| 类型 | 需求 | 实现 |
|------|------|------|
| 安全 | 密码不明文存储 | BCrypt 加密（强度 10） |
| 安全 | Token 被盗可快速失效 | 短期 Token（24h）+ Refresh 机制 |
| 性能 | 登录接口 < 200ms | 数据库 phone 字段索引 + Redis 缓存热点 |

---

## 3. 外部交互关系

### 3.1 上游依赖（User Service 依赖谁）

```
┌─────────────────────────────────────────────┐
│        canteen-user-service :8081            │
├─────────────────────────────────────────────┤
│ 依赖方              │ 用途                    │
├─────────────────────┼───────────────────────┤
│ MySQL :3320/canteen │ 用户数据持久化          │
│ Redis :6379         │ Token 黑名单 / 用户缓存   │
│ Nacos :8848         │ 服务注册                │
│ canteen-common      │ JwtUtil, Result, BaseEntity│
└─────────────────────────────────────────────┘
```

### 3.2 下游消费（谁调用 User Service）

| 调用方 | 调用方式 | 场景 |
|--------|---------|------|
| Gateway | HTTP 路由转发 | 所有用户相关请求经过 Gateway 路由到本服务 |
| 其他服务（间接） | 不直接调用 | 其他服务通过 Gateway 透传的 `X-User-Id` 识别用户，不直接调用 User Service |

> **设计决策**：为了降低服务间耦合，其他业务服务不直接调用 User Service 查询用户信息，而是信任 Gateway 注入的 `X-User-Id` Header。如需用户信息，由前端携带 Token 访问 `/user/me`。

### 3.3 交互时序 —— 登录流程

```text
客户端          Gateway            UserService          MySQL           Redis
  │              │                    │                  │               │
  │  POST /api/user/login           │                  │               │
  │─────────────>│                  │                  │               │
  │              │  白名单，跳过JWT   │                  │               │
  │              │  转发到UserService │                  │               │
  │              │─────────────────>│                  │               │
  │              │                  │  1. 参数校验      │               │
  │              │                  │  2. 根据phone查询用户│               │
  │              │                  │─────────────────>│               │
  │              │                  │<─────────────────│               │
  │              │                  │  3. BCrypt比对密码 │               │
  │              │                  │  4. 密码错误→抛异常 │               │
  │              │                  │  5. 密码正确→生成JWT│               │
  │              │                  │  → JwtUtil.generateToken(...)      │
  │              │                  │                  │               │
  │              │                  │  6. 可选：缓存用户信息到Redis        │
  │              │                  │───────────────────────────────────>│
  │              │                  │                  │               │
  │              │<─────────────────│  返回Result.success(token)         │
  │<─────────────│  透传响应         │                  │               │
  │              │                  │                  │               │
```

---

## 4. 代码文件结构

```text
canteen-user-service/
├── pom.xml
└── src/
    ├── main/
    │   ├── java/
    │   │   └── com/
    │   │       └── canteen/
    │   │           └── user/
    │   │               ├── UserServiceApplication.java
    │   │               │       ↑ @SpringBootApplication + @EnableDiscoveryClient
    │   │               ├── controller/
    │   │               │   └── UserController.java
    │   │               │       ↑ 6个API端点，参数校验，调用Service
    │   │               ├── service/
    │   │               │   └── UserService.java
    │   │               │       ↑ 业务逻辑：注册/登录/刷新/查询
    │   │               ├── mapper/
    │   │               │   └── UserMapper.java
    │   │               │       ↑ MyBatis-Plus BaseMapper
    │   │               └── entity/
    │   │                   └── User.java
    │   │                       ↑ 继承BaseEntity，对应sys_user表
    │   └── resources/
    │       ├── application.yml
    │       │       ↑ 端口8081、数据库连接、Nacos、Redis、MyBatis-Plus
    │       └── mapper/
    │           └── UserMapper.xml
    │               ↑ 复杂查询（如分页、多条件）
    └── test/
        └── java/
            └── com/
                └── canteen/
                    └── user/
                        ├── service/
                        │   └── UserServiceTest.java
                        └── controller/
                            └── UserControllerTest.java
```

---

## 5. 核心逻辑描述

### 5.1 数据库表结构

**表名**：`sys_user`

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | BIGINT UNSIGNED | PK, AUTO_INCREMENT | 用户ID |
| `student_no` | VARCHAR(32) | UNIQUE | 学工号 |
| `phone` | VARCHAR(20) | UNIQUE, INDEX | 手机号（登录账号） |
| `password` | VARCHAR(128) | NOT NULL | BCrypt 加密后的密码 |
| `nickname` | VARCHAR(64) | | 昵称 |
| `avatar` | VARCHAR(255) | | 头像URL |
| `role` | TINYINT | DEFAULT 0 | 0-普通用户，1-商家，2-管理员 |
| `status` | TINYINT | DEFAULT 1 | 0-禁用，1-正常 |
| `create_time` | DATETIME | DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| `update_time` | DATETIME | ON UPDATE CURRENT_TIMESTAMP | 更新时间 |
| `deleted` | TINYINT | DEFAULT 0 | 逻辑删除 |

**索引设计**：
- `phone`：登录查询主入口，必须索引
- `student_no`：学工号注册唯一性校验

### 5.2 领域模型

```java
@Entity
public class User extends BaseEntity {
    private String studentNo;   // 学工号
    private String phone;       // 手机号（登录凭证）
    private String password;    // BCrypt 密文
    private String nickname;
    private String avatar;
    private Integer role;       // 0=USER, 1=MERCHANT, 2=ADMIN
    private Integer status;     // 0=DISABLED, 1=ENABLED
}
```

### 5.3 注册逻辑

1. **参数校验**：phone 格式（正则）、password 长度（6~20位）
2. **唯一性校验**：查询 `phone` 或 `student_no` 是否已存在
3. **密码加密**：`BCryptPasswordEncoder.encode(rawPassword)`
4. **持久化**：插入 `sys_user` 表
5. **返回**：`Result.success()`（不返回密码）

### 5.4 登录逻辑

1. **参数校验**：phone、password 非空
2. **查询用户**：`SELECT * FROM sys_user WHERE phone = ? AND deleted = 0`
3. **用户存在性**：不存在 → `USER_NOT_FOUND`
4. **状态检查**：`status = 0` → `FORBIDDEN`（账号禁用）
5. **密码比对**：`BCryptPasswordEncoder.matches(raw, encoded)`
6. **密码错误**：`PASSWORD_ERROR`
7. **生成 Token**：`JwtUtil.generateToken(secret, expiration, userId, username, role)`
8. **返回**：`Result.success(Map.of("accessToken", token, "expiresIn", 86400))`

### 5.5 Token 刷新机制

**问题**：Access Token 有效期 24 小时，如果用户正在操作期间过期，会被踢出。

**方案**：
- 每次请求携带 Access Token
- 当 Access Token 即将过期（如剩余 < 1 小时），客户端调用 `/user/refresh`
- 服务端校验旧 Token 签名有效（即使已过期，也允许刷新）
- 颁发新的 Access Token，延长 24 小时

**伪代码**：
```text
function 刷新Token(oldToken):
    // 只校验签名，不校验过期时间
    claims = JwtUtil.parseToken(secret, oldToken)   // 可能抛 ExpiredJwtException

    // 即使过期，只要签名正确且时间在合理范围内（如7天内），允许刷新
    if Token过期超过7天:
        throw BusinessException(TOKEN_EXPIRED)

    userId = claims.get("userId")
    username = claims.get("username")
    role = claims.get("role")

    // 重新生成
    newToken = JwtUtil.generateToken(secret, expiration, userId, username, role)
    return newToken
```

### 5.6 密码安全策略

- **加密算法**：BCrypt（自适应哈希，强度因子 10）
- **盐值**：BCrypt 自动生成随机盐，无需额外存储
- **传输安全**：依赖 HTTPS（生产环境）或内网信任（开发环境）
- **防暴力破解**：Gateway 用户级限流（30次/分钟）间接保护

---

## 6. 伪代码

### 6.1 用户注册

```text
function 注册(registerDTO):
    // 1. 参数校验
    if registerDTO.phone 不符合手机号正则:
        return Result.error(PARAM_ERROR)
    if registerDTO.password 长度 < 6:
        return Result.error(PARAM_ERROR)

    // 2. 唯一性校验
    existingUser = userMapper.selectByPhone(registerDTO.phone)
    if existingUser != null:
        return Result.error(USER_EXISTS)

    if registerDTO.studentNo 不为空:
        existing = userMapper.selectByStudentNo(registerDTO.studentNo)
        if existing != null:
            return Result.error(USER_EXISTS)

    // 3. 密码加密
    encodedPassword = BCrypt.encode(registerDTO.password)

    // 4. 构造实体
    user = new User()
    user.phone = registerDTO.phone
    user.studentNo = registerDTO.studentNo
    user.password = encodedPassword
    user.nickname = registerDTO.nickname
    user.role = 0          // 默认普通用户
    user.status = 1        // 默认启用

    // 5. 持久化
    userMapper.insert(user)

    // 6. 返回（不暴露密码）
    return Result.success("注册成功")
```

### 6.2 用户登录

```text
function 登录(loginDTO):
    // 1. 参数校验
    if loginDTO.phone为空 或 loginDTO.password为空:
        return Result.error(PARAM_ERROR)

    // 2. 查询用户
    user = userMapper.selectByPhone(loginDTO.phone)
    if user == null:
        return Result.error(USER_NOT_FOUND)

    // 3. 状态检查
    if user.status == 0:
        return Result.error(FORBIDDEN)

    // 4. 密码比对
    if not BCrypt.matches(loginDTO.password, user.password):
        return Result.error(PASSWORD_ERROR)

    // 5. 生成 JWT
    token = JwtUtil.generateToken(
        secret = jwt.secret,
        expiration = jwt.expiration,
        userId = user.id,
        username = user.nickname ?? user.phone,
        role = user.role.toString()
    )

    // 6. 组装响应
    response = new Map()
    response["accessToken"] = token
    response["tokenType"] = "Bearer"
    response["expiresIn"] = jwt.expiration / 1000   // 秒
    response["userId"] = user.id
    response["role"] = user.role

    return Result.success(response)
```

### 6.3 查询当前用户

```text
function 查询当前用户(request):
    // Gateway 已注入 X-User-Id
    userId = request.getHeader("X-User-Id")
    if userId == null:
        return Result.error(UNAUTHORIZED)

    // 1. 先查 Redis 缓存
    cacheKey = "user:" + userId
    cachedUser = Redis.get(cacheKey)
    if cachedUser != null:
        return Result.success(cachedUser)

    // 2. 缓存未命中，查数据库
    user = userMapper.selectById(userId)
    if user == null 或 user.deleted == 1:
        return Result.error(USER_NOT_FOUND)

    // 3. 脱敏（去掉 password）
    user.password = null

    // 4. 写入缓存（TTL 10分钟）
    Redis.setex(cacheKey, 600, user)

    return Result.success(user)
```

---

## 7. 接口契约

### 7.1 API 列表

| 方法 | 路径 | 鉴权 | 请求体 | 响应 |
|------|------|------|--------|------|
| POST | `/user/register` | 否 | `RegisterDTO` | `Result<String>` |
| POST | `/user/login` | 否 | `LoginDTO` | `Result<TokenVO>` |
| POST | `/user/refresh` | 否（需旧Token） | `RefreshDTO` | `Result<TokenVO>` |
| GET | `/user/me` | 是 | — | `Result<UserVO>` |
| PUT | `/user/me` | 是 | `UserUpdateDTO` | `Result<String>` |
| PUT | `/user/me/password` | 是 | `ChangePasswordDTO` | `Result<Void>` |
| POST | `/user/{id}/reset-password` | 是（ADMIN） | `AdminResetPasswordDTO` | `Result<Void>` |
| GET | `/user/list` | 是（ADMIN） | `PageParam` | `Result<Page<UserVO>>` |

### 7.2 DTO 定义

**RegisterDTO**：
```json
{
  "phone": "13800138000",
  "studentNo": "2024001001",    // 可选
  "password": "123456",
  "nickname": "张三"
}
```

**LoginDTO**：
```json
{
  "phone": "13800138000",
  "password": "123456"
}
```

**ChangePasswordDTO**：
```json
{
  "oldPassword": "原密码",
  "newPassword": "新密码6~20位"
}
```

**AdminResetPasswordDTO**：
```json
{
  "password": "为该用户设置的密码6~20位"
}
```

**TokenVO**：
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "tokenType": "Bearer",
  "expiresIn": 86400,
  "userId": 10001,
  "role": 0
}
```

**UserVO**（脱敏）：
```json
{
  "id": 10001,
  "phone": "138****8000",
  "studentNo": "2024001001",
  "nickname": "张三",
  "avatar": "https://...",
  "role": 0,
  "createTime": "2026-04-27T10:00:00"
}
```

---

## 8. 配置说明

### 8.1 application.yml

```yaml
server:
  port: 8081

spring:
  application:
    name: canteen-user-service
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

jwt:
  secret: canteen-secret-key-2026-smart-canteen-jwt
  expiration: 86400000
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
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-validation</artifactId>
    </dependency>
    <dependency>
        <groupId>org.springframework.security</groupId>
        <artifactId>spring-security-crypto</artifactId>
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
        <groupId>io.jsonwebtoken</groupId>
        <artifactId>jjwt-impl</artifactId>
        <scope>runtime</scope>
    </dependency>
    <dependency>
        <groupId>io.jsonwebtoken</groupId>
        <artifactId>jjwt-jackson</artifactId>
        <scope>runtime</scope>
    </dependency>
    <dependency>
        <groupId>com.canteen</groupId>
        <artifactId>canteen-common</artifactId>
    </dependency>
</dependencies>
```

---

> 本文档描述用户域微服务。其他模块详细设计请参见对应文档。
