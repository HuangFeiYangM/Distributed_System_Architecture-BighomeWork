<template>
  <div class="page-wrap">
    <el-card>
      <template #header>
        <div class="header-row">
          <span>管理员全局库存管理</span>
          <el-space>
            <el-button @click="goHome">返回首页</el-button>
            <el-button type="primary" :loading="loading" @click="loadData">刷新</el-button>
          </el-space>
        </div>
      </template>

      <el-space wrap class="query-row">
        <el-input-number v-model="query.merchantId" :min="1" :step="1" placeholder="商家ID" />
        <el-input v-model="query.keyword" placeholder="菜品/菜单关键字" class="query-item" clearable />
        <el-input-number v-model="query.menuId" :min="1" :step="1" placeholder="菜单ID" />
        <el-input-number v-model="query.dishId" :min="1" :step="1" placeholder="菜品ID" />
        <el-select v-model="query.status" clearable placeholder="状态" class="query-item">
          <el-option :value="1" label="可售" />
          <el-option :value="0" label="停售" />
        </el-select>
        <el-date-picker v-model="query.saleDate" type="date" value-format="YYYY-MM-DD" placeholder="售卖日期" />
        <el-switch v-model="query.lowStockOnly" active-text="仅低库存" />
        <el-button type="primary" @click="onSearch">查询</el-button>
      </el-space>

      <el-table :data="records" v-loading="loading" size="small">
        <el-table-column prop="menuDishId" label="菜单菜品ID" width="120" />
        <el-table-column prop="merchantId" label="商家ID" width="90" />
        <el-table-column prop="merchantName" label="商家" width="130" />
        <el-table-column prop="menuName" label="菜单" min-width="140" />
        <el-table-column prop="dishName" label="菜品" min-width="130" />
        <el-table-column prop="saleDate" label="日期" width="120" />
        <el-table-column prop="stock" label="库存" width="90" />
        <el-table-column prop="sold" label="已售" width="90" />
        <el-table-column prop="stockThreshold" label="阈值" width="90" />
        <el-table-column label="操作" min-width="250">
          <template #default="{ row }">
            <el-space wrap>
              <el-button size="small" @click="openOp(row, 'INCR')">增库存</el-button>
              <el-button size="small" @click="openOp(row, 'DECR')">减库存</el-button>
              <el-button size="small" type="warning" @click="openOp(row, 'SET')">设库存</el-button>
            </el-space>
          </template>
        </el-table-column>
      </el-table>

      <div class="pager">
        <el-pagination
          background
          layout="total, sizes, prev, pager, next"
          :total="total"
          :current-page="query.page"
          :page-size="query.size"
          :page-sizes="[10, 20, 50]"
          @current-change="onPageChange"
          @size-change="onSizeChange"
        />
      </div>
    </el-card>

    <el-dialog v-model="opVisible" title="库存操作" width="420px">
      <el-form label-width="90px">
        <el-form-item label="操作类型">
          <el-tag>{{ opForm.op }}</el-tag>
        </el-form-item>
        <el-form-item label="数值">
          <el-input-number v-model="opForm.value" :min="0" :step="1" />
        </el-form-item>
        <el-form-item label="原因">
          <el-input v-model="opForm.reason" placeholder="可选，记录变更原因" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="opVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitOp">确认</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import { useRouter } from "vue-router";
import { getAdminStockApi, updateStockApi, type StockRecord, type StockUpdatePayload } from "../api/menu";
import { useAuthStore } from "../stores/auth";

const router = useRouter();
const authStore = useAuthStore();
const loading = ref(false);
const saving = ref(false);
const records = ref<StockRecord[]>([]);
const total = ref(0);
const opVisible = ref(false);
const activeMenuDishId = ref<number | null>(null);

const query = reactive({
  page: 1,
  size: 10,
  merchantId: undefined as number | undefined,
  keyword: "",
  status: undefined as number | undefined,
  menuId: undefined as number | undefined,
  dishId: undefined as number | undefined,
  saleDate: "",
  lowStockOnly: false
});

const opForm = reactive<StockUpdatePayload>({
  op: "INCR",
  value: 0,
  reason: ""
});

const goHome = async () => {
  await router.push("/");
};

const loadData = async () => {
  loading.value = true;
  try {
    const pageData = await getAdminStockApi(query);
    records.value = pageData.records || [];
    total.value = pageData.total || 0;
  } finally {
    loading.value = false;
  }
};

const onSearch = async () => {
  query.page = 1;
  await loadData();
};

const onPageChange = async (page: number) => {
  query.page = page;
  await loadData();
};

const onSizeChange = async (size: number) => {
  query.size = size;
  query.page = 1;
  await loadData();
};

const openOp = (row: StockRecord, op: StockUpdatePayload["op"]) => {
  activeMenuDishId.value = row.menuDishId;
  opForm.op = op;
  opForm.value = op === "SET" ? row.stock : 1;
  opForm.reason = "";
  opVisible.value = true;
};

const submitOp = async () => {
  if (!activeMenuDishId.value) return;
  if ((opForm.op === "INCR" || opForm.op === "DECR") && opForm.value <= 0) {
    ElMessage.warning("增减库存时 value 必须大于 0");
    return;
  }
  saving.value = true;
  try {
    await updateStockApi(activeMenuDishId.value, opForm);
    ElMessage.success("库存更新成功");
    opVisible.value = false;
    await loadData();
  } finally {
    saving.value = false;
  }
};

onMounted(async () => {
  if (authStore.role !== 2) {
    ElMessage.error("仅管理员可访问该页面");
    await router.push("/");
    return;
  }
  await loadData();
});
</script>

<style scoped>
.page-wrap {
  max-width: 1400px;
  margin: 0 auto;
  padding: 20px;
}
.header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.query-row {
  margin-bottom: 12px;
}
.query-item {
  width: 220px;
}
.pager {
  margin-top: 12px;
  display: flex;
  justify-content: flex-end;
}
</style>
