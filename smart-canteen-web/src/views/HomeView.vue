<template>
  <div class="wrap">
    <el-card>
      <template #header>
        <div class="head">
          <span>智能食堂前端工作台</span>
          <el-button type="danger" plain @click="logout">退出登录</el-button>
        </div>
      </template>
      <p>已完成基础骨架，下一步可按角色拆分页面：</p>
      <ul>
        <li>学生端：今日菜单、下单、我的订单</li>
        <li>商家端：菜品管理、订单处理、叫号核销</li>
        <li>管理员端：窗口管理、用户管理</li>
      </ul>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";

const router = useRouter();
const authStore = useAuthStore();

const logout = async () => {
  authStore.logout();
  await router.push("/login");
};
</script>

<style scoped>
.wrap {
  padding: 24px;
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
</style>
