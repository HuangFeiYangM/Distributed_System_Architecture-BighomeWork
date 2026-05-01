<template>
  <div class="wrap">
    <el-card>
      <template #header>
        <div class="head">
          <span>个人中心</span>
          <el-space>
            <el-button @click="goHome">返回工作台</el-button>
            <el-button type="primary" plain :loading="refreshing" @click="refreshToken">刷新 Token</el-button>
          </el-space>
        </div>
      </template>

      <el-descriptions v-if="profile" :column="2" border>
        <el-descriptions-item label="用户ID">{{ profile.id }}</el-descriptions-item>
        <el-descriptions-item label="手机号">{{ profile.phone }}</el-descriptions-item>
        <el-descriptions-item label="学号">{{ profile.studentNo }}</el-descriptions-item>
        <el-descriptions-item label="角色">{{ roleLabel(profile.role) }}</el-descriptions-item>
        <el-descriptions-item label="状态">{{ profile.status === 1 ? "启用" : "停用" }}</el-descriptions-item>
      </el-descriptions>

      <el-divider />
      <el-form label-width="90px">
        <el-form-item label="昵称">
          <el-input v-model="form.nickname" placeholder="请输入昵称" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="saving" @click="save">保存资料</el-button>
        </el-form-item>
      </el-form>

      <el-divider content-position="left">修改密码</el-divider>
      <el-form label-width="90px">
        <el-form-item label="当前密码">
          <el-input v-model="pwdForm.oldPassword" type="password" show-password placeholder="请输入当前密码" />
        </el-form-item>
        <el-form-item label="新密码">
          <el-input
            v-model="pwdForm.newPassword"
            type="password"
            show-password
            placeholder="6～20 位，与注册一致"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" plain :loading="pwdSaving" @click="savePassword">确认修改密码</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import {
  changePasswordApi,
  meApi,
  refreshTokenApi,
  updateMeApi,
  type UserProfile
} from "../api/user";
import { useAuthStore } from "../stores/auth";

const router = useRouter();
const authStore = useAuthStore();

const profile = ref<UserProfile | null>(null);
const saving = ref(false);
const refreshing = ref(false);
const form = reactive({
  nickname: ""
});

const pwdForm = reactive({
  oldPassword: "",
  newPassword: ""
});
const pwdSaving = ref(false);

const roleLabel = (role: number) => {
  if (role === 2) return "管理员";
  if (role === 1) return "商家";
  return "普通用户";
};

const loadProfile = async () => {
  const data = await meApi();
  profile.value = data;
  form.nickname = data.nickname || "";
};

const save = async () => {
  saving.value = true;
  try {
    await updateMeApi({
      nickname: form.nickname.trim() || undefined
    });
    ElMessage.success("资料已更新");
    await loadProfile();
  } finally {
    saving.value = false;
  }
};

const savePassword = async () => {
  if (!pwdForm.oldPassword.trim()) {
    ElMessage.warning("请输入当前密码");
    return;
  }
  const np = pwdForm.newPassword.trim();
  if (np.length < 6 || np.length > 20) {
    ElMessage.warning("新密码长度需为 6～20 位");
    return;
  }
  pwdSaving.value = true;
  try {
    await changePasswordApi({
      oldPassword: pwdForm.oldPassword,
      newPassword: np
    });
    ElMessage.success("密码已更新");
    pwdForm.oldPassword = "";
    pwdForm.newPassword = "";
  } finally {
    pwdSaving.value = false;
  }
};

const refreshToken = async () => {
  refreshing.value = true;
  try {
    const token = await refreshTokenApi();
    if (token) {
      authStore.setToken(token);
      ElMessage.success("Token 刷新成功");
    } else {
      ElMessage.warning("未获取到新 Token");
    }
  } finally {
    refreshing.value = false;
  }
};

const goHome = async () => {
  await router.push("/");
};

onMounted(() => {
  loadProfile();
});
</script>

<style scoped>
.wrap {
  padding: 26px 20px;
  max-width: 1080px;
  margin: 0 auto;
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.head span {
  font-size: 22px;
  font-weight: 700;
  color: #1d3b8b;
}

:deep(.el-descriptions) {
  border-radius: 12px;
  overflow: hidden;
}

:deep(.el-descriptions__label) {
  color: #475569;
  width: 120px;
}

:deep(.el-form) {
  max-width: 620px;
}

@media (max-width: 768px) {
  .wrap {
    padding: 16px 12px 20px;
  }

  .head {
    flex-wrap: wrap;
  }
}
</style>
