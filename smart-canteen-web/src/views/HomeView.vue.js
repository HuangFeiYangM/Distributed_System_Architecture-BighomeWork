import { computed, onMounted, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import { useRouter } from "vue-router";
import { getMenuDetailApi, getMenuDishDetailApi, getTodayMenusApi, publishMenuApi } from "../api/menu";
import { cancelOrderApi, getMyOrdersApi, createOrderApi, updateOrderStatusApi, getOrderDetailApi, getOrderByPickupCodeApi } from "../api/order";
import { getWindowsApi, getWindowQueueApi, callNextApi, verifyPickupApi, createWindowApi } from "../api/pickup";
import { getUserListApi } from "../api/user";
import { createDishApi, deleteDishApi, getDishDetailApi, getDishListApi, updateDishApi, updateDishStatusApi } from "../api/dish";
import { useAuthStore } from "../stores/auth";
const router = useRouter();
const authStore = useAuthStore();
const loading = ref(false);
const submitting = ref(false);
const windows = ref([]);
const orders = ref([]);
const merchantOrders = ref([]);
const dishes = ref([]);
const merchantTodayMenus = ref([]);
const adminMenus = ref([]);
const lowStockDishes = ref([]);
const merchantUsers = ref([]);
const allUsers = ref([]);
const merchantDishes = ref([]);
const selectedWindowId = ref(null);
const remark = ref("");
const quantityMap = reactive({});
const queueList = ref([]);
const verifyCode = ref("");
const searchPickupCode = ref("");
const searchedOrder = ref(null);
const detailVisible = ref(false);
const detailOrder = ref(null);
const menuDishDetailVisible = ref(false);
const menuDishDetailLoading = ref(false);
const menuDishDetail = ref(null);
const creatingWindow = ref(false);
const creatingDish = ref(false);
const publishingMenu = ref(false);
const adminMenuDetailVisible = ref(false);
const adminMenuDetail = ref(null);
const adminMenuLoading = ref(false);
const adminDishQueryId = ref(null);
const adminDishQueryLoading = ref(false);
const adminDishDetail = ref(null);
const lowStockThreshold = ref(10);
const userMenuKeyword = ref("");
const userOrderKeyword = ref("");
const merchantOrderKeyword = ref("");
const lowStockKeyword = ref("");
const dishKeyword = ref("");
const windowKeyword = ref("");
const userKeyword = ref("");
const menuKeyword = ref("");
const userOrderFilter = ref("all");
const adminUserPage = ref(1);
const adminUserSize = ref(10);
const adminUserTotal = ref(0);
const activeSection = ref("");
const windowForm = reactive({
    name: "",
    location: "",
    merchantId: undefined,
    pickupPrefix: "A"
});
const dishForm = reactive({
    id: undefined,
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
const menuItemMap = reactive({});
const roleLabel = computed(() => {
    if (authStore.role === 0)
        return "普通用户";
    if (authStore.role === 1)
        return "商家";
    if (authStore.role === 2)
        return "管理员";
    return "未知";
});
const isUser = computed(() => authStore.role === 0);
const isMerchant = computed(() => authStore.role === 1);
const isAdmin = computed(() => authStore.role === 2);
const flatDishes = computed(() => dishes.value.filter((d) => d.status === 1));
const selectedItems = computed(() => flatDishes.value
    .map((d) => ({ menuDishId: d.id, quantity: quantityMap[d.id] || 0, price: d.salePrice }))
    .filter((x) => x.quantity > 0));
const selectedCount = computed(() => selectedItems.value.reduce((sum, item) => sum + item.quantity, 0));
const totalAmount = computed(() => selectedItems.value.reduce((sum, item) => sum + item.quantity * item.price, 0));
const userReadyCount = computed(() => orders.value.filter((o) => o.status === 3).length);
const filteredUserOrders = computed(() => (userOrderFilter.value === "all" ? orders.value : orders.value.filter((o) => o.status === userOrderFilter.value)).filter((o) => {
    const kw = userOrderKeyword.value.trim();
    if (!kw)
        return true;
    return (String(o.id).includes(kw) ||
        o.orderNo.includes(kw) ||
        (o.pickupCode || "").includes(kw) ||
        (o.pickupNo || "").includes(kw));
}));
const merchantPendingCount = computed(() => merchantOrders.value.filter((o) => o.status <= 2).length);
const activeWindowCount = computed(() => windows.value.filter((w) => w.status === 1).length);
const publishedDishIdSet = computed(() => {
    const ids = new Set();
    merchantTodayMenus.value.forEach((m) => {
        (m.dishes || []).forEach((d) => ids.add(d.dishId));
    });
    return ids;
});
const filteredMenuDishes = computed(() => {
    const kw = userMenuKeyword.value.trim();
    return flatDishes.value.filter((d) => {
        if (!kw)
            return true;
        return d.dishName.includes(kw) || String(d.id).includes(kw);
    });
});
const filteredMerchantOrders = computed(() => {
    const kw = merchantOrderKeyword.value.trim();
    return merchantOrders.value.filter((o) => {
        if (!kw)
            return true;
        return String(o.id).includes(kw) || o.orderNo.includes(kw) || (o.pickupCode || "").includes(kw);
    });
});
const filteredLowStockDishes = computed(() => {
    const kw = lowStockKeyword.value.trim();
    return lowStockDishes.value.filter((d) => {
        const hitThreshold = d.status === 1 && d.stock <= lowStockThreshold.value;
        if (!hitThreshold)
            return false;
        if (!kw)
            return true;
        return d.dishName.includes(kw) || String(d.id).includes(kw);
    });
});
const filteredMerchantDishes = computed(() => {
    const kw = dishKeyword.value.trim();
    return merchantDishes.value.filter((d) => {
        if (!kw)
            return true;
        return d.name.includes(kw) || String(d.id).includes(kw) || (d.category || "").includes(kw);
    });
});
const filteredWindows = computed(() => {
    const kw = windowKeyword.value.trim();
    return windows.value.filter((w) => {
        if (!kw)
            return true;
        return w.name.includes(kw) || w.location.includes(kw) || String(w.id).includes(kw) || String(w.merchantId).includes(kw);
    });
});
const filteredUsers = computed(() => {
    const kw = userKeyword.value.trim();
    return allUsers.value.filter((u) => {
        if (!kw)
            return true;
        return String(u.id).includes(kw) || u.phone.includes(kw) || u.nickname.includes(kw);
    });
});
const filteredAdminMenus = computed(() => {
    const kw = menuKeyword.value.trim();
    return adminMenus.value.filter((m) => {
        if (!kw)
            return true;
        return String(m.id).includes(kw) || m.name.includes(kw);
    });
});
const selectedWindowLabel = computed(() => {
    if (!selectedWindowId.value)
        return "未选择窗口";
    const target = windows.value.find((w) => w.id === selectedWindowId.value);
    if (!target)
        return `窗口ID ${selectedWindowId.value}`;
    return `${target.name}（${target.location}）`;
});
const pickedMenuItems = computed(() => merchantDishes.value
    .filter((d) => menuItemMap[d.id]?.enabled)
    .map((d) => ({
    dishId: d.id,
    salePrice: Number(menuItemMap[d.id]?.salePrice || d.price),
    stock: Number(menuItemMap[d.id]?.stock || 0)
}))
    .filter((x) => x.stock >= 0));
const sectionIdMap = {
    userMenu: "section-user-menu",
    userOrders: "section-user-orders",
    merchantFulfill: "section-merchant-fulfill",
    merchantPickup: "section-merchant-pickup",
    merchantStock: "section-merchant-stock",
    merchantDish: "section-merchant-dish",
    merchantMenu: "section-merchant-menu",
    adminCreateWindow: "section-admin-create-window",
    adminWindows: "section-admin-windows",
    adminUsers: "section-admin-users",
    adminMenuDetail: "section-admin-menu-detail",
    adminDishDetail: "section-admin-dish-detail"
};
const roleNavItems = computed(() => {
    if (isUser.value) {
        return [
            { key: sectionIdMap.userMenu, label: "今日菜单与下单" },
            { key: sectionIdMap.userOrders, label: "我的订单" }
        ];
    }
    if (isMerchant.value) {
        return [
            { key: sectionIdMap.merchantFulfill, label: "订单履约" },
            { key: sectionIdMap.merchantPickup, label: "叫号核销" },
            { key: sectionIdMap.merchantStock, label: "库存预警" },
            { key: sectionIdMap.merchantDish, label: "菜品管理" },
            { key: sectionIdMap.merchantMenu, label: "菜单发布" }
        ];
    }
    return [
        { key: sectionIdMap.adminCreateWindow, label: "窗口创建" },
        { key: sectionIdMap.adminWindows, label: "窗口列表" },
        { key: sectionIdMap.adminUsers, label: "用户列表" },
        { key: sectionIdMap.adminMenuDetail, label: "菜单详情查询" },
        { key: sectionIdMap.adminDishDetail, label: "菜品详情查询" }
    ];
});
const loadAll = async () => {
    loading.value = true;
    try {
        const [winList, myOrders] = await Promise.all([getWindowsApi(), getMyOrdersApi()]);
        windows.value = winList.filter((w) => w.status === 1);
        if (isUser.value) {
            const menus = await getTodayMenusApi();
            dishes.value = menus.flatMap((m) => m.dishes || []);
            orders.value = myOrders;
        }
        else if (isMerchant.value) {
            merchantOrders.value = myOrders;
            merchantDishes.value = await getDishListApi();
            merchantTodayMenus.value = await getTodayMenusApi();
            lowStockDishes.value = merchantTodayMenus.value.flatMap((m) => m.dishes || []);
            merchantDishes.value.forEach((d) => {
                menuItemMap[d.id] = menuItemMap[d.id] || { enabled: false, salePrice: Number(d.price), stock: 50 };
            });
        }
        else {
            const [usersPage, usersForMerchant] = await Promise.all([
                getUserListApi(adminUserPage.value, adminUserSize.value),
                getUserListApi(1, 200)
            ]);
            adminMenus.value = await getTodayMenusApi();
            allUsers.value = usersPage.records;
            adminUserTotal.value = usersPage.total;
            merchantUsers.value = usersForMerchant.records.filter((u) => u.role === 1 && u.status === 1);
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
    }
    finally {
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
    }
    finally {
        submitting.value = false;
    }
};
const statusText = (status) => {
    if (status === 0)
        return "已下单";
    if (status === 1)
        return "已接单";
    if (status === 2)
        return "制作中";
    if (status === 3)
        return "待取餐";
    if (status === 4)
        return "已取餐";
    if (status === 5)
        return "已取消";
    return `未知(${status})`;
};
const changeStatus = async (orderId, action) => {
    await updateOrderStatusApi(orderId, action);
    ElMessage.success("操作成功");
    await loadAll();
};
const loadQueue = async () => {
    if (!selectedWindowId.value)
        return;
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
const searchOrderByCode = async () => {
    if (!searchPickupCode.value.trim()) {
        ElMessage.warning("请输入取餐码");
        return;
    }
    searchedOrder.value = await getOrderByPickupCodeApi(searchPickupCode.value.trim());
    ElMessage.success("查询成功");
};
const showOrderDetail = async (orderId) => {
    detailOrder.value = await getOrderDetailApi(orderId);
    detailVisible.value = true;
};
const cancelOrder = async (orderId) => {
    await cancelOrderApi(orderId);
    ElMessage.success("订单已取消");
    await loadAll();
};
const showMenuDishDetail = async (menuDishId) => {
    menuDishDetailLoading.value = true;
    try {
        menuDishDetail.value = await getMenuDishDetailApi(menuDishId);
        menuDishDetailVisible.value = true;
    }
    finally {
        menuDishDetailLoading.value = false;
    }
};
const onAdminUserPageChange = async (page) => {
    adminUserPage.value = page;
    await loadAll();
};
const onAdminUserSizeChange = async (size) => {
    adminUserSize.value = size;
    adminUserPage.value = 1;
    await loadAll();
};
const openAdminMenuDetail = async (menuId) => {
    adminMenuLoading.value = true;
    try {
        adminMenuDetail.value = await getMenuDetailApi(menuId);
        adminMenuDetailVisible.value = true;
    }
    finally {
        adminMenuLoading.value = false;
    }
};
const queryAdminDishDetail = async () => {
    if (!adminDishQueryId.value) {
        ElMessage.warning("请输入菜品ID");
        return;
    }
    adminDishQueryLoading.value = true;
    try {
        adminDishDetail.value = await getDishDetailApi(adminDishQueryId.value);
        ElMessage.success("查询成功");
    }
    finally {
        adminDishQueryLoading.value = false;
    }
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
    }
    finally {
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
        }
        else {
            await createDishApi(payload);
            ElMessage.success("菜品创建成功");
        }
        resetDishForm();
        await loadAll();
    }
    finally {
        creatingDish.value = false;
    }
};
const editDish = (dish) => {
    dishForm.id = dish.id;
    dishForm.name = dish.name;
    dishForm.description = dish.description || "";
    dishForm.price = Number(dish.price);
    dishForm.category = dish.category || "";
};
const toggleDishStatus = async (dish) => {
    await updateDishStatusApi(dish.id, dish.status === 1 ? 0 : 1);
    ElMessage.success("状态已更新");
    await loadAll();
};
const removeDish = async (id) => {
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
    }
    finally {
        publishingMenu.value = false;
    }
};
const roleNameByValue = (role) => {
    if (role === 2)
        return "管理员";
    if (role === 1)
        return "商家";
    return "普通用户";
};
const goDisplay = async () => {
    await router.push("/display");
};
const goProfile = async () => {
    await router.push("/profile");
};
onMounted(() => {
    const now = new Date();
    const hour = String(now.getHours()).padStart(2, "0");
    menuForm.saleDate = now.toISOString().slice(0, 10);
    menuForm.startTime = `${hour}:00:00`;
    menuForm.endTime = `${hour}:59:59`;
    activeSection.value = roleNavItems.value[0]?.key || "";
    loadAll();
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['hero-head']} */ ;
/** @type {__VLS_StyleScopedClasses['hero-head']} */ ;
/** @type {__VLS_StyleScopedClasses['section-head']} */ ;
/** @type {__VLS_StyleScopedClasses['section-head']} */ ;
/** @type {__VLS_StyleScopedClasses['el-table']} */ ;
/** @type {__VLS_StyleScopedClasses['wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['hero-head']} */ ;
/** @type {__VLS_StyleScopedClasses['section-head']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "wrap" },
});
const __VLS_0 = {}.ElCard;
/** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    ...{ class: "hero-card" },
}));
const __VLS_2 = __VLS_1({
    ...{ class: "hero-card" },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_3.slots.default;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "hero-head" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h1, __VLS_intrinsicElements.h1)({});
(__VLS_ctx.roleLabel);
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
const __VLS_4 = {}.ElSpace;
/** @type {[typeof __VLS_components.ElSpace, typeof __VLS_components.elSpace, typeof __VLS_components.ElSpace, typeof __VLS_components.elSpace, ]} */ ;
// @ts-ignore
const __VLS_5 = __VLS_asFunctionalComponent(__VLS_4, new __VLS_4({
    wrap: true,
}));
const __VLS_6 = __VLS_5({
    wrap: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_5));
__VLS_7.slots.default;
const __VLS_8 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({
    ...{ 'onClick': {} },
    loading: (__VLS_ctx.loading),
}));
const __VLS_10 = __VLS_9({
    ...{ 'onClick': {} },
    loading: (__VLS_ctx.loading),
}, ...__VLS_functionalComponentArgsRest(__VLS_9));
let __VLS_12;
let __VLS_13;
let __VLS_14;
const __VLS_15 = {
    onClick: (__VLS_ctx.loadAll)
};
__VLS_11.slots.default;
var __VLS_11;
const __VLS_16 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_17 = __VLS_asFunctionalComponent(__VLS_16, new __VLS_16({
    ...{ 'onClick': {} },
    type: "primary",
    plain: true,
}));
const __VLS_18 = __VLS_17({
    ...{ 'onClick': {} },
    type: "primary",
    plain: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_17));
let __VLS_20;
let __VLS_21;
let __VLS_22;
const __VLS_23 = {
    onClick: (__VLS_ctx.goDisplay)
};
__VLS_19.slots.default;
var __VLS_19;
const __VLS_24 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_25 = __VLS_asFunctionalComponent(__VLS_24, new __VLS_24({
    ...{ 'onClick': {} },
    type: "primary",
    plain: true,
}));
const __VLS_26 = __VLS_25({
    ...{ 'onClick': {} },
    type: "primary",
    plain: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_25));
let __VLS_28;
let __VLS_29;
let __VLS_30;
const __VLS_31 = {
    onClick: (__VLS_ctx.goProfile)
};
__VLS_27.slots.default;
var __VLS_27;
const __VLS_32 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_33 = __VLS_asFunctionalComponent(__VLS_32, new __VLS_32({
    ...{ 'onClick': {} },
    type: "danger",
    plain: true,
}));
const __VLS_34 = __VLS_33({
    ...{ 'onClick': {} },
    type: "danger",
    plain: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_33));
let __VLS_36;
let __VLS_37;
let __VLS_38;
const __VLS_39 = {
    onClick: (__VLS_ctx.logout)
};
__VLS_35.slots.default;
var __VLS_35;
var __VLS_7;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "kpi-grid" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "kpi-item" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "kpi-label" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({
    ...{ class: "kpi-value" },
});
(__VLS_ctx.windows.length);
if (__VLS_ctx.isUser) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "kpi-item" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "kpi-label" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({
        ...{ class: "kpi-value" },
    });
    (__VLS_ctx.userReadyCount);
}
if (__VLS_ctx.isUser) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "kpi-item" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "kpi-label" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({
        ...{ class: "kpi-value" },
    });
    (__VLS_ctx.flatDishes.length);
}
if (__VLS_ctx.isMerchant) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "kpi-item" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "kpi-label" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({
        ...{ class: "kpi-value" },
    });
    (__VLS_ctx.merchantPendingCount);
}
if (__VLS_ctx.isMerchant) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "kpi-item" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "kpi-label" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({
        ...{ class: "kpi-value" },
    });
    (__VLS_ctx.lowStockDishes.length);
}
if (__VLS_ctx.isAdmin) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "kpi-item" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "kpi-label" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({
        ...{ class: "kpi-value" },
    });
    (__VLS_ctx.activeWindowCount);
}
if (__VLS_ctx.isAdmin) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "kpi-item" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "kpi-label" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({
        ...{ class: "kpi-value" },
    });
    (__VLS_ctx.merchantUsers.length);
}
var __VLS_3;
const __VLS_40 = {}.ElCard;
/** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
// @ts-ignore
const __VLS_41 = __VLS_asFunctionalComponent(__VLS_40, new __VLS_40({
    ...{ class: "nav-card" },
}));
const __VLS_42 = __VLS_41({
    ...{ class: "nav-card" },
}, ...__VLS_functionalComponentArgsRest(__VLS_41));
__VLS_43.slots.default;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "role-nav" },
});
for (const [item] of __VLS_getVForSourceType((__VLS_ctx.roleNavItems))) {
    const __VLS_44 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_45 = __VLS_asFunctionalComponent(__VLS_44, new __VLS_44({
        ...{ 'onClick': {} },
        key: (item.key),
        type: (__VLS_ctx.activeSection === item.key ? 'primary' : 'default'),
        plain: true,
        ...{ class: "nav-item-btn" },
    }));
    const __VLS_46 = __VLS_45({
        ...{ 'onClick': {} },
        key: (item.key),
        type: (__VLS_ctx.activeSection === item.key ? 'primary' : 'default'),
        plain: true,
        ...{ class: "nav-item-btn" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_45));
    let __VLS_48;
    let __VLS_49;
    let __VLS_50;
    const __VLS_51 = {
        onClick: (...[$event]) => {
            __VLS_ctx.activeSection = item.key;
        }
    };
    __VLS_47.slots.default;
    (item.label);
    var __VLS_47;
}
var __VLS_43;
if (__VLS_ctx.isUser && __VLS_ctx.activeSection === __VLS_ctx.sectionIdMap.userMenu) {
    const __VLS_52 = {}.ElRow;
    /** @type {[typeof __VLS_components.ElRow, typeof __VLS_components.elRow, typeof __VLS_components.ElRow, typeof __VLS_components.elRow, ]} */ ;
    // @ts-ignore
    const __VLS_53 = __VLS_asFunctionalComponent(__VLS_52, new __VLS_52({
        gutter: (16),
    }));
    const __VLS_54 = __VLS_53({
        gutter: (16),
    }, ...__VLS_functionalComponentArgsRest(__VLS_53));
    __VLS_55.slots.default;
    const __VLS_56 = {}.ElCol;
    /** @type {[typeof __VLS_components.ElCol, typeof __VLS_components.elCol, typeof __VLS_components.ElCol, typeof __VLS_components.elCol, ]} */ ;
    // @ts-ignore
    const __VLS_57 = __VLS_asFunctionalComponent(__VLS_56, new __VLS_56({
        span: (16),
    }));
    const __VLS_58 = __VLS_57({
        span: (16),
    }, ...__VLS_functionalComponentArgsRest(__VLS_57));
    __VLS_59.slots.default;
    const __VLS_60 = {}.ElCard;
    /** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
    // @ts-ignore
    const __VLS_61 = __VLS_asFunctionalComponent(__VLS_60, new __VLS_60({
        id: (__VLS_ctx.sectionIdMap.userMenu),
        ...{ class: "student-menu-card" },
    }));
    const __VLS_62 = __VLS_61({
        id: (__VLS_ctx.sectionIdMap.userMenu),
        ...{ class: "student-menu-card" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_61));
    __VLS_63.slots.default;
    {
        const { header: __VLS_thisSlot } = __VLS_63.slots;
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "section-head" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
    }
    const __VLS_64 = {}.ElInput;
    /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
    // @ts-ignore
    const __VLS_65 = __VLS_asFunctionalComponent(__VLS_64, new __VLS_64({
        modelValue: (__VLS_ctx.userMenuKeyword),
        placeholder: "按菜品名/菜单菜品ID查询",
        ...{ class: "query-input" },
    }));
    const __VLS_66 = __VLS_65({
        modelValue: (__VLS_ctx.userMenuKeyword),
        placeholder: "按菜品名/菜单菜品ID查询",
        ...{ class: "query-input" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_65));
    if (__VLS_ctx.filteredMenuDishes.length === 0) {
        const __VLS_68 = {}.ElEmpty;
        /** @type {[typeof __VLS_components.ElEmpty, typeof __VLS_components.elEmpty, ]} */ ;
        // @ts-ignore
        const __VLS_69 = __VLS_asFunctionalComponent(__VLS_68, new __VLS_68({
            description: "当前无可用菜单",
        }));
        const __VLS_70 = __VLS_69({
            description: "当前无可用菜单",
        }, ...__VLS_functionalComponentArgsRest(__VLS_69));
    }
    else {
        const __VLS_72 = {}.ElTable;
        /** @type {[typeof __VLS_components.ElTable, typeof __VLS_components.elTable, typeof __VLS_components.ElTable, typeof __VLS_components.elTable, ]} */ ;
        // @ts-ignore
        const __VLS_73 = __VLS_asFunctionalComponent(__VLS_72, new __VLS_72({
            data: (__VLS_ctx.filteredMenuDishes),
            size: "small",
        }));
        const __VLS_74 = __VLS_73({
            data: (__VLS_ctx.filteredMenuDishes),
            size: "small",
        }, ...__VLS_functionalComponentArgsRest(__VLS_73));
        __VLS_75.slots.default;
        const __VLS_76 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_77 = __VLS_asFunctionalComponent(__VLS_76, new __VLS_76({
            prop: "dishName",
            label: "菜品",
            minWidth: "120",
        }));
        const __VLS_78 = __VLS_77({
            prop: "dishName",
            label: "菜品",
            minWidth: "120",
        }, ...__VLS_functionalComponentArgsRest(__VLS_77));
        const __VLS_80 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_81 = __VLS_asFunctionalComponent(__VLS_80, new __VLS_80({
            prop: "salePrice",
            label: "价格",
            width: "90",
        }));
        const __VLS_82 = __VLS_81({
            prop: "salePrice",
            label: "价格",
            width: "90",
        }, ...__VLS_functionalComponentArgsRest(__VLS_81));
        __VLS_83.slots.default;
        {
            const { default: __VLS_thisSlot } = __VLS_83.slots;
            const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
            (row.salePrice);
        }
        var __VLS_83;
        const __VLS_84 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_85 = __VLS_asFunctionalComponent(__VLS_84, new __VLS_84({
            prop: "stock",
            label: "库存",
            width: "80",
        }));
        const __VLS_86 = __VLS_85({
            prop: "stock",
            label: "库存",
            width: "80",
        }, ...__VLS_functionalComponentArgsRest(__VLS_85));
        const __VLS_88 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_89 = __VLS_asFunctionalComponent(__VLS_88, new __VLS_88({
            label: "提示",
            width: "100",
        }));
        const __VLS_90 = __VLS_89({
            label: "提示",
            width: "100",
        }, ...__VLS_functionalComponentArgsRest(__VLS_89));
        __VLS_91.slots.default;
        {
            const { default: __VLS_thisSlot } = __VLS_91.slots;
            const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
            if (row.stock <= 10) {
                const __VLS_92 = {}.ElTag;
                /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
                // @ts-ignore
                const __VLS_93 = __VLS_asFunctionalComponent(__VLS_92, new __VLS_92({
                    type: "danger",
                    size: "small",
                }));
                const __VLS_94 = __VLS_93({
                    type: "danger",
                    size: "small",
                }, ...__VLS_functionalComponentArgsRest(__VLS_93));
                __VLS_95.slots.default;
                var __VLS_95;
            }
            else {
                const __VLS_96 = {}.ElTag;
                /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
                // @ts-ignore
                const __VLS_97 = __VLS_asFunctionalComponent(__VLS_96, new __VLS_96({
                    type: "success",
                    size: "small",
                }));
                const __VLS_98 = __VLS_97({
                    type: "success",
                    size: "small",
                }, ...__VLS_functionalComponentArgsRest(__VLS_97));
                __VLS_99.slots.default;
                var __VLS_99;
            }
        }
        var __VLS_91;
        const __VLS_100 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_101 = __VLS_asFunctionalComponent(__VLS_100, new __VLS_100({
            label: "数量",
            width: "120",
        }));
        const __VLS_102 = __VLS_101({
            label: "数量",
            width: "120",
        }, ...__VLS_functionalComponentArgsRest(__VLS_101));
        __VLS_103.slots.default;
        {
            const { default: __VLS_thisSlot } = __VLS_103.slots;
            const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
            const __VLS_104 = {}.ElInputNumber;
            /** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
            // @ts-ignore
            const __VLS_105 = __VLS_asFunctionalComponent(__VLS_104, new __VLS_104({
                modelValue: (__VLS_ctx.quantityMap[row.id]),
                min: (0),
                max: (20),
                step: (1),
                size: "small",
            }));
            const __VLS_106 = __VLS_105({
                modelValue: (__VLS_ctx.quantityMap[row.id]),
                min: (0),
                max: (20),
                step: (1),
                size: "small",
            }, ...__VLS_functionalComponentArgsRest(__VLS_105));
        }
        var __VLS_103;
        var __VLS_75;
    }
    var __VLS_63;
    var __VLS_59;
    const __VLS_108 = {}.ElCol;
    /** @type {[typeof __VLS_components.ElCol, typeof __VLS_components.elCol, typeof __VLS_components.ElCol, typeof __VLS_components.elCol, ]} */ ;
    // @ts-ignore
    const __VLS_109 = __VLS_asFunctionalComponent(__VLS_108, new __VLS_108({
        span: (8),
    }));
    const __VLS_110 = __VLS_109({
        span: (8),
    }, ...__VLS_functionalComponentArgsRest(__VLS_109));
    __VLS_111.slots.default;
    const __VLS_112 = {}.ElCard;
    /** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
    // @ts-ignore
    const __VLS_113 = __VLS_asFunctionalComponent(__VLS_112, new __VLS_112({}));
    const __VLS_114 = __VLS_113({}, ...__VLS_functionalComponentArgsRest(__VLS_113));
    __VLS_115.slots.default;
    {
        const { header: __VLS_thisSlot } = __VLS_115.slots;
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "section-head" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
    }
    const __VLS_116 = {}.ElForm;
    /** @type {[typeof __VLS_components.ElForm, typeof __VLS_components.elForm, typeof __VLS_components.ElForm, typeof __VLS_components.elForm, ]} */ ;
    // @ts-ignore
    const __VLS_117 = __VLS_asFunctionalComponent(__VLS_116, new __VLS_116({
        labelWidth: "90px",
    }));
    const __VLS_118 = __VLS_117({
        labelWidth: "90px",
    }, ...__VLS_functionalComponentArgsRest(__VLS_117));
    __VLS_119.slots.default;
    const __VLS_120 = {}.ElFormItem;
    /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
    // @ts-ignore
    const __VLS_121 = __VLS_asFunctionalComponent(__VLS_120, new __VLS_120({
        label: "取餐窗口",
    }));
    const __VLS_122 = __VLS_121({
        label: "取餐窗口",
    }, ...__VLS_functionalComponentArgsRest(__VLS_121));
    __VLS_123.slots.default;
    const __VLS_124 = {}.ElSelect;
    /** @type {[typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, ]} */ ;
    // @ts-ignore
    const __VLS_125 = __VLS_asFunctionalComponent(__VLS_124, new __VLS_124({
        modelValue: (__VLS_ctx.selectedWindowId),
        placeholder: "请选择窗口",
        ...{ style: {} },
    }));
    const __VLS_126 = __VLS_125({
        modelValue: (__VLS_ctx.selectedWindowId),
        placeholder: "请选择窗口",
        ...{ style: {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_125));
    __VLS_127.slots.default;
    for (const [w] of __VLS_getVForSourceType((__VLS_ctx.windows))) {
        const __VLS_128 = {}.ElOption;
        /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
        // @ts-ignore
        const __VLS_129 = __VLS_asFunctionalComponent(__VLS_128, new __VLS_128({
            key: (w.id),
            label: (`${w.name} (${w.location})`),
            value: (w.id),
        }));
        const __VLS_130 = __VLS_129({
            key: (w.id),
            label: (`${w.name} (${w.location})`),
            value: (w.id),
        }, ...__VLS_functionalComponentArgsRest(__VLS_129));
    }
    var __VLS_127;
    var __VLS_123;
    const __VLS_132 = {}.ElFormItem;
    /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
    // @ts-ignore
    const __VLS_133 = __VLS_asFunctionalComponent(__VLS_132, new __VLS_132({
        label: "备注",
    }));
    const __VLS_134 = __VLS_133({
        label: "备注",
    }, ...__VLS_functionalComponentArgsRest(__VLS_133));
    __VLS_135.slots.default;
    const __VLS_136 = {}.ElInput;
    /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
    // @ts-ignore
    const __VLS_137 = __VLS_asFunctionalComponent(__VLS_136, new __VLS_136({
        modelValue: (__VLS_ctx.remark),
        placeholder: "例如：少辣、不加葱",
    }));
    const __VLS_138 = __VLS_137({
        modelValue: (__VLS_ctx.remark),
        placeholder: "例如：少辣、不加葱",
    }, ...__VLS_functionalComponentArgsRest(__VLS_137));
    var __VLS_135;
    var __VLS_119;
    const __VLS_140 = {}.ElAlert;
    /** @type {[typeof __VLS_components.ElAlert, typeof __VLS_components.elAlert, ]} */ ;
    // @ts-ignore
    const __VLS_141 = __VLS_asFunctionalComponent(__VLS_140, new __VLS_140({
        closable: (false),
        type: "info",
        title: (`下单窗口：${__VLS_ctx.selectedWindowLabel}`),
    }));
    const __VLS_142 = __VLS_141({
        closable: (false),
        type: "info",
        title: (`下单窗口：${__VLS_ctx.selectedWindowLabel}`),
    }, ...__VLS_functionalComponentArgsRest(__VLS_141));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "summary" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
    (__VLS_ctx.selectedCount);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
    (__VLS_ctx.totalAmount.toFixed(2));
    const __VLS_144 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_145 = __VLS_asFunctionalComponent(__VLS_144, new __VLS_144({
        ...{ 'onClick': {} },
        type: "primary",
        ...{ class: "full-btn" },
        loading: (__VLS_ctx.submitting),
    }));
    const __VLS_146 = __VLS_145({
        ...{ 'onClick': {} },
        type: "primary",
        ...{ class: "full-btn" },
        loading: (__VLS_ctx.submitting),
    }, ...__VLS_functionalComponentArgsRest(__VLS_145));
    let __VLS_148;
    let __VLS_149;
    let __VLS_150;
    const __VLS_151 = {
        onClick: (__VLS_ctx.submitOrder)
    };
    __VLS_147.slots.default;
    var __VLS_147;
    var __VLS_115;
    var __VLS_111;
    var __VLS_55;
}
if (__VLS_ctx.isUser && __VLS_ctx.activeSection === __VLS_ctx.sectionIdMap.userOrders) {
    const __VLS_152 = {}.ElCard;
    /** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
    // @ts-ignore
    const __VLS_153 = __VLS_asFunctionalComponent(__VLS_152, new __VLS_152({
        id: (__VLS_ctx.sectionIdMap.userOrders),
        ...{ class: "order-card" },
    }));
    const __VLS_154 = __VLS_153({
        id: (__VLS_ctx.sectionIdMap.userOrders),
        ...{ class: "order-card" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_153));
    __VLS_155.slots.default;
    {
        const { header: __VLS_thisSlot } = __VLS_155.slots;
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "section-head" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        const __VLS_156 = {}.ElRadioGroup;
        /** @type {[typeof __VLS_components.ElRadioGroup, typeof __VLS_components.elRadioGroup, typeof __VLS_components.ElRadioGroup, typeof __VLS_components.elRadioGroup, ]} */ ;
        // @ts-ignore
        const __VLS_157 = __VLS_asFunctionalComponent(__VLS_156, new __VLS_156({
            modelValue: (__VLS_ctx.userOrderFilter),
            size: "small",
        }));
        const __VLS_158 = __VLS_157({
            modelValue: (__VLS_ctx.userOrderFilter),
            size: "small",
        }, ...__VLS_functionalComponentArgsRest(__VLS_157));
        __VLS_159.slots.default;
        const __VLS_160 = {}.ElRadioButton;
        /** @type {[typeof __VLS_components.ElRadioButton, typeof __VLS_components.elRadioButton, typeof __VLS_components.ElRadioButton, typeof __VLS_components.elRadioButton, ]} */ ;
        // @ts-ignore
        const __VLS_161 = __VLS_asFunctionalComponent(__VLS_160, new __VLS_160({
            label: "all",
        }));
        const __VLS_162 = __VLS_161({
            label: "all",
        }, ...__VLS_functionalComponentArgsRest(__VLS_161));
        __VLS_163.slots.default;
        var __VLS_163;
        const __VLS_164 = {}.ElRadioButton;
        /** @type {[typeof __VLS_components.ElRadioButton, typeof __VLS_components.elRadioButton, typeof __VLS_components.ElRadioButton, typeof __VLS_components.elRadioButton, ]} */ ;
        // @ts-ignore
        const __VLS_165 = __VLS_asFunctionalComponent(__VLS_164, new __VLS_164({
            label: (0),
        }));
        const __VLS_166 = __VLS_165({
            label: (0),
        }, ...__VLS_functionalComponentArgsRest(__VLS_165));
        __VLS_167.slots.default;
        var __VLS_167;
        const __VLS_168 = {}.ElRadioButton;
        /** @type {[typeof __VLS_components.ElRadioButton, typeof __VLS_components.elRadioButton, typeof __VLS_components.ElRadioButton, typeof __VLS_components.elRadioButton, ]} */ ;
        // @ts-ignore
        const __VLS_169 = __VLS_asFunctionalComponent(__VLS_168, new __VLS_168({
            label: (3),
        }));
        const __VLS_170 = __VLS_169({
            label: (3),
        }, ...__VLS_functionalComponentArgsRest(__VLS_169));
        __VLS_171.slots.default;
        var __VLS_171;
        const __VLS_172 = {}.ElRadioButton;
        /** @type {[typeof __VLS_components.ElRadioButton, typeof __VLS_components.elRadioButton, typeof __VLS_components.ElRadioButton, typeof __VLS_components.elRadioButton, ]} */ ;
        // @ts-ignore
        const __VLS_173 = __VLS_asFunctionalComponent(__VLS_172, new __VLS_172({
            label: (4),
        }));
        const __VLS_174 = __VLS_173({
            label: (4),
        }, ...__VLS_functionalComponentArgsRest(__VLS_173));
        __VLS_175.slots.default;
        var __VLS_175;
        var __VLS_159;
    }
    const __VLS_176 = {}.ElInput;
    /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
    // @ts-ignore
    const __VLS_177 = __VLS_asFunctionalComponent(__VLS_176, new __VLS_176({
        modelValue: (__VLS_ctx.userOrderKeyword),
        placeholder: "按订单号/取餐码/叫号码查询",
        ...{ class: "query-input" },
    }));
    const __VLS_178 = __VLS_177({
        modelValue: (__VLS_ctx.userOrderKeyword),
        placeholder: "按订单号/取餐码/叫号码查询",
        ...{ class: "query-input" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_177));
    const __VLS_180 = {}.ElTable;
    /** @type {[typeof __VLS_components.ElTable, typeof __VLS_components.elTable, typeof __VLS_components.ElTable, typeof __VLS_components.elTable, ]} */ ;
    // @ts-ignore
    const __VLS_181 = __VLS_asFunctionalComponent(__VLS_180, new __VLS_180({
        data: (__VLS_ctx.filteredUserOrders),
        size: "small",
    }));
    const __VLS_182 = __VLS_181({
        data: (__VLS_ctx.filteredUserOrders),
        size: "small",
    }, ...__VLS_functionalComponentArgsRest(__VLS_181));
    __VLS_183.slots.default;
    const __VLS_184 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_185 = __VLS_asFunctionalComponent(__VLS_184, new __VLS_184({
        prop: "id",
        label: "订单ID",
        width: "90",
    }));
    const __VLS_186 = __VLS_185({
        prop: "id",
        label: "订单ID",
        width: "90",
    }, ...__VLS_functionalComponentArgsRest(__VLS_185));
    const __VLS_188 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_189 = __VLS_asFunctionalComponent(__VLS_188, new __VLS_188({
        prop: "orderNo",
        label: "订单号",
        minWidth: "160",
    }));
    const __VLS_190 = __VLS_189({
        prop: "orderNo",
        label: "订单号",
        minWidth: "160",
    }, ...__VLS_functionalComponentArgsRest(__VLS_189));
    const __VLS_192 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_193 = __VLS_asFunctionalComponent(__VLS_192, new __VLS_192({
        prop: "totalAmount",
        label: "金额",
        width: "90",
    }));
    const __VLS_194 = __VLS_193({
        prop: "totalAmount",
        label: "金额",
        width: "90",
    }, ...__VLS_functionalComponentArgsRest(__VLS_193));
    __VLS_195.slots.default;
    {
        const { default: __VLS_thisSlot } = __VLS_195.slots;
        const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
        (row.totalAmount);
    }
    var __VLS_195;
    const __VLS_196 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_197 = __VLS_asFunctionalComponent(__VLS_196, new __VLS_196({
        prop: "status",
        label: "状态",
        width: "110",
    }));
    const __VLS_198 = __VLS_197({
        prop: "status",
        label: "状态",
        width: "110",
    }, ...__VLS_functionalComponentArgsRest(__VLS_197));
    __VLS_199.slots.default;
    {
        const { default: __VLS_thisSlot } = __VLS_199.slots;
        const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
        (__VLS_ctx.statusText(row.status));
    }
    var __VLS_199;
    const __VLS_200 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_201 = __VLS_asFunctionalComponent(__VLS_200, new __VLS_200({
        prop: "pickupCode",
        label: "取餐码",
        width: "110",
    }));
    const __VLS_202 = __VLS_201({
        prop: "pickupCode",
        label: "取餐码",
        width: "110",
    }, ...__VLS_functionalComponentArgsRest(__VLS_201));
    const __VLS_204 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_205 = __VLS_asFunctionalComponent(__VLS_204, new __VLS_204({
        prop: "pickupNo",
        label: "叫号码",
        width: "90",
    }));
    const __VLS_206 = __VLS_205({
        prop: "pickupNo",
        label: "叫号码",
        width: "90",
    }, ...__VLS_functionalComponentArgsRest(__VLS_205));
    const __VLS_208 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_209 = __VLS_asFunctionalComponent(__VLS_208, new __VLS_208({
        prop: "createTime",
        label: "创建时间",
        minWidth: "170",
    }));
    const __VLS_210 = __VLS_209({
        prop: "createTime",
        label: "创建时间",
        minWidth: "170",
    }, ...__VLS_functionalComponentArgsRest(__VLS_209));
    const __VLS_212 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_213 = __VLS_asFunctionalComponent(__VLS_212, new __VLS_212({
        label: "操作",
        width: "100",
    }));
    const __VLS_214 = __VLS_213({
        label: "操作",
        width: "100",
    }, ...__VLS_functionalComponentArgsRest(__VLS_213));
    __VLS_215.slots.default;
    {
        const { default: __VLS_thisSlot } = __VLS_215.slots;
        const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
        const __VLS_216 = {}.ElSpace;
        /** @type {[typeof __VLS_components.ElSpace, typeof __VLS_components.elSpace, typeof __VLS_components.ElSpace, typeof __VLS_components.elSpace, ]} */ ;
        // @ts-ignore
        const __VLS_217 = __VLS_asFunctionalComponent(__VLS_216, new __VLS_216({}));
        const __VLS_218 = __VLS_217({}, ...__VLS_functionalComponentArgsRest(__VLS_217));
        __VLS_219.slots.default;
        const __VLS_220 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        const __VLS_221 = __VLS_asFunctionalComponent(__VLS_220, new __VLS_220({
            ...{ 'onClick': {} },
            link: true,
            type: "primary",
        }));
        const __VLS_222 = __VLS_221({
            ...{ 'onClick': {} },
            link: true,
            type: "primary",
        }, ...__VLS_functionalComponentArgsRest(__VLS_221));
        let __VLS_224;
        let __VLS_225;
        let __VLS_226;
        const __VLS_227 = {
            onClick: (...[$event]) => {
                if (!(__VLS_ctx.isUser && __VLS_ctx.activeSection === __VLS_ctx.sectionIdMap.userOrders))
                    return;
                __VLS_ctx.showOrderDetail(row.id);
            }
        };
        __VLS_223.slots.default;
        var __VLS_223;
        if (row.status === 0) {
            const __VLS_228 = {}.ElButton;
            /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
            // @ts-ignore
            const __VLS_229 = __VLS_asFunctionalComponent(__VLS_228, new __VLS_228({
                ...{ 'onClick': {} },
                link: true,
                type: "danger",
            }));
            const __VLS_230 = __VLS_229({
                ...{ 'onClick': {} },
                link: true,
                type: "danger",
            }, ...__VLS_functionalComponentArgsRest(__VLS_229));
            let __VLS_232;
            let __VLS_233;
            let __VLS_234;
            const __VLS_235 = {
                onClick: (...[$event]) => {
                    if (!(__VLS_ctx.isUser && __VLS_ctx.activeSection === __VLS_ctx.sectionIdMap.userOrders))
                        return;
                    if (!(row.status === 0))
                        return;
                    __VLS_ctx.cancelOrder(row.id);
                }
            };
            __VLS_231.slots.default;
            var __VLS_231;
        }
        var __VLS_219;
    }
    var __VLS_215;
    var __VLS_183;
    var __VLS_155;
}
else if (__VLS_ctx.isMerchant) {
    const __VLS_236 = {}.ElRow;
    /** @type {[typeof __VLS_components.ElRow, typeof __VLS_components.elRow, typeof __VLS_components.ElRow, typeof __VLS_components.elRow, ]} */ ;
    // @ts-ignore
    const __VLS_237 = __VLS_asFunctionalComponent(__VLS_236, new __VLS_236({
        gutter: (16),
    }));
    const __VLS_238 = __VLS_237({
        gutter: (16),
    }, ...__VLS_functionalComponentArgsRest(__VLS_237));
    __VLS_239.slots.default;
    if (__VLS_ctx.activeSection === __VLS_ctx.sectionIdMap.merchantFulfill) {
        const __VLS_240 = {}.ElCol;
        /** @type {[typeof __VLS_components.ElCol, typeof __VLS_components.elCol, typeof __VLS_components.ElCol, typeof __VLS_components.elCol, ]} */ ;
        // @ts-ignore
        const __VLS_241 = __VLS_asFunctionalComponent(__VLS_240, new __VLS_240({
            span: (24),
            ...{ class: "block" },
        }));
        const __VLS_242 = __VLS_241({
            span: (24),
            ...{ class: "block" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_241));
        __VLS_243.slots.default;
        const __VLS_244 = {}.ElCard;
        /** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
        // @ts-ignore
        const __VLS_245 = __VLS_asFunctionalComponent(__VLS_244, new __VLS_244({
            id: (__VLS_ctx.sectionIdMap.merchantFulfill),
        }));
        const __VLS_246 = __VLS_245({
            id: (__VLS_ctx.sectionIdMap.merchantFulfill),
        }, ...__VLS_functionalComponentArgsRest(__VLS_245));
        __VLS_247.slots.default;
        {
            const { header: __VLS_thisSlot } = __VLS_247.slots;
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "section-head" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
            __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
        }
        const __VLS_248 = {}.ElInput;
        /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
        // @ts-ignore
        const __VLS_249 = __VLS_asFunctionalComponent(__VLS_248, new __VLS_248({
            modelValue: (__VLS_ctx.merchantOrderKeyword),
            placeholder: "按订单号/取餐码/订单ID查询",
            ...{ class: "query-input" },
        }));
        const __VLS_250 = __VLS_249({
            modelValue: (__VLS_ctx.merchantOrderKeyword),
            placeholder: "按订单号/取餐码/订单ID查询",
            ...{ class: "query-input" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_249));
        const __VLS_252 = {}.ElTable;
        /** @type {[typeof __VLS_components.ElTable, typeof __VLS_components.elTable, typeof __VLS_components.ElTable, typeof __VLS_components.elTable, ]} */ ;
        // @ts-ignore
        const __VLS_253 = __VLS_asFunctionalComponent(__VLS_252, new __VLS_252({
            data: (__VLS_ctx.filteredMerchantOrders),
            size: "small",
        }));
        const __VLS_254 = __VLS_253({
            data: (__VLS_ctx.filteredMerchantOrders),
            size: "small",
        }, ...__VLS_functionalComponentArgsRest(__VLS_253));
        __VLS_255.slots.default;
        const __VLS_256 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_257 = __VLS_asFunctionalComponent(__VLS_256, new __VLS_256({
            prop: "id",
            label: "订单ID",
            width: "90",
        }));
        const __VLS_258 = __VLS_257({
            prop: "id",
            label: "订单ID",
            width: "90",
        }, ...__VLS_functionalComponentArgsRest(__VLS_257));
        const __VLS_260 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_261 = __VLS_asFunctionalComponent(__VLS_260, new __VLS_260({
            prop: "orderNo",
            label: "订单号",
            minWidth: "160",
        }));
        const __VLS_262 = __VLS_261({
            prop: "orderNo",
            label: "订单号",
            minWidth: "160",
        }, ...__VLS_functionalComponentArgsRest(__VLS_261));
        const __VLS_264 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_265 = __VLS_asFunctionalComponent(__VLS_264, new __VLS_264({
            prop: "windowId",
            label: "窗口ID",
            width: "90",
        }));
        const __VLS_266 = __VLS_265({
            prop: "windowId",
            label: "窗口ID",
            width: "90",
        }, ...__VLS_functionalComponentArgsRest(__VLS_265));
        const __VLS_268 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_269 = __VLS_asFunctionalComponent(__VLS_268, new __VLS_268({
            prop: "status",
            label: "状态",
            width: "100",
        }));
        const __VLS_270 = __VLS_269({
            prop: "status",
            label: "状态",
            width: "100",
        }, ...__VLS_functionalComponentArgsRest(__VLS_269));
        __VLS_271.slots.default;
        {
            const { default: __VLS_thisSlot } = __VLS_271.slots;
            const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
            (__VLS_ctx.statusText(row.status));
        }
        var __VLS_271;
        const __VLS_272 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_273 = __VLS_asFunctionalComponent(__VLS_272, new __VLS_272({
            prop: "pickupCode",
            label: "取餐码",
            width: "110",
        }));
        const __VLS_274 = __VLS_273({
            prop: "pickupCode",
            label: "取餐码",
            width: "110",
        }, ...__VLS_functionalComponentArgsRest(__VLS_273));
        const __VLS_276 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_277 = __VLS_asFunctionalComponent(__VLS_276, new __VLS_276({
            label: "操作",
            minWidth: "240",
        }));
        const __VLS_278 = __VLS_277({
            label: "操作",
            minWidth: "240",
        }, ...__VLS_functionalComponentArgsRest(__VLS_277));
        __VLS_279.slots.default;
        {
            const { default: __VLS_thisSlot } = __VLS_279.slots;
            const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
            const __VLS_280 = {}.ElSpace;
            /** @type {[typeof __VLS_components.ElSpace, typeof __VLS_components.elSpace, typeof __VLS_components.ElSpace, typeof __VLS_components.elSpace, ]} */ ;
            // @ts-ignore
            const __VLS_281 = __VLS_asFunctionalComponent(__VLS_280, new __VLS_280({
                wrap: true,
            }));
            const __VLS_282 = __VLS_281({
                wrap: true,
            }, ...__VLS_functionalComponentArgsRest(__VLS_281));
            __VLS_283.slots.default;
            const __VLS_284 = {}.ElButton;
            /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
            // @ts-ignore
            const __VLS_285 = __VLS_asFunctionalComponent(__VLS_284, new __VLS_284({
                ...{ 'onClick': {} },
                size: "small",
                disabled: (row.status !== 0),
            }));
            const __VLS_286 = __VLS_285({
                ...{ 'onClick': {} },
                size: "small",
                disabled: (row.status !== 0),
            }, ...__VLS_functionalComponentArgsRest(__VLS_285));
            let __VLS_288;
            let __VLS_289;
            let __VLS_290;
            const __VLS_291 = {
                onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.isUser && __VLS_ctx.activeSection === __VLS_ctx.sectionIdMap.userOrders))
                        return;
                    if (!(__VLS_ctx.isMerchant))
                        return;
                    if (!(__VLS_ctx.activeSection === __VLS_ctx.sectionIdMap.merchantFulfill))
                        return;
                    __VLS_ctx.changeStatus(row.id, 'accept');
                }
            };
            __VLS_287.slots.default;
            var __VLS_287;
            const __VLS_292 = {}.ElButton;
            /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
            // @ts-ignore
            const __VLS_293 = __VLS_asFunctionalComponent(__VLS_292, new __VLS_292({
                ...{ 'onClick': {} },
                size: "small",
                disabled: (row.status !== 1),
            }));
            const __VLS_294 = __VLS_293({
                ...{ 'onClick': {} },
                size: "small",
                disabled: (row.status !== 1),
            }, ...__VLS_functionalComponentArgsRest(__VLS_293));
            let __VLS_296;
            let __VLS_297;
            let __VLS_298;
            const __VLS_299 = {
                onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.isUser && __VLS_ctx.activeSection === __VLS_ctx.sectionIdMap.userOrders))
                        return;
                    if (!(__VLS_ctx.isMerchant))
                        return;
                    if (!(__VLS_ctx.activeSection === __VLS_ctx.sectionIdMap.merchantFulfill))
                        return;
                    __VLS_ctx.changeStatus(row.id, 'cook');
                }
            };
            __VLS_295.slots.default;
            var __VLS_295;
            const __VLS_300 = {}.ElButton;
            /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
            // @ts-ignore
            const __VLS_301 = __VLS_asFunctionalComponent(__VLS_300, new __VLS_300({
                ...{ 'onClick': {} },
                size: "small",
                type: "success",
                disabled: (row.status !== 2),
            }));
            const __VLS_302 = __VLS_301({
                ...{ 'onClick': {} },
                size: "small",
                type: "success",
                disabled: (row.status !== 2),
            }, ...__VLS_functionalComponentArgsRest(__VLS_301));
            let __VLS_304;
            let __VLS_305;
            let __VLS_306;
            const __VLS_307 = {
                onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.isUser && __VLS_ctx.activeSection === __VLS_ctx.sectionIdMap.userOrders))
                        return;
                    if (!(__VLS_ctx.isMerchant))
                        return;
                    if (!(__VLS_ctx.activeSection === __VLS_ctx.sectionIdMap.merchantFulfill))
                        return;
                    __VLS_ctx.changeStatus(row.id, 'ready');
                }
            };
            __VLS_303.slots.default;
            var __VLS_303;
            var __VLS_283;
        }
        var __VLS_279;
        var __VLS_255;
        var __VLS_247;
        var __VLS_243;
    }
    if (__VLS_ctx.activeSection === __VLS_ctx.sectionIdMap.merchantPickup) {
        const __VLS_308 = {}.ElCol;
        /** @type {[typeof __VLS_components.ElCol, typeof __VLS_components.elCol, typeof __VLS_components.ElCol, typeof __VLS_components.elCol, ]} */ ;
        // @ts-ignore
        const __VLS_309 = __VLS_asFunctionalComponent(__VLS_308, new __VLS_308({
            span: (24),
            ...{ class: "block" },
        }));
        const __VLS_310 = __VLS_309({
            span: (24),
            ...{ class: "block" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_309));
        __VLS_311.slots.default;
        const __VLS_312 = {}.ElCard;
        /** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
        // @ts-ignore
        const __VLS_313 = __VLS_asFunctionalComponent(__VLS_312, new __VLS_312({
            id: (__VLS_ctx.sectionIdMap.merchantPickup),
        }));
        const __VLS_314 = __VLS_313({
            id: (__VLS_ctx.sectionIdMap.merchantPickup),
        }, ...__VLS_functionalComponentArgsRest(__VLS_313));
        __VLS_315.slots.default;
        {
            const { header: __VLS_thisSlot } = __VLS_315.slots;
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "section-head" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
            __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
        }
        const __VLS_316 = {}.ElForm;
        /** @type {[typeof __VLS_components.ElForm, typeof __VLS_components.elForm, typeof __VLS_components.ElForm, typeof __VLS_components.elForm, ]} */ ;
        // @ts-ignore
        const __VLS_317 = __VLS_asFunctionalComponent(__VLS_316, new __VLS_316({
            labelWidth: "80px",
        }));
        const __VLS_318 = __VLS_317({
            labelWidth: "80px",
        }, ...__VLS_functionalComponentArgsRest(__VLS_317));
        __VLS_319.slots.default;
        const __VLS_320 = {}.ElFormItem;
        /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
        // @ts-ignore
        const __VLS_321 = __VLS_asFunctionalComponent(__VLS_320, new __VLS_320({
            label: "窗口",
        }));
        const __VLS_322 = __VLS_321({
            label: "窗口",
        }, ...__VLS_functionalComponentArgsRest(__VLS_321));
        __VLS_323.slots.default;
        const __VLS_324 = {}.ElSelect;
        /** @type {[typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, ]} */ ;
        // @ts-ignore
        const __VLS_325 = __VLS_asFunctionalComponent(__VLS_324, new __VLS_324({
            modelValue: (__VLS_ctx.selectedWindowId),
            placeholder: "请选择窗口",
            ...{ style: {} },
        }));
        const __VLS_326 = __VLS_325({
            modelValue: (__VLS_ctx.selectedWindowId),
            placeholder: "请选择窗口",
            ...{ style: {} },
        }, ...__VLS_functionalComponentArgsRest(__VLS_325));
        __VLS_327.slots.default;
        for (const [w] of __VLS_getVForSourceType((__VLS_ctx.windows))) {
            const __VLS_328 = {}.ElOption;
            /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
            // @ts-ignore
            const __VLS_329 = __VLS_asFunctionalComponent(__VLS_328, new __VLS_328({
                key: (w.id),
                label: (`${w.name} (${w.location})`),
                value: (w.id),
            }));
            const __VLS_330 = __VLS_329({
                key: (w.id),
                label: (`${w.name} (${w.location})`),
                value: (w.id),
            }, ...__VLS_functionalComponentArgsRest(__VLS_329));
        }
        var __VLS_327;
        var __VLS_323;
        var __VLS_319;
        const __VLS_332 = {}.ElSpace;
        /** @type {[typeof __VLS_components.ElSpace, typeof __VLS_components.elSpace, typeof __VLS_components.ElSpace, typeof __VLS_components.elSpace, ]} */ ;
        // @ts-ignore
        const __VLS_333 = __VLS_asFunctionalComponent(__VLS_332, new __VLS_332({
            wrap: true,
        }));
        const __VLS_334 = __VLS_333({
            wrap: true,
        }, ...__VLS_functionalComponentArgsRest(__VLS_333));
        __VLS_335.slots.default;
        const __VLS_336 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        const __VLS_337 = __VLS_asFunctionalComponent(__VLS_336, new __VLS_336({
            ...{ 'onClick': {} },
            type: "primary",
        }));
        const __VLS_338 = __VLS_337({
            ...{ 'onClick': {} },
            type: "primary",
        }, ...__VLS_functionalComponentArgsRest(__VLS_337));
        let __VLS_340;
        let __VLS_341;
        let __VLS_342;
        const __VLS_343 = {
            onClick: (__VLS_ctx.callNext)
        };
        __VLS_339.slots.default;
        var __VLS_339;
        const __VLS_344 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        const __VLS_345 = __VLS_asFunctionalComponent(__VLS_344, new __VLS_344({
            ...{ 'onClick': {} },
        }));
        const __VLS_346 = __VLS_345({
            ...{ 'onClick': {} },
        }, ...__VLS_functionalComponentArgsRest(__VLS_345));
        let __VLS_348;
        let __VLS_349;
        let __VLS_350;
        const __VLS_351 = {
            onClick: (__VLS_ctx.loadQueue)
        };
        __VLS_347.slots.default;
        var __VLS_347;
        var __VLS_335;
        const __VLS_352 = {}.ElDivider;
        /** @type {[typeof __VLS_components.ElDivider, typeof __VLS_components.elDivider, ]} */ ;
        // @ts-ignore
        const __VLS_353 = __VLS_asFunctionalComponent(__VLS_352, new __VLS_352({}));
        const __VLS_354 = __VLS_353({}, ...__VLS_functionalComponentArgsRest(__VLS_353));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
        (__VLS_ctx.queueList.length);
        for (const [item] of __VLS_getVForSourceType((__VLS_ctx.queueList))) {
            const __VLS_356 = {}.ElTag;
            /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
            // @ts-ignore
            const __VLS_357 = __VLS_asFunctionalComponent(__VLS_356, new __VLS_356({
                key: (item),
                ...{ class: "queue-tag" },
            }));
            const __VLS_358 = __VLS_357({
                key: (item),
                ...{ class: "queue-tag" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_357));
            __VLS_359.slots.default;
            (item);
            var __VLS_359;
        }
        const __VLS_360 = {}.ElDivider;
        /** @type {[typeof __VLS_components.ElDivider, typeof __VLS_components.elDivider, ]} */ ;
        // @ts-ignore
        const __VLS_361 = __VLS_asFunctionalComponent(__VLS_360, new __VLS_360({}));
        const __VLS_362 = __VLS_361({}, ...__VLS_functionalComponentArgsRest(__VLS_361));
        const __VLS_364 = {}.ElInput;
        /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
        // @ts-ignore
        const __VLS_365 = __VLS_asFunctionalComponent(__VLS_364, new __VLS_364({
            modelValue: (__VLS_ctx.verifyCode),
            placeholder: "输入取餐码，例如 408765",
        }));
        const __VLS_366 = __VLS_365({
            modelValue: (__VLS_ctx.verifyCode),
            placeholder: "输入取餐码，例如 408765",
        }, ...__VLS_functionalComponentArgsRest(__VLS_365));
        const __VLS_368 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        const __VLS_369 = __VLS_asFunctionalComponent(__VLS_368, new __VLS_368({
            ...{ 'onClick': {} },
            ...{ class: "verify-btn" },
            type: "success",
        }));
        const __VLS_370 = __VLS_369({
            ...{ 'onClick': {} },
            ...{ class: "verify-btn" },
            type: "success",
        }, ...__VLS_functionalComponentArgsRest(__VLS_369));
        let __VLS_372;
        let __VLS_373;
        let __VLS_374;
        const __VLS_375 = {
            onClick: (__VLS_ctx.verifyPickup)
        };
        __VLS_371.slots.default;
        var __VLS_371;
        const __VLS_376 = {}.ElDivider;
        /** @type {[typeof __VLS_components.ElDivider, typeof __VLS_components.elDivider, ]} */ ;
        // @ts-ignore
        const __VLS_377 = __VLS_asFunctionalComponent(__VLS_376, new __VLS_376({}));
        const __VLS_378 = __VLS_377({}, ...__VLS_functionalComponentArgsRest(__VLS_377));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "section-sub-title" },
        });
        const __VLS_380 = {}.ElInput;
        /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
        // @ts-ignore
        const __VLS_381 = __VLS_asFunctionalComponent(__VLS_380, new __VLS_380({
            modelValue: (__VLS_ctx.searchPickupCode),
            placeholder: "输入取餐码进行查询",
        }));
        const __VLS_382 = __VLS_381({
            modelValue: (__VLS_ctx.searchPickupCode),
            placeholder: "输入取餐码进行查询",
        }, ...__VLS_functionalComponentArgsRest(__VLS_381));
        const __VLS_384 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        const __VLS_385 = __VLS_asFunctionalComponent(__VLS_384, new __VLS_384({
            ...{ 'onClick': {} },
            ...{ class: "verify-btn" },
            type: "primary",
            plain: true,
        }));
        const __VLS_386 = __VLS_385({
            ...{ 'onClick': {} },
            ...{ class: "verify-btn" },
            type: "primary",
            plain: true,
        }, ...__VLS_functionalComponentArgsRest(__VLS_385));
        let __VLS_388;
        let __VLS_389;
        let __VLS_390;
        const __VLS_391 = {
            onClick: (__VLS_ctx.searchOrderByCode)
        };
        __VLS_387.slots.default;
        var __VLS_387;
        if (__VLS_ctx.searchedOrder) {
            const __VLS_392 = {}.ElDescriptions;
            /** @type {[typeof __VLS_components.ElDescriptions, typeof __VLS_components.elDescriptions, typeof __VLS_components.ElDescriptions, typeof __VLS_components.elDescriptions, ]} */ ;
            // @ts-ignore
            const __VLS_393 = __VLS_asFunctionalComponent(__VLS_392, new __VLS_392({
                column: (1),
                border: true,
                ...{ class: "search-result" },
            }));
            const __VLS_394 = __VLS_393({
                column: (1),
                border: true,
                ...{ class: "search-result" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_393));
            __VLS_395.slots.default;
            const __VLS_396 = {}.ElDescriptionsItem;
            /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
            // @ts-ignore
            const __VLS_397 = __VLS_asFunctionalComponent(__VLS_396, new __VLS_396({
                label: "订单ID",
            }));
            const __VLS_398 = __VLS_397({
                label: "订单ID",
            }, ...__VLS_functionalComponentArgsRest(__VLS_397));
            __VLS_399.slots.default;
            (__VLS_ctx.searchedOrder.id);
            var __VLS_399;
            const __VLS_400 = {}.ElDescriptionsItem;
            /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
            // @ts-ignore
            const __VLS_401 = __VLS_asFunctionalComponent(__VLS_400, new __VLS_400({
                label: "用户ID",
            }));
            const __VLS_402 = __VLS_401({
                label: "用户ID",
            }, ...__VLS_functionalComponentArgsRest(__VLS_401));
            __VLS_403.slots.default;
            (__VLS_ctx.searchedOrder.userId);
            var __VLS_403;
            const __VLS_404 = {}.ElDescriptionsItem;
            /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
            // @ts-ignore
            const __VLS_405 = __VLS_asFunctionalComponent(__VLS_404, new __VLS_404({
                label: "窗口ID",
            }));
            const __VLS_406 = __VLS_405({
                label: "窗口ID",
            }, ...__VLS_functionalComponentArgsRest(__VLS_405));
            __VLS_407.slots.default;
            (__VLS_ctx.searchedOrder.windowId);
            var __VLS_407;
            const __VLS_408 = {}.ElDescriptionsItem;
            /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
            // @ts-ignore
            const __VLS_409 = __VLS_asFunctionalComponent(__VLS_408, new __VLS_408({
                label: "状态",
            }));
            const __VLS_410 = __VLS_409({
                label: "状态",
            }, ...__VLS_functionalComponentArgsRest(__VLS_409));
            __VLS_411.slots.default;
            (__VLS_ctx.statusText(__VLS_ctx.searchedOrder.status));
            var __VLS_411;
            const __VLS_412 = {}.ElDescriptionsItem;
            /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
            // @ts-ignore
            const __VLS_413 = __VLS_asFunctionalComponent(__VLS_412, new __VLS_412({
                label: "取餐码",
            }));
            const __VLS_414 = __VLS_413({
                label: "取餐码",
            }, ...__VLS_functionalComponentArgsRest(__VLS_413));
            __VLS_415.slots.default;
            (__VLS_ctx.searchedOrder.pickupCode);
            var __VLS_415;
            const __VLS_416 = {}.ElDescriptionsItem;
            /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
            // @ts-ignore
            const __VLS_417 = __VLS_asFunctionalComponent(__VLS_416, new __VLS_416({
                label: "叫号码",
            }));
            const __VLS_418 = __VLS_417({
                label: "叫号码",
            }, ...__VLS_functionalComponentArgsRest(__VLS_417));
            __VLS_419.slots.default;
            (__VLS_ctx.searchedOrder.pickupNo || "-");
            var __VLS_419;
            var __VLS_395;
        }
        var __VLS_315;
        var __VLS_311;
    }
    if (__VLS_ctx.activeSection === __VLS_ctx.sectionIdMap.merchantStock) {
        const __VLS_420 = {}.ElCol;
        /** @type {[typeof __VLS_components.ElCol, typeof __VLS_components.elCol, typeof __VLS_components.ElCol, typeof __VLS_components.elCol, ]} */ ;
        // @ts-ignore
        const __VLS_421 = __VLS_asFunctionalComponent(__VLS_420, new __VLS_420({
            span: (24),
            ...{ class: "block" },
        }));
        const __VLS_422 = __VLS_421({
            span: (24),
            ...{ class: "block" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_421));
        __VLS_423.slots.default;
        const __VLS_424 = {}.ElCard;
        /** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
        // @ts-ignore
        const __VLS_425 = __VLS_asFunctionalComponent(__VLS_424, new __VLS_424({
            id: (__VLS_ctx.sectionIdMap.merchantStock),
        }));
        const __VLS_426 = __VLS_425({
            id: (__VLS_ctx.sectionIdMap.merchantStock),
        }, ...__VLS_functionalComponentArgsRest(__VLS_425));
        __VLS_427.slots.default;
        {
            const { header: __VLS_thisSlot } = __VLS_427.slots;
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "section-head" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
            __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
        }
        const __VLS_428 = {}.ElSpace;
        /** @type {[typeof __VLS_components.ElSpace, typeof __VLS_components.elSpace, typeof __VLS_components.ElSpace, typeof __VLS_components.elSpace, ]} */ ;
        // @ts-ignore
        const __VLS_429 = __VLS_asFunctionalComponent(__VLS_428, new __VLS_428({
            wrap: true,
            ...{ class: "query-row" },
        }));
        const __VLS_430 = __VLS_429({
            wrap: true,
            ...{ class: "query-row" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_429));
        __VLS_431.slots.default;
        const __VLS_432 = {}.ElFormItem;
        /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
        // @ts-ignore
        const __VLS_433 = __VLS_asFunctionalComponent(__VLS_432, new __VLS_432({
            label: "低库存阈值",
            ...{ class: "inline-form-item" },
        }));
        const __VLS_434 = __VLS_433({
            label: "低库存阈值",
            ...{ class: "inline-form-item" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_433));
        __VLS_435.slots.default;
        const __VLS_436 = {}.ElInputNumber;
        /** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
        // @ts-ignore
        const __VLS_437 = __VLS_asFunctionalComponent(__VLS_436, new __VLS_436({
            modelValue: (__VLS_ctx.lowStockThreshold),
            min: (1),
            max: (200),
            step: (1),
        }));
        const __VLS_438 = __VLS_437({
            modelValue: (__VLS_ctx.lowStockThreshold),
            min: (1),
            max: (200),
            step: (1),
        }, ...__VLS_functionalComponentArgsRest(__VLS_437));
        var __VLS_435;
        const __VLS_440 = {}.ElInput;
        /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
        // @ts-ignore
        const __VLS_441 = __VLS_asFunctionalComponent(__VLS_440, new __VLS_440({
            modelValue: (__VLS_ctx.lowStockKeyword),
            placeholder: "按菜品名/菜单菜品ID查询",
            ...{ class: "query-input-short" },
        }));
        const __VLS_442 = __VLS_441({
            modelValue: (__VLS_ctx.lowStockKeyword),
            placeholder: "按菜品名/菜单菜品ID查询",
            ...{ class: "query-input-short" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_441));
        var __VLS_431;
        if (__VLS_ctx.filteredLowStockDishes.length === 0) {
            const __VLS_444 = {}.ElEmpty;
            /** @type {[typeof __VLS_components.ElEmpty, typeof __VLS_components.elEmpty, ]} */ ;
            // @ts-ignore
            const __VLS_445 = __VLS_asFunctionalComponent(__VLS_444, new __VLS_444({
                description: (`当前无低库存菜品（阈值<=${__VLS_ctx.lowStockThreshold}）`),
            }));
            const __VLS_446 = __VLS_445({
                description: (`当前无低库存菜品（阈值<=${__VLS_ctx.lowStockThreshold}）`),
            }, ...__VLS_functionalComponentArgsRest(__VLS_445));
        }
        else {
            const __VLS_448 = {}.ElTable;
            /** @type {[typeof __VLS_components.ElTable, typeof __VLS_components.elTable, typeof __VLS_components.ElTable, typeof __VLS_components.elTable, ]} */ ;
            // @ts-ignore
            const __VLS_449 = __VLS_asFunctionalComponent(__VLS_448, new __VLS_448({
                data: (__VLS_ctx.filteredLowStockDishes),
                size: "small",
            }));
            const __VLS_450 = __VLS_449({
                data: (__VLS_ctx.filteredLowStockDishes),
                size: "small",
            }, ...__VLS_functionalComponentArgsRest(__VLS_449));
            __VLS_451.slots.default;
            const __VLS_452 = {}.ElTableColumn;
            /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
            // @ts-ignore
            const __VLS_453 = __VLS_asFunctionalComponent(__VLS_452, new __VLS_452({
                prop: "id",
                label: "菜单菜品ID",
                width: "100",
            }));
            const __VLS_454 = __VLS_453({
                prop: "id",
                label: "菜单菜品ID",
                width: "100",
            }, ...__VLS_functionalComponentArgsRest(__VLS_453));
            const __VLS_456 = {}.ElTableColumn;
            /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
            // @ts-ignore
            const __VLS_457 = __VLS_asFunctionalComponent(__VLS_456, new __VLS_456({
                prop: "dishName",
                label: "菜品",
                minWidth: "120",
            }));
            const __VLS_458 = __VLS_457({
                prop: "dishName",
                label: "菜品",
                minWidth: "120",
            }, ...__VLS_functionalComponentArgsRest(__VLS_457));
            const __VLS_460 = {}.ElTableColumn;
            /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
            // @ts-ignore
            const __VLS_461 = __VLS_asFunctionalComponent(__VLS_460, new __VLS_460({
                prop: "salePrice",
                label: "售价",
                width: "90",
            }));
            const __VLS_462 = __VLS_461({
                prop: "salePrice",
                label: "售价",
                width: "90",
            }, ...__VLS_functionalComponentArgsRest(__VLS_461));
            const __VLS_464 = {}.ElTableColumn;
            /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
            // @ts-ignore
            const __VLS_465 = __VLS_asFunctionalComponent(__VLS_464, new __VLS_464({
                prop: "stock",
                label: "剩余库存",
                width: "90",
            }));
            const __VLS_466 = __VLS_465({
                prop: "stock",
                label: "剩余库存",
                width: "90",
            }, ...__VLS_functionalComponentArgsRest(__VLS_465));
            const __VLS_468 = {}.ElTableColumn;
            /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
            // @ts-ignore
            const __VLS_469 = __VLS_asFunctionalComponent(__VLS_468, new __VLS_468({
                prop: "sold",
                label: "已售",
                width: "80",
            }));
            const __VLS_470 = __VLS_469({
                prop: "sold",
                label: "已售",
                width: "80",
            }, ...__VLS_functionalComponentArgsRest(__VLS_469));
            const __VLS_472 = {}.ElTableColumn;
            /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
            // @ts-ignore
            const __VLS_473 = __VLS_asFunctionalComponent(__VLS_472, new __VLS_472({
                prop: "status",
                label: "状态",
                width: "90",
            }));
            const __VLS_474 = __VLS_473({
                prop: "status",
                label: "状态",
                width: "90",
            }, ...__VLS_functionalComponentArgsRest(__VLS_473));
            __VLS_475.slots.default;
            {
                const { default: __VLS_thisSlot } = __VLS_475.slots;
                const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
                (row.status === 1 ? "上架" : "下架");
            }
            var __VLS_475;
            const __VLS_476 = {}.ElTableColumn;
            /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
            // @ts-ignore
            const __VLS_477 = __VLS_asFunctionalComponent(__VLS_476, new __VLS_476({
                label: "预警",
                width: "100",
            }));
            const __VLS_478 = __VLS_477({
                label: "预警",
                width: "100",
            }, ...__VLS_functionalComponentArgsRest(__VLS_477));
            __VLS_479.slots.default;
            {
                const { default: __VLS_thisSlot } = __VLS_479.slots;
                const __VLS_480 = {}.ElTag;
                /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
                // @ts-ignore
                const __VLS_481 = __VLS_asFunctionalComponent(__VLS_480, new __VLS_480({
                    type: "danger",
                    size: "small",
                }));
                const __VLS_482 = __VLS_481({
                    type: "danger",
                    size: "small",
                }, ...__VLS_functionalComponentArgsRest(__VLS_481));
                __VLS_483.slots.default;
                var __VLS_483;
            }
            var __VLS_479;
            const __VLS_484 = {}.ElTableColumn;
            /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
            // @ts-ignore
            const __VLS_485 = __VLS_asFunctionalComponent(__VLS_484, new __VLS_484({
                label: "操作",
                width: "100",
            }));
            const __VLS_486 = __VLS_485({
                label: "操作",
                width: "100",
            }, ...__VLS_functionalComponentArgsRest(__VLS_485));
            __VLS_487.slots.default;
            {
                const { default: __VLS_thisSlot } = __VLS_487.slots;
                const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
                const __VLS_488 = {}.ElButton;
                /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
                // @ts-ignore
                const __VLS_489 = __VLS_asFunctionalComponent(__VLS_488, new __VLS_488({
                    ...{ 'onClick': {} },
                    link: true,
                    type: "primary",
                    loading: (__VLS_ctx.menuDishDetailLoading),
                }));
                const __VLS_490 = __VLS_489({
                    ...{ 'onClick': {} },
                    link: true,
                    type: "primary",
                    loading: (__VLS_ctx.menuDishDetailLoading),
                }, ...__VLS_functionalComponentArgsRest(__VLS_489));
                let __VLS_492;
                let __VLS_493;
                let __VLS_494;
                const __VLS_495 = {
                    onClick: (...[$event]) => {
                        if (!!(__VLS_ctx.isUser && __VLS_ctx.activeSection === __VLS_ctx.sectionIdMap.userOrders))
                            return;
                        if (!(__VLS_ctx.isMerchant))
                            return;
                        if (!(__VLS_ctx.activeSection === __VLS_ctx.sectionIdMap.merchantStock))
                            return;
                        if (!!(__VLS_ctx.filteredLowStockDishes.length === 0))
                            return;
                        __VLS_ctx.showMenuDishDetail(row.id);
                    }
                };
                __VLS_491.slots.default;
                var __VLS_491;
            }
            var __VLS_487;
            var __VLS_451;
        }
        var __VLS_427;
        var __VLS_423;
    }
    if (__VLS_ctx.activeSection === __VLS_ctx.sectionIdMap.merchantDish) {
        const __VLS_496 = {}.ElCol;
        /** @type {[typeof __VLS_components.ElCol, typeof __VLS_components.elCol, typeof __VLS_components.ElCol, typeof __VLS_components.elCol, ]} */ ;
        // @ts-ignore
        const __VLS_497 = __VLS_asFunctionalComponent(__VLS_496, new __VLS_496({
            span: (24),
            ...{ class: "block" },
        }));
        const __VLS_498 = __VLS_497({
            span: (24),
            ...{ class: "block" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_497));
        __VLS_499.slots.default;
        const __VLS_500 = {}.ElCard;
        /** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
        // @ts-ignore
        const __VLS_501 = __VLS_asFunctionalComponent(__VLS_500, new __VLS_500({
            id: (__VLS_ctx.sectionIdMap.merchantDish),
        }));
        const __VLS_502 = __VLS_501({
            id: (__VLS_ctx.sectionIdMap.merchantDish),
        }, ...__VLS_functionalComponentArgsRest(__VLS_501));
        __VLS_503.slots.default;
        {
            const { header: __VLS_thisSlot } = __VLS_503.slots;
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "section-head" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
            __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
        }
        const __VLS_504 = {}.ElAlert;
        /** @type {[typeof __VLS_components.ElAlert, typeof __VLS_components.elAlert, ]} */ ;
        // @ts-ignore
        const __VLS_505 = __VLS_asFunctionalComponent(__VLS_504, new __VLS_504({
            type: "warning",
            closable: (false),
            title: "已发布菜单中的菜品不允许直接编辑/上下架/删除。",
            ...{ class: "tip-alert" },
        }));
        const __VLS_506 = __VLS_505({
            type: "warning",
            closable: (false),
            title: "已发布菜单中的菜品不允许直接编辑/上下架/删除。",
            ...{ class: "tip-alert" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_505));
        const __VLS_508 = {}.ElInput;
        /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
        // @ts-ignore
        const __VLS_509 = __VLS_asFunctionalComponent(__VLS_508, new __VLS_508({
            modelValue: (__VLS_ctx.dishKeyword),
            placeholder: "按菜品名/ID/分类查询",
            ...{ class: "query-input" },
        }));
        const __VLS_510 = __VLS_509({
            modelValue: (__VLS_ctx.dishKeyword),
            placeholder: "按菜品名/ID/分类查询",
            ...{ class: "query-input" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_509));
        const __VLS_512 = {}.ElForm;
        /** @type {[typeof __VLS_components.ElForm, typeof __VLS_components.elForm, typeof __VLS_components.ElForm, typeof __VLS_components.elForm, ]} */ ;
        // @ts-ignore
        const __VLS_513 = __VLS_asFunctionalComponent(__VLS_512, new __VLS_512({
            inline: true,
        }));
        const __VLS_514 = __VLS_513({
            inline: true,
        }, ...__VLS_functionalComponentArgsRest(__VLS_513));
        __VLS_515.slots.default;
        const __VLS_516 = {}.ElFormItem;
        /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
        // @ts-ignore
        const __VLS_517 = __VLS_asFunctionalComponent(__VLS_516, new __VLS_516({
            label: "名称",
        }));
        const __VLS_518 = __VLS_517({
            label: "名称",
        }, ...__VLS_functionalComponentArgsRest(__VLS_517));
        __VLS_519.slots.default;
        const __VLS_520 = {}.ElInput;
        /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
        // @ts-ignore
        const __VLS_521 = __VLS_asFunctionalComponent(__VLS_520, new __VLS_520({
            modelValue: (__VLS_ctx.dishForm.name),
            placeholder: "例如：宫保鸡丁",
        }));
        const __VLS_522 = __VLS_521({
            modelValue: (__VLS_ctx.dishForm.name),
            placeholder: "例如：宫保鸡丁",
        }, ...__VLS_functionalComponentArgsRest(__VLS_521));
        var __VLS_519;
        const __VLS_524 = {}.ElFormItem;
        /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
        // @ts-ignore
        const __VLS_525 = __VLS_asFunctionalComponent(__VLS_524, new __VLS_524({
            label: "价格",
        }));
        const __VLS_526 = __VLS_525({
            label: "价格",
        }, ...__VLS_functionalComponentArgsRest(__VLS_525));
        __VLS_527.slots.default;
        const __VLS_528 = {}.ElInputNumber;
        /** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
        // @ts-ignore
        const __VLS_529 = __VLS_asFunctionalComponent(__VLS_528, new __VLS_528({
            modelValue: (__VLS_ctx.dishForm.price),
            min: (0.01),
            step: (0.5),
        }));
        const __VLS_530 = __VLS_529({
            modelValue: (__VLS_ctx.dishForm.price),
            min: (0.01),
            step: (0.5),
        }, ...__VLS_functionalComponentArgsRest(__VLS_529));
        var __VLS_527;
        const __VLS_532 = {}.ElFormItem;
        /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
        // @ts-ignore
        const __VLS_533 = __VLS_asFunctionalComponent(__VLS_532, new __VLS_532({
            label: "分类",
        }));
        const __VLS_534 = __VLS_533({
            label: "分类",
        }, ...__VLS_functionalComponentArgsRest(__VLS_533));
        __VLS_535.slots.default;
        const __VLS_536 = {}.ElInput;
        /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
        // @ts-ignore
        const __VLS_537 = __VLS_asFunctionalComponent(__VLS_536, new __VLS_536({
            modelValue: (__VLS_ctx.dishForm.category),
            placeholder: "主食/小吃/饮料",
        }));
        const __VLS_538 = __VLS_537({
            modelValue: (__VLS_ctx.dishForm.category),
            placeholder: "主食/小吃/饮料",
        }, ...__VLS_functionalComponentArgsRest(__VLS_537));
        var __VLS_535;
        const __VLS_540 = {}.ElFormItem;
        /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
        // @ts-ignore
        const __VLS_541 = __VLS_asFunctionalComponent(__VLS_540, new __VLS_540({}));
        const __VLS_542 = __VLS_541({}, ...__VLS_functionalComponentArgsRest(__VLS_541));
        __VLS_543.slots.default;
        const __VLS_544 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        const __VLS_545 = __VLS_asFunctionalComponent(__VLS_544, new __VLS_544({
            ...{ 'onClick': {} },
            type: "primary",
            loading: (__VLS_ctx.creatingDish),
        }));
        const __VLS_546 = __VLS_545({
            ...{ 'onClick': {} },
            type: "primary",
            loading: (__VLS_ctx.creatingDish),
        }, ...__VLS_functionalComponentArgsRest(__VLS_545));
        let __VLS_548;
        let __VLS_549;
        let __VLS_550;
        const __VLS_551 = {
            onClick: (__VLS_ctx.saveDish)
        };
        __VLS_547.slots.default;
        (__VLS_ctx.dishForm.id ? "更新菜品" : "新增菜品");
        var __VLS_547;
        if (__VLS_ctx.dishForm.id) {
            const __VLS_552 = {}.ElButton;
            /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
            // @ts-ignore
            const __VLS_553 = __VLS_asFunctionalComponent(__VLS_552, new __VLS_552({
                ...{ 'onClick': {} },
            }));
            const __VLS_554 = __VLS_553({
                ...{ 'onClick': {} },
            }, ...__VLS_functionalComponentArgsRest(__VLS_553));
            let __VLS_556;
            let __VLS_557;
            let __VLS_558;
            const __VLS_559 = {
                onClick: (__VLS_ctx.resetDishForm)
            };
            __VLS_555.slots.default;
            var __VLS_555;
        }
        var __VLS_543;
        var __VLS_515;
        const __VLS_560 = {}.ElTable;
        /** @type {[typeof __VLS_components.ElTable, typeof __VLS_components.elTable, typeof __VLS_components.ElTable, typeof __VLS_components.elTable, ]} */ ;
        // @ts-ignore
        const __VLS_561 = __VLS_asFunctionalComponent(__VLS_560, new __VLS_560({
            data: (__VLS_ctx.filteredMerchantDishes),
            size: "small",
        }));
        const __VLS_562 = __VLS_561({
            data: (__VLS_ctx.filteredMerchantDishes),
            size: "small",
        }, ...__VLS_functionalComponentArgsRest(__VLS_561));
        __VLS_563.slots.default;
        const __VLS_564 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_565 = __VLS_asFunctionalComponent(__VLS_564, new __VLS_564({
            prop: "id",
            label: "ID",
            width: "70",
        }));
        const __VLS_566 = __VLS_565({
            prop: "id",
            label: "ID",
            width: "70",
        }, ...__VLS_functionalComponentArgsRest(__VLS_565));
        const __VLS_568 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_569 = __VLS_asFunctionalComponent(__VLS_568, new __VLS_568({
            prop: "name",
            label: "菜品",
            minWidth: "120",
        }));
        const __VLS_570 = __VLS_569({
            prop: "name",
            label: "菜品",
            minWidth: "120",
        }, ...__VLS_functionalComponentArgsRest(__VLS_569));
        const __VLS_572 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_573 = __VLS_asFunctionalComponent(__VLS_572, new __VLS_572({
            prop: "price",
            label: "价格",
            width: "90",
        }));
        const __VLS_574 = __VLS_573({
            prop: "price",
            label: "价格",
            width: "90",
        }, ...__VLS_functionalComponentArgsRest(__VLS_573));
        const __VLS_576 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_577 = __VLS_asFunctionalComponent(__VLS_576, new __VLS_576({
            prop: "category",
            label: "分类",
            width: "90",
        }));
        const __VLS_578 = __VLS_577({
            prop: "category",
            label: "分类",
            width: "90",
        }, ...__VLS_functionalComponentArgsRest(__VLS_577));
        const __VLS_580 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_581 = __VLS_asFunctionalComponent(__VLS_580, new __VLS_580({
            prop: "status",
            label: "状态",
            width: "90",
        }));
        const __VLS_582 = __VLS_581({
            prop: "status",
            label: "状态",
            width: "90",
        }, ...__VLS_functionalComponentArgsRest(__VLS_581));
        __VLS_583.slots.default;
        {
            const { default: __VLS_thisSlot } = __VLS_583.slots;
            const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
            (row.status === 1 ? "上架" : "下架");
        }
        var __VLS_583;
        const __VLS_584 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_585 = __VLS_asFunctionalComponent(__VLS_584, new __VLS_584({
            label: "操作",
            minWidth: "260",
        }));
        const __VLS_586 = __VLS_585({
            label: "操作",
            minWidth: "260",
        }, ...__VLS_functionalComponentArgsRest(__VLS_585));
        __VLS_587.slots.default;
        {
            const { default: __VLS_thisSlot } = __VLS_587.slots;
            const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
            const __VLS_588 = {}.ElSpace;
            /** @type {[typeof __VLS_components.ElSpace, typeof __VLS_components.elSpace, typeof __VLS_components.ElSpace, typeof __VLS_components.elSpace, ]} */ ;
            // @ts-ignore
            const __VLS_589 = __VLS_asFunctionalComponent(__VLS_588, new __VLS_588({
                wrap: true,
            }));
            const __VLS_590 = __VLS_589({
                wrap: true,
            }, ...__VLS_functionalComponentArgsRest(__VLS_589));
            __VLS_591.slots.default;
            const __VLS_592 = {}.ElButton;
            /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
            // @ts-ignore
            const __VLS_593 = __VLS_asFunctionalComponent(__VLS_592, new __VLS_592({
                ...{ 'onClick': {} },
                size: "small",
                disabled: (__VLS_ctx.publishedDishIdSet.has(row.id)),
            }));
            const __VLS_594 = __VLS_593({
                ...{ 'onClick': {} },
                size: "small",
                disabled: (__VLS_ctx.publishedDishIdSet.has(row.id)),
            }, ...__VLS_functionalComponentArgsRest(__VLS_593));
            let __VLS_596;
            let __VLS_597;
            let __VLS_598;
            const __VLS_599 = {
                onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.isUser && __VLS_ctx.activeSection === __VLS_ctx.sectionIdMap.userOrders))
                        return;
                    if (!(__VLS_ctx.isMerchant))
                        return;
                    if (!(__VLS_ctx.activeSection === __VLS_ctx.sectionIdMap.merchantDish))
                        return;
                    __VLS_ctx.editDish(row);
                }
            };
            __VLS_595.slots.default;
            var __VLS_595;
            const __VLS_600 = {}.ElButton;
            /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
            // @ts-ignore
            const __VLS_601 = __VLS_asFunctionalComponent(__VLS_600, new __VLS_600({
                ...{ 'onClick': {} },
                size: "small",
                disabled: (__VLS_ctx.publishedDishIdSet.has(row.id)),
                type: (row.status === 1 ? 'warning' : 'success'),
            }));
            const __VLS_602 = __VLS_601({
                ...{ 'onClick': {} },
                size: "small",
                disabled: (__VLS_ctx.publishedDishIdSet.has(row.id)),
                type: (row.status === 1 ? 'warning' : 'success'),
            }, ...__VLS_functionalComponentArgsRest(__VLS_601));
            let __VLS_604;
            let __VLS_605;
            let __VLS_606;
            const __VLS_607 = {
                onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.isUser && __VLS_ctx.activeSection === __VLS_ctx.sectionIdMap.userOrders))
                        return;
                    if (!(__VLS_ctx.isMerchant))
                        return;
                    if (!(__VLS_ctx.activeSection === __VLS_ctx.sectionIdMap.merchantDish))
                        return;
                    __VLS_ctx.toggleDishStatus(row);
                }
            };
            __VLS_603.slots.default;
            (row.status === 1 ? "下架" : "上架");
            var __VLS_603;
            const __VLS_608 = {}.ElButton;
            /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
            // @ts-ignore
            const __VLS_609 = __VLS_asFunctionalComponent(__VLS_608, new __VLS_608({
                ...{ 'onClick': {} },
                size: "small",
                type: "danger",
                disabled: (__VLS_ctx.publishedDishIdSet.has(row.id)),
            }));
            const __VLS_610 = __VLS_609({
                ...{ 'onClick': {} },
                size: "small",
                type: "danger",
                disabled: (__VLS_ctx.publishedDishIdSet.has(row.id)),
            }, ...__VLS_functionalComponentArgsRest(__VLS_609));
            let __VLS_612;
            let __VLS_613;
            let __VLS_614;
            const __VLS_615 = {
                onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.isUser && __VLS_ctx.activeSection === __VLS_ctx.sectionIdMap.userOrders))
                        return;
                    if (!(__VLS_ctx.isMerchant))
                        return;
                    if (!(__VLS_ctx.activeSection === __VLS_ctx.sectionIdMap.merchantDish))
                        return;
                    __VLS_ctx.removeDish(row.id);
                }
            };
            __VLS_611.slots.default;
            var __VLS_611;
            var __VLS_591;
        }
        var __VLS_587;
        var __VLS_563;
        var __VLS_503;
        var __VLS_499;
    }
    if (__VLS_ctx.activeSection === __VLS_ctx.sectionIdMap.merchantMenu) {
        const __VLS_616 = {}.ElCol;
        /** @type {[typeof __VLS_components.ElCol, typeof __VLS_components.elCol, typeof __VLS_components.ElCol, typeof __VLS_components.elCol, ]} */ ;
        // @ts-ignore
        const __VLS_617 = __VLS_asFunctionalComponent(__VLS_616, new __VLS_616({
            span: (24),
            ...{ class: "block" },
        }));
        const __VLS_618 = __VLS_617({
            span: (24),
            ...{ class: "block" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_617));
        __VLS_619.slots.default;
        const __VLS_620 = {}.ElCard;
        /** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
        // @ts-ignore
        const __VLS_621 = __VLS_asFunctionalComponent(__VLS_620, new __VLS_620({
            id: (__VLS_ctx.sectionIdMap.merchantMenu),
        }));
        const __VLS_622 = __VLS_621({
            id: (__VLS_ctx.sectionIdMap.merchantMenu),
        }, ...__VLS_functionalComponentArgsRest(__VLS_621));
        __VLS_623.slots.default;
        {
            const { header: __VLS_thisSlot } = __VLS_623.slots;
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "section-head" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
            __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
        }
        const __VLS_624 = {}.ElForm;
        /** @type {[typeof __VLS_components.ElForm, typeof __VLS_components.elForm, typeof __VLS_components.ElForm, typeof __VLS_components.elForm, ]} */ ;
        // @ts-ignore
        const __VLS_625 = __VLS_asFunctionalComponent(__VLS_624, new __VLS_624({
            inline: true,
        }));
        const __VLS_626 = __VLS_625({
            inline: true,
        }, ...__VLS_functionalComponentArgsRest(__VLS_625));
        __VLS_627.slots.default;
        const __VLS_628 = {}.ElFormItem;
        /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
        // @ts-ignore
        const __VLS_629 = __VLS_asFunctionalComponent(__VLS_628, new __VLS_628({
            label: "菜单名称",
        }));
        const __VLS_630 = __VLS_629({
            label: "菜单名称",
        }, ...__VLS_functionalComponentArgsRest(__VLS_629));
        __VLS_631.slots.default;
        const __VLS_632 = {}.ElInput;
        /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
        // @ts-ignore
        const __VLS_633 = __VLS_asFunctionalComponent(__VLS_632, new __VLS_632({
            modelValue: (__VLS_ctx.menuForm.name),
        }));
        const __VLS_634 = __VLS_633({
            modelValue: (__VLS_ctx.menuForm.name),
        }, ...__VLS_functionalComponentArgsRest(__VLS_633));
        var __VLS_631;
        const __VLS_636 = {}.ElFormItem;
        /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
        // @ts-ignore
        const __VLS_637 = __VLS_asFunctionalComponent(__VLS_636, new __VLS_636({
            label: "日期",
        }));
        const __VLS_638 = __VLS_637({
            label: "日期",
        }, ...__VLS_functionalComponentArgsRest(__VLS_637));
        __VLS_639.slots.default;
        const __VLS_640 = {}.ElDatePicker;
        /** @type {[typeof __VLS_components.ElDatePicker, typeof __VLS_components.elDatePicker, ]} */ ;
        // @ts-ignore
        const __VLS_641 = __VLS_asFunctionalComponent(__VLS_640, new __VLS_640({
            modelValue: (__VLS_ctx.menuForm.saleDate),
            type: "date",
            valueFormat: "YYYY-MM-DD",
        }));
        const __VLS_642 = __VLS_641({
            modelValue: (__VLS_ctx.menuForm.saleDate),
            type: "date",
            valueFormat: "YYYY-MM-DD",
        }, ...__VLS_functionalComponentArgsRest(__VLS_641));
        var __VLS_639;
        const __VLS_644 = {}.ElFormItem;
        /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
        // @ts-ignore
        const __VLS_645 = __VLS_asFunctionalComponent(__VLS_644, new __VLS_644({
            label: "开始",
        }));
        const __VLS_646 = __VLS_645({
            label: "开始",
        }, ...__VLS_functionalComponentArgsRest(__VLS_645));
        __VLS_647.slots.default;
        const __VLS_648 = {}.ElTimePicker;
        /** @type {[typeof __VLS_components.ElTimePicker, typeof __VLS_components.elTimePicker, ]} */ ;
        // @ts-ignore
        const __VLS_649 = __VLS_asFunctionalComponent(__VLS_648, new __VLS_648({
            modelValue: (__VLS_ctx.menuForm.startTime),
            valueFormat: "HH:mm:ss",
        }));
        const __VLS_650 = __VLS_649({
            modelValue: (__VLS_ctx.menuForm.startTime),
            valueFormat: "HH:mm:ss",
        }, ...__VLS_functionalComponentArgsRest(__VLS_649));
        var __VLS_647;
        const __VLS_652 = {}.ElFormItem;
        /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
        // @ts-ignore
        const __VLS_653 = __VLS_asFunctionalComponent(__VLS_652, new __VLS_652({
            label: "结束",
        }));
        const __VLS_654 = __VLS_653({
            label: "结束",
        }, ...__VLS_functionalComponentArgsRest(__VLS_653));
        __VLS_655.slots.default;
        const __VLS_656 = {}.ElTimePicker;
        /** @type {[typeof __VLS_components.ElTimePicker, typeof __VLS_components.elTimePicker, ]} */ ;
        // @ts-ignore
        const __VLS_657 = __VLS_asFunctionalComponent(__VLS_656, new __VLS_656({
            modelValue: (__VLS_ctx.menuForm.endTime),
            valueFormat: "HH:mm:ss",
        }));
        const __VLS_658 = __VLS_657({
            modelValue: (__VLS_ctx.menuForm.endTime),
            valueFormat: "HH:mm:ss",
        }, ...__VLS_functionalComponentArgsRest(__VLS_657));
        var __VLS_655;
        var __VLS_627;
        const __VLS_660 = {}.ElTable;
        /** @type {[typeof __VLS_components.ElTable, typeof __VLS_components.elTable, typeof __VLS_components.ElTable, typeof __VLS_components.elTable, ]} */ ;
        // @ts-ignore
        const __VLS_661 = __VLS_asFunctionalComponent(__VLS_660, new __VLS_660({
            data: (__VLS_ctx.merchantDishes),
            size: "small",
        }));
        const __VLS_662 = __VLS_661({
            data: (__VLS_ctx.merchantDishes),
            size: "small",
        }, ...__VLS_functionalComponentArgsRest(__VLS_661));
        __VLS_663.slots.default;
        const __VLS_664 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_665 = __VLS_asFunctionalComponent(__VLS_664, new __VLS_664({
            prop: "name",
            label: "菜品",
            minWidth: "120",
        }));
        const __VLS_666 = __VLS_665({
            prop: "name",
            label: "菜品",
            minWidth: "120",
        }, ...__VLS_functionalComponentArgsRest(__VLS_665));
        const __VLS_668 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_669 = __VLS_asFunctionalComponent(__VLS_668, new __VLS_668({
            label: "售价",
            width: "130",
        }));
        const __VLS_670 = __VLS_669({
            label: "售价",
            width: "130",
        }, ...__VLS_functionalComponentArgsRest(__VLS_669));
        __VLS_671.slots.default;
        {
            const { default: __VLS_thisSlot } = __VLS_671.slots;
            const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
            const __VLS_672 = {}.ElInputNumber;
            /** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
            // @ts-ignore
            const __VLS_673 = __VLS_asFunctionalComponent(__VLS_672, new __VLS_672({
                modelValue: (__VLS_ctx.menuItemMap[row.id].salePrice),
                min: (0.01),
                step: (0.5),
                size: "small",
            }));
            const __VLS_674 = __VLS_673({
                modelValue: (__VLS_ctx.menuItemMap[row.id].salePrice),
                min: (0.01),
                step: (0.5),
                size: "small",
            }, ...__VLS_functionalComponentArgsRest(__VLS_673));
        }
        var __VLS_671;
        const __VLS_676 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_677 = __VLS_asFunctionalComponent(__VLS_676, new __VLS_676({
            label: "库存",
            width: "120",
        }));
        const __VLS_678 = __VLS_677({
            label: "库存",
            width: "120",
        }, ...__VLS_functionalComponentArgsRest(__VLS_677));
        __VLS_679.slots.default;
        {
            const { default: __VLS_thisSlot } = __VLS_679.slots;
            const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
            const __VLS_680 = {}.ElInputNumber;
            /** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
            // @ts-ignore
            const __VLS_681 = __VLS_asFunctionalComponent(__VLS_680, new __VLS_680({
                modelValue: (__VLS_ctx.menuItemMap[row.id].stock),
                min: (0),
                step: (10),
                size: "small",
            }));
            const __VLS_682 = __VLS_681({
                modelValue: (__VLS_ctx.menuItemMap[row.id].stock),
                min: (0),
                step: (10),
                size: "small",
            }, ...__VLS_functionalComponentArgsRest(__VLS_681));
        }
        var __VLS_679;
        const __VLS_684 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_685 = __VLS_asFunctionalComponent(__VLS_684, new __VLS_684({
            label: "入选",
            width: "100",
        }));
        const __VLS_686 = __VLS_685({
            label: "入选",
            width: "100",
        }, ...__VLS_functionalComponentArgsRest(__VLS_685));
        __VLS_687.slots.default;
        {
            const { default: __VLS_thisSlot } = __VLS_687.slots;
            const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
            const __VLS_688 = {}.ElSwitch;
            /** @type {[typeof __VLS_components.ElSwitch, typeof __VLS_components.elSwitch, ]} */ ;
            // @ts-ignore
            const __VLS_689 = __VLS_asFunctionalComponent(__VLS_688, new __VLS_688({
                modelValue: (__VLS_ctx.menuItemMap[row.id].enabled),
            }));
            const __VLS_690 = __VLS_689({
                modelValue: (__VLS_ctx.menuItemMap[row.id].enabled),
            }, ...__VLS_functionalComponentArgsRest(__VLS_689));
        }
        var __VLS_687;
        var __VLS_663;
        const __VLS_692 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        const __VLS_693 = __VLS_asFunctionalComponent(__VLS_692, new __VLS_692({
            ...{ 'onClick': {} },
            ...{ class: "publish-btn" },
            type: "primary",
            loading: (__VLS_ctx.publishingMenu),
        }));
        const __VLS_694 = __VLS_693({
            ...{ 'onClick': {} },
            ...{ class: "publish-btn" },
            type: "primary",
            loading: (__VLS_ctx.publishingMenu),
        }, ...__VLS_functionalComponentArgsRest(__VLS_693));
        let __VLS_696;
        let __VLS_697;
        let __VLS_698;
        const __VLS_699 = {
            onClick: (__VLS_ctx.publishMenu)
        };
        __VLS_695.slots.default;
        var __VLS_695;
        var __VLS_623;
        var __VLS_619;
    }
    var __VLS_239;
}
else {
    const __VLS_700 = {}.ElRow;
    /** @type {[typeof __VLS_components.ElRow, typeof __VLS_components.elRow, typeof __VLS_components.ElRow, typeof __VLS_components.elRow, ]} */ ;
    // @ts-ignore
    const __VLS_701 = __VLS_asFunctionalComponent(__VLS_700, new __VLS_700({
        gutter: (16),
    }));
    const __VLS_702 = __VLS_701({
        gutter: (16),
    }, ...__VLS_functionalComponentArgsRest(__VLS_701));
    __VLS_703.slots.default;
    if (__VLS_ctx.activeSection === __VLS_ctx.sectionIdMap.adminCreateWindow) {
        const __VLS_704 = {}.ElCol;
        /** @type {[typeof __VLS_components.ElCol, typeof __VLS_components.elCol, typeof __VLS_components.ElCol, typeof __VLS_components.elCol, ]} */ ;
        // @ts-ignore
        const __VLS_705 = __VLS_asFunctionalComponent(__VLS_704, new __VLS_704({
            span: (24),
        }));
        const __VLS_706 = __VLS_705({
            span: (24),
        }, ...__VLS_functionalComponentArgsRest(__VLS_705));
        __VLS_707.slots.default;
        const __VLS_708 = {}.ElCard;
        /** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
        // @ts-ignore
        const __VLS_709 = __VLS_asFunctionalComponent(__VLS_708, new __VLS_708({
            id: (__VLS_ctx.sectionIdMap.adminCreateWindow),
        }));
        const __VLS_710 = __VLS_709({
            id: (__VLS_ctx.sectionIdMap.adminCreateWindow),
        }, ...__VLS_functionalComponentArgsRest(__VLS_709));
        __VLS_711.slots.default;
        {
            const { header: __VLS_thisSlot } = __VLS_711.slots;
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "section-head" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
            __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
        }
        const __VLS_712 = {}.ElForm;
        /** @type {[typeof __VLS_components.ElForm, typeof __VLS_components.elForm, typeof __VLS_components.ElForm, typeof __VLS_components.elForm, ]} */ ;
        // @ts-ignore
        const __VLS_713 = __VLS_asFunctionalComponent(__VLS_712, new __VLS_712({
            labelWidth: "95px",
        }));
        const __VLS_714 = __VLS_713({
            labelWidth: "95px",
        }, ...__VLS_functionalComponentArgsRest(__VLS_713));
        __VLS_715.slots.default;
        const __VLS_716 = {}.ElFormItem;
        /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
        // @ts-ignore
        const __VLS_717 = __VLS_asFunctionalComponent(__VLS_716, new __VLS_716({
            label: "窗口名称",
        }));
        const __VLS_718 = __VLS_717({
            label: "窗口名称",
        }, ...__VLS_functionalComponentArgsRest(__VLS_717));
        __VLS_719.slots.default;
        const __VLS_720 = {}.ElInput;
        /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
        // @ts-ignore
        const __VLS_721 = __VLS_asFunctionalComponent(__VLS_720, new __VLS_720({
            modelValue: (__VLS_ctx.windowForm.name),
            placeholder: "例如：1号档口-盖浇饭",
        }));
        const __VLS_722 = __VLS_721({
            modelValue: (__VLS_ctx.windowForm.name),
            placeholder: "例如：1号档口-盖浇饭",
        }, ...__VLS_functionalComponentArgsRest(__VLS_721));
        var __VLS_719;
        const __VLS_724 = {}.ElFormItem;
        /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
        // @ts-ignore
        const __VLS_725 = __VLS_asFunctionalComponent(__VLS_724, new __VLS_724({
            label: "位置",
        }));
        const __VLS_726 = __VLS_725({
            label: "位置",
        }, ...__VLS_functionalComponentArgsRest(__VLS_725));
        __VLS_727.slots.default;
        const __VLS_728 = {}.ElInput;
        /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
        // @ts-ignore
        const __VLS_729 = __VLS_asFunctionalComponent(__VLS_728, new __VLS_728({
            modelValue: (__VLS_ctx.windowForm.location),
            placeholder: "例如：食堂一楼东侧",
        }));
        const __VLS_730 = __VLS_729({
            modelValue: (__VLS_ctx.windowForm.location),
            placeholder: "例如：食堂一楼东侧",
        }, ...__VLS_functionalComponentArgsRest(__VLS_729));
        var __VLS_727;
        const __VLS_732 = {}.ElFormItem;
        /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
        // @ts-ignore
        const __VLS_733 = __VLS_asFunctionalComponent(__VLS_732, new __VLS_732({
            label: "商家账号",
        }));
        const __VLS_734 = __VLS_733({
            label: "商家账号",
        }, ...__VLS_functionalComponentArgsRest(__VLS_733));
        __VLS_735.slots.default;
        const __VLS_736 = {}.ElSelect;
        /** @type {[typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, ]} */ ;
        // @ts-ignore
        const __VLS_737 = __VLS_asFunctionalComponent(__VLS_736, new __VLS_736({
            modelValue: (__VLS_ctx.windowForm.merchantId),
            placeholder: "请选择商家",
            ...{ style: {} },
        }));
        const __VLS_738 = __VLS_737({
            modelValue: (__VLS_ctx.windowForm.merchantId),
            placeholder: "请选择商家",
            ...{ style: {} },
        }, ...__VLS_functionalComponentArgsRest(__VLS_737));
        __VLS_739.slots.default;
        for (const [m] of __VLS_getVForSourceType((__VLS_ctx.merchantUsers))) {
            const __VLS_740 = {}.ElOption;
            /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
            // @ts-ignore
            const __VLS_741 = __VLS_asFunctionalComponent(__VLS_740, new __VLS_740({
                key: (m.id),
                label: (`${m.nickname} (${m.phone})`),
                value: (m.id),
            }));
            const __VLS_742 = __VLS_741({
                key: (m.id),
                label: (`${m.nickname} (${m.phone})`),
                value: (m.id),
            }, ...__VLS_functionalComponentArgsRest(__VLS_741));
        }
        var __VLS_739;
        var __VLS_735;
        const __VLS_744 = {}.ElFormItem;
        /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
        // @ts-ignore
        const __VLS_745 = __VLS_asFunctionalComponent(__VLS_744, new __VLS_744({
            label: "叫号前缀",
        }));
        const __VLS_746 = __VLS_745({
            label: "叫号前缀",
        }, ...__VLS_functionalComponentArgsRest(__VLS_745));
        __VLS_747.slots.default;
        const __VLS_748 = {}.ElInput;
        /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
        // @ts-ignore
        const __VLS_749 = __VLS_asFunctionalComponent(__VLS_748, new __VLS_748({
            modelValue: (__VLS_ctx.windowForm.pickupPrefix),
            maxlength: "2",
            placeholder: "例如：A",
        }));
        const __VLS_750 = __VLS_749({
            modelValue: (__VLS_ctx.windowForm.pickupPrefix),
            maxlength: "2",
            placeholder: "例如：A",
        }, ...__VLS_functionalComponentArgsRest(__VLS_749));
        var __VLS_747;
        const __VLS_752 = {}.ElFormItem;
        /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
        // @ts-ignore
        const __VLS_753 = __VLS_asFunctionalComponent(__VLS_752, new __VLS_752({}));
        const __VLS_754 = __VLS_753({}, ...__VLS_functionalComponentArgsRest(__VLS_753));
        __VLS_755.slots.default;
        const __VLS_756 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        const __VLS_757 = __VLS_asFunctionalComponent(__VLS_756, new __VLS_756({
            ...{ 'onClick': {} },
            type: "primary",
            loading: (__VLS_ctx.creatingWindow),
        }));
        const __VLS_758 = __VLS_757({
            ...{ 'onClick': {} },
            type: "primary",
            loading: (__VLS_ctx.creatingWindow),
        }, ...__VLS_functionalComponentArgsRest(__VLS_757));
        let __VLS_760;
        let __VLS_761;
        let __VLS_762;
        const __VLS_763 = {
            onClick: (__VLS_ctx.createWindow)
        };
        __VLS_759.slots.default;
        var __VLS_759;
        var __VLS_755;
        var __VLS_715;
        var __VLS_711;
        var __VLS_707;
    }
    if (__VLS_ctx.activeSection === __VLS_ctx.sectionIdMap.adminWindows) {
        const __VLS_764 = {}.ElCol;
        /** @type {[typeof __VLS_components.ElCol, typeof __VLS_components.elCol, typeof __VLS_components.ElCol, typeof __VLS_components.elCol, ]} */ ;
        // @ts-ignore
        const __VLS_765 = __VLS_asFunctionalComponent(__VLS_764, new __VLS_764({
            span: (24),
        }));
        const __VLS_766 = __VLS_765({
            span: (24),
        }, ...__VLS_functionalComponentArgsRest(__VLS_765));
        __VLS_767.slots.default;
        const __VLS_768 = {}.ElCard;
        /** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
        // @ts-ignore
        const __VLS_769 = __VLS_asFunctionalComponent(__VLS_768, new __VLS_768({
            id: (__VLS_ctx.sectionIdMap.adminWindows),
        }));
        const __VLS_770 = __VLS_769({
            id: (__VLS_ctx.sectionIdMap.adminWindows),
        }, ...__VLS_functionalComponentArgsRest(__VLS_769));
        __VLS_771.slots.default;
        {
            const { header: __VLS_thisSlot } = __VLS_771.slots;
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "section-head" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
            __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
        }
        const __VLS_772 = {}.ElInput;
        /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
        // @ts-ignore
        const __VLS_773 = __VLS_asFunctionalComponent(__VLS_772, new __VLS_772({
            modelValue: (__VLS_ctx.windowKeyword),
            placeholder: "按窗口名/位置/商家ID查询",
            ...{ class: "query-input" },
        }));
        const __VLS_774 = __VLS_773({
            modelValue: (__VLS_ctx.windowKeyword),
            placeholder: "按窗口名/位置/商家ID查询",
            ...{ class: "query-input" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_773));
        const __VLS_776 = {}.ElTable;
        /** @type {[typeof __VLS_components.ElTable, typeof __VLS_components.elTable, typeof __VLS_components.ElTable, typeof __VLS_components.elTable, ]} */ ;
        // @ts-ignore
        const __VLS_777 = __VLS_asFunctionalComponent(__VLS_776, new __VLS_776({
            data: (__VLS_ctx.filteredWindows),
            size: "small",
        }));
        const __VLS_778 = __VLS_777({
            data: (__VLS_ctx.filteredWindows),
            size: "small",
        }, ...__VLS_functionalComponentArgsRest(__VLS_777));
        __VLS_779.slots.default;
        const __VLS_780 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_781 = __VLS_asFunctionalComponent(__VLS_780, new __VLS_780({
            prop: "id",
            label: "ID",
            width: "70",
        }));
        const __VLS_782 = __VLS_781({
            prop: "id",
            label: "ID",
            width: "70",
        }, ...__VLS_functionalComponentArgsRest(__VLS_781));
        const __VLS_784 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_785 = __VLS_asFunctionalComponent(__VLS_784, new __VLS_784({
            prop: "name",
            label: "窗口名称",
            minWidth: "120",
        }));
        const __VLS_786 = __VLS_785({
            prop: "name",
            label: "窗口名称",
            minWidth: "120",
        }, ...__VLS_functionalComponentArgsRest(__VLS_785));
        const __VLS_788 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_789 = __VLS_asFunctionalComponent(__VLS_788, new __VLS_788({
            prop: "location",
            label: "位置",
            minWidth: "140",
        }));
        const __VLS_790 = __VLS_789({
            prop: "location",
            label: "位置",
            minWidth: "140",
        }, ...__VLS_functionalComponentArgsRest(__VLS_789));
        const __VLS_792 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_793 = __VLS_asFunctionalComponent(__VLS_792, new __VLS_792({
            prop: "merchantId",
            label: "商家ID",
            width: "90",
        }));
        const __VLS_794 = __VLS_793({
            prop: "merchantId",
            label: "商家ID",
            width: "90",
        }, ...__VLS_functionalComponentArgsRest(__VLS_793));
        const __VLS_796 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_797 = __VLS_asFunctionalComponent(__VLS_796, new __VLS_796({
            prop: "pickupPrefix",
            label: "前缀",
            width: "80",
        }));
        const __VLS_798 = __VLS_797({
            prop: "pickupPrefix",
            label: "前缀",
            width: "80",
        }, ...__VLS_functionalComponentArgsRest(__VLS_797));
        const __VLS_800 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_801 = __VLS_asFunctionalComponent(__VLS_800, new __VLS_800({
            prop: "status",
            label: "状态",
            width: "90",
        }));
        const __VLS_802 = __VLS_801({
            prop: "status",
            label: "状态",
            width: "90",
        }, ...__VLS_functionalComponentArgsRest(__VLS_801));
        __VLS_803.slots.default;
        {
            const { default: __VLS_thisSlot } = __VLS_803.slots;
            const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
            (row.status === 1 ? "启用" : "停用");
        }
        var __VLS_803;
        var __VLS_779;
        var __VLS_771;
        var __VLS_767;
    }
    if (__VLS_ctx.activeSection === __VLS_ctx.sectionIdMap.adminUsers) {
        const __VLS_804 = {}.ElCol;
        /** @type {[typeof __VLS_components.ElCol, typeof __VLS_components.elCol, typeof __VLS_components.ElCol, typeof __VLS_components.elCol, ]} */ ;
        // @ts-ignore
        const __VLS_805 = __VLS_asFunctionalComponent(__VLS_804, new __VLS_804({
            span: (24),
        }));
        const __VLS_806 = __VLS_805({
            span: (24),
        }, ...__VLS_functionalComponentArgsRest(__VLS_805));
        __VLS_807.slots.default;
        const __VLS_808 = {}.ElCard;
        /** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
        // @ts-ignore
        const __VLS_809 = __VLS_asFunctionalComponent(__VLS_808, new __VLS_808({
            id: (__VLS_ctx.sectionIdMap.adminUsers),
        }));
        const __VLS_810 = __VLS_809({
            id: (__VLS_ctx.sectionIdMap.adminUsers),
        }, ...__VLS_functionalComponentArgsRest(__VLS_809));
        __VLS_811.slots.default;
        {
            const { header: __VLS_thisSlot } = __VLS_811.slots;
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "section-head" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
            __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
        }
        const __VLS_812 = {}.ElInput;
        /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
        // @ts-ignore
        const __VLS_813 = __VLS_asFunctionalComponent(__VLS_812, new __VLS_812({
            modelValue: (__VLS_ctx.userKeyword),
            placeholder: "按用户ID/手机号/昵称查询",
            ...{ class: "query-input" },
        }));
        const __VLS_814 = __VLS_813({
            modelValue: (__VLS_ctx.userKeyword),
            placeholder: "按用户ID/手机号/昵称查询",
            ...{ class: "query-input" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_813));
        const __VLS_816 = {}.ElTable;
        /** @type {[typeof __VLS_components.ElTable, typeof __VLS_components.elTable, typeof __VLS_components.ElTable, typeof __VLS_components.elTable, ]} */ ;
        // @ts-ignore
        const __VLS_817 = __VLS_asFunctionalComponent(__VLS_816, new __VLS_816({
            data: (__VLS_ctx.filteredUsers),
            size: "small",
        }));
        const __VLS_818 = __VLS_817({
            data: (__VLS_ctx.filteredUsers),
            size: "small",
        }, ...__VLS_functionalComponentArgsRest(__VLS_817));
        __VLS_819.slots.default;
        const __VLS_820 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_821 = __VLS_asFunctionalComponent(__VLS_820, new __VLS_820({
            prop: "id",
            label: "ID",
            width: "70",
        }));
        const __VLS_822 = __VLS_821({
            prop: "id",
            label: "ID",
            width: "70",
        }, ...__VLS_functionalComponentArgsRest(__VLS_821));
        const __VLS_824 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_825 = __VLS_asFunctionalComponent(__VLS_824, new __VLS_824({
            prop: "phone",
            label: "手机号",
            width: "130",
        }));
        const __VLS_826 = __VLS_825({
            prop: "phone",
            label: "手机号",
            width: "130",
        }, ...__VLS_functionalComponentArgsRest(__VLS_825));
        const __VLS_828 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_829 = __VLS_asFunctionalComponent(__VLS_828, new __VLS_828({
            prop: "nickname",
            label: "昵称",
            minWidth: "100",
        }));
        const __VLS_830 = __VLS_829({
            prop: "nickname",
            label: "昵称",
            minWidth: "100",
        }, ...__VLS_functionalComponentArgsRest(__VLS_829));
        const __VLS_832 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_833 = __VLS_asFunctionalComponent(__VLS_832, new __VLS_832({
            prop: "role",
            label: "角色",
            width: "90",
        }));
        const __VLS_834 = __VLS_833({
            prop: "role",
            label: "角色",
            width: "90",
        }, ...__VLS_functionalComponentArgsRest(__VLS_833));
        __VLS_835.slots.default;
        {
            const { default: __VLS_thisSlot } = __VLS_835.slots;
            const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
            (__VLS_ctx.roleNameByValue(row.role));
        }
        var __VLS_835;
        const __VLS_836 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_837 = __VLS_asFunctionalComponent(__VLS_836, new __VLS_836({
            prop: "status",
            label: "状态",
            width: "80",
        }));
        const __VLS_838 = __VLS_837({
            prop: "status",
            label: "状态",
            width: "80",
        }, ...__VLS_functionalComponentArgsRest(__VLS_837));
        __VLS_839.slots.default;
        {
            const { default: __VLS_thisSlot } = __VLS_839.slots;
            const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
            (row.status === 1 ? "启用" : "停用");
        }
        var __VLS_839;
        var __VLS_819;
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "pagination-wrap" },
        });
        const __VLS_840 = {}.ElPagination;
        /** @type {[typeof __VLS_components.ElPagination, typeof __VLS_components.elPagination, ]} */ ;
        // @ts-ignore
        const __VLS_841 = __VLS_asFunctionalComponent(__VLS_840, new __VLS_840({
            ...{ 'onCurrentChange': {} },
            ...{ 'onSizeChange': {} },
            background: true,
            layout: "total, sizes, prev, pager, next",
            total: (__VLS_ctx.adminUserTotal),
            currentPage: (__VLS_ctx.adminUserPage),
            pageSize: (__VLS_ctx.adminUserSize),
            pageSizes: ([5, 10, 20, 50]),
        }));
        const __VLS_842 = __VLS_841({
            ...{ 'onCurrentChange': {} },
            ...{ 'onSizeChange': {} },
            background: true,
            layout: "total, sizes, prev, pager, next",
            total: (__VLS_ctx.adminUserTotal),
            currentPage: (__VLS_ctx.adminUserPage),
            pageSize: (__VLS_ctx.adminUserSize),
            pageSizes: ([5, 10, 20, 50]),
        }, ...__VLS_functionalComponentArgsRest(__VLS_841));
        let __VLS_844;
        let __VLS_845;
        let __VLS_846;
        const __VLS_847 = {
            onCurrentChange: (__VLS_ctx.onAdminUserPageChange)
        };
        const __VLS_848 = {
            onSizeChange: (__VLS_ctx.onAdminUserSizeChange)
        };
        var __VLS_843;
        var __VLS_811;
        var __VLS_807;
    }
    if (__VLS_ctx.activeSection === __VLS_ctx.sectionIdMap.adminMenuDetail) {
        const __VLS_849 = {}.ElCol;
        /** @type {[typeof __VLS_components.ElCol, typeof __VLS_components.elCol, typeof __VLS_components.ElCol, typeof __VLS_components.elCol, ]} */ ;
        // @ts-ignore
        const __VLS_850 = __VLS_asFunctionalComponent(__VLS_849, new __VLS_849({
            span: (24),
        }));
        const __VLS_851 = __VLS_850({
            span: (24),
        }, ...__VLS_functionalComponentArgsRest(__VLS_850));
        __VLS_852.slots.default;
        const __VLS_853 = {}.ElCard;
        /** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
        // @ts-ignore
        const __VLS_854 = __VLS_asFunctionalComponent(__VLS_853, new __VLS_853({
            id: (__VLS_ctx.sectionIdMap.adminMenuDetail),
        }));
        const __VLS_855 = __VLS_854({
            id: (__VLS_ctx.sectionIdMap.adminMenuDetail),
        }, ...__VLS_functionalComponentArgsRest(__VLS_854));
        __VLS_856.slots.default;
        {
            const { header: __VLS_thisSlot } = __VLS_856.slots;
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "section-head" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
            __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
        }
        const __VLS_857 = {}.ElInput;
        /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
        // @ts-ignore
        const __VLS_858 = __VLS_asFunctionalComponent(__VLS_857, new __VLS_857({
            modelValue: (__VLS_ctx.menuKeyword),
            placeholder: "按菜单ID/菜单名称查询",
            ...{ class: "query-input" },
        }));
        const __VLS_859 = __VLS_858({
            modelValue: (__VLS_ctx.menuKeyword),
            placeholder: "按菜单ID/菜单名称查询",
            ...{ class: "query-input" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_858));
        if (__VLS_ctx.filteredAdminMenus.length === 0) {
            const __VLS_861 = {}.ElEmpty;
            /** @type {[typeof __VLS_components.ElEmpty, typeof __VLS_components.elEmpty, ]} */ ;
            // @ts-ignore
            const __VLS_862 = __VLS_asFunctionalComponent(__VLS_861, new __VLS_861({
                description: "当前无可查询菜单",
            }));
            const __VLS_863 = __VLS_862({
                description: "当前无可查询菜单",
            }, ...__VLS_functionalComponentArgsRest(__VLS_862));
        }
        else {
            const __VLS_865 = {}.ElTable;
            /** @type {[typeof __VLS_components.ElTable, typeof __VLS_components.elTable, typeof __VLS_components.ElTable, typeof __VLS_components.elTable, ]} */ ;
            // @ts-ignore
            const __VLS_866 = __VLS_asFunctionalComponent(__VLS_865, new __VLS_865({
                data: (__VLS_ctx.filteredAdminMenus),
                size: "small",
            }));
            const __VLS_867 = __VLS_866({
                data: (__VLS_ctx.filteredAdminMenus),
                size: "small",
            }, ...__VLS_functionalComponentArgsRest(__VLS_866));
            __VLS_868.slots.default;
            const __VLS_869 = {}.ElTableColumn;
            /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
            // @ts-ignore
            const __VLS_870 = __VLS_asFunctionalComponent(__VLS_869, new __VLS_869({
                prop: "id",
                label: "菜单ID",
                width: "100",
            }));
            const __VLS_871 = __VLS_870({
                prop: "id",
                label: "菜单ID",
                width: "100",
            }, ...__VLS_functionalComponentArgsRest(__VLS_870));
            const __VLS_873 = {}.ElTableColumn;
            /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
            // @ts-ignore
            const __VLS_874 = __VLS_asFunctionalComponent(__VLS_873, new __VLS_873({
                prop: "name",
                label: "菜单名称",
                minWidth: "150",
            }));
            const __VLS_875 = __VLS_874({
                prop: "name",
                label: "菜单名称",
                minWidth: "150",
            }, ...__VLS_functionalComponentArgsRest(__VLS_874));
            const __VLS_877 = {}.ElTableColumn;
            /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
            // @ts-ignore
            const __VLS_878 = __VLS_asFunctionalComponent(__VLS_877, new __VLS_877({
                prop: "saleDate",
                label: "日期",
                width: "120",
            }));
            const __VLS_879 = __VLS_878({
                prop: "saleDate",
                label: "日期",
                width: "120",
            }, ...__VLS_functionalComponentArgsRest(__VLS_878));
            const __VLS_881 = {}.ElTableColumn;
            /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
            // @ts-ignore
            const __VLS_882 = __VLS_asFunctionalComponent(__VLS_881, new __VLS_881({
                prop: "startTime",
                label: "开始",
                width: "110",
            }));
            const __VLS_883 = __VLS_882({
                prop: "startTime",
                label: "开始",
                width: "110",
            }, ...__VLS_functionalComponentArgsRest(__VLS_882));
            const __VLS_885 = {}.ElTableColumn;
            /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
            // @ts-ignore
            const __VLS_886 = __VLS_asFunctionalComponent(__VLS_885, new __VLS_885({
                prop: "endTime",
                label: "结束",
                width: "110",
            }));
            const __VLS_887 = __VLS_886({
                prop: "endTime",
                label: "结束",
                width: "110",
            }, ...__VLS_functionalComponentArgsRest(__VLS_886));
            const __VLS_889 = {}.ElTableColumn;
            /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
            // @ts-ignore
            const __VLS_890 = __VLS_asFunctionalComponent(__VLS_889, new __VLS_889({
                label: "操作",
                width: "120",
            }));
            const __VLS_891 = __VLS_890({
                label: "操作",
                width: "120",
            }, ...__VLS_functionalComponentArgsRest(__VLS_890));
            __VLS_892.slots.default;
            {
                const { default: __VLS_thisSlot } = __VLS_892.slots;
                const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
                const __VLS_893 = {}.ElButton;
                /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
                // @ts-ignore
                const __VLS_894 = __VLS_asFunctionalComponent(__VLS_893, new __VLS_893({
                    ...{ 'onClick': {} },
                    link: true,
                    type: "primary",
                    loading: (__VLS_ctx.adminMenuLoading),
                }));
                const __VLS_895 = __VLS_894({
                    ...{ 'onClick': {} },
                    link: true,
                    type: "primary",
                    loading: (__VLS_ctx.adminMenuLoading),
                }, ...__VLS_functionalComponentArgsRest(__VLS_894));
                let __VLS_897;
                let __VLS_898;
                let __VLS_899;
                const __VLS_900 = {
                    onClick: (...[$event]) => {
                        if (!!(__VLS_ctx.isUser && __VLS_ctx.activeSection === __VLS_ctx.sectionIdMap.userOrders))
                            return;
                        if (!!(__VLS_ctx.isMerchant))
                            return;
                        if (!(__VLS_ctx.activeSection === __VLS_ctx.sectionIdMap.adminMenuDetail))
                            return;
                        if (!!(__VLS_ctx.filteredAdminMenus.length === 0))
                            return;
                        __VLS_ctx.openAdminMenuDetail(row.id);
                    }
                };
                __VLS_896.slots.default;
                var __VLS_896;
            }
            var __VLS_892;
            var __VLS_868;
        }
        var __VLS_856;
        var __VLS_852;
    }
    if (__VLS_ctx.activeSection === __VLS_ctx.sectionIdMap.adminDishDetail) {
        const __VLS_901 = {}.ElCol;
        /** @type {[typeof __VLS_components.ElCol, typeof __VLS_components.elCol, typeof __VLS_components.ElCol, typeof __VLS_components.elCol, ]} */ ;
        // @ts-ignore
        const __VLS_902 = __VLS_asFunctionalComponent(__VLS_901, new __VLS_901({
            span: (24),
        }));
        const __VLS_903 = __VLS_902({
            span: (24),
        }, ...__VLS_functionalComponentArgsRest(__VLS_902));
        __VLS_904.slots.default;
        const __VLS_905 = {}.ElCard;
        /** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
        // @ts-ignore
        const __VLS_906 = __VLS_asFunctionalComponent(__VLS_905, new __VLS_905({
            id: (__VLS_ctx.sectionIdMap.adminDishDetail),
        }));
        const __VLS_907 = __VLS_906({
            id: (__VLS_ctx.sectionIdMap.adminDishDetail),
        }, ...__VLS_functionalComponentArgsRest(__VLS_906));
        __VLS_908.slots.default;
        {
            const { header: __VLS_thisSlot } = __VLS_908.slots;
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "section-head" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
            __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
        }
        const __VLS_909 = {}.ElSpace;
        /** @type {[typeof __VLS_components.ElSpace, typeof __VLS_components.elSpace, typeof __VLS_components.ElSpace, typeof __VLS_components.elSpace, ]} */ ;
        // @ts-ignore
        const __VLS_910 = __VLS_asFunctionalComponent(__VLS_909, new __VLS_909({
            wrap: true,
        }));
        const __VLS_911 = __VLS_910({
            wrap: true,
        }, ...__VLS_functionalComponentArgsRest(__VLS_910));
        __VLS_912.slots.default;
        const __VLS_913 = {}.ElInputNumber;
        /** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
        // @ts-ignore
        const __VLS_914 = __VLS_asFunctionalComponent(__VLS_913, new __VLS_913({
            modelValue: (__VLS_ctx.adminDishQueryId),
            min: (1),
            step: (1),
            placeholder: "输入菜品ID",
        }));
        const __VLS_915 = __VLS_914({
            modelValue: (__VLS_ctx.adminDishQueryId),
            min: (1),
            step: (1),
            placeholder: "输入菜品ID",
        }, ...__VLS_functionalComponentArgsRest(__VLS_914));
        const __VLS_917 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        const __VLS_918 = __VLS_asFunctionalComponent(__VLS_917, new __VLS_917({
            ...{ 'onClick': {} },
            type: "primary",
            loading: (__VLS_ctx.adminDishQueryLoading),
        }));
        const __VLS_919 = __VLS_918({
            ...{ 'onClick': {} },
            type: "primary",
            loading: (__VLS_ctx.adminDishQueryLoading),
        }, ...__VLS_functionalComponentArgsRest(__VLS_918));
        let __VLS_921;
        let __VLS_922;
        let __VLS_923;
        const __VLS_924 = {
            onClick: (__VLS_ctx.queryAdminDishDetail)
        };
        __VLS_920.slots.default;
        var __VLS_920;
        var __VLS_912;
        if (__VLS_ctx.adminDishDetail) {
            const __VLS_925 = {}.ElDescriptions;
            /** @type {[typeof __VLS_components.ElDescriptions, typeof __VLS_components.elDescriptions, typeof __VLS_components.ElDescriptions, typeof __VLS_components.elDescriptions, ]} */ ;
            // @ts-ignore
            const __VLS_926 = __VLS_asFunctionalComponent(__VLS_925, new __VLS_925({
                column: (2),
                border: true,
                ...{ class: "search-result" },
            }));
            const __VLS_927 = __VLS_926({
                column: (2),
                border: true,
                ...{ class: "search-result" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_926));
            __VLS_928.slots.default;
            const __VLS_929 = {}.ElDescriptionsItem;
            /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
            // @ts-ignore
            const __VLS_930 = __VLS_asFunctionalComponent(__VLS_929, new __VLS_929({
                label: "菜品ID",
            }));
            const __VLS_931 = __VLS_930({
                label: "菜品ID",
            }, ...__VLS_functionalComponentArgsRest(__VLS_930));
            __VLS_932.slots.default;
            (__VLS_ctx.adminDishDetail.id);
            var __VLS_932;
            const __VLS_933 = {}.ElDescriptionsItem;
            /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
            // @ts-ignore
            const __VLS_934 = __VLS_asFunctionalComponent(__VLS_933, new __VLS_933({
                label: "商家ID",
            }));
            const __VLS_935 = __VLS_934({
                label: "商家ID",
            }, ...__VLS_functionalComponentArgsRest(__VLS_934));
            __VLS_936.slots.default;
            (__VLS_ctx.adminDishDetail.merchantId);
            var __VLS_936;
            const __VLS_937 = {}.ElDescriptionsItem;
            /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
            // @ts-ignore
            const __VLS_938 = __VLS_asFunctionalComponent(__VLS_937, new __VLS_937({
                label: "名称",
            }));
            const __VLS_939 = __VLS_938({
                label: "名称",
            }, ...__VLS_functionalComponentArgsRest(__VLS_938));
            __VLS_940.slots.default;
            (__VLS_ctx.adminDishDetail.name);
            var __VLS_940;
            const __VLS_941 = {}.ElDescriptionsItem;
            /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
            // @ts-ignore
            const __VLS_942 = __VLS_asFunctionalComponent(__VLS_941, new __VLS_941({
                label: "分类",
            }));
            const __VLS_943 = __VLS_942({
                label: "分类",
            }, ...__VLS_functionalComponentArgsRest(__VLS_942));
            __VLS_944.slots.default;
            (__VLS_ctx.adminDishDetail.category || "-");
            var __VLS_944;
            const __VLS_945 = {}.ElDescriptionsItem;
            /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
            // @ts-ignore
            const __VLS_946 = __VLS_asFunctionalComponent(__VLS_945, new __VLS_945({
                label: "价格",
            }));
            const __VLS_947 = __VLS_946({
                label: "价格",
            }, ...__VLS_functionalComponentArgsRest(__VLS_946));
            __VLS_948.slots.default;
            (__VLS_ctx.adminDishDetail.price);
            var __VLS_948;
            const __VLS_949 = {}.ElDescriptionsItem;
            /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
            // @ts-ignore
            const __VLS_950 = __VLS_asFunctionalComponent(__VLS_949, new __VLS_949({
                label: "状态",
            }));
            const __VLS_951 = __VLS_950({
                label: "状态",
            }, ...__VLS_functionalComponentArgsRest(__VLS_950));
            __VLS_952.slots.default;
            (__VLS_ctx.adminDishDetail.status === 1 ? "上架" : "下架");
            var __VLS_952;
            var __VLS_928;
        }
        var __VLS_908;
        var __VLS_904;
    }
    var __VLS_703;
}
const __VLS_953 = {}.ElDialog;
/** @type {[typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, ]} */ ;
// @ts-ignore
const __VLS_954 = __VLS_asFunctionalComponent(__VLS_953, new __VLS_953({
    modelValue: (__VLS_ctx.detailVisible),
    title: "订单详情",
    width: "720px",
}));
const __VLS_955 = __VLS_954({
    modelValue: (__VLS_ctx.detailVisible),
    title: "订单详情",
    width: "720px",
}, ...__VLS_functionalComponentArgsRest(__VLS_954));
__VLS_956.slots.default;
if (__VLS_ctx.detailOrder) {
    const __VLS_957 = {}.ElDescriptions;
    /** @type {[typeof __VLS_components.ElDescriptions, typeof __VLS_components.elDescriptions, typeof __VLS_components.ElDescriptions, typeof __VLS_components.elDescriptions, ]} */ ;
    // @ts-ignore
    const __VLS_958 = __VLS_asFunctionalComponent(__VLS_957, new __VLS_957({
        column: (2),
        border: true,
    }));
    const __VLS_959 = __VLS_958({
        column: (2),
        border: true,
    }, ...__VLS_functionalComponentArgsRest(__VLS_958));
    __VLS_960.slots.default;
    const __VLS_961 = {}.ElDescriptionsItem;
    /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
    // @ts-ignore
    const __VLS_962 = __VLS_asFunctionalComponent(__VLS_961, new __VLS_961({
        label: "订单ID",
    }));
    const __VLS_963 = __VLS_962({
        label: "订单ID",
    }, ...__VLS_functionalComponentArgsRest(__VLS_962));
    __VLS_964.slots.default;
    (__VLS_ctx.detailOrder.id);
    var __VLS_964;
    const __VLS_965 = {}.ElDescriptionsItem;
    /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
    // @ts-ignore
    const __VLS_966 = __VLS_asFunctionalComponent(__VLS_965, new __VLS_965({
        label: "订单号",
    }));
    const __VLS_967 = __VLS_966({
        label: "订单号",
    }, ...__VLS_functionalComponentArgsRest(__VLS_966));
    __VLS_968.slots.default;
    (__VLS_ctx.detailOrder.orderNo);
    var __VLS_968;
    const __VLS_969 = {}.ElDescriptionsItem;
    /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
    // @ts-ignore
    const __VLS_970 = __VLS_asFunctionalComponent(__VLS_969, new __VLS_969({
        label: "窗口ID",
    }));
    const __VLS_971 = __VLS_970({
        label: "窗口ID",
    }, ...__VLS_functionalComponentArgsRest(__VLS_970));
    __VLS_972.slots.default;
    (__VLS_ctx.detailOrder.windowId);
    var __VLS_972;
    const __VLS_973 = {}.ElDescriptionsItem;
    /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
    // @ts-ignore
    const __VLS_974 = __VLS_asFunctionalComponent(__VLS_973, new __VLS_973({
        label: "状态",
    }));
    const __VLS_975 = __VLS_974({
        label: "状态",
    }, ...__VLS_functionalComponentArgsRest(__VLS_974));
    __VLS_976.slots.default;
    (__VLS_ctx.statusText(__VLS_ctx.detailOrder.status));
    var __VLS_976;
    const __VLS_977 = {}.ElDescriptionsItem;
    /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
    // @ts-ignore
    const __VLS_978 = __VLS_asFunctionalComponent(__VLS_977, new __VLS_977({
        label: "取餐码",
    }));
    const __VLS_979 = __VLS_978({
        label: "取餐码",
    }, ...__VLS_functionalComponentArgsRest(__VLS_978));
    __VLS_980.slots.default;
    (__VLS_ctx.detailOrder.pickupCode);
    var __VLS_980;
    const __VLS_981 = {}.ElDescriptionsItem;
    /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
    // @ts-ignore
    const __VLS_982 = __VLS_asFunctionalComponent(__VLS_981, new __VLS_981({
        label: "叫号码",
    }));
    const __VLS_983 = __VLS_982({
        label: "叫号码",
    }, ...__VLS_functionalComponentArgsRest(__VLS_982));
    __VLS_984.slots.default;
    (__VLS_ctx.detailOrder.pickupNo || "-");
    var __VLS_984;
    const __VLS_985 = {}.ElDescriptionsItem;
    /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
    // @ts-ignore
    const __VLS_986 = __VLS_asFunctionalComponent(__VLS_985, new __VLS_985({
        label: "金额",
    }));
    const __VLS_987 = __VLS_986({
        label: "金额",
    }, ...__VLS_functionalComponentArgsRest(__VLS_986));
    __VLS_988.slots.default;
    (__VLS_ctx.detailOrder.totalAmount);
    var __VLS_988;
    const __VLS_989 = {}.ElDescriptionsItem;
    /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
    // @ts-ignore
    const __VLS_990 = __VLS_asFunctionalComponent(__VLS_989, new __VLS_989({
        label: "备注",
    }));
    const __VLS_991 = __VLS_990({
        label: "备注",
    }, ...__VLS_functionalComponentArgsRest(__VLS_990));
    __VLS_992.slots.default;
    (__VLS_ctx.detailOrder.remark || "-");
    var __VLS_992;
    var __VLS_960;
}
const __VLS_993 = {}.ElDivider;
/** @type {[typeof __VLS_components.ElDivider, typeof __VLS_components.elDivider, ]} */ ;
// @ts-ignore
const __VLS_994 = __VLS_asFunctionalComponent(__VLS_993, new __VLS_993({}));
const __VLS_995 = __VLS_994({}, ...__VLS_functionalComponentArgsRest(__VLS_994));
const __VLS_997 = {}.ElTable;
/** @type {[typeof __VLS_components.ElTable, typeof __VLS_components.elTable, typeof __VLS_components.ElTable, typeof __VLS_components.elTable, ]} */ ;
// @ts-ignore
const __VLS_998 = __VLS_asFunctionalComponent(__VLS_997, new __VLS_997({
    data: (__VLS_ctx.detailOrder?.items || []),
    size: "small",
}));
const __VLS_999 = __VLS_998({
    data: (__VLS_ctx.detailOrder?.items || []),
    size: "small",
}, ...__VLS_functionalComponentArgsRest(__VLS_998));
__VLS_1000.slots.default;
const __VLS_1001 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_1002 = __VLS_asFunctionalComponent(__VLS_1001, new __VLS_1001({
    prop: "dishName",
    label: "菜品",
    minWidth: "130",
}));
const __VLS_1003 = __VLS_1002({
    prop: "dishName",
    label: "菜品",
    minWidth: "130",
}, ...__VLS_functionalComponentArgsRest(__VLS_1002));
const __VLS_1005 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_1006 = __VLS_asFunctionalComponent(__VLS_1005, new __VLS_1005({
    prop: "quantity",
    label: "数量",
    width: "80",
}));
const __VLS_1007 = __VLS_1006({
    prop: "quantity",
    label: "数量",
    width: "80",
}, ...__VLS_functionalComponentArgsRest(__VLS_1006));
const __VLS_1009 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_1010 = __VLS_asFunctionalComponent(__VLS_1009, new __VLS_1009({
    prop: "unitPrice",
    label: "单价",
    width: "90",
}));
const __VLS_1011 = __VLS_1010({
    prop: "unitPrice",
    label: "单价",
    width: "90",
}, ...__VLS_functionalComponentArgsRest(__VLS_1010));
const __VLS_1013 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_1014 = __VLS_asFunctionalComponent(__VLS_1013, new __VLS_1013({
    prop: "subtotal",
    label: "小计",
    width: "100",
}));
const __VLS_1015 = __VLS_1014({
    prop: "subtotal",
    label: "小计",
    width: "100",
}, ...__VLS_functionalComponentArgsRest(__VLS_1014));
var __VLS_1000;
var __VLS_956;
const __VLS_1017 = {}.ElDialog;
/** @type {[typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, ]} */ ;
// @ts-ignore
const __VLS_1018 = __VLS_asFunctionalComponent(__VLS_1017, new __VLS_1017({
    modelValue: (__VLS_ctx.menuDishDetailVisible),
    title: "库存详情",
    width: "520px",
}));
const __VLS_1019 = __VLS_1018({
    modelValue: (__VLS_ctx.menuDishDetailVisible),
    title: "库存详情",
    width: "520px",
}, ...__VLS_functionalComponentArgsRest(__VLS_1018));
__VLS_1020.slots.default;
if (__VLS_ctx.menuDishDetail) {
    const __VLS_1021 = {}.ElDescriptions;
    /** @type {[typeof __VLS_components.ElDescriptions, typeof __VLS_components.elDescriptions, typeof __VLS_components.ElDescriptions, typeof __VLS_components.elDescriptions, ]} */ ;
    // @ts-ignore
    const __VLS_1022 = __VLS_asFunctionalComponent(__VLS_1021, new __VLS_1021({
        column: (1),
        border: true,
    }));
    const __VLS_1023 = __VLS_1022({
        column: (1),
        border: true,
    }, ...__VLS_functionalComponentArgsRest(__VLS_1022));
    __VLS_1024.slots.default;
    const __VLS_1025 = {}.ElDescriptionsItem;
    /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
    // @ts-ignore
    const __VLS_1026 = __VLS_asFunctionalComponent(__VLS_1025, new __VLS_1025({
        label: "菜单菜品ID",
    }));
    const __VLS_1027 = __VLS_1026({
        label: "菜单菜品ID",
    }, ...__VLS_functionalComponentArgsRest(__VLS_1026));
    __VLS_1028.slots.default;
    (__VLS_ctx.menuDishDetail.id);
    var __VLS_1028;
    const __VLS_1029 = {}.ElDescriptionsItem;
    /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
    // @ts-ignore
    const __VLS_1030 = __VLS_asFunctionalComponent(__VLS_1029, new __VLS_1029({
        label: "菜品",
    }));
    const __VLS_1031 = __VLS_1030({
        label: "菜品",
    }, ...__VLS_functionalComponentArgsRest(__VLS_1030));
    __VLS_1032.slots.default;
    (__VLS_ctx.menuDishDetail.dishName);
    var __VLS_1032;
    const __VLS_1033 = {}.ElDescriptionsItem;
    /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
    // @ts-ignore
    const __VLS_1034 = __VLS_asFunctionalComponent(__VLS_1033, new __VLS_1033({
        label: "售价",
    }));
    const __VLS_1035 = __VLS_1034({
        label: "售价",
    }, ...__VLS_functionalComponentArgsRest(__VLS_1034));
    __VLS_1036.slots.default;
    (__VLS_ctx.menuDishDetail.salePrice);
    var __VLS_1036;
    const __VLS_1037 = {}.ElDescriptionsItem;
    /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
    // @ts-ignore
    const __VLS_1038 = __VLS_asFunctionalComponent(__VLS_1037, new __VLS_1037({
        label: "库存",
    }));
    const __VLS_1039 = __VLS_1038({
        label: "库存",
    }, ...__VLS_functionalComponentArgsRest(__VLS_1038));
    __VLS_1040.slots.default;
    (__VLS_ctx.menuDishDetail.stock);
    var __VLS_1040;
    const __VLS_1041 = {}.ElDescriptionsItem;
    /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
    // @ts-ignore
    const __VLS_1042 = __VLS_asFunctionalComponent(__VLS_1041, new __VLS_1041({
        label: "已售",
    }));
    const __VLS_1043 = __VLS_1042({
        label: "已售",
    }, ...__VLS_functionalComponentArgsRest(__VLS_1042));
    __VLS_1044.slots.default;
    (__VLS_ctx.menuDishDetail.sold);
    var __VLS_1044;
    const __VLS_1045 = {}.ElDescriptionsItem;
    /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
    // @ts-ignore
    const __VLS_1046 = __VLS_asFunctionalComponent(__VLS_1045, new __VLS_1045({
        label: "状态",
    }));
    const __VLS_1047 = __VLS_1046({
        label: "状态",
    }, ...__VLS_functionalComponentArgsRest(__VLS_1046));
    __VLS_1048.slots.default;
    (__VLS_ctx.menuDishDetail.status === 1 ? "上架" : "下架");
    var __VLS_1048;
    var __VLS_1024;
}
else {
    const __VLS_1049 = {}.ElEmpty;
    /** @type {[typeof __VLS_components.ElEmpty, typeof __VLS_components.elEmpty, ]} */ ;
    // @ts-ignore
    const __VLS_1050 = __VLS_asFunctionalComponent(__VLS_1049, new __VLS_1049({
        description: "暂无详情数据",
    }));
    const __VLS_1051 = __VLS_1050({
        description: "暂无详情数据",
    }, ...__VLS_functionalComponentArgsRest(__VLS_1050));
}
var __VLS_1020;
const __VLS_1053 = {}.ElDialog;
/** @type {[typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, ]} */ ;
// @ts-ignore
const __VLS_1054 = __VLS_asFunctionalComponent(__VLS_1053, new __VLS_1053({
    modelValue: (__VLS_ctx.adminMenuDetailVisible),
    title: "菜单详情",
    width: "760px",
}));
const __VLS_1055 = __VLS_1054({
    modelValue: (__VLS_ctx.adminMenuDetailVisible),
    title: "菜单详情",
    width: "760px",
}, ...__VLS_functionalComponentArgsRest(__VLS_1054));
__VLS_1056.slots.default;
if (__VLS_ctx.adminMenuDetail) {
    const __VLS_1057 = {}.ElDescriptions;
    /** @type {[typeof __VLS_components.ElDescriptions, typeof __VLS_components.elDescriptions, typeof __VLS_components.ElDescriptions, typeof __VLS_components.elDescriptions, ]} */ ;
    // @ts-ignore
    const __VLS_1058 = __VLS_asFunctionalComponent(__VLS_1057, new __VLS_1057({
        column: (2),
        border: true,
    }));
    const __VLS_1059 = __VLS_1058({
        column: (2),
        border: true,
    }, ...__VLS_functionalComponentArgsRest(__VLS_1058));
    __VLS_1060.slots.default;
    const __VLS_1061 = {}.ElDescriptionsItem;
    /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
    // @ts-ignore
    const __VLS_1062 = __VLS_asFunctionalComponent(__VLS_1061, new __VLS_1061({
        label: "菜单ID",
    }));
    const __VLS_1063 = __VLS_1062({
        label: "菜单ID",
    }, ...__VLS_functionalComponentArgsRest(__VLS_1062));
    __VLS_1064.slots.default;
    (__VLS_ctx.adminMenuDetail.id);
    var __VLS_1064;
    const __VLS_1065 = {}.ElDescriptionsItem;
    /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
    // @ts-ignore
    const __VLS_1066 = __VLS_asFunctionalComponent(__VLS_1065, new __VLS_1065({
        label: "菜单名称",
    }));
    const __VLS_1067 = __VLS_1066({
        label: "菜单名称",
    }, ...__VLS_functionalComponentArgsRest(__VLS_1066));
    __VLS_1068.slots.default;
    (__VLS_ctx.adminMenuDetail.name);
    var __VLS_1068;
    const __VLS_1069 = {}.ElDescriptionsItem;
    /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
    // @ts-ignore
    const __VLS_1070 = __VLS_asFunctionalComponent(__VLS_1069, new __VLS_1069({
        label: "日期",
    }));
    const __VLS_1071 = __VLS_1070({
        label: "日期",
    }, ...__VLS_functionalComponentArgsRest(__VLS_1070));
    __VLS_1072.slots.default;
    (__VLS_ctx.adminMenuDetail.saleDate);
    var __VLS_1072;
    const __VLS_1073 = {}.ElDescriptionsItem;
    /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
    // @ts-ignore
    const __VLS_1074 = __VLS_asFunctionalComponent(__VLS_1073, new __VLS_1073({
        label: "状态",
    }));
    const __VLS_1075 = __VLS_1074({
        label: "状态",
    }, ...__VLS_functionalComponentArgsRest(__VLS_1074));
    __VLS_1076.slots.default;
    (__VLS_ctx.adminMenuDetail.status === 1 ? "启用" : "停用");
    var __VLS_1076;
    var __VLS_1060;
}
const __VLS_1077 = {}.ElDivider;
/** @type {[typeof __VLS_components.ElDivider, typeof __VLS_components.elDivider, ]} */ ;
// @ts-ignore
const __VLS_1078 = __VLS_asFunctionalComponent(__VLS_1077, new __VLS_1077({}));
const __VLS_1079 = __VLS_1078({}, ...__VLS_functionalComponentArgsRest(__VLS_1078));
const __VLS_1081 = {}.ElTable;
/** @type {[typeof __VLS_components.ElTable, typeof __VLS_components.elTable, typeof __VLS_components.ElTable, typeof __VLS_components.elTable, ]} */ ;
// @ts-ignore
const __VLS_1082 = __VLS_asFunctionalComponent(__VLS_1081, new __VLS_1081({
    data: (__VLS_ctx.adminMenuDetail?.dishes || []),
    size: "small",
}));
const __VLS_1083 = __VLS_1082({
    data: (__VLS_ctx.adminMenuDetail?.dishes || []),
    size: "small",
}, ...__VLS_functionalComponentArgsRest(__VLS_1082));
__VLS_1084.slots.default;
const __VLS_1085 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_1086 = __VLS_asFunctionalComponent(__VLS_1085, new __VLS_1085({
    prop: "id",
    label: "菜单菜品ID",
    width: "110",
}));
const __VLS_1087 = __VLS_1086({
    prop: "id",
    label: "菜单菜品ID",
    width: "110",
}, ...__VLS_functionalComponentArgsRest(__VLS_1086));
const __VLS_1089 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_1090 = __VLS_asFunctionalComponent(__VLS_1089, new __VLS_1089({
    prop: "dishId",
    label: "菜品ID",
    width: "90",
}));
const __VLS_1091 = __VLS_1090({
    prop: "dishId",
    label: "菜品ID",
    width: "90",
}, ...__VLS_functionalComponentArgsRest(__VLS_1090));
const __VLS_1093 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_1094 = __VLS_asFunctionalComponent(__VLS_1093, new __VLS_1093({
    prop: "dishName",
    label: "菜品",
    minWidth: "130",
}));
const __VLS_1095 = __VLS_1094({
    prop: "dishName",
    label: "菜品",
    minWidth: "130",
}, ...__VLS_functionalComponentArgsRest(__VLS_1094));
const __VLS_1097 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_1098 = __VLS_asFunctionalComponent(__VLS_1097, new __VLS_1097({
    prop: "salePrice",
    label: "售价",
    width: "90",
}));
const __VLS_1099 = __VLS_1098({
    prop: "salePrice",
    label: "售价",
    width: "90",
}, ...__VLS_functionalComponentArgsRest(__VLS_1098));
const __VLS_1101 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_1102 = __VLS_asFunctionalComponent(__VLS_1101, new __VLS_1101({
    prop: "stock",
    label: "库存",
    width: "90",
}));
const __VLS_1103 = __VLS_1102({
    prop: "stock",
    label: "库存",
    width: "90",
}, ...__VLS_functionalComponentArgsRest(__VLS_1102));
const __VLS_1105 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_1106 = __VLS_asFunctionalComponent(__VLS_1105, new __VLS_1105({
    prop: "sold",
    label: "已售",
    width: "90",
}));
const __VLS_1107 = __VLS_1106({
    prop: "sold",
    label: "已售",
    width: "90",
}, ...__VLS_functionalComponentArgsRest(__VLS_1106));
var __VLS_1084;
var __VLS_1056;
/** @type {__VLS_StyleScopedClasses['wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['hero-card']} */ ;
/** @type {__VLS_StyleScopedClasses['hero-head']} */ ;
/** @type {__VLS_StyleScopedClasses['kpi-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['kpi-item']} */ ;
/** @type {__VLS_StyleScopedClasses['kpi-label']} */ ;
/** @type {__VLS_StyleScopedClasses['kpi-value']} */ ;
/** @type {__VLS_StyleScopedClasses['kpi-item']} */ ;
/** @type {__VLS_StyleScopedClasses['kpi-label']} */ ;
/** @type {__VLS_StyleScopedClasses['kpi-value']} */ ;
/** @type {__VLS_StyleScopedClasses['kpi-item']} */ ;
/** @type {__VLS_StyleScopedClasses['kpi-label']} */ ;
/** @type {__VLS_StyleScopedClasses['kpi-value']} */ ;
/** @type {__VLS_StyleScopedClasses['kpi-item']} */ ;
/** @type {__VLS_StyleScopedClasses['kpi-label']} */ ;
/** @type {__VLS_StyleScopedClasses['kpi-value']} */ ;
/** @type {__VLS_StyleScopedClasses['kpi-item']} */ ;
/** @type {__VLS_StyleScopedClasses['kpi-label']} */ ;
/** @type {__VLS_StyleScopedClasses['kpi-value']} */ ;
/** @type {__VLS_StyleScopedClasses['kpi-item']} */ ;
/** @type {__VLS_StyleScopedClasses['kpi-label']} */ ;
/** @type {__VLS_StyleScopedClasses['kpi-value']} */ ;
/** @type {__VLS_StyleScopedClasses['kpi-item']} */ ;
/** @type {__VLS_StyleScopedClasses['kpi-label']} */ ;
/** @type {__VLS_StyleScopedClasses['kpi-value']} */ ;
/** @type {__VLS_StyleScopedClasses['nav-card']} */ ;
/** @type {__VLS_StyleScopedClasses['role-nav']} */ ;
/** @type {__VLS_StyleScopedClasses['nav-item-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['student-menu-card']} */ ;
/** @type {__VLS_StyleScopedClasses['section-head']} */ ;
/** @type {__VLS_StyleScopedClasses['query-input']} */ ;
/** @type {__VLS_StyleScopedClasses['section-head']} */ ;
/** @type {__VLS_StyleScopedClasses['summary']} */ ;
/** @type {__VLS_StyleScopedClasses['full-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['order-card']} */ ;
/** @type {__VLS_StyleScopedClasses['section-head']} */ ;
/** @type {__VLS_StyleScopedClasses['query-input']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['section-head']} */ ;
/** @type {__VLS_StyleScopedClasses['query-input']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['section-head']} */ ;
/** @type {__VLS_StyleScopedClasses['queue-tag']} */ ;
/** @type {__VLS_StyleScopedClasses['verify-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['section-sub-title']} */ ;
/** @type {__VLS_StyleScopedClasses['verify-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['search-result']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['section-head']} */ ;
/** @type {__VLS_StyleScopedClasses['query-row']} */ ;
/** @type {__VLS_StyleScopedClasses['inline-form-item']} */ ;
/** @type {__VLS_StyleScopedClasses['query-input-short']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['section-head']} */ ;
/** @type {__VLS_StyleScopedClasses['tip-alert']} */ ;
/** @type {__VLS_StyleScopedClasses['query-input']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['section-head']} */ ;
/** @type {__VLS_StyleScopedClasses['publish-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['section-head']} */ ;
/** @type {__VLS_StyleScopedClasses['section-head']} */ ;
/** @type {__VLS_StyleScopedClasses['query-input']} */ ;
/** @type {__VLS_StyleScopedClasses['section-head']} */ ;
/** @type {__VLS_StyleScopedClasses['query-input']} */ ;
/** @type {__VLS_StyleScopedClasses['pagination-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['section-head']} */ ;
/** @type {__VLS_StyleScopedClasses['query-input']} */ ;
/** @type {__VLS_StyleScopedClasses['section-head']} */ ;
/** @type {__VLS_StyleScopedClasses['search-result']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            loading: loading,
            submitting: submitting,
            windows: windows,
            lowStockDishes: lowStockDishes,
            merchantUsers: merchantUsers,
            merchantDishes: merchantDishes,
            selectedWindowId: selectedWindowId,
            remark: remark,
            quantityMap: quantityMap,
            queueList: queueList,
            verifyCode: verifyCode,
            searchPickupCode: searchPickupCode,
            searchedOrder: searchedOrder,
            detailVisible: detailVisible,
            detailOrder: detailOrder,
            menuDishDetailVisible: menuDishDetailVisible,
            menuDishDetailLoading: menuDishDetailLoading,
            menuDishDetail: menuDishDetail,
            creatingWindow: creatingWindow,
            creatingDish: creatingDish,
            publishingMenu: publishingMenu,
            adminMenuDetailVisible: adminMenuDetailVisible,
            adminMenuDetail: adminMenuDetail,
            adminMenuLoading: adminMenuLoading,
            adminDishQueryId: adminDishQueryId,
            adminDishQueryLoading: adminDishQueryLoading,
            adminDishDetail: adminDishDetail,
            lowStockThreshold: lowStockThreshold,
            userMenuKeyword: userMenuKeyword,
            userOrderKeyword: userOrderKeyword,
            merchantOrderKeyword: merchantOrderKeyword,
            lowStockKeyword: lowStockKeyword,
            dishKeyword: dishKeyword,
            windowKeyword: windowKeyword,
            userKeyword: userKeyword,
            menuKeyword: menuKeyword,
            userOrderFilter: userOrderFilter,
            adminUserPage: adminUserPage,
            adminUserSize: adminUserSize,
            adminUserTotal: adminUserTotal,
            activeSection: activeSection,
            windowForm: windowForm,
            dishForm: dishForm,
            menuForm: menuForm,
            menuItemMap: menuItemMap,
            roleLabel: roleLabel,
            isUser: isUser,
            isMerchant: isMerchant,
            isAdmin: isAdmin,
            flatDishes: flatDishes,
            selectedCount: selectedCount,
            totalAmount: totalAmount,
            userReadyCount: userReadyCount,
            filteredUserOrders: filteredUserOrders,
            merchantPendingCount: merchantPendingCount,
            activeWindowCount: activeWindowCount,
            publishedDishIdSet: publishedDishIdSet,
            filteredMenuDishes: filteredMenuDishes,
            filteredMerchantOrders: filteredMerchantOrders,
            filteredLowStockDishes: filteredLowStockDishes,
            filteredMerchantDishes: filteredMerchantDishes,
            filteredWindows: filteredWindows,
            filteredUsers: filteredUsers,
            filteredAdminMenus: filteredAdminMenus,
            selectedWindowLabel: selectedWindowLabel,
            sectionIdMap: sectionIdMap,
            roleNavItems: roleNavItems,
            loadAll: loadAll,
            submitOrder: submitOrder,
            statusText: statusText,
            changeStatus: changeStatus,
            loadQueue: loadQueue,
            callNext: callNext,
            verifyPickup: verifyPickup,
            searchOrderByCode: searchOrderByCode,
            showOrderDetail: showOrderDetail,
            cancelOrder: cancelOrder,
            showMenuDishDetail: showMenuDishDetail,
            onAdminUserPageChange: onAdminUserPageChange,
            onAdminUserSizeChange: onAdminUserSizeChange,
            openAdminMenuDetail: openAdminMenuDetail,
            queryAdminDishDetail: queryAdminDishDetail,
            createWindow: createWindow,
            logout: logout,
            resetDishForm: resetDishForm,
            saveDish: saveDish,
            editDish: editDish,
            toggleDishStatus: toggleDishStatus,
            removeDish: removeDish,
            publishMenu: publishMenu,
            roleNameByValue: roleNameByValue,
            goDisplay: goDisplay,
            goProfile: goProfile,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
