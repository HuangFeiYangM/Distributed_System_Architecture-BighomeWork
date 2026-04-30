<template>
  <div class="page">
    <div class="bg-glow" />
    <el-card class="register-card">
      <template #header>
        <div class="title-wrap">
          <div class="title">用户注册</div>
          <div class="subtitle">创建账号后可返回登录</div>
        </div>
      </template>
      <el-form :model="form" label-width="80px">
        <el-form-item label="手机号">
          <el-input v-model="form.phone" placeholder="请输入手机号" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="form.password" type="password" show-password placeholder="请输入密码" />
        </el-form-item>
        <el-form-item label="昵称">
          <el-input v-model="form.nickname" placeholder="请输入昵称" />
        </el-form-item>
        <el-form-item label="学号">
          <el-input v-model="form.studentNo" placeholder="请输入学号/工号" />
        </el-form-item>
        <el-form-item>
          <el-space>
            <el-button type="primary" :loading="loading" @click="onRegister">注册</el-button>
            <el-button @click="goLogin">返回登录</el-button>
          </el-space>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import { registerApi } from "../api/user";

const router = useRouter();
const loading = ref(false);
const form = reactive({
  phone: "",
  password: "",
  nickname: "",
  studentNo: ""
});

const onRegister = async () => {
  if (!form.phone || !form.password || !form.nickname || !form.studentNo) {
    ElMessage.warning("请填写完整注册信息");
    return;
  }
  loading.value = true;
  try {
    await registerApi(form);
    ElMessage.success("注册成功，请登录");
    await router.push("/login");
  } finally {
    loading.value = false;
  }
};

const goLogin = async () => {
  await router.push("/login");
};
</script>

<style scoped>
.page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  padding: 20px;
}

.bg-glow {
  position: absolute;
  width: 580px;
  height: 580px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(76, 132, 255, 0.26) 0%, rgba(76, 132, 255, 0) 70%);
  bottom: -120px;
  left: -120px;
}

.bg-glow::after {
  content: "";
  position: absolute;
  width: 280px;
  height: 280px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(129, 140, 248, 0.24) 0%, rgba(129, 140, 248, 0) 70%);
  right: -520px;
  top: -280px;
}

.register-card {
  width: 500px;
  z-index: 1;
}

.title-wrap {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.title {
  font-size: 22px;
  font-weight: 700;
  color: #1e3a8a;
}

.subtitle {
  font-size: 13px;
  color: #64748b;
}

:deep(.el-form-item:last-child) {
  margin-bottom: 0;
}
</style>
