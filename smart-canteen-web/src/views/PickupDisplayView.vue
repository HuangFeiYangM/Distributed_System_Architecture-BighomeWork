<template>
  <div class="wrap">
    <el-card>
      <template #header>
        <div class="head">
          <span>取餐大屏（P2）</span>
          <el-button @click="goHome">返回工作台</el-button>
        </div>
      </template>

      <el-space wrap>
        <el-select v-model="windowId" placeholder="选择窗口" style="width: 320px">
          <el-option v-for="w in windows" :key="w.id" :label="`${w.name} (${w.location})`" :value="w.id" />
        </el-select>
        <el-button :disabled="!windowId" @click="loadDisplay">刷新</el-button>
      </el-space>

      <el-divider />

      <el-descriptions v-if="display" :column="2" border>
        <el-descriptions-item label="当前窗口">{{ display.windowId }}</el-descriptions-item>
        <el-descriptions-item label="当前叫号">{{ display.currentPickupNo || "-" }}</el-descriptions-item>
        <el-descriptions-item label="当前订单">{{ display.currentOrderId || "-" }}</el-descriptions-item>
        <el-descriptions-item label="等待数量">{{ display.waitingCount }}</el-descriptions-item>
      </el-descriptions>

      <el-divider />
      <div class="section-title">等待订单</div>
      <el-tag v-for="id in display?.waitingOrderIds || []" :key="id" class="tag">{{ id }}</el-tag>

      <el-divider />
      <div class="section-title">最近叫号</div>
      <el-tag v-for="item in display?.recentCalls || []" :key="item" class="tag" type="success">{{ item }}</el-tag>

      <el-divider />
      <div class="section-title">实时消息（WebSocket）</div>
      <el-alert :title="wsStatus" :type="wsConnected ? 'success' : 'warning'" show-icon :closable="false" />
      <el-table :data="wsMessages" size="small" style="margin-top: 10px">
        <el-table-column prop="time" label="时间" width="120" />
        <el-table-column prop="type" label="类型" width="100" />
        <el-table-column prop="payload" label="消息内容" />
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import { getDisplayApi, getWindowsApi, type PickupDisplay, type PickupWindow } from "../api/pickup";

const router = useRouter();
const windows = ref<PickupWindow[]>([]);
const windowId = ref<number | null>(null);
const display = ref<PickupDisplay | null>(null);
const ws = ref<WebSocket | null>(null);
const wsConnected = ref(false);
const wsMessages = ref<Array<{ time: string; type: string; payload: string }>>([]);

const wsStatus = computed(() => (wsConnected.value ? "WebSocket 已连接" : "WebSocket 未连接"));

const nowTime = () => new Date().toLocaleTimeString("zh-CN", { hour12: false });

const addMessage = (type: string, payload: unknown) => {
  wsMessages.value.unshift({
    time: nowTime(),
    type,
    payload: typeof payload === "string" ? payload : JSON.stringify(payload)
  });
  wsMessages.value = wsMessages.value.slice(0, 20);
};

const connectWs = () => {
  if (ws.value) {
    ws.value.close();
  }
  const protocol = location.protocol === "https:" ? "wss" : "ws";
  ws.value = new WebSocket(`${protocol}://${location.host}/ws/pickup`);
  ws.value.onopen = () => {
    wsConnected.value = true;
    addMessage("OPEN", "连接已建立");
  };
  ws.value.onmessage = (event) => {
    try {
      addMessage("MSG", JSON.parse(event.data));
    } catch {
      addMessage("MSG", event.data);
    }
    if (windowId.value) {
      loadDisplay();
    }
  };
  ws.value.onclose = () => {
    wsConnected.value = false;
    addMessage("CLOSE", "连接已关闭");
  };
  ws.value.onerror = () => {
    wsConnected.value = false;
    addMessage("ERROR", "连接异常");
  };
};

const loadDisplay = async () => {
  if (!windowId.value) return;
  display.value = await getDisplayApi(windowId.value);
};

const goHome = async () => {
  await router.push("/");
};

onMounted(async () => {
  windows.value = await getWindowsApi();
  if (windows.value.length > 0) {
    windowId.value = windows.value[0].id;
    await loadDisplay();
  } else {
    ElMessage.warning("暂无窗口，请先由管理员创建窗口");
  }
  connectWs();
});

watch(windowId, async () => {
  await loadDisplay();
});

onUnmounted(() => {
  if (ws.value) ws.value.close();
});
</script>

<style scoped>
.wrap {
  padding: 26px 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}

.head span {
  font-size: 22px;
  font-weight: 700;
  color: #1d3b8b;
}

.section-title {
  margin-bottom: 10px;
  font-weight: 600;
  color: #334155;
}

.tag {
  margin-right: 8px;
  margin-bottom: 8px;
}

:deep(.el-alert) {
  border-radius: 12px;
}

:deep(.el-table) {
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid #e8eef9;
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
