<template>
  <div class="page">
    <el-card class="login-card">
      <template #header>智能食堂系统登录</template>
      <el-form :model="form" label-width="70px">
        <el-form-item label="手机号">
          <el-input v-model="form.phone" placeholder="请输入手机号" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="form.password" type="password" show-password placeholder="请输入密码" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="loading" @click="onLogin">登录</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import { loginApi } from "../api/user";
import { useAuthStore } from "../stores/auth";

const router = useRouter();
const authStore = useAuthStore();
const loading = ref(false);
const form = reactive({
  phone: "",
  password: ""
});

const onLogin = async () => {
  if (!form.phone || !form.password) {
    ElMessage.warning("请输入手机号和密码");
    return;
  }
  loading.value = true;
  try {
    const data = await loginApi(form);
    authStore.setLogin(data);
    ElMessage.success("登录成功");
    await router.push("/");
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}

.login-card {
  width: 420px;
}
</style>
