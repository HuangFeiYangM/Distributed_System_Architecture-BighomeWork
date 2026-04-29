测试账号（本地联调）

- 管理员
  - phone: `13800000000`
  - password: `admin123`
- 商家
  - phone: `13800000001`
  - password: `merchant123`
- 学生（普通用户）
  - phone: `13800000002`
  - password: `user123`
- 普通测试账号（可选）
  - phone: `13800138000`
  - password: `123456`

说明：
- 管理员与商家账号如刚注册，需在数据库 `sys_user` 设置角色后重新登录：
  - 商家：`role = 1`
  - 管理员：`role = 2`