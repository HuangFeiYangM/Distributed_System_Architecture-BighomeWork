测试账号（本地联调）

- 管理员
  - phone: `13800000000`
  - password: `123456`
- 商家
  - phone: `13800000001`
  - password: `123456`
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
- 当前联调环境中，商家密码已通过重置接口更新为 `123456`。
- 管理员重置密码：`POST /api/user/{id}/reset-password`，Body `{ "password": "新密码" }`（6～20 位）。
- 用户自助改密：`PUT /api/user/me/password`，Body `{ "oldPassword": "...", "newPassword": "..." }`（新密码 6～20 位）；原密码错误返回业务码 `1004`。
