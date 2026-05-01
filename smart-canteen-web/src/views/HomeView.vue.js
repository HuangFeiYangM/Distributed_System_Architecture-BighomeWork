import { computed, onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { useRouter } from "vue-router";
import { adminDeleteMenuApi, adminUpdateMenuApi, adminUpdateMenuDishApi, adminUpdateMenuStatusApi, getMenuDetailApi, getMenuDishDetailApi, getMenuListApi, getTodayMenusApi, publishMenuApi, updateStockApi } from "../api/menu";
import { cancelOrderApi, getMerchantOrdersApi, getMyOrdersApi, createOrderApi, updateOrderStatusApi, getOrderDetailApi, getOrderByPickupCodeApi } from "../api/order";
import { deleteWindowApi, getWindowsApi, getWindowsPageApi, getWindowQueueApi, callNextApi, updateWindowStatusApi, verifyPickupApi, createWindowApi } from "../api/pickup";
import { deleteUserApi, getUserListApi, queryUserListApi, resetUserPasswordApi, updateUserStatusApi } from "../api/user";
import { createDishApi, deleteDishApi, getDishDetailApi, getDishListApi, getDishPageApi, updateDishApi, updateDishStatusApi } from "../api/dish";
import { useAuthStore } from "../stores/auth";
const router = useRouter();
const authStore = useAuthStore();
const loading = ref(false);
const submitting = ref(false);
const windows = ref([]);
const orders = ref([]);
const merchantOrders = ref([]);
const dishes = ref([]);
const userTodayMenus = ref([]);
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
const adminMenuPageLoading = ref(false);
const adminMenuPage = ref(1);
const adminMenuSize = ref(10);
const adminMenuTotal = ref(0);
const adminMenuMerchantId = ref(null);
const adminMenuStatus = ref(undefined);
const adminMenuSaleDate = ref("");
const adminMenuEditVisible = ref(false);
const adminMenuEditSaving = ref(false);
const adminMenuEditId = ref(null);
const adminMenuEditForm = reactive({
    name: "",
    saleDate: "",
    startTime: "",
    endTime: ""
});
const adminMenuDishEditVisible = ref(false);
const adminMenuDishEditSaving = ref(false);
const adminMenuDishEditForm = reactive({
    menuDishId: 0,
    dishId: 0,
    salePrice: 0,
    status: 1
});
const adminStockOpVisible = ref(false);
const adminStockOpSaving = ref(false);
const adminStockMenuDishId = ref(null);
const adminStockOpForm = reactive({
    op: "INCR",
    value: 1,
    reason: ""
});
const adminMenuSelectedIds = ref([]);
const adminMenuBatchLoading = ref(false);
const adminDishQueryId = ref(null);
const adminDishQueryLoading = ref(false);
const adminDishPageLoading = ref(false);
const adminDishDetail = ref(null);
const adminDishList = ref([]);
const adminDishPage = ref(1);
const adminDishSize = ref(10);
const adminDishTotal = ref(0);
const adminDishNameKeyword = ref("");
const adminDishCategoryKeyword = ref("");
const adminDishMerchantId = ref(null);
const adminDishStatus = ref(undefined);
const adminDishMinPrice = ref(null);
const adminDishMaxPrice = ref(null);
const adminDishSortType = ref("createTimeDesc");
const lowStockThreshold = ref(10);
const userMenuKeyword = ref("");
const userOrderKeyword = ref("");
const merchantOrderKeyword = ref("");
const lowStockKeyword = ref("");
const dishKeyword = ref("");
const windowKeyword = ref("");
const userKeyword = ref("");
const menuKeyword = ref("");
const merchantOrderPage = ref(1);
const merchantOrderSize = ref(20);
const merchantOrderTotal = ref(0);
const merchantOrderStatus = ref(undefined);
const merchantOrderDateRange = ref(null);
const merchantMinAmount = ref(null);
const merchantMaxAmount = ref(null);
const adminWindowPage = ref(1);
const adminWindowSize = ref(10);
const adminWindowTotal = ref(0);
const adminWindowStatus = ref(undefined);
const adminWindowMerchantId = ref(null);
const userOrderFilter = ref("all");
const userAdvancedStatus = ref(undefined);
const userOrderDateRange = ref(null);
const userMinAmount = ref(null);
const userMaxAmount = ref(null);
const adminUserPage = ref(1);
const adminUserSize = ref(10);
const adminUserTotal = ref(0);
const adminUserRole = ref(undefined);
const adminUserStatus = ref(undefined);
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
    if (userAdvancedStatus.value !== undefined && o.status !== userAdvancedStatus.value)
        return false;
    if (userOrderDateRange.value && userOrderDateRange.value.length === 2) {
        const [start, end] = userOrderDateRange.value;
        const createTime = new Date(o.createTime).getTime();
        const startTime = new Date(start).getTime();
        const endTime = new Date(end).getTime();
        if (!Number.isNaN(startTime) && createTime < startTime)
            return false;
        if (!Number.isNaN(endTime) && createTime > endTime)
            return false;
    }
    if (userMinAmount.value !== null && Number(o.totalAmount) < userMinAmount.value)
        return false;
    if (userMaxAmount.value !== null && Number(o.totalAmount) > userMaxAmount.value)
        return false;
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
        if (merchantOrderStatus.value !== undefined && o.status !== merchantOrderStatus.value)
            return false;
        if (merchantOrderDateRange.value && merchantOrderDateRange.value.length === 2) {
            const [start, end] = merchantOrderDateRange.value;
            const createTime = new Date(o.createTime).getTime();
            const startTime = new Date(start).getTime();
            const endTime = new Date(end).getTime();
            if (!Number.isNaN(startTime) && createTime < startTime)
                return false;
            if (!Number.isNaN(endTime) && createTime > endTime)
                return false;
        }
        if (merchantMinAmount.value !== null && Number(o.totalAmount) < merchantMinAmount.value)
            return false;
        if (merchantMaxAmount.value !== null && Number(o.totalAmount) > merchantMaxAmount.value)
            return false;
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
        if (adminWindowStatus.value !== undefined && w.status !== adminWindowStatus.value)
            return false;
        if (adminWindowMerchantId.value !== null && w.merchantId !== adminWindowMerchantId.value)
            return false;
        if (!kw)
            return true;
        return w.name.includes(kw) || w.location.includes(kw) || String(w.id).includes(kw) || String(w.merchantId).includes(kw);
    });
});
const filteredUsers = computed(() => {
    const kw = userKeyword.value.trim();
    return allUsers.value.filter((u) => {
        if (adminUserRole.value !== undefined && u.role !== adminUserRole.value)
            return false;
        if (adminUserStatus.value !== undefined && u.status !== adminUserStatus.value)
            return false;
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
const sortedAdminDishList = computed(() => {
    const rows = [...adminDishList.value];
    if (adminDishSortType.value === "priceAsc") {
        rows.sort((a, b) => Number(a.price) - Number(b.price));
    }
    else if (adminDishSortType.value === "priceDesc") {
        rows.sort((a, b) => Number(b.price) - Number(a.price));
    }
    else if (adminDishSortType.value === "createTimeAsc") {
        rows.sort((a, b) => new Date(a.createTime || 0).getTime() - new Date(b.createTime || 0).getTime());
    }
    else {
        rows.sort((a, b) => new Date(b.createTime || 0).getTime() - new Date(a.createTime || 0).getTime());
    }
    return rows;
});
const selectedWindowLabel = computed(() => {
    if (!selectedWindowId.value)
        return "未选择窗口";
    const target = windows.value.find((w) => w.id === selectedWindowId.value);
    if (!target)
        return `窗口ID ${selectedWindowId.value}`;
    return `${target.name}（${target.location}）`;
});
const menuMerchantNameByMenuDishId = (menuDishId) => {
    for (const menu of userTodayMenus.value) {
        if ((menu.dishes || []).some((d) => d.id === menuDishId)) {
            return menu.merchantName || `商家ID ${menu.merchantId ?? "-"}`;
        }
    }
    return "-";
};
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
        const [winList, myOrderPage] = await Promise.all([getWindowsApi(), getMyOrdersApi()]);
        windows.value = winList.filter((w) => w.status === 1);
        if (isUser.value) {
            const menus = await getTodayMenusApi();
            userTodayMenus.value = menus;
            dishes.value = menus.flatMap((m) => m.dishes || []);
            orders.value = myOrderPage.records || [];
        }
        else if (isMerchant.value) {
            const merchantPage = await getMerchantOrdersApi({
                page: merchantOrderPage.value,
                size: merchantOrderSize.value,
                keyword: merchantOrderKeyword.value.trim() || undefined,
                status: merchantOrderStatus.value,
                dateFrom: merchantOrderDateRange.value?.[0],
                dateTo: merchantOrderDateRange.value?.[1]
            });
            merchantOrders.value = merchantPage.records || [];
            merchantOrderTotal.value = merchantPage.total || 0;
            merchantDishes.value = await getDishListApi();
            merchantTodayMenus.value = await getTodayMenusApi();
            lowStockDishes.value = merchantTodayMenus.value.flatMap((m) => m.dishes || []);
            merchantDishes.value.forEach((d) => {
                menuItemMap[d.id] = menuItemMap[d.id] || { enabled: false, salePrice: Number(d.price), stock: 50 };
            });
        }
        else {
            const [usersPage, usersForMerchant, windowsPage] = await Promise.all([
                queryUserListApi({ page: adminUserPage.value, size: adminUserSize.value, nickname: userKeyword.value.trim() || undefined }),
                getUserListApi(1, 200),
                getWindowsPageApi({
                    page: adminWindowPage.value,
                    size: adminWindowSize.value,
                    keyword: windowKeyword.value.trim() || undefined,
                    status: adminWindowStatus.value,
                    merchantId: adminWindowMerchantId.value || undefined
                })
            ]);
            adminMenuPageLoading.value = true;
            try {
                const menuPage = await getMenuListApi({
                    page: adminMenuPage.value,
                    size: adminMenuSize.value,
                    name: menuKeyword.value.trim() || undefined,
                    merchantId: adminMenuMerchantId.value || undefined,
                    saleDate: adminMenuSaleDate.value || undefined,
                    status: adminMenuStatus.value
                });
                adminMenus.value = menuPage.records || [];
                adminMenuTotal.value = menuPage.total || 0;
            }
            finally {
                adminMenuPageLoading.value = false;
            }
            adminDishPageLoading.value = true;
            try {
                const dishPage = await getDishPageApi({
                    page: adminDishPage.value,
                    size: adminDishSize.value,
                    merchantId: adminDishMerchantId.value || undefined,
                    name: adminDishQueryId.value ? undefined : adminDishNameKeyword.value.trim() || undefined,
                    category: adminDishCategoryKeyword.value.trim() || undefined,
                    status: adminDishStatus.value,
                    minPrice: adminDishMinPrice.value ?? undefined,
                    maxPrice: adminDishMaxPrice.value ?? undefined
                });
                let records = dishPage.records || [];
                if (adminDishQueryId.value) {
                    records = records.filter((d) => d.id === adminDishQueryId.value);
                }
                adminDishList.value = records;
                adminDishTotal.value = dishPage.total || 0;
            }
            finally {
                adminDishPageLoading.value = false;
            }
            allUsers.value = usersPage.records;
            adminUserTotal.value = usersPage.total;
            windows.value = windowsPage.records;
            adminWindowTotal.value = windowsPage.total;
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
const onAdminWindowPageChange = async (page) => {
    adminWindowPage.value = page;
    await loadAll();
};
const onAdminWindowSizeChange = async (size) => {
    adminWindowSize.value = size;
    adminWindowPage.value = 1;
    await loadAll();
};
const onAdminMenuPageChange = async (page) => {
    adminMenuPage.value = page;
    await loadAll();
};
const onAdminMenuSizeChange = async (size) => {
    adminMenuSize.value = size;
    adminMenuPage.value = 1;
    await loadAll();
};
const onAdminDishPageChange = async (page) => {
    adminDishPage.value = page;
    await loadAll();
};
const onAdminDishSizeChange = async (size) => {
    adminDishSize.value = size;
    adminDishPage.value = 1;
    await loadAll();
};
const onMerchantOrderPageChange = async (page) => {
    merchantOrderPage.value = page;
    await loadAll();
};
const onMerchantOrderSizeChange = async (size) => {
    merchantOrderSize.value = size;
    merchantOrderPage.value = 1;
    await loadAll();
};
const resetUserOrderFilters = () => {
    userOrderFilter.value = "all";
    userAdvancedStatus.value = undefined;
    userOrderDateRange.value = null;
    userMinAmount.value = null;
    userMaxAmount.value = null;
    userOrderKeyword.value = "";
};
const resetMerchantOrderFilters = () => {
    merchantOrderKeyword.value = "";
    merchantOrderStatus.value = undefined;
    merchantOrderDateRange.value = null;
    merchantMinAmount.value = null;
    merchantMaxAmount.value = null;
    merchantOrderPage.value = 1;
    loadAll();
};
const resetAdminWindowFilters = () => {
    windowKeyword.value = "";
    adminWindowStatus.value = undefined;
    adminWindowMerchantId.value = null;
    adminWindowPage.value = 1;
    loadAll();
};
const resetAdminUserFilters = () => {
    userKeyword.value = "";
    adminUserRole.value = undefined;
    adminUserStatus.value = undefined;
    adminUserPage.value = 1;
    loadAll();
};
const resetAdminMenuFilters = () => {
    menuKeyword.value = "";
    adminMenuMerchantId.value = null;
    adminMenuStatus.value = undefined;
    adminMenuSaleDate.value = "";
    adminMenuPage.value = 1;
    loadAll();
};
const resetAdminDishFilters = () => {
    adminDishQueryId.value = null;
    adminDishNameKeyword.value = "";
    adminDishCategoryKeyword.value = "";
    adminDishMerchantId.value = null;
    adminDishStatus.value = undefined;
    adminDishMinPrice.value = null;
    adminDishMaxPrice.value = null;
    adminDishSortType.value = "createTimeDesc";
    adminDishPage.value = 1;
    adminDishDetail.value = null;
    loadAll();
};
const toggleUserStatus = async (user) => {
    await updateUserStatusApi(user.id, user.status === 1 ? 0 : 1);
    ElMessage.success("用户状态已更新");
    await loadAll();
};
const removeUser = async (user) => {
    await deleteUserApi(user.id);
    ElMessage.success("用户已删除");
    await loadAll();
};
const resetUserPassword = (user) => {
    ElMessageBox.prompt("为该用户设置新密码（6～20 位，与注册规则一致）", "重置密码", {
        confirmButtonText: "确定",
        cancelButtonText: "取消",
        inputType: "password",
        inputPlaceholder: "新密码",
        inputValidator: (v) => {
            if (!v || v.trim().length < 6 || v.trim().length > 20) {
                return "密码长度需为 6～20 位";
            }
            return true;
        }
    })
        .then(async ({ value }) => {
        await resetUserPasswordApi(user.id, value.trim());
        ElMessage.success(`已重置 ${user.nickname ?? user.phone} 的密码`);
        await loadAll();
    })
        .catch(() => { });
};
const toggleWindowStatus = async (row) => {
    await updateWindowStatusApi(row.id, row.status === 1 ? 0 : 1);
    ElMessage.success("窗口状态已更新");
    await loadAll();
};
const removeWindow = async (row) => {
    await deleteWindowApi(row.id);
    ElMessage.success("窗口已删除");
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
const openAdminMenuEdit = (row) => {
    adminMenuEditId.value = row.id;
    adminMenuEditForm.name = row.name || "";
    adminMenuEditForm.saleDate = row.saleDate || "";
    adminMenuEditForm.startTime = row.startTime || "";
    adminMenuEditForm.endTime = row.endTime || "";
    adminMenuEditVisible.value = true;
};
const submitAdminMenuEdit = async () => {
    if (!adminMenuEditId.value)
        return;
    adminMenuEditSaving.value = true;
    try {
        await adminUpdateMenuApi(adminMenuEditId.value, {
            name: adminMenuEditForm.name.trim() || undefined,
            saleDate: adminMenuEditForm.saleDate || undefined,
            startTime: adminMenuEditForm.startTime || undefined,
            endTime: adminMenuEditForm.endTime || undefined
        });
        ElMessage.success("菜单已更新");
        adminMenuEditVisible.value = false;
        await loadAll();
    }
    finally {
        adminMenuEditSaving.value = false;
    }
};
const toggleAdminMenuStatus = async (row) => {
    await adminUpdateMenuStatusApi(row.id, row.status === 1 ? 0 : 1);
    ElMessage.success("菜单状态已更新");
    await loadAll();
};
const deleteAdminMenu = async (row) => {
    await ElMessageBox.confirm(`确认删除菜单「${row.name}」？`, "删除菜单", {
        confirmButtonText: "删除",
        cancelButtonText: "取消",
        type: "warning"
    });
    await adminDeleteMenuApi(row.id);
    ElMessage.success("菜单已删除");
    await loadAll();
};
const batchUpdateAdminMenuStatus = async (value) => {
    if (adminMenuSelectedIds.value.length === 0)
        return;
    adminMenuBatchLoading.value = true;
    try {
        for (const id of adminMenuSelectedIds.value) {
            await adminUpdateMenuStatusApi(id, value);
        }
        ElMessage.success(value === 1 ? "已批量启用" : "已批量停用");
        adminMenuSelectedIds.value = [];
        await loadAll();
    }
    finally {
        adminMenuBatchLoading.value = false;
    }
};
const batchDeleteAdminMenus = async () => {
    if (adminMenuSelectedIds.value.length === 0)
        return;
    await ElMessageBox.confirm(`确认删除选中的 ${adminMenuSelectedIds.value.length} 个菜单？`, "批量删除菜单", {
        confirmButtonText: "删除",
        cancelButtonText: "取消",
        type: "warning"
    });
    adminMenuBatchLoading.value = true;
    try {
        for (const id of adminMenuSelectedIds.value) {
            await adminDeleteMenuApi(id);
        }
        ElMessage.success("已批量删除");
        adminMenuSelectedIds.value = [];
        await loadAll();
    }
    finally {
        adminMenuBatchLoading.value = false;
    }
};
const onAdminMenuSelectionChange = (rows) => {
    adminMenuSelectedIds.value = (rows || []).map((r) => r.id);
};
const openAdminMenuDishEdit = (row) => {
    adminMenuDishEditForm.menuDishId = row.id;
    adminMenuDishEditForm.dishId = row.dishId;
    adminMenuDishEditForm.salePrice = Number(row.salePrice);
    adminMenuDishEditForm.status = row.status;
    adminMenuDishEditVisible.value = true;
};
const submitAdminMenuDishEdit = async () => {
    adminMenuDishEditSaving.value = true;
    try {
        await adminUpdateMenuDishApi(adminMenuDishEditForm.menuDishId, {
            dishId: adminMenuDishEditForm.dishId,
            salePrice: Number(adminMenuDishEditForm.salePrice),
            status: adminMenuDishEditForm.status
        });
        ElMessage.success("菜单项已更新");
        adminMenuDishEditVisible.value = false;
        // refresh detail view for immediate feedback
        if (adminMenuDetail.value?.id) {
            adminMenuDetail.value = await getMenuDetailApi(adminMenuDetail.value.id);
        }
    }
    finally {
        adminMenuDishEditSaving.value = false;
    }
};
const openAdminStockOp = (row) => {
    adminStockMenuDishId.value = row.id;
    adminStockOpForm.op = "SET";
    adminStockOpForm.value = Number(row.stock);
    adminStockOpForm.reason = "";
    adminStockOpVisible.value = true;
};
const submitAdminStockOp = async () => {
    if (!adminStockMenuDishId.value)
        return;
    adminStockOpSaving.value = true;
    try {
        await updateStockApi(adminStockMenuDishId.value, adminStockOpForm);
        ElMessage.success("库存已更新");
        adminStockOpVisible.value = false;
        if (adminMenuDetail.value?.id) {
            adminMenuDetail.value = await getMenuDetailApi(adminMenuDetail.value.id);
        }
    }
    finally {
        adminStockOpSaving.value = false;
    }
};
const openAdminDishDetail = async (dishId) => {
    adminDishQueryLoading.value = true;
    try {
        adminDishDetail.value = await getDishDetailApi(dishId);
        ElMessage.success("查询成功");
    }
    finally {
        adminDishQueryLoading.value = false;
    }
};
const loadAdminDishPage = async (resetPage = false) => {
    if (resetPage) {
        adminDishPage.value = 1;
    }
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
const goMerchantStock = async () => {
    await router.push("/merchant/stock");
};
const goAdminStock = async () => {
    await router.push("/admin/stock");
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
if (__VLS_ctx.isAdmin) {
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
        onClick: (__VLS_ctx.goAdminStock)
    };
    __VLS_19.slots.default;
    var __VLS_19;
}
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
    onClick: (__VLS_ctx.goDisplay)
};
__VLS_27.slots.default;
var __VLS_27;
const __VLS_32 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_33 = __VLS_asFunctionalComponent(__VLS_32, new __VLS_32({
    ...{ 'onClick': {} },
    type: "primary",
    plain: true,
}));
const __VLS_34 = __VLS_33({
    ...{ 'onClick': {} },
    type: "primary",
    plain: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_33));
let __VLS_36;
let __VLS_37;
let __VLS_38;
const __VLS_39 = {
    onClick: (__VLS_ctx.goProfile)
};
__VLS_35.slots.default;
var __VLS_35;
const __VLS_40 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_41 = __VLS_asFunctionalComponent(__VLS_40, new __VLS_40({
    ...{ 'onClick': {} },
    type: "danger",
    plain: true,
}));
const __VLS_42 = __VLS_41({
    ...{ 'onClick': {} },
    type: "danger",
    plain: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_41));
let __VLS_44;
let __VLS_45;
let __VLS_46;
const __VLS_47 = {
    onClick: (__VLS_ctx.logout)
};
__VLS_43.slots.default;
var __VLS_43;
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
const __VLS_48 = {}.ElCard;
/** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
// @ts-ignore
const __VLS_49 = __VLS_asFunctionalComponent(__VLS_48, new __VLS_48({
    ...{ class: "nav-card" },
}));
const __VLS_50 = __VLS_49({
    ...{ class: "nav-card" },
}, ...__VLS_functionalComponentArgsRest(__VLS_49));
__VLS_51.slots.default;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "role-nav" },
});
for (const [item] of __VLS_getVForSourceType((__VLS_ctx.roleNavItems))) {
    (item.key);
    const __VLS_52 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_53 = __VLS_asFunctionalComponent(__VLS_52, new __VLS_52({
        ...{ 'onClick': {} },
        type: (__VLS_ctx.activeSection === item.key ? 'primary' : 'default'),
        plain: true,
        ...{ class: "nav-item-btn" },
    }));
    const __VLS_54 = __VLS_53({
        ...{ 'onClick': {} },
        type: (__VLS_ctx.activeSection === item.key ? 'primary' : 'default'),
        plain: true,
        ...{ class: "nav-item-btn" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_53));
    let __VLS_56;
    let __VLS_57;
    let __VLS_58;
    const __VLS_59 = {
        onClick: (...[$event]) => {
            __VLS_ctx.activeSection = item.key;
        }
    };
    __VLS_55.slots.default;
    (item.label);
    var __VLS_55;
    if (__VLS_ctx.isMerchant && item.key === __VLS_ctx.sectionIdMap.merchantStock) {
        const __VLS_60 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        const __VLS_61 = __VLS_asFunctionalComponent(__VLS_60, new __VLS_60({
            ...{ 'onClick': {} },
            type: "primary",
            plain: true,
            ...{ class: "nav-item-btn" },
        }));
        const __VLS_62 = __VLS_61({
            ...{ 'onClick': {} },
            type: "primary",
            plain: true,
            ...{ class: "nav-item-btn" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_61));
        let __VLS_64;
        let __VLS_65;
        let __VLS_66;
        const __VLS_67 = {
            onClick: (__VLS_ctx.goMerchantStock)
        };
        __VLS_63.slots.default;
        var __VLS_63;
    }
}
var __VLS_51;
if (__VLS_ctx.isUser && __VLS_ctx.activeSection === __VLS_ctx.sectionIdMap.userMenu) {
    const __VLS_68 = {}.ElRow;
    /** @type {[typeof __VLS_components.ElRow, typeof __VLS_components.elRow, typeof __VLS_components.ElRow, typeof __VLS_components.elRow, ]} */ ;
    // @ts-ignore
    const __VLS_69 = __VLS_asFunctionalComponent(__VLS_68, new __VLS_68({
        gutter: (16),
    }));
    const __VLS_70 = __VLS_69({
        gutter: (16),
    }, ...__VLS_functionalComponentArgsRest(__VLS_69));
    __VLS_71.slots.default;
    const __VLS_72 = {}.ElCol;
    /** @type {[typeof __VLS_components.ElCol, typeof __VLS_components.elCol, typeof __VLS_components.ElCol, typeof __VLS_components.elCol, ]} */ ;
    // @ts-ignore
    const __VLS_73 = __VLS_asFunctionalComponent(__VLS_72, new __VLS_72({
        span: (16),
    }));
    const __VLS_74 = __VLS_73({
        span: (16),
    }, ...__VLS_functionalComponentArgsRest(__VLS_73));
    __VLS_75.slots.default;
    const __VLS_76 = {}.ElCard;
    /** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
    // @ts-ignore
    const __VLS_77 = __VLS_asFunctionalComponent(__VLS_76, new __VLS_76({
        id: (__VLS_ctx.sectionIdMap.userMenu),
        ...{ class: "student-menu-card" },
    }));
    const __VLS_78 = __VLS_77({
        id: (__VLS_ctx.sectionIdMap.userMenu),
        ...{ class: "student-menu-card" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_77));
    __VLS_79.slots.default;
    {
        const { header: __VLS_thisSlot } = __VLS_79.slots;
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "section-head" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
    }
    const __VLS_80 = {}.ElInput;
    /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
    // @ts-ignore
    const __VLS_81 = __VLS_asFunctionalComponent(__VLS_80, new __VLS_80({
        modelValue: (__VLS_ctx.userMenuKeyword),
        placeholder: "按菜品名/菜单菜品ID查询",
        ...{ class: "query-input" },
    }));
    const __VLS_82 = __VLS_81({
        modelValue: (__VLS_ctx.userMenuKeyword),
        placeholder: "按菜品名/菜单菜品ID查询",
        ...{ class: "query-input" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_81));
    if (__VLS_ctx.filteredMenuDishes.length === 0) {
        const __VLS_84 = {}.ElEmpty;
        /** @type {[typeof __VLS_components.ElEmpty, typeof __VLS_components.elEmpty, ]} */ ;
        // @ts-ignore
        const __VLS_85 = __VLS_asFunctionalComponent(__VLS_84, new __VLS_84({
            description: "当前无可用菜单",
        }));
        const __VLS_86 = __VLS_85({
            description: "当前无可用菜单",
        }, ...__VLS_functionalComponentArgsRest(__VLS_85));
    }
    else {
        const __VLS_88 = {}.ElTable;
        /** @type {[typeof __VLS_components.ElTable, typeof __VLS_components.elTable, typeof __VLS_components.ElTable, typeof __VLS_components.elTable, ]} */ ;
        // @ts-ignore
        const __VLS_89 = __VLS_asFunctionalComponent(__VLS_88, new __VLS_88({
            data: (__VLS_ctx.filteredMenuDishes),
            size: "small",
        }));
        const __VLS_90 = __VLS_89({
            data: (__VLS_ctx.filteredMenuDishes),
            size: "small",
        }, ...__VLS_functionalComponentArgsRest(__VLS_89));
        __VLS_91.slots.default;
        const __VLS_92 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_93 = __VLS_asFunctionalComponent(__VLS_92, new __VLS_92({
            prop: "dishName",
            label: "菜品",
            minWidth: "120",
        }));
        const __VLS_94 = __VLS_93({
            prop: "dishName",
            label: "菜品",
            minWidth: "120",
        }, ...__VLS_functionalComponentArgsRest(__VLS_93));
        const __VLS_96 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_97 = __VLS_asFunctionalComponent(__VLS_96, new __VLS_96({
            label: "商家",
            minWidth: "120",
        }));
        const __VLS_98 = __VLS_97({
            label: "商家",
            minWidth: "120",
        }, ...__VLS_functionalComponentArgsRest(__VLS_97));
        __VLS_99.slots.default;
        {
            const { default: __VLS_thisSlot } = __VLS_99.slots;
            const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
            (__VLS_ctx.menuMerchantNameByMenuDishId(row.id));
        }
        var __VLS_99;
        const __VLS_100 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_101 = __VLS_asFunctionalComponent(__VLS_100, new __VLS_100({
            prop: "salePrice",
            label: "价格",
            width: "90",
        }));
        const __VLS_102 = __VLS_101({
            prop: "salePrice",
            label: "价格",
            width: "90",
        }, ...__VLS_functionalComponentArgsRest(__VLS_101));
        __VLS_103.slots.default;
        {
            const { default: __VLS_thisSlot } = __VLS_103.slots;
            const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
            (row.salePrice);
        }
        var __VLS_103;
        const __VLS_104 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_105 = __VLS_asFunctionalComponent(__VLS_104, new __VLS_104({
            prop: "stock",
            label: "库存",
            width: "80",
        }));
        const __VLS_106 = __VLS_105({
            prop: "stock",
            label: "库存",
            width: "80",
        }, ...__VLS_functionalComponentArgsRest(__VLS_105));
        const __VLS_108 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_109 = __VLS_asFunctionalComponent(__VLS_108, new __VLS_108({
            label: "提示",
            width: "100",
        }));
        const __VLS_110 = __VLS_109({
            label: "提示",
            width: "100",
        }, ...__VLS_functionalComponentArgsRest(__VLS_109));
        __VLS_111.slots.default;
        {
            const { default: __VLS_thisSlot } = __VLS_111.slots;
            const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
            if (row.stock <= 10) {
                const __VLS_112 = {}.ElTag;
                /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
                // @ts-ignore
                const __VLS_113 = __VLS_asFunctionalComponent(__VLS_112, new __VLS_112({
                    type: "danger",
                    size: "small",
                }));
                const __VLS_114 = __VLS_113({
                    type: "danger",
                    size: "small",
                }, ...__VLS_functionalComponentArgsRest(__VLS_113));
                __VLS_115.slots.default;
                var __VLS_115;
            }
            else {
                const __VLS_116 = {}.ElTag;
                /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
                // @ts-ignore
                const __VLS_117 = __VLS_asFunctionalComponent(__VLS_116, new __VLS_116({
                    type: "success",
                    size: "small",
                }));
                const __VLS_118 = __VLS_117({
                    type: "success",
                    size: "small",
                }, ...__VLS_functionalComponentArgsRest(__VLS_117));
                __VLS_119.slots.default;
                var __VLS_119;
            }
        }
        var __VLS_111;
        const __VLS_120 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_121 = __VLS_asFunctionalComponent(__VLS_120, new __VLS_120({
            label: "数量",
            width: "120",
        }));
        const __VLS_122 = __VLS_121({
            label: "数量",
            width: "120",
        }, ...__VLS_functionalComponentArgsRest(__VLS_121));
        __VLS_123.slots.default;
        {
            const { default: __VLS_thisSlot } = __VLS_123.slots;
            const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
            const __VLS_124 = {}.ElInputNumber;
            /** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
            // @ts-ignore
            const __VLS_125 = __VLS_asFunctionalComponent(__VLS_124, new __VLS_124({
                modelValue: (__VLS_ctx.quantityMap[row.id]),
                min: (0),
                max: (20),
                step: (1),
                size: "small",
            }));
            const __VLS_126 = __VLS_125({
                modelValue: (__VLS_ctx.quantityMap[row.id]),
                min: (0),
                max: (20),
                step: (1),
                size: "small",
            }, ...__VLS_functionalComponentArgsRest(__VLS_125));
        }
        var __VLS_123;
        var __VLS_91;
    }
    var __VLS_79;
    var __VLS_75;
    const __VLS_128 = {}.ElCol;
    /** @type {[typeof __VLS_components.ElCol, typeof __VLS_components.elCol, typeof __VLS_components.ElCol, typeof __VLS_components.elCol, ]} */ ;
    // @ts-ignore
    const __VLS_129 = __VLS_asFunctionalComponent(__VLS_128, new __VLS_128({
        span: (8),
    }));
    const __VLS_130 = __VLS_129({
        span: (8),
    }, ...__VLS_functionalComponentArgsRest(__VLS_129));
    __VLS_131.slots.default;
    const __VLS_132 = {}.ElCard;
    /** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
    // @ts-ignore
    const __VLS_133 = __VLS_asFunctionalComponent(__VLS_132, new __VLS_132({}));
    const __VLS_134 = __VLS_133({}, ...__VLS_functionalComponentArgsRest(__VLS_133));
    __VLS_135.slots.default;
    {
        const { header: __VLS_thisSlot } = __VLS_135.slots;
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "section-head" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
    }
    const __VLS_136 = {}.ElForm;
    /** @type {[typeof __VLS_components.ElForm, typeof __VLS_components.elForm, typeof __VLS_components.ElForm, typeof __VLS_components.elForm, ]} */ ;
    // @ts-ignore
    const __VLS_137 = __VLS_asFunctionalComponent(__VLS_136, new __VLS_136({
        labelWidth: "90px",
    }));
    const __VLS_138 = __VLS_137({
        labelWidth: "90px",
    }, ...__VLS_functionalComponentArgsRest(__VLS_137));
    __VLS_139.slots.default;
    const __VLS_140 = {}.ElFormItem;
    /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
    // @ts-ignore
    const __VLS_141 = __VLS_asFunctionalComponent(__VLS_140, new __VLS_140({
        label: "取餐窗口",
    }));
    const __VLS_142 = __VLS_141({
        label: "取餐窗口",
    }, ...__VLS_functionalComponentArgsRest(__VLS_141));
    __VLS_143.slots.default;
    const __VLS_144 = {}.ElSelect;
    /** @type {[typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, ]} */ ;
    // @ts-ignore
    const __VLS_145 = __VLS_asFunctionalComponent(__VLS_144, new __VLS_144({
        modelValue: (__VLS_ctx.selectedWindowId),
        placeholder: "请选择窗口",
        ...{ style: {} },
    }));
    const __VLS_146 = __VLS_145({
        modelValue: (__VLS_ctx.selectedWindowId),
        placeholder: "请选择窗口",
        ...{ style: {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_145));
    __VLS_147.slots.default;
    for (const [w] of __VLS_getVForSourceType((__VLS_ctx.windows))) {
        const __VLS_148 = {}.ElOption;
        /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
        // @ts-ignore
        const __VLS_149 = __VLS_asFunctionalComponent(__VLS_148, new __VLS_148({
            key: (w.id),
            label: (`${w.name} (${w.location})`),
            value: (w.id),
        }));
        const __VLS_150 = __VLS_149({
            key: (w.id),
            label: (`${w.name} (${w.location})`),
            value: (w.id),
        }, ...__VLS_functionalComponentArgsRest(__VLS_149));
    }
    var __VLS_147;
    var __VLS_143;
    const __VLS_152 = {}.ElFormItem;
    /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
    // @ts-ignore
    const __VLS_153 = __VLS_asFunctionalComponent(__VLS_152, new __VLS_152({
        label: "备注",
    }));
    const __VLS_154 = __VLS_153({
        label: "备注",
    }, ...__VLS_functionalComponentArgsRest(__VLS_153));
    __VLS_155.slots.default;
    const __VLS_156 = {}.ElInput;
    /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
    // @ts-ignore
    const __VLS_157 = __VLS_asFunctionalComponent(__VLS_156, new __VLS_156({
        modelValue: (__VLS_ctx.remark),
        placeholder: "例如：少辣、不加葱",
    }));
    const __VLS_158 = __VLS_157({
        modelValue: (__VLS_ctx.remark),
        placeholder: "例如：少辣、不加葱",
    }, ...__VLS_functionalComponentArgsRest(__VLS_157));
    var __VLS_155;
    var __VLS_139;
    const __VLS_160 = {}.ElAlert;
    /** @type {[typeof __VLS_components.ElAlert, typeof __VLS_components.elAlert, ]} */ ;
    // @ts-ignore
    const __VLS_161 = __VLS_asFunctionalComponent(__VLS_160, new __VLS_160({
        closable: (false),
        type: "info",
        title: (`下单窗口：${__VLS_ctx.selectedWindowLabel}`),
    }));
    const __VLS_162 = __VLS_161({
        closable: (false),
        type: "info",
        title: (`下单窗口：${__VLS_ctx.selectedWindowLabel}`),
    }, ...__VLS_functionalComponentArgsRest(__VLS_161));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "summary" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
    (__VLS_ctx.selectedCount);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
    (__VLS_ctx.totalAmount.toFixed(2));
    const __VLS_164 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_165 = __VLS_asFunctionalComponent(__VLS_164, new __VLS_164({
        ...{ 'onClick': {} },
        type: "primary",
        ...{ class: "full-btn" },
        loading: (__VLS_ctx.submitting),
    }));
    const __VLS_166 = __VLS_165({
        ...{ 'onClick': {} },
        type: "primary",
        ...{ class: "full-btn" },
        loading: (__VLS_ctx.submitting),
    }, ...__VLS_functionalComponentArgsRest(__VLS_165));
    let __VLS_168;
    let __VLS_169;
    let __VLS_170;
    const __VLS_171 = {
        onClick: (__VLS_ctx.submitOrder)
    };
    __VLS_167.slots.default;
    var __VLS_167;
    var __VLS_135;
    var __VLS_131;
    var __VLS_71;
}
if (__VLS_ctx.isUser && __VLS_ctx.activeSection === __VLS_ctx.sectionIdMap.userOrders) {
    const __VLS_172 = {}.ElCard;
    /** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
    // @ts-ignore
    const __VLS_173 = __VLS_asFunctionalComponent(__VLS_172, new __VLS_172({
        id: (__VLS_ctx.sectionIdMap.userOrders),
        ...{ class: "order-card" },
    }));
    const __VLS_174 = __VLS_173({
        id: (__VLS_ctx.sectionIdMap.userOrders),
        ...{ class: "order-card" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_173));
    __VLS_175.slots.default;
    {
        const { header: __VLS_thisSlot } = __VLS_175.slots;
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "section-head" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        const __VLS_176 = {}.ElRadioGroup;
        /** @type {[typeof __VLS_components.ElRadioGroup, typeof __VLS_components.elRadioGroup, typeof __VLS_components.ElRadioGroup, typeof __VLS_components.elRadioGroup, ]} */ ;
        // @ts-ignore
        const __VLS_177 = __VLS_asFunctionalComponent(__VLS_176, new __VLS_176({
            modelValue: (__VLS_ctx.userOrderFilter),
            size: "small",
        }));
        const __VLS_178 = __VLS_177({
            modelValue: (__VLS_ctx.userOrderFilter),
            size: "small",
        }, ...__VLS_functionalComponentArgsRest(__VLS_177));
        __VLS_179.slots.default;
        const __VLS_180 = {}.ElRadioButton;
        /** @type {[typeof __VLS_components.ElRadioButton, typeof __VLS_components.elRadioButton, typeof __VLS_components.ElRadioButton, typeof __VLS_components.elRadioButton, ]} */ ;
        // @ts-ignore
        const __VLS_181 = __VLS_asFunctionalComponent(__VLS_180, new __VLS_180({
            label: "all",
        }));
        const __VLS_182 = __VLS_181({
            label: "all",
        }, ...__VLS_functionalComponentArgsRest(__VLS_181));
        __VLS_183.slots.default;
        var __VLS_183;
        const __VLS_184 = {}.ElRadioButton;
        /** @type {[typeof __VLS_components.ElRadioButton, typeof __VLS_components.elRadioButton, typeof __VLS_components.ElRadioButton, typeof __VLS_components.elRadioButton, ]} */ ;
        // @ts-ignore
        const __VLS_185 = __VLS_asFunctionalComponent(__VLS_184, new __VLS_184({
            label: (0),
        }));
        const __VLS_186 = __VLS_185({
            label: (0),
        }, ...__VLS_functionalComponentArgsRest(__VLS_185));
        __VLS_187.slots.default;
        var __VLS_187;
        const __VLS_188 = {}.ElRadioButton;
        /** @type {[typeof __VLS_components.ElRadioButton, typeof __VLS_components.elRadioButton, typeof __VLS_components.ElRadioButton, typeof __VLS_components.elRadioButton, ]} */ ;
        // @ts-ignore
        const __VLS_189 = __VLS_asFunctionalComponent(__VLS_188, new __VLS_188({
            label: (3),
        }));
        const __VLS_190 = __VLS_189({
            label: (3),
        }, ...__VLS_functionalComponentArgsRest(__VLS_189));
        __VLS_191.slots.default;
        var __VLS_191;
        const __VLS_192 = {}.ElRadioButton;
        /** @type {[typeof __VLS_components.ElRadioButton, typeof __VLS_components.elRadioButton, typeof __VLS_components.ElRadioButton, typeof __VLS_components.elRadioButton, ]} */ ;
        // @ts-ignore
        const __VLS_193 = __VLS_asFunctionalComponent(__VLS_192, new __VLS_192({
            label: (4),
        }));
        const __VLS_194 = __VLS_193({
            label: (4),
        }, ...__VLS_functionalComponentArgsRest(__VLS_193));
        __VLS_195.slots.default;
        var __VLS_195;
        var __VLS_179;
    }
    const __VLS_196 = {}.ElInput;
    /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
    // @ts-ignore
    const __VLS_197 = __VLS_asFunctionalComponent(__VLS_196, new __VLS_196({
        modelValue: (__VLS_ctx.userOrderKeyword),
        placeholder: "按订单号/取餐码/叫号码查询",
        ...{ class: "query-input" },
    }));
    const __VLS_198 = __VLS_197({
        modelValue: (__VLS_ctx.userOrderKeyword),
        placeholder: "按订单号/取餐码/叫号码查询",
        ...{ class: "query-input" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_197));
    const __VLS_200 = {}.ElSpace;
    /** @type {[typeof __VLS_components.ElSpace, typeof __VLS_components.elSpace, typeof __VLS_components.ElSpace, typeof __VLS_components.elSpace, ]} */ ;
    // @ts-ignore
    const __VLS_201 = __VLS_asFunctionalComponent(__VLS_200, new __VLS_200({
        wrap: true,
        ...{ class: "query-row" },
    }));
    const __VLS_202 = __VLS_201({
        wrap: true,
        ...{ class: "query-row" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_201));
    __VLS_203.slots.default;
    const __VLS_204 = {}.ElSelect;
    /** @type {[typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, ]} */ ;
    // @ts-ignore
    const __VLS_205 = __VLS_asFunctionalComponent(__VLS_204, new __VLS_204({
        modelValue: (__VLS_ctx.userAdvancedStatus),
        placeholder: "状态筛选",
        clearable: true,
        ...{ class: "query-input-short" },
    }));
    const __VLS_206 = __VLS_205({
        modelValue: (__VLS_ctx.userAdvancedStatus),
        placeholder: "状态筛选",
        clearable: true,
        ...{ class: "query-input-short" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_205));
    __VLS_207.slots.default;
    const __VLS_208 = {}.ElOption;
    /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
    // @ts-ignore
    const __VLS_209 = __VLS_asFunctionalComponent(__VLS_208, new __VLS_208({
        value: (0),
        label: "已下单",
    }));
    const __VLS_210 = __VLS_209({
        value: (0),
        label: "已下单",
    }, ...__VLS_functionalComponentArgsRest(__VLS_209));
    const __VLS_212 = {}.ElOption;
    /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
    // @ts-ignore
    const __VLS_213 = __VLS_asFunctionalComponent(__VLS_212, new __VLS_212({
        value: (1),
        label: "已接单",
    }));
    const __VLS_214 = __VLS_213({
        value: (1),
        label: "已接单",
    }, ...__VLS_functionalComponentArgsRest(__VLS_213));
    const __VLS_216 = {}.ElOption;
    /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
    // @ts-ignore
    const __VLS_217 = __VLS_asFunctionalComponent(__VLS_216, new __VLS_216({
        value: (2),
        label: "制作中",
    }));
    const __VLS_218 = __VLS_217({
        value: (2),
        label: "制作中",
    }, ...__VLS_functionalComponentArgsRest(__VLS_217));
    const __VLS_220 = {}.ElOption;
    /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
    // @ts-ignore
    const __VLS_221 = __VLS_asFunctionalComponent(__VLS_220, new __VLS_220({
        value: (3),
        label: "待取餐",
    }));
    const __VLS_222 = __VLS_221({
        value: (3),
        label: "待取餐",
    }, ...__VLS_functionalComponentArgsRest(__VLS_221));
    const __VLS_224 = {}.ElOption;
    /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
    // @ts-ignore
    const __VLS_225 = __VLS_asFunctionalComponent(__VLS_224, new __VLS_224({
        value: (4),
        label: "已取餐",
    }));
    const __VLS_226 = __VLS_225({
        value: (4),
        label: "已取餐",
    }, ...__VLS_functionalComponentArgsRest(__VLS_225));
    const __VLS_228 = {}.ElOption;
    /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
    // @ts-ignore
    const __VLS_229 = __VLS_asFunctionalComponent(__VLS_228, new __VLS_228({
        value: (5),
        label: "已取消",
    }));
    const __VLS_230 = __VLS_229({
        value: (5),
        label: "已取消",
    }, ...__VLS_functionalComponentArgsRest(__VLS_229));
    var __VLS_207;
    const __VLS_232 = {}.ElDatePicker;
    /** @type {[typeof __VLS_components.ElDatePicker, typeof __VLS_components.elDatePicker, ]} */ ;
    // @ts-ignore
    const __VLS_233 = __VLS_asFunctionalComponent(__VLS_232, new __VLS_232({
        modelValue: (__VLS_ctx.userOrderDateRange),
        type: "datetimerange",
        valueFormat: "YYYY-MM-DDTHH:mm:ss",
        startPlaceholder: "开始时间",
        endPlaceholder: "结束时间",
        rangeSeparator: "至",
    }));
    const __VLS_234 = __VLS_233({
        modelValue: (__VLS_ctx.userOrderDateRange),
        type: "datetimerange",
        valueFormat: "YYYY-MM-DDTHH:mm:ss",
        startPlaceholder: "开始时间",
        endPlaceholder: "结束时间",
        rangeSeparator: "至",
    }, ...__VLS_functionalComponentArgsRest(__VLS_233));
    const __VLS_236 = {}.ElInputNumber;
    /** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
    // @ts-ignore
    const __VLS_237 = __VLS_asFunctionalComponent(__VLS_236, new __VLS_236({
        modelValue: (__VLS_ctx.userMinAmount),
        min: (0),
        step: (1),
        placeholder: "最小金额",
    }));
    const __VLS_238 = __VLS_237({
        modelValue: (__VLS_ctx.userMinAmount),
        min: (0),
        step: (1),
        placeholder: "最小金额",
    }, ...__VLS_functionalComponentArgsRest(__VLS_237));
    const __VLS_240 = {}.ElInputNumber;
    /** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
    // @ts-ignore
    const __VLS_241 = __VLS_asFunctionalComponent(__VLS_240, new __VLS_240({
        modelValue: (__VLS_ctx.userMaxAmount),
        min: (0),
        step: (1),
        placeholder: "最大金额",
    }));
    const __VLS_242 = __VLS_241({
        modelValue: (__VLS_ctx.userMaxAmount),
        min: (0),
        step: (1),
        placeholder: "最大金额",
    }, ...__VLS_functionalComponentArgsRest(__VLS_241));
    const __VLS_244 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_245 = __VLS_asFunctionalComponent(__VLS_244, new __VLS_244({
        ...{ 'onClick': {} },
    }));
    const __VLS_246 = __VLS_245({
        ...{ 'onClick': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_245));
    let __VLS_248;
    let __VLS_249;
    let __VLS_250;
    const __VLS_251 = {
        onClick: (__VLS_ctx.resetUserOrderFilters)
    };
    __VLS_247.slots.default;
    var __VLS_247;
    var __VLS_203;
    const __VLS_252 = {}.ElTable;
    /** @type {[typeof __VLS_components.ElTable, typeof __VLS_components.elTable, typeof __VLS_components.ElTable, typeof __VLS_components.elTable, ]} */ ;
    // @ts-ignore
    const __VLS_253 = __VLS_asFunctionalComponent(__VLS_252, new __VLS_252({
        data: (__VLS_ctx.filteredUserOrders),
        size: "small",
    }));
    const __VLS_254 = __VLS_253({
        data: (__VLS_ctx.filteredUserOrders),
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
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_265 = __VLS_asFunctionalComponent(__VLS_264, new __VLS_264({
        prop: "totalAmount",
        label: "金额",
        width: "90",
    }));
    const __VLS_266 = __VLS_265({
        prop: "totalAmount",
        label: "金额",
        width: "90",
    }, ...__VLS_functionalComponentArgsRest(__VLS_265));
    __VLS_267.slots.default;
    {
        const { default: __VLS_thisSlot } = __VLS_267.slots;
        const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
        (row.totalAmount);
    }
    var __VLS_267;
    const __VLS_268 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_269 = __VLS_asFunctionalComponent(__VLS_268, new __VLS_268({
        prop: "status",
        label: "状态",
        width: "110",
    }));
    const __VLS_270 = __VLS_269({
        prop: "status",
        label: "状态",
        width: "110",
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
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_277 = __VLS_asFunctionalComponent(__VLS_276, new __VLS_276({
        prop: "pickupNo",
        label: "叫号码",
        width: "90",
    }));
    const __VLS_278 = __VLS_277({
        prop: "pickupNo",
        label: "叫号码",
        width: "90",
    }, ...__VLS_functionalComponentArgsRest(__VLS_277));
    const __VLS_280 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_281 = __VLS_asFunctionalComponent(__VLS_280, new __VLS_280({
        prop: "createTime",
        label: "创建时间",
        minWidth: "170",
    }));
    const __VLS_282 = __VLS_281({
        prop: "createTime",
        label: "创建时间",
        minWidth: "170",
    }, ...__VLS_functionalComponentArgsRest(__VLS_281));
    const __VLS_284 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_285 = __VLS_asFunctionalComponent(__VLS_284, new __VLS_284({
        label: "操作",
        width: "100",
    }));
    const __VLS_286 = __VLS_285({
        label: "操作",
        width: "100",
    }, ...__VLS_functionalComponentArgsRest(__VLS_285));
    __VLS_287.slots.default;
    {
        const { default: __VLS_thisSlot } = __VLS_287.slots;
        const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
        const __VLS_288 = {}.ElSpace;
        /** @type {[typeof __VLS_components.ElSpace, typeof __VLS_components.elSpace, typeof __VLS_components.ElSpace, typeof __VLS_components.elSpace, ]} */ ;
        // @ts-ignore
        const __VLS_289 = __VLS_asFunctionalComponent(__VLS_288, new __VLS_288({}));
        const __VLS_290 = __VLS_289({}, ...__VLS_functionalComponentArgsRest(__VLS_289));
        __VLS_291.slots.default;
        const __VLS_292 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        const __VLS_293 = __VLS_asFunctionalComponent(__VLS_292, new __VLS_292({
            ...{ 'onClick': {} },
            link: true,
            type: "primary",
        }));
        const __VLS_294 = __VLS_293({
            ...{ 'onClick': {} },
            link: true,
            type: "primary",
        }, ...__VLS_functionalComponentArgsRest(__VLS_293));
        let __VLS_296;
        let __VLS_297;
        let __VLS_298;
        const __VLS_299 = {
            onClick: (...[$event]) => {
                if (!(__VLS_ctx.isUser && __VLS_ctx.activeSection === __VLS_ctx.sectionIdMap.userOrders))
                    return;
                __VLS_ctx.showOrderDetail(row.id);
            }
        };
        __VLS_295.slots.default;
        var __VLS_295;
        if (row.status === 0) {
            const __VLS_300 = {}.ElButton;
            /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
            // @ts-ignore
            const __VLS_301 = __VLS_asFunctionalComponent(__VLS_300, new __VLS_300({
                ...{ 'onClick': {} },
                link: true,
                type: "danger",
            }));
            const __VLS_302 = __VLS_301({
                ...{ 'onClick': {} },
                link: true,
                type: "danger",
            }, ...__VLS_functionalComponentArgsRest(__VLS_301));
            let __VLS_304;
            let __VLS_305;
            let __VLS_306;
            const __VLS_307 = {
                onClick: (...[$event]) => {
                    if (!(__VLS_ctx.isUser && __VLS_ctx.activeSection === __VLS_ctx.sectionIdMap.userOrders))
                        return;
                    if (!(row.status === 0))
                        return;
                    __VLS_ctx.cancelOrder(row.id);
                }
            };
            __VLS_303.slots.default;
            var __VLS_303;
        }
        var __VLS_291;
    }
    var __VLS_287;
    var __VLS_255;
    var __VLS_175;
}
else if (__VLS_ctx.isMerchant) {
    const __VLS_308 = {}.ElRow;
    /** @type {[typeof __VLS_components.ElRow, typeof __VLS_components.elRow, typeof __VLS_components.ElRow, typeof __VLS_components.elRow, ]} */ ;
    // @ts-ignore
    const __VLS_309 = __VLS_asFunctionalComponent(__VLS_308, new __VLS_308({
        gutter: (16),
    }));
    const __VLS_310 = __VLS_309({
        gutter: (16),
    }, ...__VLS_functionalComponentArgsRest(__VLS_309));
    __VLS_311.slots.default;
    if (__VLS_ctx.activeSection === __VLS_ctx.sectionIdMap.merchantFulfill) {
        const __VLS_312 = {}.ElCol;
        /** @type {[typeof __VLS_components.ElCol, typeof __VLS_components.elCol, typeof __VLS_components.ElCol, typeof __VLS_components.elCol, ]} */ ;
        // @ts-ignore
        const __VLS_313 = __VLS_asFunctionalComponent(__VLS_312, new __VLS_312({
            span: (24),
            ...{ class: "block" },
        }));
        const __VLS_314 = __VLS_313({
            span: (24),
            ...{ class: "block" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_313));
        __VLS_315.slots.default;
        const __VLS_316 = {}.ElCard;
        /** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
        // @ts-ignore
        const __VLS_317 = __VLS_asFunctionalComponent(__VLS_316, new __VLS_316({
            id: (__VLS_ctx.sectionIdMap.merchantFulfill),
        }));
        const __VLS_318 = __VLS_317({
            id: (__VLS_ctx.sectionIdMap.merchantFulfill),
        }, ...__VLS_functionalComponentArgsRest(__VLS_317));
        __VLS_319.slots.default;
        {
            const { header: __VLS_thisSlot } = __VLS_319.slots;
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "section-head" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
            __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
        }
        const __VLS_320 = {}.ElInput;
        /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
        // @ts-ignore
        const __VLS_321 = __VLS_asFunctionalComponent(__VLS_320, new __VLS_320({
            modelValue: (__VLS_ctx.merchantOrderKeyword),
            placeholder: "按订单号/取餐码/订单ID查询",
            ...{ class: "query-input" },
        }));
        const __VLS_322 = __VLS_321({
            modelValue: (__VLS_ctx.merchantOrderKeyword),
            placeholder: "按订单号/取餐码/订单ID查询",
            ...{ class: "query-input" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_321));
        const __VLS_324 = {}.ElSpace;
        /** @type {[typeof __VLS_components.ElSpace, typeof __VLS_components.elSpace, typeof __VLS_components.ElSpace, typeof __VLS_components.elSpace, ]} */ ;
        // @ts-ignore
        const __VLS_325 = __VLS_asFunctionalComponent(__VLS_324, new __VLS_324({
            wrap: true,
            ...{ class: "query-row" },
        }));
        const __VLS_326 = __VLS_325({
            wrap: true,
            ...{ class: "query-row" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_325));
        __VLS_327.slots.default;
        const __VLS_328 = {}.ElSelect;
        /** @type {[typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, ]} */ ;
        // @ts-ignore
        const __VLS_329 = __VLS_asFunctionalComponent(__VLS_328, new __VLS_328({
            modelValue: (__VLS_ctx.merchantOrderStatus),
            placeholder: "状态筛选",
            clearable: true,
            ...{ class: "query-input-short" },
        }));
        const __VLS_330 = __VLS_329({
            modelValue: (__VLS_ctx.merchantOrderStatus),
            placeholder: "状态筛选",
            clearable: true,
            ...{ class: "query-input-short" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_329));
        __VLS_331.slots.default;
        const __VLS_332 = {}.ElOption;
        /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
        // @ts-ignore
        const __VLS_333 = __VLS_asFunctionalComponent(__VLS_332, new __VLS_332({
            value: (0),
            label: "已下单",
        }));
        const __VLS_334 = __VLS_333({
            value: (0),
            label: "已下单",
        }, ...__VLS_functionalComponentArgsRest(__VLS_333));
        const __VLS_336 = {}.ElOption;
        /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
        // @ts-ignore
        const __VLS_337 = __VLS_asFunctionalComponent(__VLS_336, new __VLS_336({
            value: (1),
            label: "已接单",
        }));
        const __VLS_338 = __VLS_337({
            value: (1),
            label: "已接单",
        }, ...__VLS_functionalComponentArgsRest(__VLS_337));
        const __VLS_340 = {}.ElOption;
        /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
        // @ts-ignore
        const __VLS_341 = __VLS_asFunctionalComponent(__VLS_340, new __VLS_340({
            value: (2),
            label: "制作中",
        }));
        const __VLS_342 = __VLS_341({
            value: (2),
            label: "制作中",
        }, ...__VLS_functionalComponentArgsRest(__VLS_341));
        const __VLS_344 = {}.ElOption;
        /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
        // @ts-ignore
        const __VLS_345 = __VLS_asFunctionalComponent(__VLS_344, new __VLS_344({
            value: (3),
            label: "待取餐",
        }));
        const __VLS_346 = __VLS_345({
            value: (3),
            label: "待取餐",
        }, ...__VLS_functionalComponentArgsRest(__VLS_345));
        const __VLS_348 = {}.ElOption;
        /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
        // @ts-ignore
        const __VLS_349 = __VLS_asFunctionalComponent(__VLS_348, new __VLS_348({
            value: (4),
            label: "已取餐",
        }));
        const __VLS_350 = __VLS_349({
            value: (4),
            label: "已取餐",
        }, ...__VLS_functionalComponentArgsRest(__VLS_349));
        const __VLS_352 = {}.ElOption;
        /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
        // @ts-ignore
        const __VLS_353 = __VLS_asFunctionalComponent(__VLS_352, new __VLS_352({
            value: (5),
            label: "已取消",
        }));
        const __VLS_354 = __VLS_353({
            value: (5),
            label: "已取消",
        }, ...__VLS_functionalComponentArgsRest(__VLS_353));
        var __VLS_331;
        const __VLS_356 = {}.ElDatePicker;
        /** @type {[typeof __VLS_components.ElDatePicker, typeof __VLS_components.elDatePicker, ]} */ ;
        // @ts-ignore
        const __VLS_357 = __VLS_asFunctionalComponent(__VLS_356, new __VLS_356({
            modelValue: (__VLS_ctx.merchantOrderDateRange),
            type: "datetimerange",
            valueFormat: "YYYY-MM-DDTHH:mm:ss",
            startPlaceholder: "开始时间",
            endPlaceholder: "结束时间",
            rangeSeparator: "至",
        }));
        const __VLS_358 = __VLS_357({
            modelValue: (__VLS_ctx.merchantOrderDateRange),
            type: "datetimerange",
            valueFormat: "YYYY-MM-DDTHH:mm:ss",
            startPlaceholder: "开始时间",
            endPlaceholder: "结束时间",
            rangeSeparator: "至",
        }, ...__VLS_functionalComponentArgsRest(__VLS_357));
        const __VLS_360 = {}.ElInputNumber;
        /** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
        // @ts-ignore
        const __VLS_361 = __VLS_asFunctionalComponent(__VLS_360, new __VLS_360({
            modelValue: (__VLS_ctx.merchantMinAmount),
            min: (0),
            step: (1),
            placeholder: "最小金额",
        }));
        const __VLS_362 = __VLS_361({
            modelValue: (__VLS_ctx.merchantMinAmount),
            min: (0),
            step: (1),
            placeholder: "最小金额",
        }, ...__VLS_functionalComponentArgsRest(__VLS_361));
        const __VLS_364 = {}.ElInputNumber;
        /** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
        // @ts-ignore
        const __VLS_365 = __VLS_asFunctionalComponent(__VLS_364, new __VLS_364({
            modelValue: (__VLS_ctx.merchantMaxAmount),
            min: (0),
            step: (1),
            placeholder: "最大金额",
        }));
        const __VLS_366 = __VLS_365({
            modelValue: (__VLS_ctx.merchantMaxAmount),
            min: (0),
            step: (1),
            placeholder: "最大金额",
        }, ...__VLS_functionalComponentArgsRest(__VLS_365));
        const __VLS_368 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        const __VLS_369 = __VLS_asFunctionalComponent(__VLS_368, new __VLS_368({
            ...{ 'onClick': {} },
        }));
        const __VLS_370 = __VLS_369({
            ...{ 'onClick': {} },
        }, ...__VLS_functionalComponentArgsRest(__VLS_369));
        let __VLS_372;
        let __VLS_373;
        let __VLS_374;
        const __VLS_375 = {
            onClick: (__VLS_ctx.resetMerchantOrderFilters)
        };
        __VLS_371.slots.default;
        var __VLS_371;
        var __VLS_327;
        const __VLS_376 = {}.ElTable;
        /** @type {[typeof __VLS_components.ElTable, typeof __VLS_components.elTable, typeof __VLS_components.ElTable, typeof __VLS_components.elTable, ]} */ ;
        // @ts-ignore
        const __VLS_377 = __VLS_asFunctionalComponent(__VLS_376, new __VLS_376({
            data: (__VLS_ctx.filteredMerchantOrders),
            size: "small",
        }));
        const __VLS_378 = __VLS_377({
            data: (__VLS_ctx.filteredMerchantOrders),
            size: "small",
        }, ...__VLS_functionalComponentArgsRest(__VLS_377));
        __VLS_379.slots.default;
        const __VLS_380 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_381 = __VLS_asFunctionalComponent(__VLS_380, new __VLS_380({
            prop: "id",
            label: "订单ID",
            width: "90",
        }));
        const __VLS_382 = __VLS_381({
            prop: "id",
            label: "订单ID",
            width: "90",
        }, ...__VLS_functionalComponentArgsRest(__VLS_381));
        const __VLS_384 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_385 = __VLS_asFunctionalComponent(__VLS_384, new __VLS_384({
            prop: "orderNo",
            label: "订单号",
            minWidth: "160",
        }));
        const __VLS_386 = __VLS_385({
            prop: "orderNo",
            label: "订单号",
            minWidth: "160",
        }, ...__VLS_functionalComponentArgsRest(__VLS_385));
        const __VLS_388 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_389 = __VLS_asFunctionalComponent(__VLS_388, new __VLS_388({
            prop: "windowId",
            label: "窗口ID",
            width: "90",
        }));
        const __VLS_390 = __VLS_389({
            prop: "windowId",
            label: "窗口ID",
            width: "90",
        }, ...__VLS_functionalComponentArgsRest(__VLS_389));
        const __VLS_392 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_393 = __VLS_asFunctionalComponent(__VLS_392, new __VLS_392({
            prop: "status",
            label: "状态",
            width: "100",
        }));
        const __VLS_394 = __VLS_393({
            prop: "status",
            label: "状态",
            width: "100",
        }, ...__VLS_functionalComponentArgsRest(__VLS_393));
        __VLS_395.slots.default;
        {
            const { default: __VLS_thisSlot } = __VLS_395.slots;
            const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
            (__VLS_ctx.statusText(row.status));
        }
        var __VLS_395;
        const __VLS_396 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_397 = __VLS_asFunctionalComponent(__VLS_396, new __VLS_396({
            prop: "pickupCode",
            label: "取餐码",
            width: "110",
        }));
        const __VLS_398 = __VLS_397({
            prop: "pickupCode",
            label: "取餐码",
            width: "110",
        }, ...__VLS_functionalComponentArgsRest(__VLS_397));
        const __VLS_400 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_401 = __VLS_asFunctionalComponent(__VLS_400, new __VLS_400({
            label: "操作",
            minWidth: "240",
        }));
        const __VLS_402 = __VLS_401({
            label: "操作",
            minWidth: "240",
        }, ...__VLS_functionalComponentArgsRest(__VLS_401));
        __VLS_403.slots.default;
        {
            const { default: __VLS_thisSlot } = __VLS_403.slots;
            const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
            const __VLS_404 = {}.ElSpace;
            /** @type {[typeof __VLS_components.ElSpace, typeof __VLS_components.elSpace, typeof __VLS_components.ElSpace, typeof __VLS_components.elSpace, ]} */ ;
            // @ts-ignore
            const __VLS_405 = __VLS_asFunctionalComponent(__VLS_404, new __VLS_404({
                wrap: true,
            }));
            const __VLS_406 = __VLS_405({
                wrap: true,
            }, ...__VLS_functionalComponentArgsRest(__VLS_405));
            __VLS_407.slots.default;
            const __VLS_408 = {}.ElButton;
            /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
            // @ts-ignore
            const __VLS_409 = __VLS_asFunctionalComponent(__VLS_408, new __VLS_408({
                ...{ 'onClick': {} },
                size: "small",
                disabled: (row.status !== 0),
            }));
            const __VLS_410 = __VLS_409({
                ...{ 'onClick': {} },
                size: "small",
                disabled: (row.status !== 0),
            }, ...__VLS_functionalComponentArgsRest(__VLS_409));
            let __VLS_412;
            let __VLS_413;
            let __VLS_414;
            const __VLS_415 = {
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
            __VLS_411.slots.default;
            var __VLS_411;
            const __VLS_416 = {}.ElButton;
            /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
            // @ts-ignore
            const __VLS_417 = __VLS_asFunctionalComponent(__VLS_416, new __VLS_416({
                ...{ 'onClick': {} },
                size: "small",
                disabled: (row.status !== 1),
            }));
            const __VLS_418 = __VLS_417({
                ...{ 'onClick': {} },
                size: "small",
                disabled: (row.status !== 1),
            }, ...__VLS_functionalComponentArgsRest(__VLS_417));
            let __VLS_420;
            let __VLS_421;
            let __VLS_422;
            const __VLS_423 = {
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
            __VLS_419.slots.default;
            var __VLS_419;
            const __VLS_424 = {}.ElButton;
            /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
            // @ts-ignore
            const __VLS_425 = __VLS_asFunctionalComponent(__VLS_424, new __VLS_424({
                ...{ 'onClick': {} },
                size: "small",
                type: "success",
                disabled: (row.status !== 2),
            }));
            const __VLS_426 = __VLS_425({
                ...{ 'onClick': {} },
                size: "small",
                type: "success",
                disabled: (row.status !== 2),
            }, ...__VLS_functionalComponentArgsRest(__VLS_425));
            let __VLS_428;
            let __VLS_429;
            let __VLS_430;
            const __VLS_431 = {
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
            __VLS_427.slots.default;
            var __VLS_427;
            var __VLS_407;
        }
        var __VLS_403;
        var __VLS_379;
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "pagination-wrap" },
        });
        const __VLS_432 = {}.ElPagination;
        /** @type {[typeof __VLS_components.ElPagination, typeof __VLS_components.elPagination, ]} */ ;
        // @ts-ignore
        const __VLS_433 = __VLS_asFunctionalComponent(__VLS_432, new __VLS_432({
            ...{ 'onCurrentChange': {} },
            ...{ 'onSizeChange': {} },
            background: true,
            layout: "total, sizes, prev, pager, next",
            total: (__VLS_ctx.merchantOrderTotal),
            currentPage: (__VLS_ctx.merchantOrderPage),
            pageSize: (__VLS_ctx.merchantOrderSize),
            pageSizes: ([10, 20, 50]),
        }));
        const __VLS_434 = __VLS_433({
            ...{ 'onCurrentChange': {} },
            ...{ 'onSizeChange': {} },
            background: true,
            layout: "total, sizes, prev, pager, next",
            total: (__VLS_ctx.merchantOrderTotal),
            currentPage: (__VLS_ctx.merchantOrderPage),
            pageSize: (__VLS_ctx.merchantOrderSize),
            pageSizes: ([10, 20, 50]),
        }, ...__VLS_functionalComponentArgsRest(__VLS_433));
        let __VLS_436;
        let __VLS_437;
        let __VLS_438;
        const __VLS_439 = {
            onCurrentChange: (__VLS_ctx.onMerchantOrderPageChange)
        };
        const __VLS_440 = {
            onSizeChange: (__VLS_ctx.onMerchantOrderSizeChange)
        };
        var __VLS_435;
        var __VLS_319;
        var __VLS_315;
    }
    if (__VLS_ctx.activeSection === __VLS_ctx.sectionIdMap.merchantPickup) {
        const __VLS_441 = {}.ElCol;
        /** @type {[typeof __VLS_components.ElCol, typeof __VLS_components.elCol, typeof __VLS_components.ElCol, typeof __VLS_components.elCol, ]} */ ;
        // @ts-ignore
        const __VLS_442 = __VLS_asFunctionalComponent(__VLS_441, new __VLS_441({
            span: (24),
            ...{ class: "block" },
        }));
        const __VLS_443 = __VLS_442({
            span: (24),
            ...{ class: "block" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_442));
        __VLS_444.slots.default;
        const __VLS_445 = {}.ElCard;
        /** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
        // @ts-ignore
        const __VLS_446 = __VLS_asFunctionalComponent(__VLS_445, new __VLS_445({
            id: (__VLS_ctx.sectionIdMap.merchantPickup),
        }));
        const __VLS_447 = __VLS_446({
            id: (__VLS_ctx.sectionIdMap.merchantPickup),
        }, ...__VLS_functionalComponentArgsRest(__VLS_446));
        __VLS_448.slots.default;
        {
            const { header: __VLS_thisSlot } = __VLS_448.slots;
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "section-head" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
            __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
        }
        const __VLS_449 = {}.ElForm;
        /** @type {[typeof __VLS_components.ElForm, typeof __VLS_components.elForm, typeof __VLS_components.ElForm, typeof __VLS_components.elForm, ]} */ ;
        // @ts-ignore
        const __VLS_450 = __VLS_asFunctionalComponent(__VLS_449, new __VLS_449({
            labelWidth: "80px",
        }));
        const __VLS_451 = __VLS_450({
            labelWidth: "80px",
        }, ...__VLS_functionalComponentArgsRest(__VLS_450));
        __VLS_452.slots.default;
        const __VLS_453 = {}.ElFormItem;
        /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
        // @ts-ignore
        const __VLS_454 = __VLS_asFunctionalComponent(__VLS_453, new __VLS_453({
            label: "窗口",
        }));
        const __VLS_455 = __VLS_454({
            label: "窗口",
        }, ...__VLS_functionalComponentArgsRest(__VLS_454));
        __VLS_456.slots.default;
        const __VLS_457 = {}.ElSelect;
        /** @type {[typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, ]} */ ;
        // @ts-ignore
        const __VLS_458 = __VLS_asFunctionalComponent(__VLS_457, new __VLS_457({
            modelValue: (__VLS_ctx.selectedWindowId),
            placeholder: "请选择窗口",
            ...{ style: {} },
        }));
        const __VLS_459 = __VLS_458({
            modelValue: (__VLS_ctx.selectedWindowId),
            placeholder: "请选择窗口",
            ...{ style: {} },
        }, ...__VLS_functionalComponentArgsRest(__VLS_458));
        __VLS_460.slots.default;
        for (const [w] of __VLS_getVForSourceType((__VLS_ctx.windows))) {
            const __VLS_461 = {}.ElOption;
            /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
            // @ts-ignore
            const __VLS_462 = __VLS_asFunctionalComponent(__VLS_461, new __VLS_461({
                key: (w.id),
                label: (`${w.name} (${w.location})`),
                value: (w.id),
            }));
            const __VLS_463 = __VLS_462({
                key: (w.id),
                label: (`${w.name} (${w.location})`),
                value: (w.id),
            }, ...__VLS_functionalComponentArgsRest(__VLS_462));
        }
        var __VLS_460;
        var __VLS_456;
        var __VLS_452;
        const __VLS_465 = {}.ElSpace;
        /** @type {[typeof __VLS_components.ElSpace, typeof __VLS_components.elSpace, typeof __VLS_components.ElSpace, typeof __VLS_components.elSpace, ]} */ ;
        // @ts-ignore
        const __VLS_466 = __VLS_asFunctionalComponent(__VLS_465, new __VLS_465({
            wrap: true,
        }));
        const __VLS_467 = __VLS_466({
            wrap: true,
        }, ...__VLS_functionalComponentArgsRest(__VLS_466));
        __VLS_468.slots.default;
        const __VLS_469 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        const __VLS_470 = __VLS_asFunctionalComponent(__VLS_469, new __VLS_469({
            ...{ 'onClick': {} },
            type: "primary",
        }));
        const __VLS_471 = __VLS_470({
            ...{ 'onClick': {} },
            type: "primary",
        }, ...__VLS_functionalComponentArgsRest(__VLS_470));
        let __VLS_473;
        let __VLS_474;
        let __VLS_475;
        const __VLS_476 = {
            onClick: (__VLS_ctx.callNext)
        };
        __VLS_472.slots.default;
        var __VLS_472;
        const __VLS_477 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        const __VLS_478 = __VLS_asFunctionalComponent(__VLS_477, new __VLS_477({
            ...{ 'onClick': {} },
        }));
        const __VLS_479 = __VLS_478({
            ...{ 'onClick': {} },
        }, ...__VLS_functionalComponentArgsRest(__VLS_478));
        let __VLS_481;
        let __VLS_482;
        let __VLS_483;
        const __VLS_484 = {
            onClick: (__VLS_ctx.loadQueue)
        };
        __VLS_480.slots.default;
        var __VLS_480;
        var __VLS_468;
        const __VLS_485 = {}.ElDivider;
        /** @type {[typeof __VLS_components.ElDivider, typeof __VLS_components.elDivider, ]} */ ;
        // @ts-ignore
        const __VLS_486 = __VLS_asFunctionalComponent(__VLS_485, new __VLS_485({}));
        const __VLS_487 = __VLS_486({}, ...__VLS_functionalComponentArgsRest(__VLS_486));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
        (__VLS_ctx.queueList.length);
        for (const [item] of __VLS_getVForSourceType((__VLS_ctx.queueList))) {
            const __VLS_489 = {}.ElTag;
            /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
            // @ts-ignore
            const __VLS_490 = __VLS_asFunctionalComponent(__VLS_489, new __VLS_489({
                key: (item),
                ...{ class: "queue-tag" },
            }));
            const __VLS_491 = __VLS_490({
                key: (item),
                ...{ class: "queue-tag" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_490));
            __VLS_492.slots.default;
            (item);
            var __VLS_492;
        }
        const __VLS_493 = {}.ElDivider;
        /** @type {[typeof __VLS_components.ElDivider, typeof __VLS_components.elDivider, ]} */ ;
        // @ts-ignore
        const __VLS_494 = __VLS_asFunctionalComponent(__VLS_493, new __VLS_493({}));
        const __VLS_495 = __VLS_494({}, ...__VLS_functionalComponentArgsRest(__VLS_494));
        const __VLS_497 = {}.ElInput;
        /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
        // @ts-ignore
        const __VLS_498 = __VLS_asFunctionalComponent(__VLS_497, new __VLS_497({
            modelValue: (__VLS_ctx.verifyCode),
            placeholder: "输入取餐码，例如 408765",
        }));
        const __VLS_499 = __VLS_498({
            modelValue: (__VLS_ctx.verifyCode),
            placeholder: "输入取餐码，例如 408765",
        }, ...__VLS_functionalComponentArgsRest(__VLS_498));
        const __VLS_501 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        const __VLS_502 = __VLS_asFunctionalComponent(__VLS_501, new __VLS_501({
            ...{ 'onClick': {} },
            ...{ class: "verify-btn" },
            type: "success",
        }));
        const __VLS_503 = __VLS_502({
            ...{ 'onClick': {} },
            ...{ class: "verify-btn" },
            type: "success",
        }, ...__VLS_functionalComponentArgsRest(__VLS_502));
        let __VLS_505;
        let __VLS_506;
        let __VLS_507;
        const __VLS_508 = {
            onClick: (__VLS_ctx.verifyPickup)
        };
        __VLS_504.slots.default;
        var __VLS_504;
        const __VLS_509 = {}.ElDivider;
        /** @type {[typeof __VLS_components.ElDivider, typeof __VLS_components.elDivider, ]} */ ;
        // @ts-ignore
        const __VLS_510 = __VLS_asFunctionalComponent(__VLS_509, new __VLS_509({}));
        const __VLS_511 = __VLS_510({}, ...__VLS_functionalComponentArgsRest(__VLS_510));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "section-sub-title" },
        });
        const __VLS_513 = {}.ElInput;
        /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
        // @ts-ignore
        const __VLS_514 = __VLS_asFunctionalComponent(__VLS_513, new __VLS_513({
            modelValue: (__VLS_ctx.searchPickupCode),
            placeholder: "输入取餐码进行查询",
        }));
        const __VLS_515 = __VLS_514({
            modelValue: (__VLS_ctx.searchPickupCode),
            placeholder: "输入取餐码进行查询",
        }, ...__VLS_functionalComponentArgsRest(__VLS_514));
        const __VLS_517 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        const __VLS_518 = __VLS_asFunctionalComponent(__VLS_517, new __VLS_517({
            ...{ 'onClick': {} },
            ...{ class: "verify-btn" },
            type: "primary",
            plain: true,
        }));
        const __VLS_519 = __VLS_518({
            ...{ 'onClick': {} },
            ...{ class: "verify-btn" },
            type: "primary",
            plain: true,
        }, ...__VLS_functionalComponentArgsRest(__VLS_518));
        let __VLS_521;
        let __VLS_522;
        let __VLS_523;
        const __VLS_524 = {
            onClick: (__VLS_ctx.searchOrderByCode)
        };
        __VLS_520.slots.default;
        var __VLS_520;
        if (__VLS_ctx.searchedOrder) {
            const __VLS_525 = {}.ElDescriptions;
            /** @type {[typeof __VLS_components.ElDescriptions, typeof __VLS_components.elDescriptions, typeof __VLS_components.ElDescriptions, typeof __VLS_components.elDescriptions, ]} */ ;
            // @ts-ignore
            const __VLS_526 = __VLS_asFunctionalComponent(__VLS_525, new __VLS_525({
                column: (1),
                border: true,
                ...{ class: "search-result" },
            }));
            const __VLS_527 = __VLS_526({
                column: (1),
                border: true,
                ...{ class: "search-result" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_526));
            __VLS_528.slots.default;
            const __VLS_529 = {}.ElDescriptionsItem;
            /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
            // @ts-ignore
            const __VLS_530 = __VLS_asFunctionalComponent(__VLS_529, new __VLS_529({
                label: "订单ID",
            }));
            const __VLS_531 = __VLS_530({
                label: "订单ID",
            }, ...__VLS_functionalComponentArgsRest(__VLS_530));
            __VLS_532.slots.default;
            (__VLS_ctx.searchedOrder.id);
            var __VLS_532;
            const __VLS_533 = {}.ElDescriptionsItem;
            /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
            // @ts-ignore
            const __VLS_534 = __VLS_asFunctionalComponent(__VLS_533, new __VLS_533({
                label: "用户ID",
            }));
            const __VLS_535 = __VLS_534({
                label: "用户ID",
            }, ...__VLS_functionalComponentArgsRest(__VLS_534));
            __VLS_536.slots.default;
            (__VLS_ctx.searchedOrder.userId);
            var __VLS_536;
            const __VLS_537 = {}.ElDescriptionsItem;
            /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
            // @ts-ignore
            const __VLS_538 = __VLS_asFunctionalComponent(__VLS_537, new __VLS_537({
                label: "窗口ID",
            }));
            const __VLS_539 = __VLS_538({
                label: "窗口ID",
            }, ...__VLS_functionalComponentArgsRest(__VLS_538));
            __VLS_540.slots.default;
            (__VLS_ctx.searchedOrder.windowId);
            var __VLS_540;
            const __VLS_541 = {}.ElDescriptionsItem;
            /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
            // @ts-ignore
            const __VLS_542 = __VLS_asFunctionalComponent(__VLS_541, new __VLS_541({
                label: "状态",
            }));
            const __VLS_543 = __VLS_542({
                label: "状态",
            }, ...__VLS_functionalComponentArgsRest(__VLS_542));
            __VLS_544.slots.default;
            (__VLS_ctx.statusText(__VLS_ctx.searchedOrder.status));
            var __VLS_544;
            const __VLS_545 = {}.ElDescriptionsItem;
            /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
            // @ts-ignore
            const __VLS_546 = __VLS_asFunctionalComponent(__VLS_545, new __VLS_545({
                label: "取餐码",
            }));
            const __VLS_547 = __VLS_546({
                label: "取餐码",
            }, ...__VLS_functionalComponentArgsRest(__VLS_546));
            __VLS_548.slots.default;
            (__VLS_ctx.searchedOrder.pickupCode);
            var __VLS_548;
            const __VLS_549 = {}.ElDescriptionsItem;
            /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
            // @ts-ignore
            const __VLS_550 = __VLS_asFunctionalComponent(__VLS_549, new __VLS_549({
                label: "叫号码",
            }));
            const __VLS_551 = __VLS_550({
                label: "叫号码",
            }, ...__VLS_functionalComponentArgsRest(__VLS_550));
            __VLS_552.slots.default;
            (__VLS_ctx.searchedOrder.pickupNo || "-");
            var __VLS_552;
            var __VLS_528;
        }
        var __VLS_448;
        var __VLS_444;
    }
    if (__VLS_ctx.activeSection === __VLS_ctx.sectionIdMap.merchantStock) {
        const __VLS_553 = {}.ElCol;
        /** @type {[typeof __VLS_components.ElCol, typeof __VLS_components.elCol, typeof __VLS_components.ElCol, typeof __VLS_components.elCol, ]} */ ;
        // @ts-ignore
        const __VLS_554 = __VLS_asFunctionalComponent(__VLS_553, new __VLS_553({
            span: (24),
            ...{ class: "block" },
        }));
        const __VLS_555 = __VLS_554({
            span: (24),
            ...{ class: "block" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_554));
        __VLS_556.slots.default;
        const __VLS_557 = {}.ElCard;
        /** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
        // @ts-ignore
        const __VLS_558 = __VLS_asFunctionalComponent(__VLS_557, new __VLS_557({
            id: (__VLS_ctx.sectionIdMap.merchantStock),
        }));
        const __VLS_559 = __VLS_558({
            id: (__VLS_ctx.sectionIdMap.merchantStock),
        }, ...__VLS_functionalComponentArgsRest(__VLS_558));
        __VLS_560.slots.default;
        {
            const { header: __VLS_thisSlot } = __VLS_560.slots;
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "section-head" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
            __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
        }
        const __VLS_561 = {}.ElSpace;
        /** @type {[typeof __VLS_components.ElSpace, typeof __VLS_components.elSpace, typeof __VLS_components.ElSpace, typeof __VLS_components.elSpace, ]} */ ;
        // @ts-ignore
        const __VLS_562 = __VLS_asFunctionalComponent(__VLS_561, new __VLS_561({
            wrap: true,
            ...{ class: "query-row" },
        }));
        const __VLS_563 = __VLS_562({
            wrap: true,
            ...{ class: "query-row" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_562));
        __VLS_564.slots.default;
        const __VLS_565 = {}.ElFormItem;
        /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
        // @ts-ignore
        const __VLS_566 = __VLS_asFunctionalComponent(__VLS_565, new __VLS_565({
            label: "低库存阈值",
            ...{ class: "inline-form-item" },
        }));
        const __VLS_567 = __VLS_566({
            label: "低库存阈值",
            ...{ class: "inline-form-item" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_566));
        __VLS_568.slots.default;
        const __VLS_569 = {}.ElInputNumber;
        /** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
        // @ts-ignore
        const __VLS_570 = __VLS_asFunctionalComponent(__VLS_569, new __VLS_569({
            modelValue: (__VLS_ctx.lowStockThreshold),
            min: (1),
            max: (200),
            step: (1),
        }));
        const __VLS_571 = __VLS_570({
            modelValue: (__VLS_ctx.lowStockThreshold),
            min: (1),
            max: (200),
            step: (1),
        }, ...__VLS_functionalComponentArgsRest(__VLS_570));
        var __VLS_568;
        const __VLS_573 = {}.ElInput;
        /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
        // @ts-ignore
        const __VLS_574 = __VLS_asFunctionalComponent(__VLS_573, new __VLS_573({
            modelValue: (__VLS_ctx.lowStockKeyword),
            placeholder: "按菜品名/菜单菜品ID查询",
            ...{ class: "query-input-short" },
        }));
        const __VLS_575 = __VLS_574({
            modelValue: (__VLS_ctx.lowStockKeyword),
            placeholder: "按菜品名/菜单菜品ID查询",
            ...{ class: "query-input-short" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_574));
        var __VLS_564;
        if (__VLS_ctx.filteredLowStockDishes.length === 0) {
            const __VLS_577 = {}.ElEmpty;
            /** @type {[typeof __VLS_components.ElEmpty, typeof __VLS_components.elEmpty, ]} */ ;
            // @ts-ignore
            const __VLS_578 = __VLS_asFunctionalComponent(__VLS_577, new __VLS_577({
                description: (`当前无低库存菜品（阈值<=${__VLS_ctx.lowStockThreshold}）`),
            }));
            const __VLS_579 = __VLS_578({
                description: (`当前无低库存菜品（阈值<=${__VLS_ctx.lowStockThreshold}）`),
            }, ...__VLS_functionalComponentArgsRest(__VLS_578));
        }
        else {
            const __VLS_581 = {}.ElTable;
            /** @type {[typeof __VLS_components.ElTable, typeof __VLS_components.elTable, typeof __VLS_components.ElTable, typeof __VLS_components.elTable, ]} */ ;
            // @ts-ignore
            const __VLS_582 = __VLS_asFunctionalComponent(__VLS_581, new __VLS_581({
                data: (__VLS_ctx.filteredLowStockDishes),
                size: "small",
            }));
            const __VLS_583 = __VLS_582({
                data: (__VLS_ctx.filteredLowStockDishes),
                size: "small",
            }, ...__VLS_functionalComponentArgsRest(__VLS_582));
            __VLS_584.slots.default;
            const __VLS_585 = {}.ElTableColumn;
            /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
            // @ts-ignore
            const __VLS_586 = __VLS_asFunctionalComponent(__VLS_585, new __VLS_585({
                prop: "id",
                label: "菜单菜品ID",
                width: "100",
            }));
            const __VLS_587 = __VLS_586({
                prop: "id",
                label: "菜单菜品ID",
                width: "100",
            }, ...__VLS_functionalComponentArgsRest(__VLS_586));
            const __VLS_589 = {}.ElTableColumn;
            /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
            // @ts-ignore
            const __VLS_590 = __VLS_asFunctionalComponent(__VLS_589, new __VLS_589({
                prop: "dishName",
                label: "菜品",
                minWidth: "120",
            }));
            const __VLS_591 = __VLS_590({
                prop: "dishName",
                label: "菜品",
                minWidth: "120",
            }, ...__VLS_functionalComponentArgsRest(__VLS_590));
            const __VLS_593 = {}.ElTableColumn;
            /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
            // @ts-ignore
            const __VLS_594 = __VLS_asFunctionalComponent(__VLS_593, new __VLS_593({
                prop: "salePrice",
                label: "售价",
                width: "90",
            }));
            const __VLS_595 = __VLS_594({
                prop: "salePrice",
                label: "售价",
                width: "90",
            }, ...__VLS_functionalComponentArgsRest(__VLS_594));
            const __VLS_597 = {}.ElTableColumn;
            /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
            // @ts-ignore
            const __VLS_598 = __VLS_asFunctionalComponent(__VLS_597, new __VLS_597({
                prop: "stock",
                label: "剩余库存",
                width: "90",
            }));
            const __VLS_599 = __VLS_598({
                prop: "stock",
                label: "剩余库存",
                width: "90",
            }, ...__VLS_functionalComponentArgsRest(__VLS_598));
            const __VLS_601 = {}.ElTableColumn;
            /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
            // @ts-ignore
            const __VLS_602 = __VLS_asFunctionalComponent(__VLS_601, new __VLS_601({
                prop: "sold",
                label: "已售",
                width: "80",
            }));
            const __VLS_603 = __VLS_602({
                prop: "sold",
                label: "已售",
                width: "80",
            }, ...__VLS_functionalComponentArgsRest(__VLS_602));
            const __VLS_605 = {}.ElTableColumn;
            /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
            // @ts-ignore
            const __VLS_606 = __VLS_asFunctionalComponent(__VLS_605, new __VLS_605({
                prop: "status",
                label: "状态",
                width: "90",
            }));
            const __VLS_607 = __VLS_606({
                prop: "status",
                label: "状态",
                width: "90",
            }, ...__VLS_functionalComponentArgsRest(__VLS_606));
            __VLS_608.slots.default;
            {
                const { default: __VLS_thisSlot } = __VLS_608.slots;
                const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
                (row.status === 1 ? "上架" : "下架");
            }
            var __VLS_608;
            const __VLS_609 = {}.ElTableColumn;
            /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
            // @ts-ignore
            const __VLS_610 = __VLS_asFunctionalComponent(__VLS_609, new __VLS_609({
                label: "预警",
                width: "100",
            }));
            const __VLS_611 = __VLS_610({
                label: "预警",
                width: "100",
            }, ...__VLS_functionalComponentArgsRest(__VLS_610));
            __VLS_612.slots.default;
            {
                const { default: __VLS_thisSlot } = __VLS_612.slots;
                const __VLS_613 = {}.ElTag;
                /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
                // @ts-ignore
                const __VLS_614 = __VLS_asFunctionalComponent(__VLS_613, new __VLS_613({
                    type: "danger",
                    size: "small",
                }));
                const __VLS_615 = __VLS_614({
                    type: "danger",
                    size: "small",
                }, ...__VLS_functionalComponentArgsRest(__VLS_614));
                __VLS_616.slots.default;
                var __VLS_616;
            }
            var __VLS_612;
            const __VLS_617 = {}.ElTableColumn;
            /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
            // @ts-ignore
            const __VLS_618 = __VLS_asFunctionalComponent(__VLS_617, new __VLS_617({
                label: "操作",
                width: "100",
            }));
            const __VLS_619 = __VLS_618({
                label: "操作",
                width: "100",
            }, ...__VLS_functionalComponentArgsRest(__VLS_618));
            __VLS_620.slots.default;
            {
                const { default: __VLS_thisSlot } = __VLS_620.slots;
                const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
                const __VLS_621 = {}.ElButton;
                /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
                // @ts-ignore
                const __VLS_622 = __VLS_asFunctionalComponent(__VLS_621, new __VLS_621({
                    ...{ 'onClick': {} },
                    link: true,
                    type: "primary",
                    loading: (__VLS_ctx.menuDishDetailLoading),
                }));
                const __VLS_623 = __VLS_622({
                    ...{ 'onClick': {} },
                    link: true,
                    type: "primary",
                    loading: (__VLS_ctx.menuDishDetailLoading),
                }, ...__VLS_functionalComponentArgsRest(__VLS_622));
                let __VLS_625;
                let __VLS_626;
                let __VLS_627;
                const __VLS_628 = {
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
                __VLS_624.slots.default;
                var __VLS_624;
            }
            var __VLS_620;
            var __VLS_584;
        }
        var __VLS_560;
        var __VLS_556;
    }
    if (__VLS_ctx.activeSection === __VLS_ctx.sectionIdMap.merchantDish) {
        const __VLS_629 = {}.ElCol;
        /** @type {[typeof __VLS_components.ElCol, typeof __VLS_components.elCol, typeof __VLS_components.ElCol, typeof __VLS_components.elCol, ]} */ ;
        // @ts-ignore
        const __VLS_630 = __VLS_asFunctionalComponent(__VLS_629, new __VLS_629({
            span: (24),
            ...{ class: "block" },
        }));
        const __VLS_631 = __VLS_630({
            span: (24),
            ...{ class: "block" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_630));
        __VLS_632.slots.default;
        const __VLS_633 = {}.ElCard;
        /** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
        // @ts-ignore
        const __VLS_634 = __VLS_asFunctionalComponent(__VLS_633, new __VLS_633({
            id: (__VLS_ctx.sectionIdMap.merchantDish),
        }));
        const __VLS_635 = __VLS_634({
            id: (__VLS_ctx.sectionIdMap.merchantDish),
        }, ...__VLS_functionalComponentArgsRest(__VLS_634));
        __VLS_636.slots.default;
        {
            const { header: __VLS_thisSlot } = __VLS_636.slots;
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "section-head" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
            __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
        }
        const __VLS_637 = {}.ElAlert;
        /** @type {[typeof __VLS_components.ElAlert, typeof __VLS_components.elAlert, ]} */ ;
        // @ts-ignore
        const __VLS_638 = __VLS_asFunctionalComponent(__VLS_637, new __VLS_637({
            type: "warning",
            closable: (false),
            title: "已发布菜单中的菜品不允许直接编辑/上下架/删除。",
            ...{ class: "tip-alert" },
        }));
        const __VLS_639 = __VLS_638({
            type: "warning",
            closable: (false),
            title: "已发布菜单中的菜品不允许直接编辑/上下架/删除。",
            ...{ class: "tip-alert" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_638));
        const __VLS_641 = {}.ElInput;
        /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
        // @ts-ignore
        const __VLS_642 = __VLS_asFunctionalComponent(__VLS_641, new __VLS_641({
            modelValue: (__VLS_ctx.dishKeyword),
            placeholder: "按菜品名/ID/分类查询",
            ...{ class: "query-input" },
        }));
        const __VLS_643 = __VLS_642({
            modelValue: (__VLS_ctx.dishKeyword),
            placeholder: "按菜品名/ID/分类查询",
            ...{ class: "query-input" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_642));
        const __VLS_645 = {}.ElForm;
        /** @type {[typeof __VLS_components.ElForm, typeof __VLS_components.elForm, typeof __VLS_components.ElForm, typeof __VLS_components.elForm, ]} */ ;
        // @ts-ignore
        const __VLS_646 = __VLS_asFunctionalComponent(__VLS_645, new __VLS_645({
            inline: true,
        }));
        const __VLS_647 = __VLS_646({
            inline: true,
        }, ...__VLS_functionalComponentArgsRest(__VLS_646));
        __VLS_648.slots.default;
        const __VLS_649 = {}.ElFormItem;
        /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
        // @ts-ignore
        const __VLS_650 = __VLS_asFunctionalComponent(__VLS_649, new __VLS_649({
            label: "名称",
        }));
        const __VLS_651 = __VLS_650({
            label: "名称",
        }, ...__VLS_functionalComponentArgsRest(__VLS_650));
        __VLS_652.slots.default;
        const __VLS_653 = {}.ElInput;
        /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
        // @ts-ignore
        const __VLS_654 = __VLS_asFunctionalComponent(__VLS_653, new __VLS_653({
            modelValue: (__VLS_ctx.dishForm.name),
            placeholder: "例如：宫保鸡丁",
        }));
        const __VLS_655 = __VLS_654({
            modelValue: (__VLS_ctx.dishForm.name),
            placeholder: "例如：宫保鸡丁",
        }, ...__VLS_functionalComponentArgsRest(__VLS_654));
        var __VLS_652;
        const __VLS_657 = {}.ElFormItem;
        /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
        // @ts-ignore
        const __VLS_658 = __VLS_asFunctionalComponent(__VLS_657, new __VLS_657({
            label: "价格",
        }));
        const __VLS_659 = __VLS_658({
            label: "价格",
        }, ...__VLS_functionalComponentArgsRest(__VLS_658));
        __VLS_660.slots.default;
        const __VLS_661 = {}.ElInputNumber;
        /** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
        // @ts-ignore
        const __VLS_662 = __VLS_asFunctionalComponent(__VLS_661, new __VLS_661({
            modelValue: (__VLS_ctx.dishForm.price),
            min: (0.01),
            step: (0.5),
        }));
        const __VLS_663 = __VLS_662({
            modelValue: (__VLS_ctx.dishForm.price),
            min: (0.01),
            step: (0.5),
        }, ...__VLS_functionalComponentArgsRest(__VLS_662));
        var __VLS_660;
        const __VLS_665 = {}.ElFormItem;
        /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
        // @ts-ignore
        const __VLS_666 = __VLS_asFunctionalComponent(__VLS_665, new __VLS_665({
            label: "分类",
        }));
        const __VLS_667 = __VLS_666({
            label: "分类",
        }, ...__VLS_functionalComponentArgsRest(__VLS_666));
        __VLS_668.slots.default;
        const __VLS_669 = {}.ElInput;
        /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
        // @ts-ignore
        const __VLS_670 = __VLS_asFunctionalComponent(__VLS_669, new __VLS_669({
            modelValue: (__VLS_ctx.dishForm.category),
            placeholder: "主食/小吃/饮料",
        }));
        const __VLS_671 = __VLS_670({
            modelValue: (__VLS_ctx.dishForm.category),
            placeholder: "主食/小吃/饮料",
        }, ...__VLS_functionalComponentArgsRest(__VLS_670));
        var __VLS_668;
        const __VLS_673 = {}.ElFormItem;
        /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
        // @ts-ignore
        const __VLS_674 = __VLS_asFunctionalComponent(__VLS_673, new __VLS_673({}));
        const __VLS_675 = __VLS_674({}, ...__VLS_functionalComponentArgsRest(__VLS_674));
        __VLS_676.slots.default;
        const __VLS_677 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        const __VLS_678 = __VLS_asFunctionalComponent(__VLS_677, new __VLS_677({
            ...{ 'onClick': {} },
            type: "primary",
            loading: (__VLS_ctx.creatingDish),
        }));
        const __VLS_679 = __VLS_678({
            ...{ 'onClick': {} },
            type: "primary",
            loading: (__VLS_ctx.creatingDish),
        }, ...__VLS_functionalComponentArgsRest(__VLS_678));
        let __VLS_681;
        let __VLS_682;
        let __VLS_683;
        const __VLS_684 = {
            onClick: (__VLS_ctx.saveDish)
        };
        __VLS_680.slots.default;
        (__VLS_ctx.dishForm.id ? "更新菜品" : "新增菜品");
        var __VLS_680;
        if (__VLS_ctx.dishForm.id) {
            const __VLS_685 = {}.ElButton;
            /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
            // @ts-ignore
            const __VLS_686 = __VLS_asFunctionalComponent(__VLS_685, new __VLS_685({
                ...{ 'onClick': {} },
            }));
            const __VLS_687 = __VLS_686({
                ...{ 'onClick': {} },
            }, ...__VLS_functionalComponentArgsRest(__VLS_686));
            let __VLS_689;
            let __VLS_690;
            let __VLS_691;
            const __VLS_692 = {
                onClick: (__VLS_ctx.resetDishForm)
            };
            __VLS_688.slots.default;
            var __VLS_688;
        }
        var __VLS_676;
        var __VLS_648;
        const __VLS_693 = {}.ElTable;
        /** @type {[typeof __VLS_components.ElTable, typeof __VLS_components.elTable, typeof __VLS_components.ElTable, typeof __VLS_components.elTable, ]} */ ;
        // @ts-ignore
        const __VLS_694 = __VLS_asFunctionalComponent(__VLS_693, new __VLS_693({
            data: (__VLS_ctx.filteredMerchantDishes),
            size: "small",
        }));
        const __VLS_695 = __VLS_694({
            data: (__VLS_ctx.filteredMerchantDishes),
            size: "small",
        }, ...__VLS_functionalComponentArgsRest(__VLS_694));
        __VLS_696.slots.default;
        const __VLS_697 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_698 = __VLS_asFunctionalComponent(__VLS_697, new __VLS_697({
            prop: "id",
            label: "ID",
            width: "70",
        }));
        const __VLS_699 = __VLS_698({
            prop: "id",
            label: "ID",
            width: "70",
        }, ...__VLS_functionalComponentArgsRest(__VLS_698));
        const __VLS_701 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_702 = __VLS_asFunctionalComponent(__VLS_701, new __VLS_701({
            prop: "name",
            label: "菜品",
            minWidth: "120",
        }));
        const __VLS_703 = __VLS_702({
            prop: "name",
            label: "菜品",
            minWidth: "120",
        }, ...__VLS_functionalComponentArgsRest(__VLS_702));
        const __VLS_705 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_706 = __VLS_asFunctionalComponent(__VLS_705, new __VLS_705({
            prop: "price",
            label: "价格",
            width: "90",
        }));
        const __VLS_707 = __VLS_706({
            prop: "price",
            label: "价格",
            width: "90",
        }, ...__VLS_functionalComponentArgsRest(__VLS_706));
        const __VLS_709 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_710 = __VLS_asFunctionalComponent(__VLS_709, new __VLS_709({
            prop: "category",
            label: "分类",
            width: "90",
        }));
        const __VLS_711 = __VLS_710({
            prop: "category",
            label: "分类",
            width: "90",
        }, ...__VLS_functionalComponentArgsRest(__VLS_710));
        const __VLS_713 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_714 = __VLS_asFunctionalComponent(__VLS_713, new __VLS_713({
            prop: "status",
            label: "状态",
            width: "90",
        }));
        const __VLS_715 = __VLS_714({
            prop: "status",
            label: "状态",
            width: "90",
        }, ...__VLS_functionalComponentArgsRest(__VLS_714));
        __VLS_716.slots.default;
        {
            const { default: __VLS_thisSlot } = __VLS_716.slots;
            const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
            (row.status === 1 ? "上架" : "下架");
        }
        var __VLS_716;
        const __VLS_717 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_718 = __VLS_asFunctionalComponent(__VLS_717, new __VLS_717({
            label: "操作",
            minWidth: "260",
        }));
        const __VLS_719 = __VLS_718({
            label: "操作",
            minWidth: "260",
        }, ...__VLS_functionalComponentArgsRest(__VLS_718));
        __VLS_720.slots.default;
        {
            const { default: __VLS_thisSlot } = __VLS_720.slots;
            const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
            const __VLS_721 = {}.ElSpace;
            /** @type {[typeof __VLS_components.ElSpace, typeof __VLS_components.elSpace, typeof __VLS_components.ElSpace, typeof __VLS_components.elSpace, ]} */ ;
            // @ts-ignore
            const __VLS_722 = __VLS_asFunctionalComponent(__VLS_721, new __VLS_721({
                wrap: true,
            }));
            const __VLS_723 = __VLS_722({
                wrap: true,
            }, ...__VLS_functionalComponentArgsRest(__VLS_722));
            __VLS_724.slots.default;
            const __VLS_725 = {}.ElButton;
            /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
            // @ts-ignore
            const __VLS_726 = __VLS_asFunctionalComponent(__VLS_725, new __VLS_725({
                ...{ 'onClick': {} },
                size: "small",
                disabled: (__VLS_ctx.publishedDishIdSet.has(row.id)),
            }));
            const __VLS_727 = __VLS_726({
                ...{ 'onClick': {} },
                size: "small",
                disabled: (__VLS_ctx.publishedDishIdSet.has(row.id)),
            }, ...__VLS_functionalComponentArgsRest(__VLS_726));
            let __VLS_729;
            let __VLS_730;
            let __VLS_731;
            const __VLS_732 = {
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
            __VLS_728.slots.default;
            var __VLS_728;
            const __VLS_733 = {}.ElButton;
            /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
            // @ts-ignore
            const __VLS_734 = __VLS_asFunctionalComponent(__VLS_733, new __VLS_733({
                ...{ 'onClick': {} },
                size: "small",
                disabled: (__VLS_ctx.publishedDishIdSet.has(row.id)),
                type: (row.status === 1 ? 'warning' : 'success'),
            }));
            const __VLS_735 = __VLS_734({
                ...{ 'onClick': {} },
                size: "small",
                disabled: (__VLS_ctx.publishedDishIdSet.has(row.id)),
                type: (row.status === 1 ? 'warning' : 'success'),
            }, ...__VLS_functionalComponentArgsRest(__VLS_734));
            let __VLS_737;
            let __VLS_738;
            let __VLS_739;
            const __VLS_740 = {
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
            __VLS_736.slots.default;
            (row.status === 1 ? "下架" : "上架");
            var __VLS_736;
            const __VLS_741 = {}.ElButton;
            /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
            // @ts-ignore
            const __VLS_742 = __VLS_asFunctionalComponent(__VLS_741, new __VLS_741({
                ...{ 'onClick': {} },
                size: "small",
                type: "danger",
                disabled: (__VLS_ctx.publishedDishIdSet.has(row.id)),
            }));
            const __VLS_743 = __VLS_742({
                ...{ 'onClick': {} },
                size: "small",
                type: "danger",
                disabled: (__VLS_ctx.publishedDishIdSet.has(row.id)),
            }, ...__VLS_functionalComponentArgsRest(__VLS_742));
            let __VLS_745;
            let __VLS_746;
            let __VLS_747;
            const __VLS_748 = {
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
            __VLS_744.slots.default;
            var __VLS_744;
            var __VLS_724;
        }
        var __VLS_720;
        var __VLS_696;
        var __VLS_636;
        var __VLS_632;
    }
    if (__VLS_ctx.activeSection === __VLS_ctx.sectionIdMap.merchantMenu) {
        const __VLS_749 = {}.ElCol;
        /** @type {[typeof __VLS_components.ElCol, typeof __VLS_components.elCol, typeof __VLS_components.ElCol, typeof __VLS_components.elCol, ]} */ ;
        // @ts-ignore
        const __VLS_750 = __VLS_asFunctionalComponent(__VLS_749, new __VLS_749({
            span: (24),
            ...{ class: "block" },
        }));
        const __VLS_751 = __VLS_750({
            span: (24),
            ...{ class: "block" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_750));
        __VLS_752.slots.default;
        const __VLS_753 = {}.ElCard;
        /** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
        // @ts-ignore
        const __VLS_754 = __VLS_asFunctionalComponent(__VLS_753, new __VLS_753({
            id: (__VLS_ctx.sectionIdMap.merchantMenu),
        }));
        const __VLS_755 = __VLS_754({
            id: (__VLS_ctx.sectionIdMap.merchantMenu),
        }, ...__VLS_functionalComponentArgsRest(__VLS_754));
        __VLS_756.slots.default;
        {
            const { header: __VLS_thisSlot } = __VLS_756.slots;
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "section-head" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
            __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
        }
        const __VLS_757 = {}.ElForm;
        /** @type {[typeof __VLS_components.ElForm, typeof __VLS_components.elForm, typeof __VLS_components.ElForm, typeof __VLS_components.elForm, ]} */ ;
        // @ts-ignore
        const __VLS_758 = __VLS_asFunctionalComponent(__VLS_757, new __VLS_757({
            inline: true,
        }));
        const __VLS_759 = __VLS_758({
            inline: true,
        }, ...__VLS_functionalComponentArgsRest(__VLS_758));
        __VLS_760.slots.default;
        const __VLS_761 = {}.ElFormItem;
        /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
        // @ts-ignore
        const __VLS_762 = __VLS_asFunctionalComponent(__VLS_761, new __VLS_761({
            label: "菜单名称",
        }));
        const __VLS_763 = __VLS_762({
            label: "菜单名称",
        }, ...__VLS_functionalComponentArgsRest(__VLS_762));
        __VLS_764.slots.default;
        const __VLS_765 = {}.ElInput;
        /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
        // @ts-ignore
        const __VLS_766 = __VLS_asFunctionalComponent(__VLS_765, new __VLS_765({
            modelValue: (__VLS_ctx.menuForm.name),
        }));
        const __VLS_767 = __VLS_766({
            modelValue: (__VLS_ctx.menuForm.name),
        }, ...__VLS_functionalComponentArgsRest(__VLS_766));
        var __VLS_764;
        const __VLS_769 = {}.ElFormItem;
        /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
        // @ts-ignore
        const __VLS_770 = __VLS_asFunctionalComponent(__VLS_769, new __VLS_769({
            label: "日期",
        }));
        const __VLS_771 = __VLS_770({
            label: "日期",
        }, ...__VLS_functionalComponentArgsRest(__VLS_770));
        __VLS_772.slots.default;
        const __VLS_773 = {}.ElDatePicker;
        /** @type {[typeof __VLS_components.ElDatePicker, typeof __VLS_components.elDatePicker, ]} */ ;
        // @ts-ignore
        const __VLS_774 = __VLS_asFunctionalComponent(__VLS_773, new __VLS_773({
            modelValue: (__VLS_ctx.menuForm.saleDate),
            type: "date",
            valueFormat: "YYYY-MM-DD",
        }));
        const __VLS_775 = __VLS_774({
            modelValue: (__VLS_ctx.menuForm.saleDate),
            type: "date",
            valueFormat: "YYYY-MM-DD",
        }, ...__VLS_functionalComponentArgsRest(__VLS_774));
        var __VLS_772;
        const __VLS_777 = {}.ElFormItem;
        /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
        // @ts-ignore
        const __VLS_778 = __VLS_asFunctionalComponent(__VLS_777, new __VLS_777({
            label: "开始",
        }));
        const __VLS_779 = __VLS_778({
            label: "开始",
        }, ...__VLS_functionalComponentArgsRest(__VLS_778));
        __VLS_780.slots.default;
        const __VLS_781 = {}.ElTimePicker;
        /** @type {[typeof __VLS_components.ElTimePicker, typeof __VLS_components.elTimePicker, ]} */ ;
        // @ts-ignore
        const __VLS_782 = __VLS_asFunctionalComponent(__VLS_781, new __VLS_781({
            modelValue: (__VLS_ctx.menuForm.startTime),
            valueFormat: "HH:mm:ss",
        }));
        const __VLS_783 = __VLS_782({
            modelValue: (__VLS_ctx.menuForm.startTime),
            valueFormat: "HH:mm:ss",
        }, ...__VLS_functionalComponentArgsRest(__VLS_782));
        var __VLS_780;
        const __VLS_785 = {}.ElFormItem;
        /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
        // @ts-ignore
        const __VLS_786 = __VLS_asFunctionalComponent(__VLS_785, new __VLS_785({
            label: "结束",
        }));
        const __VLS_787 = __VLS_786({
            label: "结束",
        }, ...__VLS_functionalComponentArgsRest(__VLS_786));
        __VLS_788.slots.default;
        const __VLS_789 = {}.ElTimePicker;
        /** @type {[typeof __VLS_components.ElTimePicker, typeof __VLS_components.elTimePicker, ]} */ ;
        // @ts-ignore
        const __VLS_790 = __VLS_asFunctionalComponent(__VLS_789, new __VLS_789({
            modelValue: (__VLS_ctx.menuForm.endTime),
            valueFormat: "HH:mm:ss",
        }));
        const __VLS_791 = __VLS_790({
            modelValue: (__VLS_ctx.menuForm.endTime),
            valueFormat: "HH:mm:ss",
        }, ...__VLS_functionalComponentArgsRest(__VLS_790));
        var __VLS_788;
        var __VLS_760;
        const __VLS_793 = {}.ElTable;
        /** @type {[typeof __VLS_components.ElTable, typeof __VLS_components.elTable, typeof __VLS_components.ElTable, typeof __VLS_components.elTable, ]} */ ;
        // @ts-ignore
        const __VLS_794 = __VLS_asFunctionalComponent(__VLS_793, new __VLS_793({
            data: (__VLS_ctx.merchantDishes),
            size: "small",
        }));
        const __VLS_795 = __VLS_794({
            data: (__VLS_ctx.merchantDishes),
            size: "small",
        }, ...__VLS_functionalComponentArgsRest(__VLS_794));
        __VLS_796.slots.default;
        const __VLS_797 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_798 = __VLS_asFunctionalComponent(__VLS_797, new __VLS_797({
            prop: "name",
            label: "菜品",
            minWidth: "120",
        }));
        const __VLS_799 = __VLS_798({
            prop: "name",
            label: "菜品",
            minWidth: "120",
        }, ...__VLS_functionalComponentArgsRest(__VLS_798));
        const __VLS_801 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_802 = __VLS_asFunctionalComponent(__VLS_801, new __VLS_801({
            label: "售价",
            width: "130",
        }));
        const __VLS_803 = __VLS_802({
            label: "售价",
            width: "130",
        }, ...__VLS_functionalComponentArgsRest(__VLS_802));
        __VLS_804.slots.default;
        {
            const { default: __VLS_thisSlot } = __VLS_804.slots;
            const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
            const __VLS_805 = {}.ElInputNumber;
            /** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
            // @ts-ignore
            const __VLS_806 = __VLS_asFunctionalComponent(__VLS_805, new __VLS_805({
                modelValue: (__VLS_ctx.menuItemMap[row.id].salePrice),
                min: (0.01),
                step: (0.5),
                size: "small",
            }));
            const __VLS_807 = __VLS_806({
                modelValue: (__VLS_ctx.menuItemMap[row.id].salePrice),
                min: (0.01),
                step: (0.5),
                size: "small",
            }, ...__VLS_functionalComponentArgsRest(__VLS_806));
        }
        var __VLS_804;
        const __VLS_809 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_810 = __VLS_asFunctionalComponent(__VLS_809, new __VLS_809({
            label: "库存",
            width: "120",
        }));
        const __VLS_811 = __VLS_810({
            label: "库存",
            width: "120",
        }, ...__VLS_functionalComponentArgsRest(__VLS_810));
        __VLS_812.slots.default;
        {
            const { default: __VLS_thisSlot } = __VLS_812.slots;
            const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
            const __VLS_813 = {}.ElInputNumber;
            /** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
            // @ts-ignore
            const __VLS_814 = __VLS_asFunctionalComponent(__VLS_813, new __VLS_813({
                modelValue: (__VLS_ctx.menuItemMap[row.id].stock),
                min: (0),
                step: (10),
                size: "small",
            }));
            const __VLS_815 = __VLS_814({
                modelValue: (__VLS_ctx.menuItemMap[row.id].stock),
                min: (0),
                step: (10),
                size: "small",
            }, ...__VLS_functionalComponentArgsRest(__VLS_814));
        }
        var __VLS_812;
        const __VLS_817 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_818 = __VLS_asFunctionalComponent(__VLS_817, new __VLS_817({
            label: "入选",
            width: "100",
        }));
        const __VLS_819 = __VLS_818({
            label: "入选",
            width: "100",
        }, ...__VLS_functionalComponentArgsRest(__VLS_818));
        __VLS_820.slots.default;
        {
            const { default: __VLS_thisSlot } = __VLS_820.slots;
            const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
            const __VLS_821 = {}.ElSwitch;
            /** @type {[typeof __VLS_components.ElSwitch, typeof __VLS_components.elSwitch, ]} */ ;
            // @ts-ignore
            const __VLS_822 = __VLS_asFunctionalComponent(__VLS_821, new __VLS_821({
                modelValue: (__VLS_ctx.menuItemMap[row.id].enabled),
            }));
            const __VLS_823 = __VLS_822({
                modelValue: (__VLS_ctx.menuItemMap[row.id].enabled),
            }, ...__VLS_functionalComponentArgsRest(__VLS_822));
        }
        var __VLS_820;
        var __VLS_796;
        const __VLS_825 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        const __VLS_826 = __VLS_asFunctionalComponent(__VLS_825, new __VLS_825({
            ...{ 'onClick': {} },
            ...{ class: "publish-btn" },
            type: "primary",
            loading: (__VLS_ctx.publishingMenu),
        }));
        const __VLS_827 = __VLS_826({
            ...{ 'onClick': {} },
            ...{ class: "publish-btn" },
            type: "primary",
            loading: (__VLS_ctx.publishingMenu),
        }, ...__VLS_functionalComponentArgsRest(__VLS_826));
        let __VLS_829;
        let __VLS_830;
        let __VLS_831;
        const __VLS_832 = {
            onClick: (__VLS_ctx.publishMenu)
        };
        __VLS_828.slots.default;
        var __VLS_828;
        var __VLS_756;
        var __VLS_752;
    }
    var __VLS_311;
}
else {
    const __VLS_833 = {}.ElRow;
    /** @type {[typeof __VLS_components.ElRow, typeof __VLS_components.elRow, typeof __VLS_components.ElRow, typeof __VLS_components.elRow, ]} */ ;
    // @ts-ignore
    const __VLS_834 = __VLS_asFunctionalComponent(__VLS_833, new __VLS_833({
        gutter: (16),
    }));
    const __VLS_835 = __VLS_834({
        gutter: (16),
    }, ...__VLS_functionalComponentArgsRest(__VLS_834));
    __VLS_836.slots.default;
    if (__VLS_ctx.activeSection === __VLS_ctx.sectionIdMap.adminCreateWindow) {
        const __VLS_837 = {}.ElCol;
        /** @type {[typeof __VLS_components.ElCol, typeof __VLS_components.elCol, typeof __VLS_components.ElCol, typeof __VLS_components.elCol, ]} */ ;
        // @ts-ignore
        const __VLS_838 = __VLS_asFunctionalComponent(__VLS_837, new __VLS_837({
            span: (24),
        }));
        const __VLS_839 = __VLS_838({
            span: (24),
        }, ...__VLS_functionalComponentArgsRest(__VLS_838));
        __VLS_840.slots.default;
        const __VLS_841 = {}.ElCard;
        /** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
        // @ts-ignore
        const __VLS_842 = __VLS_asFunctionalComponent(__VLS_841, new __VLS_841({
            id: (__VLS_ctx.sectionIdMap.adminCreateWindow),
        }));
        const __VLS_843 = __VLS_842({
            id: (__VLS_ctx.sectionIdMap.adminCreateWindow),
        }, ...__VLS_functionalComponentArgsRest(__VLS_842));
        __VLS_844.slots.default;
        {
            const { header: __VLS_thisSlot } = __VLS_844.slots;
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "section-head" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
            __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
        }
        const __VLS_845 = {}.ElForm;
        /** @type {[typeof __VLS_components.ElForm, typeof __VLS_components.elForm, typeof __VLS_components.ElForm, typeof __VLS_components.elForm, ]} */ ;
        // @ts-ignore
        const __VLS_846 = __VLS_asFunctionalComponent(__VLS_845, new __VLS_845({
            labelWidth: "95px",
        }));
        const __VLS_847 = __VLS_846({
            labelWidth: "95px",
        }, ...__VLS_functionalComponentArgsRest(__VLS_846));
        __VLS_848.slots.default;
        const __VLS_849 = {}.ElFormItem;
        /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
        // @ts-ignore
        const __VLS_850 = __VLS_asFunctionalComponent(__VLS_849, new __VLS_849({
            label: "窗口名称",
        }));
        const __VLS_851 = __VLS_850({
            label: "窗口名称",
        }, ...__VLS_functionalComponentArgsRest(__VLS_850));
        __VLS_852.slots.default;
        const __VLS_853 = {}.ElInput;
        /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
        // @ts-ignore
        const __VLS_854 = __VLS_asFunctionalComponent(__VLS_853, new __VLS_853({
            modelValue: (__VLS_ctx.windowForm.name),
            placeholder: "例如：1号档口-盖浇饭",
        }));
        const __VLS_855 = __VLS_854({
            modelValue: (__VLS_ctx.windowForm.name),
            placeholder: "例如：1号档口-盖浇饭",
        }, ...__VLS_functionalComponentArgsRest(__VLS_854));
        var __VLS_852;
        const __VLS_857 = {}.ElFormItem;
        /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
        // @ts-ignore
        const __VLS_858 = __VLS_asFunctionalComponent(__VLS_857, new __VLS_857({
            label: "位置",
        }));
        const __VLS_859 = __VLS_858({
            label: "位置",
        }, ...__VLS_functionalComponentArgsRest(__VLS_858));
        __VLS_860.slots.default;
        const __VLS_861 = {}.ElInput;
        /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
        // @ts-ignore
        const __VLS_862 = __VLS_asFunctionalComponent(__VLS_861, new __VLS_861({
            modelValue: (__VLS_ctx.windowForm.location),
            placeholder: "例如：食堂一楼东侧",
        }));
        const __VLS_863 = __VLS_862({
            modelValue: (__VLS_ctx.windowForm.location),
            placeholder: "例如：食堂一楼东侧",
        }, ...__VLS_functionalComponentArgsRest(__VLS_862));
        var __VLS_860;
        const __VLS_865 = {}.ElFormItem;
        /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
        // @ts-ignore
        const __VLS_866 = __VLS_asFunctionalComponent(__VLS_865, new __VLS_865({
            label: "商家账号",
        }));
        const __VLS_867 = __VLS_866({
            label: "商家账号",
        }, ...__VLS_functionalComponentArgsRest(__VLS_866));
        __VLS_868.slots.default;
        const __VLS_869 = {}.ElSelect;
        /** @type {[typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, ]} */ ;
        // @ts-ignore
        const __VLS_870 = __VLS_asFunctionalComponent(__VLS_869, new __VLS_869({
            modelValue: (__VLS_ctx.windowForm.merchantId),
            placeholder: "请选择商家",
            ...{ style: {} },
        }));
        const __VLS_871 = __VLS_870({
            modelValue: (__VLS_ctx.windowForm.merchantId),
            placeholder: "请选择商家",
            ...{ style: {} },
        }, ...__VLS_functionalComponentArgsRest(__VLS_870));
        __VLS_872.slots.default;
        for (const [m] of __VLS_getVForSourceType((__VLS_ctx.merchantUsers))) {
            const __VLS_873 = {}.ElOption;
            /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
            // @ts-ignore
            const __VLS_874 = __VLS_asFunctionalComponent(__VLS_873, new __VLS_873({
                key: (m.id),
                label: (`${m.nickname} (${m.phone})`),
                value: (m.id),
            }));
            const __VLS_875 = __VLS_874({
                key: (m.id),
                label: (`${m.nickname} (${m.phone})`),
                value: (m.id),
            }, ...__VLS_functionalComponentArgsRest(__VLS_874));
        }
        var __VLS_872;
        var __VLS_868;
        const __VLS_877 = {}.ElFormItem;
        /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
        // @ts-ignore
        const __VLS_878 = __VLS_asFunctionalComponent(__VLS_877, new __VLS_877({
            label: "叫号前缀",
        }));
        const __VLS_879 = __VLS_878({
            label: "叫号前缀",
        }, ...__VLS_functionalComponentArgsRest(__VLS_878));
        __VLS_880.slots.default;
        const __VLS_881 = {}.ElInput;
        /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
        // @ts-ignore
        const __VLS_882 = __VLS_asFunctionalComponent(__VLS_881, new __VLS_881({
            modelValue: (__VLS_ctx.windowForm.pickupPrefix),
            maxlength: "2",
            placeholder: "例如：A",
        }));
        const __VLS_883 = __VLS_882({
            modelValue: (__VLS_ctx.windowForm.pickupPrefix),
            maxlength: "2",
            placeholder: "例如：A",
        }, ...__VLS_functionalComponentArgsRest(__VLS_882));
        var __VLS_880;
        const __VLS_885 = {}.ElFormItem;
        /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
        // @ts-ignore
        const __VLS_886 = __VLS_asFunctionalComponent(__VLS_885, new __VLS_885({}));
        const __VLS_887 = __VLS_886({}, ...__VLS_functionalComponentArgsRest(__VLS_886));
        __VLS_888.slots.default;
        const __VLS_889 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        const __VLS_890 = __VLS_asFunctionalComponent(__VLS_889, new __VLS_889({
            ...{ 'onClick': {} },
            type: "primary",
            loading: (__VLS_ctx.creatingWindow),
        }));
        const __VLS_891 = __VLS_890({
            ...{ 'onClick': {} },
            type: "primary",
            loading: (__VLS_ctx.creatingWindow),
        }, ...__VLS_functionalComponentArgsRest(__VLS_890));
        let __VLS_893;
        let __VLS_894;
        let __VLS_895;
        const __VLS_896 = {
            onClick: (__VLS_ctx.createWindow)
        };
        __VLS_892.slots.default;
        var __VLS_892;
        var __VLS_888;
        var __VLS_848;
        var __VLS_844;
        var __VLS_840;
    }
    if (__VLS_ctx.activeSection === __VLS_ctx.sectionIdMap.adminWindows) {
        const __VLS_897 = {}.ElCol;
        /** @type {[typeof __VLS_components.ElCol, typeof __VLS_components.elCol, typeof __VLS_components.ElCol, typeof __VLS_components.elCol, ]} */ ;
        // @ts-ignore
        const __VLS_898 = __VLS_asFunctionalComponent(__VLS_897, new __VLS_897({
            span: (24),
        }));
        const __VLS_899 = __VLS_898({
            span: (24),
        }, ...__VLS_functionalComponentArgsRest(__VLS_898));
        __VLS_900.slots.default;
        const __VLS_901 = {}.ElCard;
        /** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
        // @ts-ignore
        const __VLS_902 = __VLS_asFunctionalComponent(__VLS_901, new __VLS_901({
            id: (__VLS_ctx.sectionIdMap.adminWindows),
        }));
        const __VLS_903 = __VLS_902({
            id: (__VLS_ctx.sectionIdMap.adminWindows),
        }, ...__VLS_functionalComponentArgsRest(__VLS_902));
        __VLS_904.slots.default;
        {
            const { header: __VLS_thisSlot } = __VLS_904.slots;
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "section-head" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
            __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
        }
        const __VLS_905 = {}.ElInput;
        /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
        // @ts-ignore
        const __VLS_906 = __VLS_asFunctionalComponent(__VLS_905, new __VLS_905({
            modelValue: (__VLS_ctx.windowKeyword),
            placeholder: "按窗口名/位置/商家ID查询",
            ...{ class: "query-input" },
        }));
        const __VLS_907 = __VLS_906({
            modelValue: (__VLS_ctx.windowKeyword),
            placeholder: "按窗口名/位置/商家ID查询",
            ...{ class: "query-input" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_906));
        const __VLS_909 = {}.ElSpace;
        /** @type {[typeof __VLS_components.ElSpace, typeof __VLS_components.elSpace, typeof __VLS_components.ElSpace, typeof __VLS_components.elSpace, ]} */ ;
        // @ts-ignore
        const __VLS_910 = __VLS_asFunctionalComponent(__VLS_909, new __VLS_909({
            wrap: true,
            ...{ class: "query-row" },
        }));
        const __VLS_911 = __VLS_910({
            wrap: true,
            ...{ class: "query-row" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_910));
        __VLS_912.slots.default;
        const __VLS_913 = {}.ElSelect;
        /** @type {[typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, ]} */ ;
        // @ts-ignore
        const __VLS_914 = __VLS_asFunctionalComponent(__VLS_913, new __VLS_913({
            modelValue: (__VLS_ctx.adminWindowStatus),
            placeholder: "状态筛选",
            clearable: true,
            ...{ class: "query-input-short" },
        }));
        const __VLS_915 = __VLS_914({
            modelValue: (__VLS_ctx.adminWindowStatus),
            placeholder: "状态筛选",
            clearable: true,
            ...{ class: "query-input-short" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_914));
        __VLS_916.slots.default;
        const __VLS_917 = {}.ElOption;
        /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
        // @ts-ignore
        const __VLS_918 = __VLS_asFunctionalComponent(__VLS_917, new __VLS_917({
            value: (1),
            label: "启用",
        }));
        const __VLS_919 = __VLS_918({
            value: (1),
            label: "启用",
        }, ...__VLS_functionalComponentArgsRest(__VLS_918));
        const __VLS_921 = {}.ElOption;
        /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
        // @ts-ignore
        const __VLS_922 = __VLS_asFunctionalComponent(__VLS_921, new __VLS_921({
            value: (0),
            label: "停用",
        }));
        const __VLS_923 = __VLS_922({
            value: (0),
            label: "停用",
        }, ...__VLS_functionalComponentArgsRest(__VLS_922));
        var __VLS_916;
        const __VLS_925 = {}.ElInputNumber;
        /** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
        // @ts-ignore
        const __VLS_926 = __VLS_asFunctionalComponent(__VLS_925, new __VLS_925({
            modelValue: (__VLS_ctx.adminWindowMerchantId),
            min: (1),
            step: (1),
            placeholder: "商家ID",
        }));
        const __VLS_927 = __VLS_926({
            modelValue: (__VLS_ctx.adminWindowMerchantId),
            min: (1),
            step: (1),
            placeholder: "商家ID",
        }, ...__VLS_functionalComponentArgsRest(__VLS_926));
        const __VLS_929 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        const __VLS_930 = __VLS_asFunctionalComponent(__VLS_929, new __VLS_929({
            ...{ 'onClick': {} },
        }));
        const __VLS_931 = __VLS_930({
            ...{ 'onClick': {} },
        }, ...__VLS_functionalComponentArgsRest(__VLS_930));
        let __VLS_933;
        let __VLS_934;
        let __VLS_935;
        const __VLS_936 = {
            onClick: (__VLS_ctx.resetAdminWindowFilters)
        };
        __VLS_932.slots.default;
        var __VLS_932;
        var __VLS_912;
        const __VLS_937 = {}.ElTable;
        /** @type {[typeof __VLS_components.ElTable, typeof __VLS_components.elTable, typeof __VLS_components.ElTable, typeof __VLS_components.elTable, ]} */ ;
        // @ts-ignore
        const __VLS_938 = __VLS_asFunctionalComponent(__VLS_937, new __VLS_937({
            data: (__VLS_ctx.filteredWindows),
            size: "small",
        }));
        const __VLS_939 = __VLS_938({
            data: (__VLS_ctx.filteredWindows),
            size: "small",
        }, ...__VLS_functionalComponentArgsRest(__VLS_938));
        __VLS_940.slots.default;
        const __VLS_941 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_942 = __VLS_asFunctionalComponent(__VLS_941, new __VLS_941({
            prop: "id",
            label: "ID",
            width: "70",
        }));
        const __VLS_943 = __VLS_942({
            prop: "id",
            label: "ID",
            width: "70",
        }, ...__VLS_functionalComponentArgsRest(__VLS_942));
        const __VLS_945 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_946 = __VLS_asFunctionalComponent(__VLS_945, new __VLS_945({
            prop: "name",
            label: "窗口名称",
            minWidth: "120",
        }));
        const __VLS_947 = __VLS_946({
            prop: "name",
            label: "窗口名称",
            minWidth: "120",
        }, ...__VLS_functionalComponentArgsRest(__VLS_946));
        const __VLS_949 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_950 = __VLS_asFunctionalComponent(__VLS_949, new __VLS_949({
            prop: "location",
            label: "位置",
            minWidth: "140",
        }));
        const __VLS_951 = __VLS_950({
            prop: "location",
            label: "位置",
            minWidth: "140",
        }, ...__VLS_functionalComponentArgsRest(__VLS_950));
        const __VLS_953 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_954 = __VLS_asFunctionalComponent(__VLS_953, new __VLS_953({
            prop: "merchantId",
            label: "商家ID",
            width: "90",
        }));
        const __VLS_955 = __VLS_954({
            prop: "merchantId",
            label: "商家ID",
            width: "90",
        }, ...__VLS_functionalComponentArgsRest(__VLS_954));
        const __VLS_957 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_958 = __VLS_asFunctionalComponent(__VLS_957, new __VLS_957({
            prop: "pickupPrefix",
            label: "前缀",
            width: "80",
        }));
        const __VLS_959 = __VLS_958({
            prop: "pickupPrefix",
            label: "前缀",
            width: "80",
        }, ...__VLS_functionalComponentArgsRest(__VLS_958));
        const __VLS_961 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_962 = __VLS_asFunctionalComponent(__VLS_961, new __VLS_961({
            prop: "status",
            label: "状态",
            width: "90",
        }));
        const __VLS_963 = __VLS_962({
            prop: "status",
            label: "状态",
            width: "90",
        }, ...__VLS_functionalComponentArgsRest(__VLS_962));
        __VLS_964.slots.default;
        {
            const { default: __VLS_thisSlot } = __VLS_964.slots;
            const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
            (row.status === 1 ? "启用" : "停用");
        }
        var __VLS_964;
        const __VLS_965 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_966 = __VLS_asFunctionalComponent(__VLS_965, new __VLS_965({
            label: "操作",
            minWidth: "220",
        }));
        const __VLS_967 = __VLS_966({
            label: "操作",
            minWidth: "220",
        }, ...__VLS_functionalComponentArgsRest(__VLS_966));
        __VLS_968.slots.default;
        {
            const { default: __VLS_thisSlot } = __VLS_968.slots;
            const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
            const __VLS_969 = {}.ElSpace;
            /** @type {[typeof __VLS_components.ElSpace, typeof __VLS_components.elSpace, typeof __VLS_components.ElSpace, typeof __VLS_components.elSpace, ]} */ ;
            // @ts-ignore
            const __VLS_970 = __VLS_asFunctionalComponent(__VLS_969, new __VLS_969({
                wrap: true,
            }));
            const __VLS_971 = __VLS_970({
                wrap: true,
            }, ...__VLS_functionalComponentArgsRest(__VLS_970));
            __VLS_972.slots.default;
            const __VLS_973 = {}.ElButton;
            /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
            // @ts-ignore
            const __VLS_974 = __VLS_asFunctionalComponent(__VLS_973, new __VLS_973({
                ...{ 'onClick': {} },
                size: "small",
                type: (row.status === 1 ? 'warning' : 'success'),
            }));
            const __VLS_975 = __VLS_974({
                ...{ 'onClick': {} },
                size: "small",
                type: (row.status === 1 ? 'warning' : 'success'),
            }, ...__VLS_functionalComponentArgsRest(__VLS_974));
            let __VLS_977;
            let __VLS_978;
            let __VLS_979;
            const __VLS_980 = {
                onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.isUser && __VLS_ctx.activeSection === __VLS_ctx.sectionIdMap.userOrders))
                        return;
                    if (!!(__VLS_ctx.isMerchant))
                        return;
                    if (!(__VLS_ctx.activeSection === __VLS_ctx.sectionIdMap.adminWindows))
                        return;
                    __VLS_ctx.toggleWindowStatus(row);
                }
            };
            __VLS_976.slots.default;
            (row.status === 1 ? "停用" : "启用");
            var __VLS_976;
            const __VLS_981 = {}.ElButton;
            /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
            // @ts-ignore
            const __VLS_982 = __VLS_asFunctionalComponent(__VLS_981, new __VLS_981({
                ...{ 'onClick': {} },
                size: "small",
                type: "danger",
            }));
            const __VLS_983 = __VLS_982({
                ...{ 'onClick': {} },
                size: "small",
                type: "danger",
            }, ...__VLS_functionalComponentArgsRest(__VLS_982));
            let __VLS_985;
            let __VLS_986;
            let __VLS_987;
            const __VLS_988 = {
                onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.isUser && __VLS_ctx.activeSection === __VLS_ctx.sectionIdMap.userOrders))
                        return;
                    if (!!(__VLS_ctx.isMerchant))
                        return;
                    if (!(__VLS_ctx.activeSection === __VLS_ctx.sectionIdMap.adminWindows))
                        return;
                    __VLS_ctx.removeWindow(row);
                }
            };
            __VLS_984.slots.default;
            var __VLS_984;
            var __VLS_972;
        }
        var __VLS_968;
        var __VLS_940;
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "pagination-wrap" },
        });
        const __VLS_989 = {}.ElPagination;
        /** @type {[typeof __VLS_components.ElPagination, typeof __VLS_components.elPagination, ]} */ ;
        // @ts-ignore
        const __VLS_990 = __VLS_asFunctionalComponent(__VLS_989, new __VLS_989({
            ...{ 'onCurrentChange': {} },
            ...{ 'onSizeChange': {} },
            background: true,
            layout: "total, sizes, prev, pager, next",
            total: (__VLS_ctx.adminWindowTotal),
            currentPage: (__VLS_ctx.adminWindowPage),
            pageSize: (__VLS_ctx.adminWindowSize),
            pageSizes: ([5, 10, 20, 50]),
        }));
        const __VLS_991 = __VLS_990({
            ...{ 'onCurrentChange': {} },
            ...{ 'onSizeChange': {} },
            background: true,
            layout: "total, sizes, prev, pager, next",
            total: (__VLS_ctx.adminWindowTotal),
            currentPage: (__VLS_ctx.adminWindowPage),
            pageSize: (__VLS_ctx.adminWindowSize),
            pageSizes: ([5, 10, 20, 50]),
        }, ...__VLS_functionalComponentArgsRest(__VLS_990));
        let __VLS_993;
        let __VLS_994;
        let __VLS_995;
        const __VLS_996 = {
            onCurrentChange: (__VLS_ctx.onAdminWindowPageChange)
        };
        const __VLS_997 = {
            onSizeChange: (__VLS_ctx.onAdminWindowSizeChange)
        };
        var __VLS_992;
        var __VLS_904;
        var __VLS_900;
    }
    if (__VLS_ctx.activeSection === __VLS_ctx.sectionIdMap.adminUsers) {
        const __VLS_998 = {}.ElCol;
        /** @type {[typeof __VLS_components.ElCol, typeof __VLS_components.elCol, typeof __VLS_components.ElCol, typeof __VLS_components.elCol, ]} */ ;
        // @ts-ignore
        const __VLS_999 = __VLS_asFunctionalComponent(__VLS_998, new __VLS_998({
            span: (24),
        }));
        const __VLS_1000 = __VLS_999({
            span: (24),
        }, ...__VLS_functionalComponentArgsRest(__VLS_999));
        __VLS_1001.slots.default;
        const __VLS_1002 = {}.ElCard;
        /** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
        // @ts-ignore
        const __VLS_1003 = __VLS_asFunctionalComponent(__VLS_1002, new __VLS_1002({
            id: (__VLS_ctx.sectionIdMap.adminUsers),
        }));
        const __VLS_1004 = __VLS_1003({
            id: (__VLS_ctx.sectionIdMap.adminUsers),
        }, ...__VLS_functionalComponentArgsRest(__VLS_1003));
        __VLS_1005.slots.default;
        {
            const { header: __VLS_thisSlot } = __VLS_1005.slots;
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "section-head" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
            __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
        }
        const __VLS_1006 = {}.ElInput;
        /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
        // @ts-ignore
        const __VLS_1007 = __VLS_asFunctionalComponent(__VLS_1006, new __VLS_1006({
            modelValue: (__VLS_ctx.userKeyword),
            placeholder: "按用户ID/手机号/昵称查询",
            ...{ class: "query-input" },
        }));
        const __VLS_1008 = __VLS_1007({
            modelValue: (__VLS_ctx.userKeyword),
            placeholder: "按用户ID/手机号/昵称查询",
            ...{ class: "query-input" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_1007));
        const __VLS_1010 = {}.ElSpace;
        /** @type {[typeof __VLS_components.ElSpace, typeof __VLS_components.elSpace, typeof __VLS_components.ElSpace, typeof __VLS_components.elSpace, ]} */ ;
        // @ts-ignore
        const __VLS_1011 = __VLS_asFunctionalComponent(__VLS_1010, new __VLS_1010({
            wrap: true,
            ...{ class: "query-row" },
        }));
        const __VLS_1012 = __VLS_1011({
            wrap: true,
            ...{ class: "query-row" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_1011));
        __VLS_1013.slots.default;
        const __VLS_1014 = {}.ElSelect;
        /** @type {[typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, ]} */ ;
        // @ts-ignore
        const __VLS_1015 = __VLS_asFunctionalComponent(__VLS_1014, new __VLS_1014({
            modelValue: (__VLS_ctx.adminUserRole),
            placeholder: "角色筛选",
            clearable: true,
            ...{ class: "query-input-short" },
        }));
        const __VLS_1016 = __VLS_1015({
            modelValue: (__VLS_ctx.adminUserRole),
            placeholder: "角色筛选",
            clearable: true,
            ...{ class: "query-input-short" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_1015));
        __VLS_1017.slots.default;
        const __VLS_1018 = {}.ElOption;
        /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
        // @ts-ignore
        const __VLS_1019 = __VLS_asFunctionalComponent(__VLS_1018, new __VLS_1018({
            value: (0),
            label: "普通用户",
        }));
        const __VLS_1020 = __VLS_1019({
            value: (0),
            label: "普通用户",
        }, ...__VLS_functionalComponentArgsRest(__VLS_1019));
        const __VLS_1022 = {}.ElOption;
        /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
        // @ts-ignore
        const __VLS_1023 = __VLS_asFunctionalComponent(__VLS_1022, new __VLS_1022({
            value: (1),
            label: "商家",
        }));
        const __VLS_1024 = __VLS_1023({
            value: (1),
            label: "商家",
        }, ...__VLS_functionalComponentArgsRest(__VLS_1023));
        const __VLS_1026 = {}.ElOption;
        /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
        // @ts-ignore
        const __VLS_1027 = __VLS_asFunctionalComponent(__VLS_1026, new __VLS_1026({
            value: (2),
            label: "管理员",
        }));
        const __VLS_1028 = __VLS_1027({
            value: (2),
            label: "管理员",
        }, ...__VLS_functionalComponentArgsRest(__VLS_1027));
        var __VLS_1017;
        const __VLS_1030 = {}.ElSelect;
        /** @type {[typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, ]} */ ;
        // @ts-ignore
        const __VLS_1031 = __VLS_asFunctionalComponent(__VLS_1030, new __VLS_1030({
            modelValue: (__VLS_ctx.adminUserStatus),
            placeholder: "状态筛选",
            clearable: true,
            ...{ class: "query-input-short" },
        }));
        const __VLS_1032 = __VLS_1031({
            modelValue: (__VLS_ctx.adminUserStatus),
            placeholder: "状态筛选",
            clearable: true,
            ...{ class: "query-input-short" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_1031));
        __VLS_1033.slots.default;
        const __VLS_1034 = {}.ElOption;
        /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
        // @ts-ignore
        const __VLS_1035 = __VLS_asFunctionalComponent(__VLS_1034, new __VLS_1034({
            value: (1),
            label: "启用",
        }));
        const __VLS_1036 = __VLS_1035({
            value: (1),
            label: "启用",
        }, ...__VLS_functionalComponentArgsRest(__VLS_1035));
        const __VLS_1038 = {}.ElOption;
        /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
        // @ts-ignore
        const __VLS_1039 = __VLS_asFunctionalComponent(__VLS_1038, new __VLS_1038({
            value: (0),
            label: "停用",
        }));
        const __VLS_1040 = __VLS_1039({
            value: (0),
            label: "停用",
        }, ...__VLS_functionalComponentArgsRest(__VLS_1039));
        var __VLS_1033;
        const __VLS_1042 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        const __VLS_1043 = __VLS_asFunctionalComponent(__VLS_1042, new __VLS_1042({
            ...{ 'onClick': {} },
        }));
        const __VLS_1044 = __VLS_1043({
            ...{ 'onClick': {} },
        }, ...__VLS_functionalComponentArgsRest(__VLS_1043));
        let __VLS_1046;
        let __VLS_1047;
        let __VLS_1048;
        const __VLS_1049 = {
            onClick: (__VLS_ctx.resetAdminUserFilters)
        };
        __VLS_1045.slots.default;
        var __VLS_1045;
        var __VLS_1013;
        const __VLS_1050 = {}.ElTable;
        /** @type {[typeof __VLS_components.ElTable, typeof __VLS_components.elTable, typeof __VLS_components.ElTable, typeof __VLS_components.elTable, ]} */ ;
        // @ts-ignore
        const __VLS_1051 = __VLS_asFunctionalComponent(__VLS_1050, new __VLS_1050({
            data: (__VLS_ctx.filteredUsers),
            size: "small",
        }));
        const __VLS_1052 = __VLS_1051({
            data: (__VLS_ctx.filteredUsers),
            size: "small",
        }, ...__VLS_functionalComponentArgsRest(__VLS_1051));
        __VLS_1053.slots.default;
        const __VLS_1054 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_1055 = __VLS_asFunctionalComponent(__VLS_1054, new __VLS_1054({
            prop: "id",
            label: "ID",
            width: "70",
        }));
        const __VLS_1056 = __VLS_1055({
            prop: "id",
            label: "ID",
            width: "70",
        }, ...__VLS_functionalComponentArgsRest(__VLS_1055));
        const __VLS_1058 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_1059 = __VLS_asFunctionalComponent(__VLS_1058, new __VLS_1058({
            prop: "phone",
            label: "手机号",
            width: "130",
        }));
        const __VLS_1060 = __VLS_1059({
            prop: "phone",
            label: "手机号",
            width: "130",
        }, ...__VLS_functionalComponentArgsRest(__VLS_1059));
        const __VLS_1062 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_1063 = __VLS_asFunctionalComponent(__VLS_1062, new __VLS_1062({
            prop: "nickname",
            label: "昵称",
            minWidth: "100",
        }));
        const __VLS_1064 = __VLS_1063({
            prop: "nickname",
            label: "昵称",
            minWidth: "100",
        }, ...__VLS_functionalComponentArgsRest(__VLS_1063));
        const __VLS_1066 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_1067 = __VLS_asFunctionalComponent(__VLS_1066, new __VLS_1066({
            prop: "role",
            label: "角色",
            width: "90",
        }));
        const __VLS_1068 = __VLS_1067({
            prop: "role",
            label: "角色",
            width: "90",
        }, ...__VLS_functionalComponentArgsRest(__VLS_1067));
        __VLS_1069.slots.default;
        {
            const { default: __VLS_thisSlot } = __VLS_1069.slots;
            const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
            (__VLS_ctx.roleNameByValue(row.role));
        }
        var __VLS_1069;
        const __VLS_1070 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_1071 = __VLS_asFunctionalComponent(__VLS_1070, new __VLS_1070({
            prop: "status",
            label: "状态",
            width: "80",
        }));
        const __VLS_1072 = __VLS_1071({
            prop: "status",
            label: "状态",
            width: "80",
        }, ...__VLS_functionalComponentArgsRest(__VLS_1071));
        __VLS_1073.slots.default;
        {
            const { default: __VLS_thisSlot } = __VLS_1073.slots;
            const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
            (row.status === 1 ? "启用" : "停用");
        }
        var __VLS_1073;
        const __VLS_1074 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_1075 = __VLS_asFunctionalComponent(__VLS_1074, new __VLS_1074({
            label: "操作",
            minWidth: "280",
        }));
        const __VLS_1076 = __VLS_1075({
            label: "操作",
            minWidth: "280",
        }, ...__VLS_functionalComponentArgsRest(__VLS_1075));
        __VLS_1077.slots.default;
        {
            const { default: __VLS_thisSlot } = __VLS_1077.slots;
            const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
            const __VLS_1078 = {}.ElSpace;
            /** @type {[typeof __VLS_components.ElSpace, typeof __VLS_components.elSpace, typeof __VLS_components.ElSpace, typeof __VLS_components.elSpace, ]} */ ;
            // @ts-ignore
            const __VLS_1079 = __VLS_asFunctionalComponent(__VLS_1078, new __VLS_1078({
                wrap: true,
            }));
            const __VLS_1080 = __VLS_1079({
                wrap: true,
            }, ...__VLS_functionalComponentArgsRest(__VLS_1079));
            __VLS_1081.slots.default;
            const __VLS_1082 = {}.ElButton;
            /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
            // @ts-ignore
            const __VLS_1083 = __VLS_asFunctionalComponent(__VLS_1082, new __VLS_1082({
                ...{ 'onClick': {} },
                size: "small",
                type: (row.status === 1 ? 'warning' : 'success'),
            }));
            const __VLS_1084 = __VLS_1083({
                ...{ 'onClick': {} },
                size: "small",
                type: (row.status === 1 ? 'warning' : 'success'),
            }, ...__VLS_functionalComponentArgsRest(__VLS_1083));
            let __VLS_1086;
            let __VLS_1087;
            let __VLS_1088;
            const __VLS_1089 = {
                onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.isUser && __VLS_ctx.activeSection === __VLS_ctx.sectionIdMap.userOrders))
                        return;
                    if (!!(__VLS_ctx.isMerchant))
                        return;
                    if (!(__VLS_ctx.activeSection === __VLS_ctx.sectionIdMap.adminUsers))
                        return;
                    __VLS_ctx.toggleUserStatus(row);
                }
            };
            __VLS_1085.slots.default;
            (row.status === 1 ? "停用" : "启用");
            var __VLS_1085;
            const __VLS_1090 = {}.ElButton;
            /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
            // @ts-ignore
            const __VLS_1091 = __VLS_asFunctionalComponent(__VLS_1090, new __VLS_1090({
                ...{ 'onClick': {} },
                size: "small",
            }));
            const __VLS_1092 = __VLS_1091({
                ...{ 'onClick': {} },
                size: "small",
            }, ...__VLS_functionalComponentArgsRest(__VLS_1091));
            let __VLS_1094;
            let __VLS_1095;
            let __VLS_1096;
            const __VLS_1097 = {
                onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.isUser && __VLS_ctx.activeSection === __VLS_ctx.sectionIdMap.userOrders))
                        return;
                    if (!!(__VLS_ctx.isMerchant))
                        return;
                    if (!(__VLS_ctx.activeSection === __VLS_ctx.sectionIdMap.adminUsers))
                        return;
                    __VLS_ctx.resetUserPassword(row);
                }
            };
            __VLS_1093.slots.default;
            var __VLS_1093;
            const __VLS_1098 = {}.ElButton;
            /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
            // @ts-ignore
            const __VLS_1099 = __VLS_asFunctionalComponent(__VLS_1098, new __VLS_1098({
                ...{ 'onClick': {} },
                size: "small",
                type: "danger",
            }));
            const __VLS_1100 = __VLS_1099({
                ...{ 'onClick': {} },
                size: "small",
                type: "danger",
            }, ...__VLS_functionalComponentArgsRest(__VLS_1099));
            let __VLS_1102;
            let __VLS_1103;
            let __VLS_1104;
            const __VLS_1105 = {
                onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.isUser && __VLS_ctx.activeSection === __VLS_ctx.sectionIdMap.userOrders))
                        return;
                    if (!!(__VLS_ctx.isMerchant))
                        return;
                    if (!(__VLS_ctx.activeSection === __VLS_ctx.sectionIdMap.adminUsers))
                        return;
                    __VLS_ctx.removeUser(row);
                }
            };
            __VLS_1101.slots.default;
            var __VLS_1101;
            var __VLS_1081;
        }
        var __VLS_1077;
        var __VLS_1053;
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "pagination-wrap" },
        });
        const __VLS_1106 = {}.ElPagination;
        /** @type {[typeof __VLS_components.ElPagination, typeof __VLS_components.elPagination, ]} */ ;
        // @ts-ignore
        const __VLS_1107 = __VLS_asFunctionalComponent(__VLS_1106, new __VLS_1106({
            ...{ 'onCurrentChange': {} },
            ...{ 'onSizeChange': {} },
            background: true,
            layout: "total, sizes, prev, pager, next",
            total: (__VLS_ctx.adminUserTotal),
            currentPage: (__VLS_ctx.adminUserPage),
            pageSize: (__VLS_ctx.adminUserSize),
            pageSizes: ([5, 10, 20, 50]),
        }));
        const __VLS_1108 = __VLS_1107({
            ...{ 'onCurrentChange': {} },
            ...{ 'onSizeChange': {} },
            background: true,
            layout: "total, sizes, prev, pager, next",
            total: (__VLS_ctx.adminUserTotal),
            currentPage: (__VLS_ctx.adminUserPage),
            pageSize: (__VLS_ctx.adminUserSize),
            pageSizes: ([5, 10, 20, 50]),
        }, ...__VLS_functionalComponentArgsRest(__VLS_1107));
        let __VLS_1110;
        let __VLS_1111;
        let __VLS_1112;
        const __VLS_1113 = {
            onCurrentChange: (__VLS_ctx.onAdminUserPageChange)
        };
        const __VLS_1114 = {
            onSizeChange: (__VLS_ctx.onAdminUserSizeChange)
        };
        var __VLS_1109;
        var __VLS_1005;
        var __VLS_1001;
    }
    if (__VLS_ctx.activeSection === __VLS_ctx.sectionIdMap.adminMenuDetail) {
        const __VLS_1115 = {}.ElCol;
        /** @type {[typeof __VLS_components.ElCol, typeof __VLS_components.elCol, typeof __VLS_components.ElCol, typeof __VLS_components.elCol, ]} */ ;
        // @ts-ignore
        const __VLS_1116 = __VLS_asFunctionalComponent(__VLS_1115, new __VLS_1115({
            span: (24),
        }));
        const __VLS_1117 = __VLS_1116({
            span: (24),
        }, ...__VLS_functionalComponentArgsRest(__VLS_1116));
        __VLS_1118.slots.default;
        const __VLS_1119 = {}.ElCard;
        /** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
        // @ts-ignore
        const __VLS_1120 = __VLS_asFunctionalComponent(__VLS_1119, new __VLS_1119({
            id: (__VLS_ctx.sectionIdMap.adminMenuDetail),
        }));
        const __VLS_1121 = __VLS_1120({
            id: (__VLS_ctx.sectionIdMap.adminMenuDetail),
        }, ...__VLS_functionalComponentArgsRest(__VLS_1120));
        __VLS_1122.slots.default;
        {
            const { header: __VLS_thisSlot } = __VLS_1122.slots;
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "section-head" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
            __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
        }
        const __VLS_1123 = {}.ElSpace;
        /** @type {[typeof __VLS_components.ElSpace, typeof __VLS_components.elSpace, typeof __VLS_components.ElSpace, typeof __VLS_components.elSpace, ]} */ ;
        // @ts-ignore
        const __VLS_1124 = __VLS_asFunctionalComponent(__VLS_1123, new __VLS_1123({
            wrap: true,
            ...{ class: "query-row" },
        }));
        const __VLS_1125 = __VLS_1124({
            wrap: true,
            ...{ class: "query-row" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_1124));
        __VLS_1126.slots.default;
        const __VLS_1127 = {}.ElInput;
        /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
        // @ts-ignore
        const __VLS_1128 = __VLS_asFunctionalComponent(__VLS_1127, new __VLS_1127({
            modelValue: (__VLS_ctx.menuKeyword),
            placeholder: "按菜单ID/菜单名称查询",
            ...{ class: "query-input-short" },
        }));
        const __VLS_1129 = __VLS_1128({
            modelValue: (__VLS_ctx.menuKeyword),
            placeholder: "按菜单ID/菜单名称查询",
            ...{ class: "query-input-short" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_1128));
        const __VLS_1131 = {}.ElInputNumber;
        /** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
        // @ts-ignore
        const __VLS_1132 = __VLS_asFunctionalComponent(__VLS_1131, new __VLS_1131({
            modelValue: (__VLS_ctx.adminMenuMerchantId),
            min: (1),
            step: (1),
            placeholder: "商家ID（可选）",
        }));
        const __VLS_1133 = __VLS_1132({
            modelValue: (__VLS_ctx.adminMenuMerchantId),
            min: (1),
            step: (1),
            placeholder: "商家ID（可选）",
        }, ...__VLS_functionalComponentArgsRest(__VLS_1132));
        const __VLS_1135 = {}.ElSelect;
        /** @type {[typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, ]} */ ;
        // @ts-ignore
        const __VLS_1136 = __VLS_asFunctionalComponent(__VLS_1135, new __VLS_1135({
            modelValue: (__VLS_ctx.adminMenuStatus),
            clearable: true,
            placeholder: "状态",
            ...{ class: "query-input-short" },
        }));
        const __VLS_1137 = __VLS_1136({
            modelValue: (__VLS_ctx.adminMenuStatus),
            clearable: true,
            placeholder: "状态",
            ...{ class: "query-input-short" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_1136));
        __VLS_1138.slots.default;
        const __VLS_1139 = {}.ElOption;
        /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
        // @ts-ignore
        const __VLS_1140 = __VLS_asFunctionalComponent(__VLS_1139, new __VLS_1139({
            value: (1),
            label: "生效",
        }));
        const __VLS_1141 = __VLS_1140({
            value: (1),
            label: "生效",
        }, ...__VLS_functionalComponentArgsRest(__VLS_1140));
        const __VLS_1143 = {}.ElOption;
        /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
        // @ts-ignore
        const __VLS_1144 = __VLS_asFunctionalComponent(__VLS_1143, new __VLS_1143({
            value: (0),
            label: "失效",
        }));
        const __VLS_1145 = __VLS_1144({
            value: (0),
            label: "失效",
        }, ...__VLS_functionalComponentArgsRest(__VLS_1144));
        var __VLS_1138;
        const __VLS_1147 = {}.ElDatePicker;
        /** @type {[typeof __VLS_components.ElDatePicker, typeof __VLS_components.elDatePicker, ]} */ ;
        // @ts-ignore
        const __VLS_1148 = __VLS_asFunctionalComponent(__VLS_1147, new __VLS_1147({
            modelValue: (__VLS_ctx.adminMenuSaleDate),
            type: "date",
            valueFormat: "YYYY-MM-DD",
            placeholder: "售卖日期",
        }));
        const __VLS_1149 = __VLS_1148({
            modelValue: (__VLS_ctx.adminMenuSaleDate),
            type: "date",
            valueFormat: "YYYY-MM-DD",
            placeholder: "售卖日期",
        }, ...__VLS_functionalComponentArgsRest(__VLS_1148));
        const __VLS_1151 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        const __VLS_1152 = __VLS_asFunctionalComponent(__VLS_1151, new __VLS_1151({
            ...{ 'onClick': {} },
        }));
        const __VLS_1153 = __VLS_1152({
            ...{ 'onClick': {} },
        }, ...__VLS_functionalComponentArgsRest(__VLS_1152));
        let __VLS_1155;
        let __VLS_1156;
        let __VLS_1157;
        const __VLS_1158 = {
            onClick: (__VLS_ctx.resetAdminMenuFilters)
        };
        __VLS_1154.slots.default;
        var __VLS_1154;
        const __VLS_1159 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        const __VLS_1160 = __VLS_asFunctionalComponent(__VLS_1159, new __VLS_1159({
            ...{ 'onClick': {} },
            type: "primary",
            loading: (__VLS_ctx.adminMenuPageLoading),
        }));
        const __VLS_1161 = __VLS_1160({
            ...{ 'onClick': {} },
            type: "primary",
            loading: (__VLS_ctx.adminMenuPageLoading),
        }, ...__VLS_functionalComponentArgsRest(__VLS_1160));
        let __VLS_1163;
        let __VLS_1164;
        let __VLS_1165;
        const __VLS_1166 = {
            onClick: (__VLS_ctx.loadAll)
        };
        __VLS_1162.slots.default;
        var __VLS_1162;
        var __VLS_1126;
        if (__VLS_ctx.filteredAdminMenus.length === 0) {
            const __VLS_1167 = {}.ElEmpty;
            /** @type {[typeof __VLS_components.ElEmpty, typeof __VLS_components.elEmpty, ]} */ ;
            // @ts-ignore
            const __VLS_1168 = __VLS_asFunctionalComponent(__VLS_1167, new __VLS_1167({
                description: "当前无可查询菜单",
            }));
            const __VLS_1169 = __VLS_1168({
                description: "当前无可查询菜单",
            }, ...__VLS_functionalComponentArgsRest(__VLS_1168));
        }
        else {
            const __VLS_1171 = {}.ElSpace;
            /** @type {[typeof __VLS_components.ElSpace, typeof __VLS_components.elSpace, typeof __VLS_components.ElSpace, typeof __VLS_components.elSpace, ]} */ ;
            // @ts-ignore
            const __VLS_1172 = __VLS_asFunctionalComponent(__VLS_1171, new __VLS_1171({
                wrap: true,
                ...{ class: "query-row" },
            }));
            const __VLS_1173 = __VLS_1172({
                wrap: true,
                ...{ class: "query-row" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_1172));
            __VLS_1174.slots.default;
            const __VLS_1175 = {}.ElButton;
            /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
            // @ts-ignore
            const __VLS_1176 = __VLS_asFunctionalComponent(__VLS_1175, new __VLS_1175({
                ...{ 'onClick': {} },
                type: "success",
                plain: true,
                disabled: (__VLS_ctx.adminMenuSelectedIds.length === 0),
                loading: (__VLS_ctx.adminMenuBatchLoading),
            }));
            const __VLS_1177 = __VLS_1176({
                ...{ 'onClick': {} },
                type: "success",
                plain: true,
                disabled: (__VLS_ctx.adminMenuSelectedIds.length === 0),
                loading: (__VLS_ctx.adminMenuBatchLoading),
            }, ...__VLS_functionalComponentArgsRest(__VLS_1176));
            let __VLS_1179;
            let __VLS_1180;
            let __VLS_1181;
            const __VLS_1182 = {
                onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.isUser && __VLS_ctx.activeSection === __VLS_ctx.sectionIdMap.userOrders))
                        return;
                    if (!!(__VLS_ctx.isMerchant))
                        return;
                    if (!(__VLS_ctx.activeSection === __VLS_ctx.sectionIdMap.adminMenuDetail))
                        return;
                    if (!!(__VLS_ctx.filteredAdminMenus.length === 0))
                        return;
                    __VLS_ctx.batchUpdateAdminMenuStatus(1);
                }
            };
            __VLS_1178.slots.default;
            var __VLS_1178;
            const __VLS_1183 = {}.ElButton;
            /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
            // @ts-ignore
            const __VLS_1184 = __VLS_asFunctionalComponent(__VLS_1183, new __VLS_1183({
                ...{ 'onClick': {} },
                type: "warning",
                plain: true,
                disabled: (__VLS_ctx.adminMenuSelectedIds.length === 0),
                loading: (__VLS_ctx.adminMenuBatchLoading),
            }));
            const __VLS_1185 = __VLS_1184({
                ...{ 'onClick': {} },
                type: "warning",
                plain: true,
                disabled: (__VLS_ctx.adminMenuSelectedIds.length === 0),
                loading: (__VLS_ctx.adminMenuBatchLoading),
            }, ...__VLS_functionalComponentArgsRest(__VLS_1184));
            let __VLS_1187;
            let __VLS_1188;
            let __VLS_1189;
            const __VLS_1190 = {
                onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.isUser && __VLS_ctx.activeSection === __VLS_ctx.sectionIdMap.userOrders))
                        return;
                    if (!!(__VLS_ctx.isMerchant))
                        return;
                    if (!(__VLS_ctx.activeSection === __VLS_ctx.sectionIdMap.adminMenuDetail))
                        return;
                    if (!!(__VLS_ctx.filteredAdminMenus.length === 0))
                        return;
                    __VLS_ctx.batchUpdateAdminMenuStatus(0);
                }
            };
            __VLS_1186.slots.default;
            var __VLS_1186;
            const __VLS_1191 = {}.ElButton;
            /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
            // @ts-ignore
            const __VLS_1192 = __VLS_asFunctionalComponent(__VLS_1191, new __VLS_1191({
                ...{ 'onClick': {} },
                type: "danger",
                plain: true,
                disabled: (__VLS_ctx.adminMenuSelectedIds.length === 0),
                loading: (__VLS_ctx.adminMenuBatchLoading),
            }));
            const __VLS_1193 = __VLS_1192({
                ...{ 'onClick': {} },
                type: "danger",
                plain: true,
                disabled: (__VLS_ctx.adminMenuSelectedIds.length === 0),
                loading: (__VLS_ctx.adminMenuBatchLoading),
            }, ...__VLS_functionalComponentArgsRest(__VLS_1192));
            let __VLS_1195;
            let __VLS_1196;
            let __VLS_1197;
            const __VLS_1198 = {
                onClick: (__VLS_ctx.batchDeleteAdminMenus)
            };
            __VLS_1194.slots.default;
            var __VLS_1194;
            __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({
                ...{ style: {} },
            });
            (__VLS_ctx.adminMenuSelectedIds.length);
            var __VLS_1174;
            const __VLS_1199 = {}.ElTable;
            /** @type {[typeof __VLS_components.ElTable, typeof __VLS_components.elTable, typeof __VLS_components.ElTable, typeof __VLS_components.elTable, ]} */ ;
            // @ts-ignore
            const __VLS_1200 = __VLS_asFunctionalComponent(__VLS_1199, new __VLS_1199({
                ...{ 'onSelectionChange': {} },
                data: (__VLS_ctx.filteredAdminMenus),
                size: "small",
            }));
            const __VLS_1201 = __VLS_1200({
                ...{ 'onSelectionChange': {} },
                data: (__VLS_ctx.filteredAdminMenus),
                size: "small",
            }, ...__VLS_functionalComponentArgsRest(__VLS_1200));
            let __VLS_1203;
            let __VLS_1204;
            let __VLS_1205;
            const __VLS_1206 = {
                onSelectionChange: (__VLS_ctx.onAdminMenuSelectionChange)
            };
            __VLS_1202.slots.default;
            const __VLS_1207 = {}.ElTableColumn;
            /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
            // @ts-ignore
            const __VLS_1208 = __VLS_asFunctionalComponent(__VLS_1207, new __VLS_1207({
                type: "selection",
                width: "48",
            }));
            const __VLS_1209 = __VLS_1208({
                type: "selection",
                width: "48",
            }, ...__VLS_functionalComponentArgsRest(__VLS_1208));
            const __VLS_1211 = {}.ElTableColumn;
            /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
            // @ts-ignore
            const __VLS_1212 = __VLS_asFunctionalComponent(__VLS_1211, new __VLS_1211({
                prop: "id",
                label: "菜单ID",
                width: "100",
            }));
            const __VLS_1213 = __VLS_1212({
                prop: "id",
                label: "菜单ID",
                width: "100",
            }, ...__VLS_functionalComponentArgsRest(__VLS_1212));
            const __VLS_1215 = {}.ElTableColumn;
            /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
            // @ts-ignore
            const __VLS_1216 = __VLS_asFunctionalComponent(__VLS_1215, new __VLS_1215({
                prop: "name",
                label: "菜单名称",
                minWidth: "150",
            }));
            const __VLS_1217 = __VLS_1216({
                prop: "name",
                label: "菜单名称",
                minWidth: "150",
            }, ...__VLS_functionalComponentArgsRest(__VLS_1216));
            const __VLS_1219 = {}.ElTableColumn;
            /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
            // @ts-ignore
            const __VLS_1220 = __VLS_asFunctionalComponent(__VLS_1219, new __VLS_1219({
                prop: "saleDate",
                label: "日期",
                width: "120",
            }));
            const __VLS_1221 = __VLS_1220({
                prop: "saleDate",
                label: "日期",
                width: "120",
            }, ...__VLS_functionalComponentArgsRest(__VLS_1220));
            const __VLS_1223 = {}.ElTableColumn;
            /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
            // @ts-ignore
            const __VLS_1224 = __VLS_asFunctionalComponent(__VLS_1223, new __VLS_1223({
                prop: "startTime",
                label: "开始",
                width: "110",
            }));
            const __VLS_1225 = __VLS_1224({
                prop: "startTime",
                label: "开始",
                width: "110",
            }, ...__VLS_functionalComponentArgsRest(__VLS_1224));
            const __VLS_1227 = {}.ElTableColumn;
            /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
            // @ts-ignore
            const __VLS_1228 = __VLS_asFunctionalComponent(__VLS_1227, new __VLS_1227({
                prop: "endTime",
                label: "结束",
                width: "110",
            }));
            const __VLS_1229 = __VLS_1228({
                prop: "endTime",
                label: "结束",
                width: "110",
            }, ...__VLS_functionalComponentArgsRest(__VLS_1228));
            const __VLS_1231 = {}.ElTableColumn;
            /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
            // @ts-ignore
            const __VLS_1232 = __VLS_asFunctionalComponent(__VLS_1231, new __VLS_1231({
                prop: "status",
                label: "状态",
                width: "90",
            }));
            const __VLS_1233 = __VLS_1232({
                prop: "status",
                label: "状态",
                width: "90",
            }, ...__VLS_functionalComponentArgsRest(__VLS_1232));
            __VLS_1234.slots.default;
            {
                const { default: __VLS_thisSlot } = __VLS_1234.slots;
                const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
                (row.status === 1 ? "生效" : "失效");
            }
            var __VLS_1234;
            const __VLS_1235 = {}.ElTableColumn;
            /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
            // @ts-ignore
            const __VLS_1236 = __VLS_asFunctionalComponent(__VLS_1235, new __VLS_1235({
                label: "操作",
                minWidth: "320",
            }));
            const __VLS_1237 = __VLS_1236({
                label: "操作",
                minWidth: "320",
            }, ...__VLS_functionalComponentArgsRest(__VLS_1236));
            __VLS_1238.slots.default;
            {
                const { default: __VLS_thisSlot } = __VLS_1238.slots;
                const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
                const __VLS_1239 = {}.ElSpace;
                /** @type {[typeof __VLS_components.ElSpace, typeof __VLS_components.elSpace, typeof __VLS_components.ElSpace, typeof __VLS_components.elSpace, ]} */ ;
                // @ts-ignore
                const __VLS_1240 = __VLS_asFunctionalComponent(__VLS_1239, new __VLS_1239({
                    wrap: true,
                }));
                const __VLS_1241 = __VLS_1240({
                    wrap: true,
                }, ...__VLS_functionalComponentArgsRest(__VLS_1240));
                __VLS_1242.slots.default;
                const __VLS_1243 = {}.ElButton;
                /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
                // @ts-ignore
                const __VLS_1244 = __VLS_asFunctionalComponent(__VLS_1243, new __VLS_1243({
                    ...{ 'onClick': {} },
                    link: true,
                    type: "primary",
                    loading: (__VLS_ctx.adminMenuLoading),
                }));
                const __VLS_1245 = __VLS_1244({
                    ...{ 'onClick': {} },
                    link: true,
                    type: "primary",
                    loading: (__VLS_ctx.adminMenuLoading),
                }, ...__VLS_functionalComponentArgsRest(__VLS_1244));
                let __VLS_1247;
                let __VLS_1248;
                let __VLS_1249;
                const __VLS_1250 = {
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
                __VLS_1246.slots.default;
                var __VLS_1246;
                const __VLS_1251 = {}.ElButton;
                /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
                // @ts-ignore
                const __VLS_1252 = __VLS_asFunctionalComponent(__VLS_1251, new __VLS_1251({
                    ...{ 'onClick': {} },
                    link: true,
                    type: "warning",
                }));
                const __VLS_1253 = __VLS_1252({
                    ...{ 'onClick': {} },
                    link: true,
                    type: "warning",
                }, ...__VLS_functionalComponentArgsRest(__VLS_1252));
                let __VLS_1255;
                let __VLS_1256;
                let __VLS_1257;
                const __VLS_1258 = {
                    onClick: (...[$event]) => {
                        if (!!(__VLS_ctx.isUser && __VLS_ctx.activeSection === __VLS_ctx.sectionIdMap.userOrders))
                            return;
                        if (!!(__VLS_ctx.isMerchant))
                            return;
                        if (!(__VLS_ctx.activeSection === __VLS_ctx.sectionIdMap.adminMenuDetail))
                            return;
                        if (!!(__VLS_ctx.filteredAdminMenus.length === 0))
                            return;
                        __VLS_ctx.openAdminMenuEdit(row);
                    }
                };
                __VLS_1254.slots.default;
                var __VLS_1254;
                const __VLS_1259 = {}.ElButton;
                /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
                // @ts-ignore
                const __VLS_1260 = __VLS_asFunctionalComponent(__VLS_1259, new __VLS_1259({
                    ...{ 'onClick': {} },
                    link: true,
                    type: (row.status === 1 ? 'danger' : 'success'),
                }));
                const __VLS_1261 = __VLS_1260({
                    ...{ 'onClick': {} },
                    link: true,
                    type: (row.status === 1 ? 'danger' : 'success'),
                }, ...__VLS_functionalComponentArgsRest(__VLS_1260));
                let __VLS_1263;
                let __VLS_1264;
                let __VLS_1265;
                const __VLS_1266 = {
                    onClick: (...[$event]) => {
                        if (!!(__VLS_ctx.isUser && __VLS_ctx.activeSection === __VLS_ctx.sectionIdMap.userOrders))
                            return;
                        if (!!(__VLS_ctx.isMerchant))
                            return;
                        if (!(__VLS_ctx.activeSection === __VLS_ctx.sectionIdMap.adminMenuDetail))
                            return;
                        if (!!(__VLS_ctx.filteredAdminMenus.length === 0))
                            return;
                        __VLS_ctx.toggleAdminMenuStatus(row);
                    }
                };
                __VLS_1262.slots.default;
                (row.status === 1 ? "停用" : "启用");
                var __VLS_1262;
                const __VLS_1267 = {}.ElButton;
                /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
                // @ts-ignore
                const __VLS_1268 = __VLS_asFunctionalComponent(__VLS_1267, new __VLS_1267({
                    ...{ 'onClick': {} },
                    link: true,
                    type: "danger",
                }));
                const __VLS_1269 = __VLS_1268({
                    ...{ 'onClick': {} },
                    link: true,
                    type: "danger",
                }, ...__VLS_functionalComponentArgsRest(__VLS_1268));
                let __VLS_1271;
                let __VLS_1272;
                let __VLS_1273;
                const __VLS_1274 = {
                    onClick: (...[$event]) => {
                        if (!!(__VLS_ctx.isUser && __VLS_ctx.activeSection === __VLS_ctx.sectionIdMap.userOrders))
                            return;
                        if (!!(__VLS_ctx.isMerchant))
                            return;
                        if (!(__VLS_ctx.activeSection === __VLS_ctx.sectionIdMap.adminMenuDetail))
                            return;
                        if (!!(__VLS_ctx.filteredAdminMenus.length === 0))
                            return;
                        __VLS_ctx.deleteAdminMenu(row);
                    }
                };
                __VLS_1270.slots.default;
                var __VLS_1270;
                var __VLS_1242;
            }
            var __VLS_1238;
            var __VLS_1202;
        }
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "pagination-wrap" },
        });
        const __VLS_1275 = {}.ElPagination;
        /** @type {[typeof __VLS_components.ElPagination, typeof __VLS_components.elPagination, ]} */ ;
        // @ts-ignore
        const __VLS_1276 = __VLS_asFunctionalComponent(__VLS_1275, new __VLS_1275({
            ...{ 'onCurrentChange': {} },
            ...{ 'onSizeChange': {} },
            background: true,
            layout: "total, sizes, prev, pager, next",
            total: (__VLS_ctx.adminMenuTotal),
            currentPage: (__VLS_ctx.adminMenuPage),
            pageSize: (__VLS_ctx.adminMenuSize),
            pageSizes: ([5, 10, 20, 50]),
        }));
        const __VLS_1277 = __VLS_1276({
            ...{ 'onCurrentChange': {} },
            ...{ 'onSizeChange': {} },
            background: true,
            layout: "total, sizes, prev, pager, next",
            total: (__VLS_ctx.adminMenuTotal),
            currentPage: (__VLS_ctx.adminMenuPage),
            pageSize: (__VLS_ctx.adminMenuSize),
            pageSizes: ([5, 10, 20, 50]),
        }, ...__VLS_functionalComponentArgsRest(__VLS_1276));
        let __VLS_1279;
        let __VLS_1280;
        let __VLS_1281;
        const __VLS_1282 = {
            onCurrentChange: (__VLS_ctx.onAdminMenuPageChange)
        };
        const __VLS_1283 = {
            onSizeChange: (__VLS_ctx.onAdminMenuSizeChange)
        };
        var __VLS_1278;
        var __VLS_1122;
        var __VLS_1118;
    }
    if (__VLS_ctx.activeSection === __VLS_ctx.sectionIdMap.adminDishDetail) {
        const __VLS_1284 = {}.ElCol;
        /** @type {[typeof __VLS_components.ElCol, typeof __VLS_components.elCol, typeof __VLS_components.ElCol, typeof __VLS_components.elCol, ]} */ ;
        // @ts-ignore
        const __VLS_1285 = __VLS_asFunctionalComponent(__VLS_1284, new __VLS_1284({
            span: (24),
        }));
        const __VLS_1286 = __VLS_1285({
            span: (24),
        }, ...__VLS_functionalComponentArgsRest(__VLS_1285));
        __VLS_1287.slots.default;
        const __VLS_1288 = {}.ElCard;
        /** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
        // @ts-ignore
        const __VLS_1289 = __VLS_asFunctionalComponent(__VLS_1288, new __VLS_1288({
            id: (__VLS_ctx.sectionIdMap.adminDishDetail),
        }));
        const __VLS_1290 = __VLS_1289({
            id: (__VLS_ctx.sectionIdMap.adminDishDetail),
        }, ...__VLS_functionalComponentArgsRest(__VLS_1289));
        __VLS_1291.slots.default;
        {
            const { header: __VLS_thisSlot } = __VLS_1291.slots;
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "section-head" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
            __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
        }
        const __VLS_1292 = {}.ElSpace;
        /** @type {[typeof __VLS_components.ElSpace, typeof __VLS_components.elSpace, typeof __VLS_components.ElSpace, typeof __VLS_components.elSpace, ]} */ ;
        // @ts-ignore
        const __VLS_1293 = __VLS_asFunctionalComponent(__VLS_1292, new __VLS_1292({
            wrap: true,
            ...{ class: "query-row" },
        }));
        const __VLS_1294 = __VLS_1293({
            wrap: true,
            ...{ class: "query-row" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_1293));
        __VLS_1295.slots.default;
        const __VLS_1296 = {}.ElInputNumber;
        /** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
        // @ts-ignore
        const __VLS_1297 = __VLS_asFunctionalComponent(__VLS_1296, new __VLS_1296({
            modelValue: (__VLS_ctx.adminDishQueryId),
            min: (1),
            step: (1),
            placeholder: "菜品ID（精确）",
        }));
        const __VLS_1298 = __VLS_1297({
            modelValue: (__VLS_ctx.adminDishQueryId),
            min: (1),
            step: (1),
            placeholder: "菜品ID（精确）",
        }, ...__VLS_functionalComponentArgsRest(__VLS_1297));
        const __VLS_1300 = {}.ElInput;
        /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
        // @ts-ignore
        const __VLS_1301 = __VLS_asFunctionalComponent(__VLS_1300, new __VLS_1300({
            modelValue: (__VLS_ctx.adminDishNameKeyword),
            placeholder: "菜品名称关键字",
            ...{ class: "query-input-short" },
        }));
        const __VLS_1302 = __VLS_1301({
            modelValue: (__VLS_ctx.adminDishNameKeyword),
            placeholder: "菜品名称关键字",
            ...{ class: "query-input-short" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_1301));
        const __VLS_1304 = {}.ElInput;
        /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
        // @ts-ignore
        const __VLS_1305 = __VLS_asFunctionalComponent(__VLS_1304, new __VLS_1304({
            modelValue: (__VLS_ctx.adminDishCategoryKeyword),
            placeholder: "分类（如主食）",
            ...{ class: "query-input-short" },
        }));
        const __VLS_1306 = __VLS_1305({
            modelValue: (__VLS_ctx.adminDishCategoryKeyword),
            placeholder: "分类（如主食）",
            ...{ class: "query-input-short" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_1305));
        const __VLS_1308 = {}.ElInputNumber;
        /** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
        // @ts-ignore
        const __VLS_1309 = __VLS_asFunctionalComponent(__VLS_1308, new __VLS_1308({
            modelValue: (__VLS_ctx.adminDishMerchantId),
            min: (1),
            step: (1),
            placeholder: "商家ID",
        }));
        const __VLS_1310 = __VLS_1309({
            modelValue: (__VLS_ctx.adminDishMerchantId),
            min: (1),
            step: (1),
            placeholder: "商家ID",
        }, ...__VLS_functionalComponentArgsRest(__VLS_1309));
        const __VLS_1312 = {}.ElSelect;
        /** @type {[typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, ]} */ ;
        // @ts-ignore
        const __VLS_1313 = __VLS_asFunctionalComponent(__VLS_1312, new __VLS_1312({
            modelValue: (__VLS_ctx.adminDishStatus),
            clearable: true,
            placeholder: "状态",
            ...{ class: "query-input-short" },
        }));
        const __VLS_1314 = __VLS_1313({
            modelValue: (__VLS_ctx.adminDishStatus),
            clearable: true,
            placeholder: "状态",
            ...{ class: "query-input-short" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_1313));
        __VLS_1315.slots.default;
        const __VLS_1316 = {}.ElOption;
        /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
        // @ts-ignore
        const __VLS_1317 = __VLS_asFunctionalComponent(__VLS_1316, new __VLS_1316({
            value: (1),
            label: "上架",
        }));
        const __VLS_1318 = __VLS_1317({
            value: (1),
            label: "上架",
        }, ...__VLS_functionalComponentArgsRest(__VLS_1317));
        const __VLS_1320 = {}.ElOption;
        /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
        // @ts-ignore
        const __VLS_1321 = __VLS_asFunctionalComponent(__VLS_1320, new __VLS_1320({
            value: (0),
            label: "下架",
        }));
        const __VLS_1322 = __VLS_1321({
            value: (0),
            label: "下架",
        }, ...__VLS_functionalComponentArgsRest(__VLS_1321));
        var __VLS_1315;
        const __VLS_1324 = {}.ElInputNumber;
        /** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
        // @ts-ignore
        const __VLS_1325 = __VLS_asFunctionalComponent(__VLS_1324, new __VLS_1324({
            modelValue: (__VLS_ctx.adminDishMinPrice),
            min: (0),
            step: (1),
            placeholder: "最低价",
        }));
        const __VLS_1326 = __VLS_1325({
            modelValue: (__VLS_ctx.adminDishMinPrice),
            min: (0),
            step: (1),
            placeholder: "最低价",
        }, ...__VLS_functionalComponentArgsRest(__VLS_1325));
        const __VLS_1328 = {}.ElInputNumber;
        /** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
        // @ts-ignore
        const __VLS_1329 = __VLS_asFunctionalComponent(__VLS_1328, new __VLS_1328({
            modelValue: (__VLS_ctx.adminDishMaxPrice),
            min: (0),
            step: (1),
            placeholder: "最高价",
        }));
        const __VLS_1330 = __VLS_1329({
            modelValue: (__VLS_ctx.adminDishMaxPrice),
            min: (0),
            step: (1),
            placeholder: "最高价",
        }, ...__VLS_functionalComponentArgsRest(__VLS_1329));
        const __VLS_1332 = {}.ElSelect;
        /** @type {[typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, ]} */ ;
        // @ts-ignore
        const __VLS_1333 = __VLS_asFunctionalComponent(__VLS_1332, new __VLS_1332({
            modelValue: (__VLS_ctx.adminDishSortType),
            placeholder: "排序方式",
            ...{ class: "query-input-short" },
        }));
        const __VLS_1334 = __VLS_1333({
            modelValue: (__VLS_ctx.adminDishSortType),
            placeholder: "排序方式",
            ...{ class: "query-input-short" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_1333));
        __VLS_1335.slots.default;
        const __VLS_1336 = {}.ElOption;
        /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
        // @ts-ignore
        const __VLS_1337 = __VLS_asFunctionalComponent(__VLS_1336, new __VLS_1336({
            label: "创建时间：最新优先",
            value: "createTimeDesc",
        }));
        const __VLS_1338 = __VLS_1337({
            label: "创建时间：最新优先",
            value: "createTimeDesc",
        }, ...__VLS_functionalComponentArgsRest(__VLS_1337));
        const __VLS_1340 = {}.ElOption;
        /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
        // @ts-ignore
        const __VLS_1341 = __VLS_asFunctionalComponent(__VLS_1340, new __VLS_1340({
            label: "创建时间：最早优先",
            value: "createTimeAsc",
        }));
        const __VLS_1342 = __VLS_1341({
            label: "创建时间：最早优先",
            value: "createTimeAsc",
        }, ...__VLS_functionalComponentArgsRest(__VLS_1341));
        const __VLS_1344 = {}.ElOption;
        /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
        // @ts-ignore
        const __VLS_1345 = __VLS_asFunctionalComponent(__VLS_1344, new __VLS_1344({
            label: "价格：从低到高",
            value: "priceAsc",
        }));
        const __VLS_1346 = __VLS_1345({
            label: "价格：从低到高",
            value: "priceAsc",
        }, ...__VLS_functionalComponentArgsRest(__VLS_1345));
        const __VLS_1348 = {}.ElOption;
        /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
        // @ts-ignore
        const __VLS_1349 = __VLS_asFunctionalComponent(__VLS_1348, new __VLS_1348({
            label: "价格：从高到低",
            value: "priceDesc",
        }));
        const __VLS_1350 = __VLS_1349({
            label: "价格：从高到低",
            value: "priceDesc",
        }, ...__VLS_functionalComponentArgsRest(__VLS_1349));
        var __VLS_1335;
        const __VLS_1352 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        const __VLS_1353 = __VLS_asFunctionalComponent(__VLS_1352, new __VLS_1352({
            ...{ 'onClick': {} },
        }));
        const __VLS_1354 = __VLS_1353({
            ...{ 'onClick': {} },
        }, ...__VLS_functionalComponentArgsRest(__VLS_1353));
        let __VLS_1356;
        let __VLS_1357;
        let __VLS_1358;
        const __VLS_1359 = {
            onClick: (__VLS_ctx.resetAdminDishFilters)
        };
        __VLS_1355.slots.default;
        var __VLS_1355;
        const __VLS_1360 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        const __VLS_1361 = __VLS_asFunctionalComponent(__VLS_1360, new __VLS_1360({
            ...{ 'onClick': {} },
            type: "primary",
            loading: (__VLS_ctx.adminDishPageLoading),
        }));
        const __VLS_1362 = __VLS_1361({
            ...{ 'onClick': {} },
            type: "primary",
            loading: (__VLS_ctx.adminDishPageLoading),
        }, ...__VLS_functionalComponentArgsRest(__VLS_1361));
        let __VLS_1364;
        let __VLS_1365;
        let __VLS_1366;
        const __VLS_1367 = {
            onClick: (...[$event]) => {
                if (!!(__VLS_ctx.isUser && __VLS_ctx.activeSection === __VLS_ctx.sectionIdMap.userOrders))
                    return;
                if (!!(__VLS_ctx.isMerchant))
                    return;
                if (!(__VLS_ctx.activeSection === __VLS_ctx.sectionIdMap.adminDishDetail))
                    return;
                __VLS_ctx.loadAdminDishPage(true);
            }
        };
        __VLS_1363.slots.default;
        var __VLS_1363;
        var __VLS_1295;
        const __VLS_1368 = {}.ElTable;
        /** @type {[typeof __VLS_components.ElTable, typeof __VLS_components.elTable, typeof __VLS_components.ElTable, typeof __VLS_components.elTable, ]} */ ;
        // @ts-ignore
        const __VLS_1369 = __VLS_asFunctionalComponent(__VLS_1368, new __VLS_1368({
            data: (__VLS_ctx.sortedAdminDishList),
            size: "small",
        }));
        const __VLS_1370 = __VLS_1369({
            data: (__VLS_ctx.sortedAdminDishList),
            size: "small",
        }, ...__VLS_functionalComponentArgsRest(__VLS_1369));
        __VLS_asFunctionalDirective(__VLS_directives.vLoading)(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.adminDishPageLoading) }, null, null);
        __VLS_1371.slots.default;
        const __VLS_1372 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_1373 = __VLS_asFunctionalComponent(__VLS_1372, new __VLS_1372({
            prop: "id",
            label: "菜品ID",
            width: "90",
        }));
        const __VLS_1374 = __VLS_1373({
            prop: "id",
            label: "菜品ID",
            width: "90",
        }, ...__VLS_functionalComponentArgsRest(__VLS_1373));
        const __VLS_1376 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_1377 = __VLS_asFunctionalComponent(__VLS_1376, new __VLS_1376({
            prop: "merchantId",
            label: "商家ID",
            width: "90",
        }));
        const __VLS_1378 = __VLS_1377({
            prop: "merchantId",
            label: "商家ID",
            width: "90",
        }, ...__VLS_functionalComponentArgsRest(__VLS_1377));
        const __VLS_1380 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_1381 = __VLS_asFunctionalComponent(__VLS_1380, new __VLS_1380({
            prop: "name",
            label: "菜品名称",
            minWidth: "130",
        }));
        const __VLS_1382 = __VLS_1381({
            prop: "name",
            label: "菜品名称",
            minWidth: "130",
        }, ...__VLS_functionalComponentArgsRest(__VLS_1381));
        const __VLS_1384 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_1385 = __VLS_asFunctionalComponent(__VLS_1384, new __VLS_1384({
            prop: "category",
            label: "分类",
            width: "100",
        }));
        const __VLS_1386 = __VLS_1385({
            prop: "category",
            label: "分类",
            width: "100",
        }, ...__VLS_functionalComponentArgsRest(__VLS_1385));
        const __VLS_1388 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_1389 = __VLS_asFunctionalComponent(__VLS_1388, new __VLS_1388({
            prop: "price",
            label: "价格",
            width: "90",
        }));
        const __VLS_1390 = __VLS_1389({
            prop: "price",
            label: "价格",
            width: "90",
        }, ...__VLS_functionalComponentArgsRest(__VLS_1389));
        __VLS_1391.slots.default;
        {
            const { default: __VLS_thisSlot } = __VLS_1391.slots;
            const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
            (row.price);
        }
        var __VLS_1391;
        const __VLS_1392 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_1393 = __VLS_asFunctionalComponent(__VLS_1392, new __VLS_1392({
            prop: "status",
            label: "状态",
            width: "80",
        }));
        const __VLS_1394 = __VLS_1393({
            prop: "status",
            label: "状态",
            width: "80",
        }, ...__VLS_functionalComponentArgsRest(__VLS_1393));
        __VLS_1395.slots.default;
        {
            const { default: __VLS_thisSlot } = __VLS_1395.slots;
            const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
            (row.status === 1 ? "上架" : "下架");
        }
        var __VLS_1395;
        const __VLS_1396 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_1397 = __VLS_asFunctionalComponent(__VLS_1396, new __VLS_1396({
            label: "操作",
            width: "90",
        }));
        const __VLS_1398 = __VLS_1397({
            label: "操作",
            width: "90",
        }, ...__VLS_functionalComponentArgsRest(__VLS_1397));
        __VLS_1399.slots.default;
        {
            const { default: __VLS_thisSlot } = __VLS_1399.slots;
            const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
            const __VLS_1400 = {}.ElButton;
            /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
            // @ts-ignore
            const __VLS_1401 = __VLS_asFunctionalComponent(__VLS_1400, new __VLS_1400({
                ...{ 'onClick': {} },
                link: true,
                type: "primary",
                loading: (__VLS_ctx.adminDishQueryLoading),
            }));
            const __VLS_1402 = __VLS_1401({
                ...{ 'onClick': {} },
                link: true,
                type: "primary",
                loading: (__VLS_ctx.adminDishQueryLoading),
            }, ...__VLS_functionalComponentArgsRest(__VLS_1401));
            let __VLS_1404;
            let __VLS_1405;
            let __VLS_1406;
            const __VLS_1407 = {
                onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.isUser && __VLS_ctx.activeSection === __VLS_ctx.sectionIdMap.userOrders))
                        return;
                    if (!!(__VLS_ctx.isMerchant))
                        return;
                    if (!(__VLS_ctx.activeSection === __VLS_ctx.sectionIdMap.adminDishDetail))
                        return;
                    __VLS_ctx.openAdminDishDetail(row.id);
                }
            };
            __VLS_1403.slots.default;
            var __VLS_1403;
        }
        var __VLS_1399;
        var __VLS_1371;
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "pagination-wrap" },
        });
        const __VLS_1408 = {}.ElPagination;
        /** @type {[typeof __VLS_components.ElPagination, typeof __VLS_components.elPagination, ]} */ ;
        // @ts-ignore
        const __VLS_1409 = __VLS_asFunctionalComponent(__VLS_1408, new __VLS_1408({
            ...{ 'onCurrentChange': {} },
            ...{ 'onSizeChange': {} },
            background: true,
            layout: "total, sizes, prev, pager, next",
            total: (__VLS_ctx.adminDishTotal),
            currentPage: (__VLS_ctx.adminDishPage),
            pageSize: (__VLS_ctx.adminDishSize),
            pageSizes: ([10, 20, 50]),
        }));
        const __VLS_1410 = __VLS_1409({
            ...{ 'onCurrentChange': {} },
            ...{ 'onSizeChange': {} },
            background: true,
            layout: "total, sizes, prev, pager, next",
            total: (__VLS_ctx.adminDishTotal),
            currentPage: (__VLS_ctx.adminDishPage),
            pageSize: (__VLS_ctx.adminDishSize),
            pageSizes: ([10, 20, 50]),
        }, ...__VLS_functionalComponentArgsRest(__VLS_1409));
        let __VLS_1412;
        let __VLS_1413;
        let __VLS_1414;
        const __VLS_1415 = {
            onCurrentChange: (__VLS_ctx.onAdminDishPageChange)
        };
        const __VLS_1416 = {
            onSizeChange: (__VLS_ctx.onAdminDishSizeChange)
        };
        var __VLS_1411;
        if (__VLS_ctx.adminDishDetail) {
            const __VLS_1417 = {}.ElDescriptions;
            /** @type {[typeof __VLS_components.ElDescriptions, typeof __VLS_components.elDescriptions, typeof __VLS_components.ElDescriptions, typeof __VLS_components.elDescriptions, ]} */ ;
            // @ts-ignore
            const __VLS_1418 = __VLS_asFunctionalComponent(__VLS_1417, new __VLS_1417({
                column: (2),
                border: true,
                ...{ class: "search-result" },
            }));
            const __VLS_1419 = __VLS_1418({
                column: (2),
                border: true,
                ...{ class: "search-result" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_1418));
            __VLS_1420.slots.default;
            const __VLS_1421 = {}.ElDescriptionsItem;
            /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
            // @ts-ignore
            const __VLS_1422 = __VLS_asFunctionalComponent(__VLS_1421, new __VLS_1421({
                label: "菜品ID",
            }));
            const __VLS_1423 = __VLS_1422({
                label: "菜品ID",
            }, ...__VLS_functionalComponentArgsRest(__VLS_1422));
            __VLS_1424.slots.default;
            (__VLS_ctx.adminDishDetail.id);
            var __VLS_1424;
            const __VLS_1425 = {}.ElDescriptionsItem;
            /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
            // @ts-ignore
            const __VLS_1426 = __VLS_asFunctionalComponent(__VLS_1425, new __VLS_1425({
                label: "商家ID",
            }));
            const __VLS_1427 = __VLS_1426({
                label: "商家ID",
            }, ...__VLS_functionalComponentArgsRest(__VLS_1426));
            __VLS_1428.slots.default;
            (__VLS_ctx.adminDishDetail.merchantId);
            var __VLS_1428;
            const __VLS_1429 = {}.ElDescriptionsItem;
            /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
            // @ts-ignore
            const __VLS_1430 = __VLS_asFunctionalComponent(__VLS_1429, new __VLS_1429({
                label: "名称",
            }));
            const __VLS_1431 = __VLS_1430({
                label: "名称",
            }, ...__VLS_functionalComponentArgsRest(__VLS_1430));
            __VLS_1432.slots.default;
            (__VLS_ctx.adminDishDetail.name);
            var __VLS_1432;
            const __VLS_1433 = {}.ElDescriptionsItem;
            /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
            // @ts-ignore
            const __VLS_1434 = __VLS_asFunctionalComponent(__VLS_1433, new __VLS_1433({
                label: "分类",
            }));
            const __VLS_1435 = __VLS_1434({
                label: "分类",
            }, ...__VLS_functionalComponentArgsRest(__VLS_1434));
            __VLS_1436.slots.default;
            (__VLS_ctx.adminDishDetail.category || "-");
            var __VLS_1436;
            const __VLS_1437 = {}.ElDescriptionsItem;
            /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
            // @ts-ignore
            const __VLS_1438 = __VLS_asFunctionalComponent(__VLS_1437, new __VLS_1437({
                label: "价格",
            }));
            const __VLS_1439 = __VLS_1438({
                label: "价格",
            }, ...__VLS_functionalComponentArgsRest(__VLS_1438));
            __VLS_1440.slots.default;
            (__VLS_ctx.adminDishDetail.price);
            var __VLS_1440;
            const __VLS_1441 = {}.ElDescriptionsItem;
            /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
            // @ts-ignore
            const __VLS_1442 = __VLS_asFunctionalComponent(__VLS_1441, new __VLS_1441({
                label: "状态",
            }));
            const __VLS_1443 = __VLS_1442({
                label: "状态",
            }, ...__VLS_functionalComponentArgsRest(__VLS_1442));
            __VLS_1444.slots.default;
            (__VLS_ctx.adminDishDetail.status === 1 ? "上架" : "下架");
            var __VLS_1444;
            var __VLS_1420;
        }
        var __VLS_1291;
        var __VLS_1287;
    }
    var __VLS_836;
}
const __VLS_1445 = {}.ElDialog;
/** @type {[typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, ]} */ ;
// @ts-ignore
const __VLS_1446 = __VLS_asFunctionalComponent(__VLS_1445, new __VLS_1445({
    modelValue: (__VLS_ctx.detailVisible),
    title: "订单详情",
    width: "720px",
}));
const __VLS_1447 = __VLS_1446({
    modelValue: (__VLS_ctx.detailVisible),
    title: "订单详情",
    width: "720px",
}, ...__VLS_functionalComponentArgsRest(__VLS_1446));
__VLS_1448.slots.default;
if (__VLS_ctx.detailOrder) {
    const __VLS_1449 = {}.ElDescriptions;
    /** @type {[typeof __VLS_components.ElDescriptions, typeof __VLS_components.elDescriptions, typeof __VLS_components.ElDescriptions, typeof __VLS_components.elDescriptions, ]} */ ;
    // @ts-ignore
    const __VLS_1450 = __VLS_asFunctionalComponent(__VLS_1449, new __VLS_1449({
        column: (2),
        border: true,
    }));
    const __VLS_1451 = __VLS_1450({
        column: (2),
        border: true,
    }, ...__VLS_functionalComponentArgsRest(__VLS_1450));
    __VLS_1452.slots.default;
    const __VLS_1453 = {}.ElDescriptionsItem;
    /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
    // @ts-ignore
    const __VLS_1454 = __VLS_asFunctionalComponent(__VLS_1453, new __VLS_1453({
        label: "订单ID",
    }));
    const __VLS_1455 = __VLS_1454({
        label: "订单ID",
    }, ...__VLS_functionalComponentArgsRest(__VLS_1454));
    __VLS_1456.slots.default;
    (__VLS_ctx.detailOrder.id);
    var __VLS_1456;
    const __VLS_1457 = {}.ElDescriptionsItem;
    /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
    // @ts-ignore
    const __VLS_1458 = __VLS_asFunctionalComponent(__VLS_1457, new __VLS_1457({
        label: "订单号",
    }));
    const __VLS_1459 = __VLS_1458({
        label: "订单号",
    }, ...__VLS_functionalComponentArgsRest(__VLS_1458));
    __VLS_1460.slots.default;
    (__VLS_ctx.detailOrder.orderNo);
    var __VLS_1460;
    const __VLS_1461 = {}.ElDescriptionsItem;
    /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
    // @ts-ignore
    const __VLS_1462 = __VLS_asFunctionalComponent(__VLS_1461, new __VLS_1461({
        label: "窗口ID",
    }));
    const __VLS_1463 = __VLS_1462({
        label: "窗口ID",
    }, ...__VLS_functionalComponentArgsRest(__VLS_1462));
    __VLS_1464.slots.default;
    (__VLS_ctx.detailOrder.windowId);
    var __VLS_1464;
    const __VLS_1465 = {}.ElDescriptionsItem;
    /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
    // @ts-ignore
    const __VLS_1466 = __VLS_asFunctionalComponent(__VLS_1465, new __VLS_1465({
        label: "状态",
    }));
    const __VLS_1467 = __VLS_1466({
        label: "状态",
    }, ...__VLS_functionalComponentArgsRest(__VLS_1466));
    __VLS_1468.slots.default;
    (__VLS_ctx.statusText(__VLS_ctx.detailOrder.status));
    var __VLS_1468;
    const __VLS_1469 = {}.ElDescriptionsItem;
    /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
    // @ts-ignore
    const __VLS_1470 = __VLS_asFunctionalComponent(__VLS_1469, new __VLS_1469({
        label: "取餐码",
    }));
    const __VLS_1471 = __VLS_1470({
        label: "取餐码",
    }, ...__VLS_functionalComponentArgsRest(__VLS_1470));
    __VLS_1472.slots.default;
    (__VLS_ctx.detailOrder.pickupCode);
    var __VLS_1472;
    const __VLS_1473 = {}.ElDescriptionsItem;
    /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
    // @ts-ignore
    const __VLS_1474 = __VLS_asFunctionalComponent(__VLS_1473, new __VLS_1473({
        label: "叫号码",
    }));
    const __VLS_1475 = __VLS_1474({
        label: "叫号码",
    }, ...__VLS_functionalComponentArgsRest(__VLS_1474));
    __VLS_1476.slots.default;
    (__VLS_ctx.detailOrder.pickupNo || "-");
    var __VLS_1476;
    const __VLS_1477 = {}.ElDescriptionsItem;
    /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
    // @ts-ignore
    const __VLS_1478 = __VLS_asFunctionalComponent(__VLS_1477, new __VLS_1477({
        label: "金额",
    }));
    const __VLS_1479 = __VLS_1478({
        label: "金额",
    }, ...__VLS_functionalComponentArgsRest(__VLS_1478));
    __VLS_1480.slots.default;
    (__VLS_ctx.detailOrder.totalAmount);
    var __VLS_1480;
    const __VLS_1481 = {}.ElDescriptionsItem;
    /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
    // @ts-ignore
    const __VLS_1482 = __VLS_asFunctionalComponent(__VLS_1481, new __VLS_1481({
        label: "备注",
    }));
    const __VLS_1483 = __VLS_1482({
        label: "备注",
    }, ...__VLS_functionalComponentArgsRest(__VLS_1482));
    __VLS_1484.slots.default;
    (__VLS_ctx.detailOrder.remark || "-");
    var __VLS_1484;
    var __VLS_1452;
}
const __VLS_1485 = {}.ElDivider;
/** @type {[typeof __VLS_components.ElDivider, typeof __VLS_components.elDivider, ]} */ ;
// @ts-ignore
const __VLS_1486 = __VLS_asFunctionalComponent(__VLS_1485, new __VLS_1485({}));
const __VLS_1487 = __VLS_1486({}, ...__VLS_functionalComponentArgsRest(__VLS_1486));
const __VLS_1489 = {}.ElTable;
/** @type {[typeof __VLS_components.ElTable, typeof __VLS_components.elTable, typeof __VLS_components.ElTable, typeof __VLS_components.elTable, ]} */ ;
// @ts-ignore
const __VLS_1490 = __VLS_asFunctionalComponent(__VLS_1489, new __VLS_1489({
    data: (__VLS_ctx.detailOrder?.items || []),
    size: "small",
}));
const __VLS_1491 = __VLS_1490({
    data: (__VLS_ctx.detailOrder?.items || []),
    size: "small",
}, ...__VLS_functionalComponentArgsRest(__VLS_1490));
__VLS_1492.slots.default;
const __VLS_1493 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_1494 = __VLS_asFunctionalComponent(__VLS_1493, new __VLS_1493({
    prop: "dishName",
    label: "菜品",
    minWidth: "130",
}));
const __VLS_1495 = __VLS_1494({
    prop: "dishName",
    label: "菜品",
    minWidth: "130",
}, ...__VLS_functionalComponentArgsRest(__VLS_1494));
const __VLS_1497 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_1498 = __VLS_asFunctionalComponent(__VLS_1497, new __VLS_1497({
    prop: "quantity",
    label: "数量",
    width: "80",
}));
const __VLS_1499 = __VLS_1498({
    prop: "quantity",
    label: "数量",
    width: "80",
}, ...__VLS_functionalComponentArgsRest(__VLS_1498));
const __VLS_1501 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_1502 = __VLS_asFunctionalComponent(__VLS_1501, new __VLS_1501({
    prop: "unitPrice",
    label: "单价",
    width: "90",
}));
const __VLS_1503 = __VLS_1502({
    prop: "unitPrice",
    label: "单价",
    width: "90",
}, ...__VLS_functionalComponentArgsRest(__VLS_1502));
const __VLS_1505 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_1506 = __VLS_asFunctionalComponent(__VLS_1505, new __VLS_1505({
    prop: "subtotal",
    label: "小计",
    width: "100",
}));
const __VLS_1507 = __VLS_1506({
    prop: "subtotal",
    label: "小计",
    width: "100",
}, ...__VLS_functionalComponentArgsRest(__VLS_1506));
var __VLS_1492;
var __VLS_1448;
const __VLS_1509 = {}.ElDialog;
/** @type {[typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, ]} */ ;
// @ts-ignore
const __VLS_1510 = __VLS_asFunctionalComponent(__VLS_1509, new __VLS_1509({
    modelValue: (__VLS_ctx.menuDishDetailVisible),
    title: "库存详情",
    width: "520px",
}));
const __VLS_1511 = __VLS_1510({
    modelValue: (__VLS_ctx.menuDishDetailVisible),
    title: "库存详情",
    width: "520px",
}, ...__VLS_functionalComponentArgsRest(__VLS_1510));
__VLS_1512.slots.default;
if (__VLS_ctx.menuDishDetail) {
    const __VLS_1513 = {}.ElDescriptions;
    /** @type {[typeof __VLS_components.ElDescriptions, typeof __VLS_components.elDescriptions, typeof __VLS_components.ElDescriptions, typeof __VLS_components.elDescriptions, ]} */ ;
    // @ts-ignore
    const __VLS_1514 = __VLS_asFunctionalComponent(__VLS_1513, new __VLS_1513({
        column: (1),
        border: true,
    }));
    const __VLS_1515 = __VLS_1514({
        column: (1),
        border: true,
    }, ...__VLS_functionalComponentArgsRest(__VLS_1514));
    __VLS_1516.slots.default;
    const __VLS_1517 = {}.ElDescriptionsItem;
    /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
    // @ts-ignore
    const __VLS_1518 = __VLS_asFunctionalComponent(__VLS_1517, new __VLS_1517({
        label: "菜单菜品ID",
    }));
    const __VLS_1519 = __VLS_1518({
        label: "菜单菜品ID",
    }, ...__VLS_functionalComponentArgsRest(__VLS_1518));
    __VLS_1520.slots.default;
    (__VLS_ctx.menuDishDetail.id);
    var __VLS_1520;
    const __VLS_1521 = {}.ElDescriptionsItem;
    /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
    // @ts-ignore
    const __VLS_1522 = __VLS_asFunctionalComponent(__VLS_1521, new __VLS_1521({
        label: "菜品",
    }));
    const __VLS_1523 = __VLS_1522({
        label: "菜品",
    }, ...__VLS_functionalComponentArgsRest(__VLS_1522));
    __VLS_1524.slots.default;
    (__VLS_ctx.menuDishDetail.dishName);
    var __VLS_1524;
    const __VLS_1525 = {}.ElDescriptionsItem;
    /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
    // @ts-ignore
    const __VLS_1526 = __VLS_asFunctionalComponent(__VLS_1525, new __VLS_1525({
        label: "售价",
    }));
    const __VLS_1527 = __VLS_1526({
        label: "售价",
    }, ...__VLS_functionalComponentArgsRest(__VLS_1526));
    __VLS_1528.slots.default;
    (__VLS_ctx.menuDishDetail.salePrice);
    var __VLS_1528;
    const __VLS_1529 = {}.ElDescriptionsItem;
    /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
    // @ts-ignore
    const __VLS_1530 = __VLS_asFunctionalComponent(__VLS_1529, new __VLS_1529({
        label: "库存",
    }));
    const __VLS_1531 = __VLS_1530({
        label: "库存",
    }, ...__VLS_functionalComponentArgsRest(__VLS_1530));
    __VLS_1532.slots.default;
    (__VLS_ctx.menuDishDetail.stock);
    var __VLS_1532;
    const __VLS_1533 = {}.ElDescriptionsItem;
    /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
    // @ts-ignore
    const __VLS_1534 = __VLS_asFunctionalComponent(__VLS_1533, new __VLS_1533({
        label: "已售",
    }));
    const __VLS_1535 = __VLS_1534({
        label: "已售",
    }, ...__VLS_functionalComponentArgsRest(__VLS_1534));
    __VLS_1536.slots.default;
    (__VLS_ctx.menuDishDetail.sold);
    var __VLS_1536;
    const __VLS_1537 = {}.ElDescriptionsItem;
    /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
    // @ts-ignore
    const __VLS_1538 = __VLS_asFunctionalComponent(__VLS_1537, new __VLS_1537({
        label: "状态",
    }));
    const __VLS_1539 = __VLS_1538({
        label: "状态",
    }, ...__VLS_functionalComponentArgsRest(__VLS_1538));
    __VLS_1540.slots.default;
    (__VLS_ctx.menuDishDetail.status === 1 ? "上架" : "下架");
    var __VLS_1540;
    var __VLS_1516;
}
else {
    const __VLS_1541 = {}.ElEmpty;
    /** @type {[typeof __VLS_components.ElEmpty, typeof __VLS_components.elEmpty, ]} */ ;
    // @ts-ignore
    const __VLS_1542 = __VLS_asFunctionalComponent(__VLS_1541, new __VLS_1541({
        description: "暂无详情数据",
    }));
    const __VLS_1543 = __VLS_1542({
        description: "暂无详情数据",
    }, ...__VLS_functionalComponentArgsRest(__VLS_1542));
}
var __VLS_1512;
const __VLS_1545 = {}.ElDialog;
/** @type {[typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, ]} */ ;
// @ts-ignore
const __VLS_1546 = __VLS_asFunctionalComponent(__VLS_1545, new __VLS_1545({
    modelValue: (__VLS_ctx.adminMenuDetailVisible),
    title: "菜单详情",
    width: "760px",
}));
const __VLS_1547 = __VLS_1546({
    modelValue: (__VLS_ctx.adminMenuDetailVisible),
    title: "菜单详情",
    width: "760px",
}, ...__VLS_functionalComponentArgsRest(__VLS_1546));
__VLS_1548.slots.default;
if (__VLS_ctx.adminMenuDetail) {
    const __VLS_1549 = {}.ElDescriptions;
    /** @type {[typeof __VLS_components.ElDescriptions, typeof __VLS_components.elDescriptions, typeof __VLS_components.ElDescriptions, typeof __VLS_components.elDescriptions, ]} */ ;
    // @ts-ignore
    const __VLS_1550 = __VLS_asFunctionalComponent(__VLS_1549, new __VLS_1549({
        column: (2),
        border: true,
    }));
    const __VLS_1551 = __VLS_1550({
        column: (2),
        border: true,
    }, ...__VLS_functionalComponentArgsRest(__VLS_1550));
    __VLS_1552.slots.default;
    const __VLS_1553 = {}.ElDescriptionsItem;
    /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
    // @ts-ignore
    const __VLS_1554 = __VLS_asFunctionalComponent(__VLS_1553, new __VLS_1553({
        label: "菜单ID",
    }));
    const __VLS_1555 = __VLS_1554({
        label: "菜单ID",
    }, ...__VLS_functionalComponentArgsRest(__VLS_1554));
    __VLS_1556.slots.default;
    (__VLS_ctx.adminMenuDetail.id);
    var __VLS_1556;
    const __VLS_1557 = {}.ElDescriptionsItem;
    /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
    // @ts-ignore
    const __VLS_1558 = __VLS_asFunctionalComponent(__VLS_1557, new __VLS_1557({
        label: "菜单名称",
    }));
    const __VLS_1559 = __VLS_1558({
        label: "菜单名称",
    }, ...__VLS_functionalComponentArgsRest(__VLS_1558));
    __VLS_1560.slots.default;
    (__VLS_ctx.adminMenuDetail.name);
    var __VLS_1560;
    const __VLS_1561 = {}.ElDescriptionsItem;
    /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
    // @ts-ignore
    const __VLS_1562 = __VLS_asFunctionalComponent(__VLS_1561, new __VLS_1561({
        label: "日期",
    }));
    const __VLS_1563 = __VLS_1562({
        label: "日期",
    }, ...__VLS_functionalComponentArgsRest(__VLS_1562));
    __VLS_1564.slots.default;
    (__VLS_ctx.adminMenuDetail.saleDate);
    var __VLS_1564;
    const __VLS_1565 = {}.ElDescriptionsItem;
    /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
    // @ts-ignore
    const __VLS_1566 = __VLS_asFunctionalComponent(__VLS_1565, new __VLS_1565({
        label: "状态",
    }));
    const __VLS_1567 = __VLS_1566({
        label: "状态",
    }, ...__VLS_functionalComponentArgsRest(__VLS_1566));
    __VLS_1568.slots.default;
    (__VLS_ctx.adminMenuDetail.status === 1 ? "启用" : "停用");
    var __VLS_1568;
    var __VLS_1552;
}
const __VLS_1569 = {}.ElDivider;
/** @type {[typeof __VLS_components.ElDivider, typeof __VLS_components.elDivider, ]} */ ;
// @ts-ignore
const __VLS_1570 = __VLS_asFunctionalComponent(__VLS_1569, new __VLS_1569({}));
const __VLS_1571 = __VLS_1570({}, ...__VLS_functionalComponentArgsRest(__VLS_1570));
const __VLS_1573 = {}.ElTable;
/** @type {[typeof __VLS_components.ElTable, typeof __VLS_components.elTable, typeof __VLS_components.ElTable, typeof __VLS_components.elTable, ]} */ ;
// @ts-ignore
const __VLS_1574 = __VLS_asFunctionalComponent(__VLS_1573, new __VLS_1573({
    data: (__VLS_ctx.adminMenuDetail?.dishes || []),
    size: "small",
}));
const __VLS_1575 = __VLS_1574({
    data: (__VLS_ctx.adminMenuDetail?.dishes || []),
    size: "small",
}, ...__VLS_functionalComponentArgsRest(__VLS_1574));
__VLS_1576.slots.default;
const __VLS_1577 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_1578 = __VLS_asFunctionalComponent(__VLS_1577, new __VLS_1577({
    prop: "id",
    label: "菜单菜品ID",
    width: "110",
}));
const __VLS_1579 = __VLS_1578({
    prop: "id",
    label: "菜单菜品ID",
    width: "110",
}, ...__VLS_functionalComponentArgsRest(__VLS_1578));
const __VLS_1581 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_1582 = __VLS_asFunctionalComponent(__VLS_1581, new __VLS_1581({
    prop: "dishId",
    label: "菜品ID",
    width: "90",
}));
const __VLS_1583 = __VLS_1582({
    prop: "dishId",
    label: "菜品ID",
    width: "90",
}, ...__VLS_functionalComponentArgsRest(__VLS_1582));
const __VLS_1585 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_1586 = __VLS_asFunctionalComponent(__VLS_1585, new __VLS_1585({
    prop: "dishName",
    label: "菜品",
    minWidth: "130",
}));
const __VLS_1587 = __VLS_1586({
    prop: "dishName",
    label: "菜品",
    minWidth: "130",
}, ...__VLS_functionalComponentArgsRest(__VLS_1586));
const __VLS_1589 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_1590 = __VLS_asFunctionalComponent(__VLS_1589, new __VLS_1589({
    prop: "salePrice",
    label: "售价",
    width: "90",
}));
const __VLS_1591 = __VLS_1590({
    prop: "salePrice",
    label: "售价",
    width: "90",
}, ...__VLS_functionalComponentArgsRest(__VLS_1590));
const __VLS_1593 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_1594 = __VLS_asFunctionalComponent(__VLS_1593, new __VLS_1593({
    prop: "stock",
    label: "库存",
    width: "90",
}));
const __VLS_1595 = __VLS_1594({
    prop: "stock",
    label: "库存",
    width: "90",
}, ...__VLS_functionalComponentArgsRest(__VLS_1594));
const __VLS_1597 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_1598 = __VLS_asFunctionalComponent(__VLS_1597, new __VLS_1597({
    prop: "sold",
    label: "已售",
    width: "90",
}));
const __VLS_1599 = __VLS_1598({
    prop: "sold",
    label: "已售",
    width: "90",
}, ...__VLS_functionalComponentArgsRest(__VLS_1598));
const __VLS_1601 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_1602 = __VLS_asFunctionalComponent(__VLS_1601, new __VLS_1601({
    prop: "status",
    label: "状态",
    width: "90",
}));
const __VLS_1603 = __VLS_1602({
    prop: "status",
    label: "状态",
    width: "90",
}, ...__VLS_functionalComponentArgsRest(__VLS_1602));
__VLS_1604.slots.default;
{
    const { default: __VLS_thisSlot } = __VLS_1604.slots;
    const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
    (row.status === 1 ? "可售" : "停售");
}
var __VLS_1604;
const __VLS_1605 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_1606 = __VLS_asFunctionalComponent(__VLS_1605, new __VLS_1605({
    label: "操作",
    minWidth: "220",
}));
const __VLS_1607 = __VLS_1606({
    label: "操作",
    minWidth: "220",
}, ...__VLS_functionalComponentArgsRest(__VLS_1606));
__VLS_1608.slots.default;
{
    const { default: __VLS_thisSlot } = __VLS_1608.slots;
    const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
    const __VLS_1609 = {}.ElSpace;
    /** @type {[typeof __VLS_components.ElSpace, typeof __VLS_components.elSpace, typeof __VLS_components.ElSpace, typeof __VLS_components.elSpace, ]} */ ;
    // @ts-ignore
    const __VLS_1610 = __VLS_asFunctionalComponent(__VLS_1609, new __VLS_1609({
        wrap: true,
    }));
    const __VLS_1611 = __VLS_1610({
        wrap: true,
    }, ...__VLS_functionalComponentArgsRest(__VLS_1610));
    __VLS_1612.slots.default;
    const __VLS_1613 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_1614 = __VLS_asFunctionalComponent(__VLS_1613, new __VLS_1613({
        ...{ 'onClick': {} },
        size: "small",
    }));
    const __VLS_1615 = __VLS_1614({
        ...{ 'onClick': {} },
        size: "small",
    }, ...__VLS_functionalComponentArgsRest(__VLS_1614));
    let __VLS_1617;
    let __VLS_1618;
    let __VLS_1619;
    const __VLS_1620 = {
        onClick: (...[$event]) => {
            __VLS_ctx.openAdminMenuDishEdit(row);
        }
    };
    __VLS_1616.slots.default;
    var __VLS_1616;
    const __VLS_1621 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_1622 = __VLS_asFunctionalComponent(__VLS_1621, new __VLS_1621({
        ...{ 'onClick': {} },
        size: "small",
        type: "primary",
        plain: true,
    }));
    const __VLS_1623 = __VLS_1622({
        ...{ 'onClick': {} },
        size: "small",
        type: "primary",
        plain: true,
    }, ...__VLS_functionalComponentArgsRest(__VLS_1622));
    let __VLS_1625;
    let __VLS_1626;
    let __VLS_1627;
    const __VLS_1628 = {
        onClick: (...[$event]) => {
            __VLS_ctx.openAdminStockOp(row);
        }
    };
    __VLS_1624.slots.default;
    var __VLS_1624;
    var __VLS_1612;
}
var __VLS_1608;
var __VLS_1576;
var __VLS_1548;
const __VLS_1629 = {}.ElDialog;
/** @type {[typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, ]} */ ;
// @ts-ignore
const __VLS_1630 = __VLS_asFunctionalComponent(__VLS_1629, new __VLS_1629({
    modelValue: (__VLS_ctx.adminMenuEditVisible),
    title: "编辑菜单（管理员）",
    width: "520px",
}));
const __VLS_1631 = __VLS_1630({
    modelValue: (__VLS_ctx.adminMenuEditVisible),
    title: "编辑菜单（管理员）",
    width: "520px",
}, ...__VLS_functionalComponentArgsRest(__VLS_1630));
__VLS_1632.slots.default;
const __VLS_1633 = {}.ElForm;
/** @type {[typeof __VLS_components.ElForm, typeof __VLS_components.elForm, typeof __VLS_components.ElForm, typeof __VLS_components.elForm, ]} */ ;
// @ts-ignore
const __VLS_1634 = __VLS_asFunctionalComponent(__VLS_1633, new __VLS_1633({
    labelWidth: "90px",
}));
const __VLS_1635 = __VLS_1634({
    labelWidth: "90px",
}, ...__VLS_functionalComponentArgsRest(__VLS_1634));
__VLS_1636.slots.default;
const __VLS_1637 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_1638 = __VLS_asFunctionalComponent(__VLS_1637, new __VLS_1637({
    label: "菜单名称",
}));
const __VLS_1639 = __VLS_1638({
    label: "菜单名称",
}, ...__VLS_functionalComponentArgsRest(__VLS_1638));
__VLS_1640.slots.default;
const __VLS_1641 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_1642 = __VLS_asFunctionalComponent(__VLS_1641, new __VLS_1641({
    modelValue: (__VLS_ctx.adminMenuEditForm.name),
}));
const __VLS_1643 = __VLS_1642({
    modelValue: (__VLS_ctx.adminMenuEditForm.name),
}, ...__VLS_functionalComponentArgsRest(__VLS_1642));
var __VLS_1640;
const __VLS_1645 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_1646 = __VLS_asFunctionalComponent(__VLS_1645, new __VLS_1645({
    label: "售卖日期",
}));
const __VLS_1647 = __VLS_1646({
    label: "售卖日期",
}, ...__VLS_functionalComponentArgsRest(__VLS_1646));
__VLS_1648.slots.default;
const __VLS_1649 = {}.ElDatePicker;
/** @type {[typeof __VLS_components.ElDatePicker, typeof __VLS_components.elDatePicker, ]} */ ;
// @ts-ignore
const __VLS_1650 = __VLS_asFunctionalComponent(__VLS_1649, new __VLS_1649({
    modelValue: (__VLS_ctx.adminMenuEditForm.saleDate),
    type: "date",
    valueFormat: "YYYY-MM-DD",
}));
const __VLS_1651 = __VLS_1650({
    modelValue: (__VLS_ctx.adminMenuEditForm.saleDate),
    type: "date",
    valueFormat: "YYYY-MM-DD",
}, ...__VLS_functionalComponentArgsRest(__VLS_1650));
var __VLS_1648;
const __VLS_1653 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_1654 = __VLS_asFunctionalComponent(__VLS_1653, new __VLS_1653({
    label: "开始时间",
}));
const __VLS_1655 = __VLS_1654({
    label: "开始时间",
}, ...__VLS_functionalComponentArgsRest(__VLS_1654));
__VLS_1656.slots.default;
const __VLS_1657 = {}.ElTimePicker;
/** @type {[typeof __VLS_components.ElTimePicker, typeof __VLS_components.elTimePicker, ]} */ ;
// @ts-ignore
const __VLS_1658 = __VLS_asFunctionalComponent(__VLS_1657, new __VLS_1657({
    modelValue: (__VLS_ctx.adminMenuEditForm.startTime),
    valueFormat: "HH:mm:ss",
}));
const __VLS_1659 = __VLS_1658({
    modelValue: (__VLS_ctx.adminMenuEditForm.startTime),
    valueFormat: "HH:mm:ss",
}, ...__VLS_functionalComponentArgsRest(__VLS_1658));
var __VLS_1656;
const __VLS_1661 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_1662 = __VLS_asFunctionalComponent(__VLS_1661, new __VLS_1661({
    label: "结束时间",
}));
const __VLS_1663 = __VLS_1662({
    label: "结束时间",
}, ...__VLS_functionalComponentArgsRest(__VLS_1662));
__VLS_1664.slots.default;
const __VLS_1665 = {}.ElTimePicker;
/** @type {[typeof __VLS_components.ElTimePicker, typeof __VLS_components.elTimePicker, ]} */ ;
// @ts-ignore
const __VLS_1666 = __VLS_asFunctionalComponent(__VLS_1665, new __VLS_1665({
    modelValue: (__VLS_ctx.adminMenuEditForm.endTime),
    valueFormat: "HH:mm:ss",
}));
const __VLS_1667 = __VLS_1666({
    modelValue: (__VLS_ctx.adminMenuEditForm.endTime),
    valueFormat: "HH:mm:ss",
}, ...__VLS_functionalComponentArgsRest(__VLS_1666));
var __VLS_1664;
var __VLS_1636;
{
    const { footer: __VLS_thisSlot } = __VLS_1632.slots;
    const __VLS_1669 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_1670 = __VLS_asFunctionalComponent(__VLS_1669, new __VLS_1669({
        ...{ 'onClick': {} },
    }));
    const __VLS_1671 = __VLS_1670({
        ...{ 'onClick': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_1670));
    let __VLS_1673;
    let __VLS_1674;
    let __VLS_1675;
    const __VLS_1676 = {
        onClick: (...[$event]) => {
            __VLS_ctx.adminMenuEditVisible = false;
        }
    };
    __VLS_1672.slots.default;
    var __VLS_1672;
    const __VLS_1677 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_1678 = __VLS_asFunctionalComponent(__VLS_1677, new __VLS_1677({
        ...{ 'onClick': {} },
        type: "primary",
        loading: (__VLS_ctx.adminMenuEditSaving),
    }));
    const __VLS_1679 = __VLS_1678({
        ...{ 'onClick': {} },
        type: "primary",
        loading: (__VLS_ctx.adminMenuEditSaving),
    }, ...__VLS_functionalComponentArgsRest(__VLS_1678));
    let __VLS_1681;
    let __VLS_1682;
    let __VLS_1683;
    const __VLS_1684 = {
        onClick: (__VLS_ctx.submitAdminMenuEdit)
    };
    __VLS_1680.slots.default;
    var __VLS_1680;
}
var __VLS_1632;
const __VLS_1685 = {}.ElDialog;
/** @type {[typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, ]} */ ;
// @ts-ignore
const __VLS_1686 = __VLS_asFunctionalComponent(__VLS_1685, new __VLS_1685({
    modelValue: (__VLS_ctx.adminMenuDishEditVisible),
    title: "编辑菜单项（管理员）",
    width: "520px",
}));
const __VLS_1687 = __VLS_1686({
    modelValue: (__VLS_ctx.adminMenuDishEditVisible),
    title: "编辑菜单项（管理员）",
    width: "520px",
}, ...__VLS_functionalComponentArgsRest(__VLS_1686));
__VLS_1688.slots.default;
const __VLS_1689 = {}.ElForm;
/** @type {[typeof __VLS_components.ElForm, typeof __VLS_components.elForm, typeof __VLS_components.ElForm, typeof __VLS_components.elForm, ]} */ ;
// @ts-ignore
const __VLS_1690 = __VLS_asFunctionalComponent(__VLS_1689, new __VLS_1689({
    labelWidth: "90px",
}));
const __VLS_1691 = __VLS_1690({
    labelWidth: "90px",
}, ...__VLS_functionalComponentArgsRest(__VLS_1690));
__VLS_1692.slots.default;
const __VLS_1693 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_1694 = __VLS_asFunctionalComponent(__VLS_1693, new __VLS_1693({
    label: "菜单菜品ID",
}));
const __VLS_1695 = __VLS_1694({
    label: "菜单菜品ID",
}, ...__VLS_functionalComponentArgsRest(__VLS_1694));
__VLS_1696.slots.default;
const __VLS_1697 = {}.ElTag;
/** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
// @ts-ignore
const __VLS_1698 = __VLS_asFunctionalComponent(__VLS_1697, new __VLS_1697({}));
const __VLS_1699 = __VLS_1698({}, ...__VLS_functionalComponentArgsRest(__VLS_1698));
__VLS_1700.slots.default;
(__VLS_ctx.adminMenuDishEditForm.menuDishId);
var __VLS_1700;
var __VLS_1696;
const __VLS_1701 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_1702 = __VLS_asFunctionalComponent(__VLS_1701, new __VLS_1701({
    label: "售价",
}));
const __VLS_1703 = __VLS_1702({
    label: "售价",
}, ...__VLS_functionalComponentArgsRest(__VLS_1702));
__VLS_1704.slots.default;
const __VLS_1705 = {}.ElInputNumber;
/** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
// @ts-ignore
const __VLS_1706 = __VLS_asFunctionalComponent(__VLS_1705, new __VLS_1705({
    modelValue: (__VLS_ctx.adminMenuDishEditForm.salePrice),
    min: (0.01),
    step: (0.5),
}));
const __VLS_1707 = __VLS_1706({
    modelValue: (__VLS_ctx.adminMenuDishEditForm.salePrice),
    min: (0.01),
    step: (0.5),
}, ...__VLS_functionalComponentArgsRest(__VLS_1706));
var __VLS_1704;
const __VLS_1709 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_1710 = __VLS_asFunctionalComponent(__VLS_1709, new __VLS_1709({
    label: "状态",
}));
const __VLS_1711 = __VLS_1710({
    label: "状态",
}, ...__VLS_functionalComponentArgsRest(__VLS_1710));
__VLS_1712.slots.default;
const __VLS_1713 = {}.ElSelect;
/** @type {[typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, ]} */ ;
// @ts-ignore
const __VLS_1714 = __VLS_asFunctionalComponent(__VLS_1713, new __VLS_1713({
    modelValue: (__VLS_ctx.adminMenuDishEditForm.status),
    ...{ style: {} },
}));
const __VLS_1715 = __VLS_1714({
    modelValue: (__VLS_ctx.adminMenuDishEditForm.status),
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_1714));
__VLS_1716.slots.default;
const __VLS_1717 = {}.ElOption;
/** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
// @ts-ignore
const __VLS_1718 = __VLS_asFunctionalComponent(__VLS_1717, new __VLS_1717({
    value: (1),
    label: "可售",
}));
const __VLS_1719 = __VLS_1718({
    value: (1),
    label: "可售",
}, ...__VLS_functionalComponentArgsRest(__VLS_1718));
const __VLS_1721 = {}.ElOption;
/** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
// @ts-ignore
const __VLS_1722 = __VLS_asFunctionalComponent(__VLS_1721, new __VLS_1721({
    value: (0),
    label: "停售",
}));
const __VLS_1723 = __VLS_1722({
    value: (0),
    label: "停售",
}, ...__VLS_functionalComponentArgsRest(__VLS_1722));
var __VLS_1716;
var __VLS_1712;
var __VLS_1692;
{
    const { footer: __VLS_thisSlot } = __VLS_1688.slots;
    const __VLS_1725 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_1726 = __VLS_asFunctionalComponent(__VLS_1725, new __VLS_1725({
        ...{ 'onClick': {} },
    }));
    const __VLS_1727 = __VLS_1726({
        ...{ 'onClick': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_1726));
    let __VLS_1729;
    let __VLS_1730;
    let __VLS_1731;
    const __VLS_1732 = {
        onClick: (...[$event]) => {
            __VLS_ctx.adminMenuDishEditVisible = false;
        }
    };
    __VLS_1728.slots.default;
    var __VLS_1728;
    const __VLS_1733 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_1734 = __VLS_asFunctionalComponent(__VLS_1733, new __VLS_1733({
        ...{ 'onClick': {} },
        type: "primary",
        loading: (__VLS_ctx.adminMenuDishEditSaving),
    }));
    const __VLS_1735 = __VLS_1734({
        ...{ 'onClick': {} },
        type: "primary",
        loading: (__VLS_ctx.adminMenuDishEditSaving),
    }, ...__VLS_functionalComponentArgsRest(__VLS_1734));
    let __VLS_1737;
    let __VLS_1738;
    let __VLS_1739;
    const __VLS_1740 = {
        onClick: (__VLS_ctx.submitAdminMenuDishEdit)
    };
    __VLS_1736.slots.default;
    var __VLS_1736;
}
var __VLS_1688;
const __VLS_1741 = {}.ElDialog;
/** @type {[typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, ]} */ ;
// @ts-ignore
const __VLS_1742 = __VLS_asFunctionalComponent(__VLS_1741, new __VLS_1741({
    modelValue: (__VLS_ctx.adminStockOpVisible),
    title: "库存操作（管理员）",
    width: "420px",
}));
const __VLS_1743 = __VLS_1742({
    modelValue: (__VLS_ctx.adminStockOpVisible),
    title: "库存操作（管理员）",
    width: "420px",
}, ...__VLS_functionalComponentArgsRest(__VLS_1742));
__VLS_1744.slots.default;
const __VLS_1745 = {}.ElForm;
/** @type {[typeof __VLS_components.ElForm, typeof __VLS_components.elForm, typeof __VLS_components.ElForm, typeof __VLS_components.elForm, ]} */ ;
// @ts-ignore
const __VLS_1746 = __VLS_asFunctionalComponent(__VLS_1745, new __VLS_1745({
    labelWidth: "90px",
}));
const __VLS_1747 = __VLS_1746({
    labelWidth: "90px",
}, ...__VLS_functionalComponentArgsRest(__VLS_1746));
__VLS_1748.slots.default;
const __VLS_1749 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_1750 = __VLS_asFunctionalComponent(__VLS_1749, new __VLS_1749({
    label: "操作类型",
}));
const __VLS_1751 = __VLS_1750({
    label: "操作类型",
}, ...__VLS_functionalComponentArgsRest(__VLS_1750));
__VLS_1752.slots.default;
const __VLS_1753 = {}.ElTag;
/** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
// @ts-ignore
const __VLS_1754 = __VLS_asFunctionalComponent(__VLS_1753, new __VLS_1753({}));
const __VLS_1755 = __VLS_1754({}, ...__VLS_functionalComponentArgsRest(__VLS_1754));
__VLS_1756.slots.default;
(__VLS_ctx.adminStockOpForm.op);
var __VLS_1756;
var __VLS_1752;
const __VLS_1757 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_1758 = __VLS_asFunctionalComponent(__VLS_1757, new __VLS_1757({
    label: "数值",
}));
const __VLS_1759 = __VLS_1758({
    label: "数值",
}, ...__VLS_functionalComponentArgsRest(__VLS_1758));
__VLS_1760.slots.default;
const __VLS_1761 = {}.ElInputNumber;
/** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
// @ts-ignore
const __VLS_1762 = __VLS_asFunctionalComponent(__VLS_1761, new __VLS_1761({
    modelValue: (__VLS_ctx.adminStockOpForm.value),
    min: (0),
    step: (1),
}));
const __VLS_1763 = __VLS_1762({
    modelValue: (__VLS_ctx.adminStockOpForm.value),
    min: (0),
    step: (1),
}, ...__VLS_functionalComponentArgsRest(__VLS_1762));
var __VLS_1760;
const __VLS_1765 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_1766 = __VLS_asFunctionalComponent(__VLS_1765, new __VLS_1765({
    label: "原因",
}));
const __VLS_1767 = __VLS_1766({
    label: "原因",
}, ...__VLS_functionalComponentArgsRest(__VLS_1766));
__VLS_1768.slots.default;
const __VLS_1769 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_1770 = __VLS_asFunctionalComponent(__VLS_1769, new __VLS_1769({
    modelValue: (__VLS_ctx.adminStockOpForm.reason),
    placeholder: "可选",
}));
const __VLS_1771 = __VLS_1770({
    modelValue: (__VLS_ctx.adminStockOpForm.reason),
    placeholder: "可选",
}, ...__VLS_functionalComponentArgsRest(__VLS_1770));
var __VLS_1768;
var __VLS_1748;
{
    const { footer: __VLS_thisSlot } = __VLS_1744.slots;
    const __VLS_1773 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_1774 = __VLS_asFunctionalComponent(__VLS_1773, new __VLS_1773({
        ...{ 'onClick': {} },
    }));
    const __VLS_1775 = __VLS_1774({
        ...{ 'onClick': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_1774));
    let __VLS_1777;
    let __VLS_1778;
    let __VLS_1779;
    const __VLS_1780 = {
        onClick: (...[$event]) => {
            __VLS_ctx.adminStockOpVisible = false;
        }
    };
    __VLS_1776.slots.default;
    var __VLS_1776;
    const __VLS_1781 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_1782 = __VLS_asFunctionalComponent(__VLS_1781, new __VLS_1781({
        ...{ 'onClick': {} },
        type: "primary",
        loading: (__VLS_ctx.adminStockOpSaving),
    }));
    const __VLS_1783 = __VLS_1782({
        ...{ 'onClick': {} },
        type: "primary",
        loading: (__VLS_ctx.adminStockOpSaving),
    }, ...__VLS_functionalComponentArgsRest(__VLS_1782));
    let __VLS_1785;
    let __VLS_1786;
    let __VLS_1787;
    const __VLS_1788 = {
        onClick: (__VLS_ctx.submitAdminStockOp)
    };
    __VLS_1784.slots.default;
    var __VLS_1784;
}
var __VLS_1744;
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
/** @type {__VLS_StyleScopedClasses['query-row']} */ ;
/** @type {__VLS_StyleScopedClasses['query-input-short']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['section-head']} */ ;
/** @type {__VLS_StyleScopedClasses['query-input']} */ ;
/** @type {__VLS_StyleScopedClasses['query-row']} */ ;
/** @type {__VLS_StyleScopedClasses['query-input-short']} */ ;
/** @type {__VLS_StyleScopedClasses['pagination-wrap']} */ ;
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
/** @type {__VLS_StyleScopedClasses['query-row']} */ ;
/** @type {__VLS_StyleScopedClasses['query-input-short']} */ ;
/** @type {__VLS_StyleScopedClasses['pagination-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['section-head']} */ ;
/** @type {__VLS_StyleScopedClasses['query-input']} */ ;
/** @type {__VLS_StyleScopedClasses['query-row']} */ ;
/** @type {__VLS_StyleScopedClasses['query-input-short']} */ ;
/** @type {__VLS_StyleScopedClasses['query-input-short']} */ ;
/** @type {__VLS_StyleScopedClasses['pagination-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['section-head']} */ ;
/** @type {__VLS_StyleScopedClasses['query-row']} */ ;
/** @type {__VLS_StyleScopedClasses['query-input-short']} */ ;
/** @type {__VLS_StyleScopedClasses['query-input-short']} */ ;
/** @type {__VLS_StyleScopedClasses['query-row']} */ ;
/** @type {__VLS_StyleScopedClasses['pagination-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['section-head']} */ ;
/** @type {__VLS_StyleScopedClasses['query-row']} */ ;
/** @type {__VLS_StyleScopedClasses['query-input-short']} */ ;
/** @type {__VLS_StyleScopedClasses['query-input-short']} */ ;
/** @type {__VLS_StyleScopedClasses['query-input-short']} */ ;
/** @type {__VLS_StyleScopedClasses['query-input-short']} */ ;
/** @type {__VLS_StyleScopedClasses['pagination-wrap']} */ ;
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
            adminMenuPageLoading: adminMenuPageLoading,
            adminMenuPage: adminMenuPage,
            adminMenuSize: adminMenuSize,
            adminMenuTotal: adminMenuTotal,
            adminMenuMerchantId: adminMenuMerchantId,
            adminMenuStatus: adminMenuStatus,
            adminMenuSaleDate: adminMenuSaleDate,
            adminMenuEditVisible: adminMenuEditVisible,
            adminMenuEditSaving: adminMenuEditSaving,
            adminMenuEditForm: adminMenuEditForm,
            adminMenuDishEditVisible: adminMenuDishEditVisible,
            adminMenuDishEditSaving: adminMenuDishEditSaving,
            adminMenuDishEditForm: adminMenuDishEditForm,
            adminStockOpVisible: adminStockOpVisible,
            adminStockOpSaving: adminStockOpSaving,
            adminStockOpForm: adminStockOpForm,
            adminMenuSelectedIds: adminMenuSelectedIds,
            adminMenuBatchLoading: adminMenuBatchLoading,
            adminDishQueryId: adminDishQueryId,
            adminDishQueryLoading: adminDishQueryLoading,
            adminDishPageLoading: adminDishPageLoading,
            adminDishDetail: adminDishDetail,
            adminDishPage: adminDishPage,
            adminDishSize: adminDishSize,
            adminDishTotal: adminDishTotal,
            adminDishNameKeyword: adminDishNameKeyword,
            adminDishCategoryKeyword: adminDishCategoryKeyword,
            adminDishMerchantId: adminDishMerchantId,
            adminDishStatus: adminDishStatus,
            adminDishMinPrice: adminDishMinPrice,
            adminDishMaxPrice: adminDishMaxPrice,
            adminDishSortType: adminDishSortType,
            lowStockThreshold: lowStockThreshold,
            userMenuKeyword: userMenuKeyword,
            userOrderKeyword: userOrderKeyword,
            merchantOrderKeyword: merchantOrderKeyword,
            lowStockKeyword: lowStockKeyword,
            dishKeyword: dishKeyword,
            windowKeyword: windowKeyword,
            userKeyword: userKeyword,
            menuKeyword: menuKeyword,
            merchantOrderPage: merchantOrderPage,
            merchantOrderSize: merchantOrderSize,
            merchantOrderTotal: merchantOrderTotal,
            merchantOrderStatus: merchantOrderStatus,
            merchantOrderDateRange: merchantOrderDateRange,
            merchantMinAmount: merchantMinAmount,
            merchantMaxAmount: merchantMaxAmount,
            adminWindowPage: adminWindowPage,
            adminWindowSize: adminWindowSize,
            adminWindowTotal: adminWindowTotal,
            adminWindowStatus: adminWindowStatus,
            adminWindowMerchantId: adminWindowMerchantId,
            userOrderFilter: userOrderFilter,
            userAdvancedStatus: userAdvancedStatus,
            userOrderDateRange: userOrderDateRange,
            userMinAmount: userMinAmount,
            userMaxAmount: userMaxAmount,
            adminUserPage: adminUserPage,
            adminUserSize: adminUserSize,
            adminUserTotal: adminUserTotal,
            adminUserRole: adminUserRole,
            adminUserStatus: adminUserStatus,
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
            sortedAdminDishList: sortedAdminDishList,
            selectedWindowLabel: selectedWindowLabel,
            menuMerchantNameByMenuDishId: menuMerchantNameByMenuDishId,
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
            onAdminWindowPageChange: onAdminWindowPageChange,
            onAdminWindowSizeChange: onAdminWindowSizeChange,
            onAdminMenuPageChange: onAdminMenuPageChange,
            onAdminMenuSizeChange: onAdminMenuSizeChange,
            onAdminDishPageChange: onAdminDishPageChange,
            onAdminDishSizeChange: onAdminDishSizeChange,
            onMerchantOrderPageChange: onMerchantOrderPageChange,
            onMerchantOrderSizeChange: onMerchantOrderSizeChange,
            resetUserOrderFilters: resetUserOrderFilters,
            resetMerchantOrderFilters: resetMerchantOrderFilters,
            resetAdminWindowFilters: resetAdminWindowFilters,
            resetAdminUserFilters: resetAdminUserFilters,
            resetAdminMenuFilters: resetAdminMenuFilters,
            resetAdminDishFilters: resetAdminDishFilters,
            toggleUserStatus: toggleUserStatus,
            removeUser: removeUser,
            resetUserPassword: resetUserPassword,
            toggleWindowStatus: toggleWindowStatus,
            removeWindow: removeWindow,
            openAdminMenuDetail: openAdminMenuDetail,
            openAdminMenuEdit: openAdminMenuEdit,
            submitAdminMenuEdit: submitAdminMenuEdit,
            toggleAdminMenuStatus: toggleAdminMenuStatus,
            deleteAdminMenu: deleteAdminMenu,
            batchUpdateAdminMenuStatus: batchUpdateAdminMenuStatus,
            batchDeleteAdminMenus: batchDeleteAdminMenus,
            onAdminMenuSelectionChange: onAdminMenuSelectionChange,
            openAdminMenuDishEdit: openAdminMenuDishEdit,
            submitAdminMenuDishEdit: submitAdminMenuDishEdit,
            openAdminStockOp: openAdminStockOp,
            submitAdminStockOp: submitAdminStockOp,
            openAdminDishDetail: openAdminDishDetail,
            loadAdminDishPage: loadAdminDishPage,
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
            goMerchantStock: goMerchantStock,
            goAdminStock: goAdminStock,
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
