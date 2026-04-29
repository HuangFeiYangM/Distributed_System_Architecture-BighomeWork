<template>
  <div class="wrap">
    <el-card class="top-card">
      <template #header>
        <div class="head">
          <span>{{ roleLabel }}工作台</span>
          <el-button type="danger" plain @click="logout">退出登录</el-button>
        </div>
      </template>
      <el-space wrap>
        <el-button :loading="loading" @click="loadAll">刷新数据</el-button>
        <el-button type="primary" plain @click="goDisplay">取餐大屏</el-button>
        <span>当前角色：{{ roleLabel }}</span>
      </el-space>
    </el-card>

    <el-row v-if="isUser" :gutter="16">
      <el-col :span="12">
        <el-card>
          <template #header>今日菜单</template>
          <el-empty v-if="flatDishes.length === 0" description="当前无可用菜单" />
          <el-table v-else :data="flatDishes" size="small">
            <el-table-column prop="dishName" label="菜品" min-width="120" />
            <el-table-column prop="salePrice" label="价格" width="90">
              <template #default="{ row }">¥{{ row.salePrice }}</template>
            </el-table-column>
            <el-table-column prop="stock" label="库存" width="80" />
            <el-table-column label="数量" width="120">
              <template #default="{ row }">
                <el-input-number v-model="quantityMap[row.id]" :min="0" :max="20" :step="1" size="small" />
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>

      <el-col :span="12">
        <el-card>
          <template #header>下单</template>
          <el-form label-width="90px">
            <el-form-item label="取餐窗口">
              <el-select v-model="selectedWindowId" placeholder="请选择窗口" style="width: 100%">
                <el-option v-for="w in windows" :key="w.id" :label="`${w.name} (${w.location})`" :value="w.id" />
              </el-select>
            </el-form-item>
            <el-form-item label="备注">
              <el-input v-model="remark" placeholder="例如：少辣、不加葱" />
            </el-form-item>
          </el-form>

          <div class="summary">
            <p>已选菜品：{{ selectedCount }} 份</p>
            <p>预估金额：¥{{ totalAmount.toFixed(2) }}</p>
          </div>

          <el-button type="primary" :loading="submitting" @click="submitOrder">提交订单</el-button>
        </el-card>
      </el-col>
    </el-row>

    <el-card v-if="isUser" class="order-card">
      <template #header>我的订单</template>
      <el-table :data="orders" size="small">
        <el-table-column prop="id" label="订单ID" width="90" />
        <el-table-column prop="orderNo" label="订单号" min-width="160" />
        <el-table-column prop="totalAmount" label="金额" width="90">
          <template #default="{ row }">¥{{ row.totalAmount }}</template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="110">
          <template #default="{ row }">{{ statusText(row.status) }}</template>
        </el-table-column>
        <el-table-column prop="pickupCode" label="取餐码" width="110" />
        <el-table-column prop="pickupNo" label="叫号码" width="90" />
        <el-table-column prop="createTime" label="创建时间" min-width="170" />
      </el-table>
    </el-card>

    <template v-else-if="isMerchant">
      <el-row :gutter="16">
        <el-col :span="24" class="block">
          <el-card>
            <template #header>菜品管理（P1）</template>
            <el-form inline>
              <el-form-item label="名称">
                <el-input v-model="dishForm.name" placeholder="例如：宫保鸡丁" />
              </el-form-item>
              <el-form-item label="价格">
                <el-input-number v-model="dishForm.price" :min="0.01" :step="0.5" />
              </el-form-item>
              <el-form-item label="分类">
                <el-input v-model="dishForm.category" placeholder="主食/小吃/饮料" />
              </el-form-item>
              <el-form-item>
                <el-button type="primary" :loading="creatingDish" @click="saveDish">
                  {{ dishForm.id ? "更新菜品" : "新增菜品" }}
                </el-button>
                <el-button v-if="dishForm.id" @click="resetDishForm">取消编辑</el-button>
              </el-form-item>
            </el-form>

            <el-table :data="merchantDishes" size="small">
              <el-table-column prop="id" label="ID" width="70" />
              <el-table-column prop="name" label="菜品" min-width="120" />
              <el-table-column prop="price" label="价格" width="90" />
              <el-table-column prop="category" label="分类" width="90" />
              <el-table-column prop="status" label="状态" width="90">
                <template #default="{ row }">{{ row.status === 1 ? "上架" : "下架" }}</template>
              </el-table-column>
              <el-table-column label="操作" min-width="260">
                <template #default="{ row }">
                  <el-space wrap>
                    <el-button size="small" @click="editDish(row)">编辑</el-button>
                    <el-button size="small" :type="row.status === 1 ? 'warning' : 'success'" @click="toggleDishStatus(row)">
                      {{ row.status === 1 ? "下架" : "上架" }}
                    </el-button>
                    <el-button size="small" type="danger" @click="removeDish(row.id)">删除</el-button>
                  </el-space>
                </template>
              </el-table-column>
            </el-table>
          </el-card>
        </el-col>

        <el-col :span="24" class="block">
          <el-card>
            <template #header>菜单发布（P1）</template>
            <el-form inline>
              <el-form-item label="菜单名称">
                <el-input v-model="menuForm.name" />
              </el-form-item>
              <el-form-item label="日期">
                <el-date-picker v-model="menuForm.saleDate" type="date" value-format="YYYY-MM-DD" />
              </el-form-item>
              <el-form-item label="开始">
                <el-time-picker v-model="menuForm.startTime" value-format="HH:mm:ss" />
              </el-form-item>
              <el-form-item label="结束">
                <el-time-picker v-model="menuForm.endTime" value-format="HH:mm:ss" />
              </el-form-item>
            </el-form>

            <el-table :data="merchantDishes" size="small">
              <el-table-column prop="name" label="菜品" min-width="120" />
              <el-table-column label="售价" width="130">
                <template #default="{ row }">
                  <el-input-number v-model="menuItemMap[row.id].salePrice" :min="0.01" :step="0.5" size="small" />
                </template>
              </el-table-column>
              <el-table-column label="库存" width="120">
                <template #default="{ row }">
                  <el-input-number v-model="menuItemMap[row.id].stock" :min="0" :step="10" size="small" />
                </template>
              </el-table-column>
              <el-table-column label="入选" width="100">
                <template #default="{ row }">
                  <el-switch v-model="menuItemMap[row.id].enabled" />
                </template>
              </el-table-column>
            </el-table>
            <el-button class="publish-btn" type="primary" :loading="publishingMenu" @click="publishMenu">发布菜单</el-button>
          </el-card>
        </el-col>

        <el-col :span="16">
          <el-card>
            <template #header>商家订单处理</template>
            <el-table :data="merchantOrders" size="small">
              <el-table-column prop="id" label="订单ID" width="90" />
              <el-table-column prop="orderNo" label="订单号" min-width="160" />
              <el-table-column prop="windowId" label="窗口ID" width="90" />
              <el-table-column prop="status" label="状态" width="100">
                <template #default="{ row }">{{ statusText(row.status) }}</template>
              </el-table-column>
              <el-table-column prop="pickupCode" label="取餐码" width="110" />
              <el-table-column label="操作" min-width="240">
                <template #default="{ row }">
                  <el-space wrap>
                    <el-button size="small" :disabled="row.status !== 0" @click="changeStatus(row.id, 'accept')">接单</el-button>
                    <el-button size="small" :disabled="row.status !== 1" @click="changeStatus(row.id, 'cook')">制作</el-button>
                    <el-button size="small" type="success" :disabled="row.status !== 2" @click="changeStatus(row.id, 'ready')">
                      完成
                    </el-button>
                  </el-space>
                </template>
              </el-table-column>
            </el-table>
          </el-card>
        </el-col>

        <el-col :span="8">
          <el-card>
            <template #header>叫号与核销</template>
            <el-form label-width="80px">
              <el-form-item label="窗口">
                <el-select v-model="selectedWindowId" placeholder="请选择窗口" style="width: 100%">
                  <el-option v-for="w in windows" :key="w.id" :label="`${w.name} (${w.location})`" :value="w.id" />
                </el-select>
              </el-form-item>
            </el-form>
            <el-space wrap>
              <el-button type="primary" @click="callNext">叫下一个号</el-button>
              <el-button @click="loadQueue">刷新队列</el-button>
            </el-space>

            <el-divider />
            <div>当前队列（{{ queueList.length }}）</div>
            <el-tag v-for="item in queueList" :key="item" class="queue-tag">{{ item }}</el-tag>

            <el-divider />
            <el-input v-model="verifyCode" placeholder="输入取餐码，例如 408765" />
            <el-button class="verify-btn" type="success" @click="verifyPickup">核销取餐</el-button>
          </el-card>
        </el-col>
      </el-row>
    </template>

    <template v-else>
      <el-row :gutter="16">
        <el-col :span="10">
          <el-card>
            <template #header>窗口创建（管理员）</template>
            <el-form label-width="95px">
              <el-form-item label="窗口名称">
                <el-input v-model="windowForm.name" placeholder="例如：1号档口-盖浇饭" />
              </el-form-item>
              <el-form-item label="位置">
                <el-input v-model="windowForm.location" placeholder="例如：食堂一楼东侧" />
              </el-form-item>
              <el-form-item label="商家账号">
                <el-select v-model="windowForm.merchantId" placeholder="请选择商家" style="width: 100%">
                  <el-option
                    v-for="m in merchantUsers"
                    :key="m.id"
                    :label="`${m.nickname} (${m.phone})`"
                    :value="m.id"
                  />
                </el-select>
              </el-form-item>
              <el-form-item label="叫号前缀">
                <el-input v-model="windowForm.pickupPrefix" maxlength="2" placeholder="例如：A" />
              </el-form-item>
              <el-form-item>
                <el-button type="primary" :loading="creatingWindow" @click="createWindow">创建窗口</el-button>
              </el-form-item>
            </el-form>
          </el-card>
        </el-col>
        <el-col :span="14">
          <el-card class="order-card">
            <template #header>窗口列表</template>
            <el-table :data="windows" size="small">
              <el-table-column prop="id" label="ID" width="70" />
              <el-table-column prop="name" label="窗口名称" min-width="120" />
              <el-table-column prop="location" label="位置" min-width="140" />
              <el-table-column prop="merchantId" label="商家ID" width="90" />
              <el-table-column prop="pickupPrefix" label="前缀" width="80" />
              <el-table-column prop="status" label="状态" width="90">
                <template #default="{ row }">{{ row.status === 1 ? "启用" : "停用" }}</template>
              </el-table-column>
            </el-table>
          </el-card>
          <el-card class="order-card">
            <template #header>用户列表（P1）</template>
            <el-table :data="allUsers" size="small">
              <el-table-column prop="id" label="ID" width="70" />
              <el-table-column prop="phone" label="手机号" width="130" />
              <el-table-column prop="nickname" label="昵称" min-width="100" />
              <el-table-column prop="role" label="角色" width="90">
                <template #default="{ row }">{{ roleNameByValue(row.role) }}</template>
              </el-table-column>
              <el-table-column prop="status" label="状态" width="80">
                <template #default="{ row }">{{ row.status === 1 ? "启用" : "停用" }}</template>
              </el-table-column>
            </el-table>
          </el-card>
        </el-col>
      </el-row>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import { useRouter } from "vue-router";
import { getTodayMenusApi, publishMenuApi, type MenuDish } from "../api/menu";
import { getMyOrdersApi, createOrderApi, updateOrderStatusApi, type OrderRecord } from "../api/order";
import {
  getWindowsApi,
  getWindowQueueApi,
  callNextApi,
  verifyPickupApi,
  createWindowApi,
  type PickupWindow
} from "../api/pickup";
import { getUserListApi, type UserRecord } from "../api/user";
import { createDishApi, deleteDishApi, getDishListApi, updateDishApi, updateDishStatusApi, type Dish } from "../api/dish";
import { useAuthStore } from "../stores/auth";

const router = useRouter();
const authStore = useAuthStore();
const loading = ref(false);
const submitting = ref(false);
const windows = ref<PickupWindow[]>([]);
const orders = ref<OrderRecord[]>([]);
const merchantOrders = ref<OrderRecord[]>([]);
const dishes = ref<MenuDish[]>([]);
const merchantUsers = ref<UserRecord[]>([]);
const allUsers = ref<UserRecord[]>([]);
const merchantDishes = ref<Dish[]>([]);
const selectedWindowId = ref<number | null>(null);
const remark = ref("");
const quantityMap = reactive<Record<number, number>>({});
const queueList = ref<string[]>([]);
const verifyCode = ref("");
const creatingWindow = ref(false);
const creatingDish = ref(false);
const publishingMenu = ref(false);
const windowForm = reactive({
  name: "",
  location: "",
  merchantId: undefined as number | undefined,
  pickupPrefix: "A"
});
const dishForm = reactive({
  id: undefined as number | undefined,
  name: "",
  description: "",
  price: 15,
  category: "主食"
});
const menuForm = reactive({
  name: "今日午餐",
  saleDate: "",
  startTime: "",
  endTime: ""
});
const menuItemMap = reactive<Record<number, { enabled: boolean; salePrice: number; stock: number }>>({});

const roleLabel = computed(() => {
  if (authStore.role === 0) return "普通用户";
  if (authStore.role === 1) return "商家";
  if (authStore.role === 2) return "管理员";
  return "未知";
});
const isUser = computed(() => authStore.role === 0);
const isMerchant = computed(() => authStore.role === 1);

const flatDishes = computed(() => dishes.value.filter((d) => d.status === 1));

const selectedItems = computed(() =>
  flatDishes.value
    .map((d) => ({ menuDishId: d.id, quantity: quantityMap[d.id] || 0, price: d.salePrice }))
    .filter((x) => x.quantity > 0)
);

const selectedCount = computed(() => selectedItems.value.reduce((sum, item) => sum + item.quantity, 0));
const totalAmount = computed(() => selectedItems.value.reduce((sum, item) => sum + item.quantity * item.price, 0));
const pickedMenuItems = computed(() =>
  merchantDishes.value
    .filter((d) => menuItemMap[d.id]?.enabled)
    .map((d) => ({
      dishId: d.id,
      salePrice: Number(menuItemMap[d.id]?.salePrice || d.price),
      stock: Number(menuItemMap[d.id]?.stock || 0)
    }))
    .filter((x) => x.stock >= 0)
);

const loadAll = async () => {
  loading.value = true;
  try {
    const [winList, myOrders] = await Promise.all([getWindowsApi(), getMyOrdersApi()]);
    windows.value = winList.filter((w) => w.status === 1);
    if (isUser.value) {
      const menus = await getTodayMenusApi();
      dishes.value = menus.flatMap((m) => m.dishes || []);
      orders.value = myOrders;
    } else if (isMerchant.value) {
      merchantOrders.value = myOrders;
      merchantDishes.value = await getDishListApi();
      merchantDishes.value.forEach((d) => {
        menuItemMap[d.id] = menuItemMap[d.id] || { enabled: false, salePrice: Number(d.price), stock: 50 };
      });
    } else {
      const users = await getUserListApi();
      allUsers.value = users;
      merchantUsers.value = users.filter((u) => u.role === 1 && u.status === 1);
      if (!windowForm.merchantId && merchantUsers.value.length > 0) {
        windowForm.merchantId = merchantUsers.value[0].id;
      }
    }
    if (!selectedWindowId.value && windows.value.length > 0) {
      selectedWindowId.value = windows.value[0].id;
    }
    if (isMerchant.value && selectedWindowId.value) {
      await loadQueue();
    }
  } finally {
    loading.value = false;
  }
};

const submitOrder = async () => {
  if (!selectedWindowId.value) {
    ElMessage.warning("请先选择取餐窗口");
    return;
  }
  if (selectedItems.value.length === 0) {
    ElMessage.warning("请至少选择一个菜品");
    return;
  }
  submitting.value = true;
  try {
    await createOrderApi({
      windowId: selectedWindowId.value,
      remark: remark.value || undefined,
      items: selectedItems.value.map((item) => ({
        menuDishId: item.menuDishId,
        quantity: item.quantity
      }))
    });
    ElMessage.success("下单成功");
    Object.keys(quantityMap).forEach((key) => {
      quantityMap[Number(key)] = 0;
    });
    remark.value = "";
    await loadAll();
  } finally {
    submitting.value = false;
  }
};

const statusText = (status: number) => {
  if (status === 0) return "已下单";
  if (status === 1) return "已接单";
  if (status === 2) return "制作中";
  if (status === 3) return "待取餐";
  if (status === 4) return "已取餐";
  if (status === 5) return "已取消";
  return `未知(${status})`;
};

const changeStatus = async (orderId: number, action: "accept" | "cook" | "ready") => {
  await updateOrderStatusApi(orderId, action);
  ElMessage.success("操作成功");
  await loadAll();
};

const loadQueue = async () => {
  if (!selectedWindowId.value) return;
  queueList.value = await getWindowQueueApi(selectedWindowId.value);
};

const callNext = async () => {
  if (!selectedWindowId.value) {
    ElMessage.warning("请先选择窗口");
    return;
  }
  const pickupNo = await callNextApi(selectedWindowId.value);
  ElMessage.success(`已叫号：${pickupNo}`);
  await loadQueue();
};

const verifyPickup = async () => {
  if (!verifyCode.value.trim()) {
    ElMessage.warning("请输入取餐码");
    return;
  }
  await verifyPickupApi(verifyCode.value.trim());
  ElMessage.success("核销成功");
  verifyCode.value = "";
  await loadAll();
};

const createWindow = async () => {
  if (!windowForm.name.trim()) {
    ElMessage.warning("请输入窗口名称");
    return;
  }
  if (!windowForm.location.trim()) {
    ElMessage.warning("请输入窗口位置");
    return;
  }
  if (!windowForm.merchantId) {
    ElMessage.warning("请选择商家");
    return;
  }
  if (!windowForm.pickupPrefix.trim()) {
    ElMessage.warning("请输入叫号前缀");
    return;
  }

  creatingWindow.value = true;
  try {
    await createWindowApi({
      name: windowForm.name.trim(),
      location: windowForm.location.trim(),
      merchantId: windowForm.merchantId,
      pickupPrefix: windowForm.pickupPrefix.trim().toUpperCase()
    });
    ElMessage.success("窗口创建成功");
    windowForm.name = "";
    windowForm.location = "";
    windowForm.pickupPrefix = "A";
    await loadAll();
  } finally {
    creatingWindow.value = false;
  }
};

const logout = async () => {
  authStore.logout();
  await router.push("/login");
};

const resetDishForm = () => {
  dishForm.id = undefined;
  dishForm.name = "";
  dishForm.description = "";
  dishForm.price = 15;
  dishForm.category = "主食";
};

const saveDish = async () => {
  if (!dishForm.name.trim()) {
    ElMessage.warning("请输入菜品名称");
    return;
  }
  creatingDish.value = true;
  try {
    const payload = {
      name: dishForm.name.trim(),
      description: dishForm.description.trim() || undefined,
      price: Number(dishForm.price),
      category: dishForm.category.trim() || undefined
    };
    if (dishForm.id) {
      await updateDishApi(dishForm.id, payload);
      ElMessage.success("菜品更新成功");
    } else {
      await createDishApi(payload);
      ElMessage.success("菜品创建成功");
    }
    resetDishForm();
    await loadAll();
  } finally {
    creatingDish.value = false;
  }
};

const editDish = (dish: Dish) => {
  dishForm.id = dish.id;
  dishForm.name = dish.name;
  dishForm.description = dish.description || "";
  dishForm.price = Number(dish.price);
  dishForm.category = dish.category || "";
};

const toggleDishStatus = async (dish: Dish) => {
  await updateDishStatusApi(dish.id, dish.status === 1 ? 0 : 1);
  ElMessage.success("状态已更新");
  await loadAll();
};

const removeDish = async (id: number) => {
  await deleteDishApi(id);
  ElMessage.success("菜品已删除");
  await loadAll();
};

const publishMenu = async () => {
  if (!menuForm.name.trim() || !menuForm.saleDate || !menuForm.startTime || !menuForm.endTime) {
    ElMessage.warning("请填写完整菜单信息");
    return;
  }
  if (pickedMenuItems.value.length === 0) {
    ElMessage.warning("请至少选择一个菜品入选菜单");
    return;
  }
  publishingMenu.value = true;
  try {
    await publishMenuApi({
      name: menuForm.name.trim(),
      saleDate: menuForm.saleDate,
      startTime: menuForm.startTime,
      endTime: menuForm.endTime,
      items: pickedMenuItems.value
    });
    ElMessage.success("菜单发布成功");
    await loadAll();
  } finally {
    publishingMenu.value = false;
  }
};

const roleNameByValue = (role: number) => {
  if (role === 2) return "管理员";
  if (role === 1) return "商家";
  return "普通用户";
};

const goDisplay = async () => {
  await router.push("/display");
};

onMounted(() => {
  const now = new Date();
  const hour = String(now.getHours()).padStart(2, "0");
  menuForm.saleDate = now.toISOString().slice(0, 10);
  menuForm.startTime = `${hour}:00:00`;
  menuForm.endTime = `${hour}:59:59`;
  loadAll();
});
</script>

<style scoped>
.wrap {
  padding: 24px;
}

.top-card {
  margin-bottom: 16px;
}

.order-card {
  margin-top: 16px;
}

.block {
  margin-bottom: 16px;
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.summary {
  margin: 6px 0 14px;
  color: #606266;
}

.queue-tag {
  margin-top: 8px;
  margin-right: 8px;
}

.verify-btn {
  margin-top: 10px;
}

.publish-btn {
  margin-top: 10px;
}
</style>
