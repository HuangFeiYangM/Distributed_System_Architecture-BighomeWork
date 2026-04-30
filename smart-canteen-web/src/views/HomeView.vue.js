import { computed, onMounted, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import { useRouter } from "vue-router";
import { getTodayMenusApi, publishMenuApi } from "../api/menu";
import { getMyOrdersApi, createOrderApi, updateOrderStatusApi, getOrderDetailApi, getOrderByPickupCodeApi } from "../api/order";
import { getWindowsApi, getWindowQueueApi, callNextApi, verifyPickupApi, createWindowApi } from "../api/pickup";
import { getUserListApi } from "../api/user";
import { createDishApi, deleteDishApi, getDishListApi, updateDishApi, updateDishStatusApi } from "../api/dish";
import { useAuthStore } from "../stores/auth";
const router = useRouter();
const authStore = useAuthStore();
const loading = ref(false);
const submitting = ref(false);
const windows = ref([]);
const orders = ref([]);
const merchantOrders = ref([]);
const dishes = ref([]);
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
const creatingWindow = ref(false);
const creatingDish = ref(false);
const publishingMenu = ref(false);
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
const flatDishes = computed(() => dishes.value.filter((d) => d.status === 1));
const selectedItems = computed(() => flatDishes.value
    .map((d) => ({ menuDishId: d.id, quantity: quantityMap[d.id] || 0, price: d.salePrice }))
    .filter((x) => x.quantity > 0));
const selectedCount = computed(() => selectedItems.value.reduce((sum, item) => sum + item.quantity, 0));
const totalAmount = computed(() => selectedItems.value.reduce((sum, item) => sum + item.quantity * item.price, 0));
const pickedMenuItems = computed(() => merchantDishes.value
    .filter((d) => menuItemMap[d.id]?.enabled)
    .map((d) => ({
    dishId: d.id,
    salePrice: Number(menuItemMap[d.id]?.salePrice || d.price),
    stock: Number(menuItemMap[d.id]?.stock || 0)
}))
    .filter((x) => x.stock >= 0));
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
            merchantDishes.value.forEach((d) => {
                menuItemMap[d.id] = menuItemMap[d.id] || { enabled: false, salePrice: Number(d.price), stock: 50 };
            });
        }
        else {
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
    loadAll();
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "wrap" },
});
const __VLS_0 = {}.ElCard;
/** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    ...{ class: "top-card" },
}));
const __VLS_2 = __VLS_1({
    ...{ class: "top-card" },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_3.slots.default;
{
    const { header: __VLS_thisSlot } = __VLS_3.slots;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "head" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (__VLS_ctx.roleLabel);
    const __VLS_4 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_5 = __VLS_asFunctionalComponent(__VLS_4, new __VLS_4({
        ...{ 'onClick': {} },
        type: "danger",
        plain: true,
    }));
    const __VLS_6 = __VLS_5({
        ...{ 'onClick': {} },
        type: "danger",
        plain: true,
    }, ...__VLS_functionalComponentArgsRest(__VLS_5));
    let __VLS_8;
    let __VLS_9;
    let __VLS_10;
    const __VLS_11 = {
        onClick: (__VLS_ctx.logout)
    };
    __VLS_7.slots.default;
    var __VLS_7;
}
const __VLS_12 = {}.ElSpace;
/** @type {[typeof __VLS_components.ElSpace, typeof __VLS_components.elSpace, typeof __VLS_components.ElSpace, typeof __VLS_components.elSpace, ]} */ ;
// @ts-ignore
const __VLS_13 = __VLS_asFunctionalComponent(__VLS_12, new __VLS_12({
    wrap: true,
}));
const __VLS_14 = __VLS_13({
    wrap: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_13));
__VLS_15.slots.default;
const __VLS_16 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_17 = __VLS_asFunctionalComponent(__VLS_16, new __VLS_16({
    ...{ 'onClick': {} },
    loading: (__VLS_ctx.loading),
}));
const __VLS_18 = __VLS_17({
    ...{ 'onClick': {} },
    loading: (__VLS_ctx.loading),
}, ...__VLS_functionalComponentArgsRest(__VLS_17));
let __VLS_20;
let __VLS_21;
let __VLS_22;
const __VLS_23 = {
    onClick: (__VLS_ctx.loadAll)
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
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
(__VLS_ctx.roleLabel);
var __VLS_15;
var __VLS_3;
if (__VLS_ctx.isUser) {
    const __VLS_40 = {}.ElRow;
    /** @type {[typeof __VLS_components.ElRow, typeof __VLS_components.elRow, typeof __VLS_components.ElRow, typeof __VLS_components.elRow, ]} */ ;
    // @ts-ignore
    const __VLS_41 = __VLS_asFunctionalComponent(__VLS_40, new __VLS_40({
        gutter: (16),
    }));
    const __VLS_42 = __VLS_41({
        gutter: (16),
    }, ...__VLS_functionalComponentArgsRest(__VLS_41));
    __VLS_43.slots.default;
    const __VLS_44 = {}.ElCol;
    /** @type {[typeof __VLS_components.ElCol, typeof __VLS_components.elCol, typeof __VLS_components.ElCol, typeof __VLS_components.elCol, ]} */ ;
    // @ts-ignore
    const __VLS_45 = __VLS_asFunctionalComponent(__VLS_44, new __VLS_44({
        span: (12),
    }));
    const __VLS_46 = __VLS_45({
        span: (12),
    }, ...__VLS_functionalComponentArgsRest(__VLS_45));
    __VLS_47.slots.default;
    const __VLS_48 = {}.ElCard;
    /** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
    // @ts-ignore
    const __VLS_49 = __VLS_asFunctionalComponent(__VLS_48, new __VLS_48({}));
    const __VLS_50 = __VLS_49({}, ...__VLS_functionalComponentArgsRest(__VLS_49));
    __VLS_51.slots.default;
    {
        const { header: __VLS_thisSlot } = __VLS_51.slots;
    }
    if (__VLS_ctx.flatDishes.length === 0) {
        const __VLS_52 = {}.ElEmpty;
        /** @type {[typeof __VLS_components.ElEmpty, typeof __VLS_components.elEmpty, ]} */ ;
        // @ts-ignore
        const __VLS_53 = __VLS_asFunctionalComponent(__VLS_52, new __VLS_52({
            description: "当前无可用菜单",
        }));
        const __VLS_54 = __VLS_53({
            description: "当前无可用菜单",
        }, ...__VLS_functionalComponentArgsRest(__VLS_53));
    }
    else {
        const __VLS_56 = {}.ElTable;
        /** @type {[typeof __VLS_components.ElTable, typeof __VLS_components.elTable, typeof __VLS_components.ElTable, typeof __VLS_components.elTable, ]} */ ;
        // @ts-ignore
        const __VLS_57 = __VLS_asFunctionalComponent(__VLS_56, new __VLS_56({
            data: (__VLS_ctx.flatDishes),
            size: "small",
        }));
        const __VLS_58 = __VLS_57({
            data: (__VLS_ctx.flatDishes),
            size: "small",
        }, ...__VLS_functionalComponentArgsRest(__VLS_57));
        __VLS_59.slots.default;
        const __VLS_60 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_61 = __VLS_asFunctionalComponent(__VLS_60, new __VLS_60({
            prop: "dishName",
            label: "菜品",
            minWidth: "120",
        }));
        const __VLS_62 = __VLS_61({
            prop: "dishName",
            label: "菜品",
            minWidth: "120",
        }, ...__VLS_functionalComponentArgsRest(__VLS_61));
        const __VLS_64 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_65 = __VLS_asFunctionalComponent(__VLS_64, new __VLS_64({
            prop: "salePrice",
            label: "价格",
            width: "90",
        }));
        const __VLS_66 = __VLS_65({
            prop: "salePrice",
            label: "价格",
            width: "90",
        }, ...__VLS_functionalComponentArgsRest(__VLS_65));
        __VLS_67.slots.default;
        {
            const { default: __VLS_thisSlot } = __VLS_67.slots;
            const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
            (row.salePrice);
        }
        var __VLS_67;
        const __VLS_68 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_69 = __VLS_asFunctionalComponent(__VLS_68, new __VLS_68({
            prop: "stock",
            label: "库存",
            width: "80",
        }));
        const __VLS_70 = __VLS_69({
            prop: "stock",
            label: "库存",
            width: "80",
        }, ...__VLS_functionalComponentArgsRest(__VLS_69));
        const __VLS_72 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_73 = __VLS_asFunctionalComponent(__VLS_72, new __VLS_72({
            label: "数量",
            width: "120",
        }));
        const __VLS_74 = __VLS_73({
            label: "数量",
            width: "120",
        }, ...__VLS_functionalComponentArgsRest(__VLS_73));
        __VLS_75.slots.default;
        {
            const { default: __VLS_thisSlot } = __VLS_75.slots;
            const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
            const __VLS_76 = {}.ElInputNumber;
            /** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
            // @ts-ignore
            const __VLS_77 = __VLS_asFunctionalComponent(__VLS_76, new __VLS_76({
                modelValue: (__VLS_ctx.quantityMap[row.id]),
                min: (0),
                max: (20),
                step: (1),
                size: "small",
            }));
            const __VLS_78 = __VLS_77({
                modelValue: (__VLS_ctx.quantityMap[row.id]),
                min: (0),
                max: (20),
                step: (1),
                size: "small",
            }, ...__VLS_functionalComponentArgsRest(__VLS_77));
        }
        var __VLS_75;
        var __VLS_59;
    }
    var __VLS_51;
    var __VLS_47;
    const __VLS_80 = {}.ElCol;
    /** @type {[typeof __VLS_components.ElCol, typeof __VLS_components.elCol, typeof __VLS_components.ElCol, typeof __VLS_components.elCol, ]} */ ;
    // @ts-ignore
    const __VLS_81 = __VLS_asFunctionalComponent(__VLS_80, new __VLS_80({
        span: (12),
    }));
    const __VLS_82 = __VLS_81({
        span: (12),
    }, ...__VLS_functionalComponentArgsRest(__VLS_81));
    __VLS_83.slots.default;
    const __VLS_84 = {}.ElCard;
    /** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
    // @ts-ignore
    const __VLS_85 = __VLS_asFunctionalComponent(__VLS_84, new __VLS_84({}));
    const __VLS_86 = __VLS_85({}, ...__VLS_functionalComponentArgsRest(__VLS_85));
    __VLS_87.slots.default;
    {
        const { header: __VLS_thisSlot } = __VLS_87.slots;
    }
    const __VLS_88 = {}.ElForm;
    /** @type {[typeof __VLS_components.ElForm, typeof __VLS_components.elForm, typeof __VLS_components.ElForm, typeof __VLS_components.elForm, ]} */ ;
    // @ts-ignore
    const __VLS_89 = __VLS_asFunctionalComponent(__VLS_88, new __VLS_88({
        labelWidth: "90px",
    }));
    const __VLS_90 = __VLS_89({
        labelWidth: "90px",
    }, ...__VLS_functionalComponentArgsRest(__VLS_89));
    __VLS_91.slots.default;
    const __VLS_92 = {}.ElFormItem;
    /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
    // @ts-ignore
    const __VLS_93 = __VLS_asFunctionalComponent(__VLS_92, new __VLS_92({
        label: "取餐窗口",
    }));
    const __VLS_94 = __VLS_93({
        label: "取餐窗口",
    }, ...__VLS_functionalComponentArgsRest(__VLS_93));
    __VLS_95.slots.default;
    const __VLS_96 = {}.ElSelect;
    /** @type {[typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, ]} */ ;
    // @ts-ignore
    const __VLS_97 = __VLS_asFunctionalComponent(__VLS_96, new __VLS_96({
        modelValue: (__VLS_ctx.selectedWindowId),
        placeholder: "请选择窗口",
        ...{ style: {} },
    }));
    const __VLS_98 = __VLS_97({
        modelValue: (__VLS_ctx.selectedWindowId),
        placeholder: "请选择窗口",
        ...{ style: {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_97));
    __VLS_99.slots.default;
    for (const [w] of __VLS_getVForSourceType((__VLS_ctx.windows))) {
        const __VLS_100 = {}.ElOption;
        /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
        // @ts-ignore
        const __VLS_101 = __VLS_asFunctionalComponent(__VLS_100, new __VLS_100({
            key: (w.id),
            label: (`${w.name} (${w.location})`),
            value: (w.id),
        }));
        const __VLS_102 = __VLS_101({
            key: (w.id),
            label: (`${w.name} (${w.location})`),
            value: (w.id),
        }, ...__VLS_functionalComponentArgsRest(__VLS_101));
    }
    var __VLS_99;
    var __VLS_95;
    const __VLS_104 = {}.ElFormItem;
    /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
    // @ts-ignore
    const __VLS_105 = __VLS_asFunctionalComponent(__VLS_104, new __VLS_104({
        label: "备注",
    }));
    const __VLS_106 = __VLS_105({
        label: "备注",
    }, ...__VLS_functionalComponentArgsRest(__VLS_105));
    __VLS_107.slots.default;
    const __VLS_108 = {}.ElInput;
    /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
    // @ts-ignore
    const __VLS_109 = __VLS_asFunctionalComponent(__VLS_108, new __VLS_108({
        modelValue: (__VLS_ctx.remark),
        placeholder: "例如：少辣、不加葱",
    }));
    const __VLS_110 = __VLS_109({
        modelValue: (__VLS_ctx.remark),
        placeholder: "例如：少辣、不加葱",
    }, ...__VLS_functionalComponentArgsRest(__VLS_109));
    var __VLS_107;
    var __VLS_91;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "summary" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
    (__VLS_ctx.selectedCount);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
    (__VLS_ctx.totalAmount.toFixed(2));
    const __VLS_112 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_113 = __VLS_asFunctionalComponent(__VLS_112, new __VLS_112({
        ...{ 'onClick': {} },
        type: "primary",
        loading: (__VLS_ctx.submitting),
    }));
    const __VLS_114 = __VLS_113({
        ...{ 'onClick': {} },
        type: "primary",
        loading: (__VLS_ctx.submitting),
    }, ...__VLS_functionalComponentArgsRest(__VLS_113));
    let __VLS_116;
    let __VLS_117;
    let __VLS_118;
    const __VLS_119 = {
        onClick: (__VLS_ctx.submitOrder)
    };
    __VLS_115.slots.default;
    var __VLS_115;
    var __VLS_87;
    var __VLS_83;
    var __VLS_43;
}
if (__VLS_ctx.isUser) {
    const __VLS_120 = {}.ElCard;
    /** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
    // @ts-ignore
    const __VLS_121 = __VLS_asFunctionalComponent(__VLS_120, new __VLS_120({
        ...{ class: "order-card" },
    }));
    const __VLS_122 = __VLS_121({
        ...{ class: "order-card" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_121));
    __VLS_123.slots.default;
    {
        const { header: __VLS_thisSlot } = __VLS_123.slots;
    }
    const __VLS_124 = {}.ElTable;
    /** @type {[typeof __VLS_components.ElTable, typeof __VLS_components.elTable, typeof __VLS_components.ElTable, typeof __VLS_components.elTable, ]} */ ;
    // @ts-ignore
    const __VLS_125 = __VLS_asFunctionalComponent(__VLS_124, new __VLS_124({
        data: (__VLS_ctx.orders),
        size: "small",
    }));
    const __VLS_126 = __VLS_125({
        data: (__VLS_ctx.orders),
        size: "small",
    }, ...__VLS_functionalComponentArgsRest(__VLS_125));
    __VLS_127.slots.default;
    const __VLS_128 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_129 = __VLS_asFunctionalComponent(__VLS_128, new __VLS_128({
        prop: "id",
        label: "订单ID",
        width: "90",
    }));
    const __VLS_130 = __VLS_129({
        prop: "id",
        label: "订单ID",
        width: "90",
    }, ...__VLS_functionalComponentArgsRest(__VLS_129));
    const __VLS_132 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_133 = __VLS_asFunctionalComponent(__VLS_132, new __VLS_132({
        prop: "orderNo",
        label: "订单号",
        minWidth: "160",
    }));
    const __VLS_134 = __VLS_133({
        prop: "orderNo",
        label: "订单号",
        minWidth: "160",
    }, ...__VLS_functionalComponentArgsRest(__VLS_133));
    const __VLS_136 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_137 = __VLS_asFunctionalComponent(__VLS_136, new __VLS_136({
        prop: "totalAmount",
        label: "金额",
        width: "90",
    }));
    const __VLS_138 = __VLS_137({
        prop: "totalAmount",
        label: "金额",
        width: "90",
    }, ...__VLS_functionalComponentArgsRest(__VLS_137));
    __VLS_139.slots.default;
    {
        const { default: __VLS_thisSlot } = __VLS_139.slots;
        const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
        (row.totalAmount);
    }
    var __VLS_139;
    const __VLS_140 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_141 = __VLS_asFunctionalComponent(__VLS_140, new __VLS_140({
        prop: "status",
        label: "状态",
        width: "110",
    }));
    const __VLS_142 = __VLS_141({
        prop: "status",
        label: "状态",
        width: "110",
    }, ...__VLS_functionalComponentArgsRest(__VLS_141));
    __VLS_143.slots.default;
    {
        const { default: __VLS_thisSlot } = __VLS_143.slots;
        const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
        (__VLS_ctx.statusText(row.status));
    }
    var __VLS_143;
    const __VLS_144 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_145 = __VLS_asFunctionalComponent(__VLS_144, new __VLS_144({
        prop: "pickupCode",
        label: "取餐码",
        width: "110",
    }));
    const __VLS_146 = __VLS_145({
        prop: "pickupCode",
        label: "取餐码",
        width: "110",
    }, ...__VLS_functionalComponentArgsRest(__VLS_145));
    const __VLS_148 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_149 = __VLS_asFunctionalComponent(__VLS_148, new __VLS_148({
        prop: "pickupNo",
        label: "叫号码",
        width: "90",
    }));
    const __VLS_150 = __VLS_149({
        prop: "pickupNo",
        label: "叫号码",
        width: "90",
    }, ...__VLS_functionalComponentArgsRest(__VLS_149));
    const __VLS_152 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_153 = __VLS_asFunctionalComponent(__VLS_152, new __VLS_152({
        prop: "createTime",
        label: "创建时间",
        minWidth: "170",
    }));
    const __VLS_154 = __VLS_153({
        prop: "createTime",
        label: "创建时间",
        minWidth: "170",
    }, ...__VLS_functionalComponentArgsRest(__VLS_153));
    const __VLS_156 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_157 = __VLS_asFunctionalComponent(__VLS_156, new __VLS_156({
        label: "操作",
        width: "100",
    }));
    const __VLS_158 = __VLS_157({
        label: "操作",
        width: "100",
    }, ...__VLS_functionalComponentArgsRest(__VLS_157));
    __VLS_159.slots.default;
    {
        const { default: __VLS_thisSlot } = __VLS_159.slots;
        const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
        const __VLS_160 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        const __VLS_161 = __VLS_asFunctionalComponent(__VLS_160, new __VLS_160({
            ...{ 'onClick': {} },
            link: true,
            type: "primary",
        }));
        const __VLS_162 = __VLS_161({
            ...{ 'onClick': {} },
            link: true,
            type: "primary",
        }, ...__VLS_functionalComponentArgsRest(__VLS_161));
        let __VLS_164;
        let __VLS_165;
        let __VLS_166;
        const __VLS_167 = {
            onClick: (...[$event]) => {
                if (!(__VLS_ctx.isUser))
                    return;
                __VLS_ctx.showOrderDetail(row.id);
            }
        };
        __VLS_163.slots.default;
        var __VLS_163;
    }
    var __VLS_159;
    var __VLS_127;
    var __VLS_123;
}
else if (__VLS_ctx.isMerchant) {
    const __VLS_168 = {}.ElRow;
    /** @type {[typeof __VLS_components.ElRow, typeof __VLS_components.elRow, typeof __VLS_components.ElRow, typeof __VLS_components.elRow, ]} */ ;
    // @ts-ignore
    const __VLS_169 = __VLS_asFunctionalComponent(__VLS_168, new __VLS_168({
        gutter: (16),
    }));
    const __VLS_170 = __VLS_169({
        gutter: (16),
    }, ...__VLS_functionalComponentArgsRest(__VLS_169));
    __VLS_171.slots.default;
    const __VLS_172 = {}.ElCol;
    /** @type {[typeof __VLS_components.ElCol, typeof __VLS_components.elCol, typeof __VLS_components.ElCol, typeof __VLS_components.elCol, ]} */ ;
    // @ts-ignore
    const __VLS_173 = __VLS_asFunctionalComponent(__VLS_172, new __VLS_172({
        span: (24),
        ...{ class: "block" },
    }));
    const __VLS_174 = __VLS_173({
        span: (24),
        ...{ class: "block" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_173));
    __VLS_175.slots.default;
    const __VLS_176 = {}.ElCard;
    /** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
    // @ts-ignore
    const __VLS_177 = __VLS_asFunctionalComponent(__VLS_176, new __VLS_176({}));
    const __VLS_178 = __VLS_177({}, ...__VLS_functionalComponentArgsRest(__VLS_177));
    __VLS_179.slots.default;
    {
        const { header: __VLS_thisSlot } = __VLS_179.slots;
    }
    const __VLS_180 = {}.ElForm;
    /** @type {[typeof __VLS_components.ElForm, typeof __VLS_components.elForm, typeof __VLS_components.ElForm, typeof __VLS_components.elForm, ]} */ ;
    // @ts-ignore
    const __VLS_181 = __VLS_asFunctionalComponent(__VLS_180, new __VLS_180({
        inline: true,
    }));
    const __VLS_182 = __VLS_181({
        inline: true,
    }, ...__VLS_functionalComponentArgsRest(__VLS_181));
    __VLS_183.slots.default;
    const __VLS_184 = {}.ElFormItem;
    /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
    // @ts-ignore
    const __VLS_185 = __VLS_asFunctionalComponent(__VLS_184, new __VLS_184({
        label: "名称",
    }));
    const __VLS_186 = __VLS_185({
        label: "名称",
    }, ...__VLS_functionalComponentArgsRest(__VLS_185));
    __VLS_187.slots.default;
    const __VLS_188 = {}.ElInput;
    /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
    // @ts-ignore
    const __VLS_189 = __VLS_asFunctionalComponent(__VLS_188, new __VLS_188({
        modelValue: (__VLS_ctx.dishForm.name),
        placeholder: "例如：宫保鸡丁",
    }));
    const __VLS_190 = __VLS_189({
        modelValue: (__VLS_ctx.dishForm.name),
        placeholder: "例如：宫保鸡丁",
    }, ...__VLS_functionalComponentArgsRest(__VLS_189));
    var __VLS_187;
    const __VLS_192 = {}.ElFormItem;
    /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
    // @ts-ignore
    const __VLS_193 = __VLS_asFunctionalComponent(__VLS_192, new __VLS_192({
        label: "价格",
    }));
    const __VLS_194 = __VLS_193({
        label: "价格",
    }, ...__VLS_functionalComponentArgsRest(__VLS_193));
    __VLS_195.slots.default;
    const __VLS_196 = {}.ElInputNumber;
    /** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
    // @ts-ignore
    const __VLS_197 = __VLS_asFunctionalComponent(__VLS_196, new __VLS_196({
        modelValue: (__VLS_ctx.dishForm.price),
        min: (0.01),
        step: (0.5),
    }));
    const __VLS_198 = __VLS_197({
        modelValue: (__VLS_ctx.dishForm.price),
        min: (0.01),
        step: (0.5),
    }, ...__VLS_functionalComponentArgsRest(__VLS_197));
    var __VLS_195;
    const __VLS_200 = {}.ElFormItem;
    /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
    // @ts-ignore
    const __VLS_201 = __VLS_asFunctionalComponent(__VLS_200, new __VLS_200({
        label: "分类",
    }));
    const __VLS_202 = __VLS_201({
        label: "分类",
    }, ...__VLS_functionalComponentArgsRest(__VLS_201));
    __VLS_203.slots.default;
    const __VLS_204 = {}.ElInput;
    /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
    // @ts-ignore
    const __VLS_205 = __VLS_asFunctionalComponent(__VLS_204, new __VLS_204({
        modelValue: (__VLS_ctx.dishForm.category),
        placeholder: "主食/小吃/饮料",
    }));
    const __VLS_206 = __VLS_205({
        modelValue: (__VLS_ctx.dishForm.category),
        placeholder: "主食/小吃/饮料",
    }, ...__VLS_functionalComponentArgsRest(__VLS_205));
    var __VLS_203;
    const __VLS_208 = {}.ElFormItem;
    /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
    // @ts-ignore
    const __VLS_209 = __VLS_asFunctionalComponent(__VLS_208, new __VLS_208({}));
    const __VLS_210 = __VLS_209({}, ...__VLS_functionalComponentArgsRest(__VLS_209));
    __VLS_211.slots.default;
    const __VLS_212 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_213 = __VLS_asFunctionalComponent(__VLS_212, new __VLS_212({
        ...{ 'onClick': {} },
        type: "primary",
        loading: (__VLS_ctx.creatingDish),
    }));
    const __VLS_214 = __VLS_213({
        ...{ 'onClick': {} },
        type: "primary",
        loading: (__VLS_ctx.creatingDish),
    }, ...__VLS_functionalComponentArgsRest(__VLS_213));
    let __VLS_216;
    let __VLS_217;
    let __VLS_218;
    const __VLS_219 = {
        onClick: (__VLS_ctx.saveDish)
    };
    __VLS_215.slots.default;
    (__VLS_ctx.dishForm.id ? "更新菜品" : "新增菜品");
    var __VLS_215;
    if (__VLS_ctx.dishForm.id) {
        const __VLS_220 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        const __VLS_221 = __VLS_asFunctionalComponent(__VLS_220, new __VLS_220({
            ...{ 'onClick': {} },
        }));
        const __VLS_222 = __VLS_221({
            ...{ 'onClick': {} },
        }, ...__VLS_functionalComponentArgsRest(__VLS_221));
        let __VLS_224;
        let __VLS_225;
        let __VLS_226;
        const __VLS_227 = {
            onClick: (__VLS_ctx.resetDishForm)
        };
        __VLS_223.slots.default;
        var __VLS_223;
    }
    var __VLS_211;
    var __VLS_183;
    const __VLS_228 = {}.ElTable;
    /** @type {[typeof __VLS_components.ElTable, typeof __VLS_components.elTable, typeof __VLS_components.ElTable, typeof __VLS_components.elTable, ]} */ ;
    // @ts-ignore
    const __VLS_229 = __VLS_asFunctionalComponent(__VLS_228, new __VLS_228({
        data: (__VLS_ctx.merchantDishes),
        size: "small",
    }));
    const __VLS_230 = __VLS_229({
        data: (__VLS_ctx.merchantDishes),
        size: "small",
    }, ...__VLS_functionalComponentArgsRest(__VLS_229));
    __VLS_231.slots.default;
    const __VLS_232 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_233 = __VLS_asFunctionalComponent(__VLS_232, new __VLS_232({
        prop: "id",
        label: "ID",
        width: "70",
    }));
    const __VLS_234 = __VLS_233({
        prop: "id",
        label: "ID",
        width: "70",
    }, ...__VLS_functionalComponentArgsRest(__VLS_233));
    const __VLS_236 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_237 = __VLS_asFunctionalComponent(__VLS_236, new __VLS_236({
        prop: "name",
        label: "菜品",
        minWidth: "120",
    }));
    const __VLS_238 = __VLS_237({
        prop: "name",
        label: "菜品",
        minWidth: "120",
    }, ...__VLS_functionalComponentArgsRest(__VLS_237));
    const __VLS_240 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_241 = __VLS_asFunctionalComponent(__VLS_240, new __VLS_240({
        prop: "price",
        label: "价格",
        width: "90",
    }));
    const __VLS_242 = __VLS_241({
        prop: "price",
        label: "价格",
        width: "90",
    }, ...__VLS_functionalComponentArgsRest(__VLS_241));
    const __VLS_244 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_245 = __VLS_asFunctionalComponent(__VLS_244, new __VLS_244({
        prop: "category",
        label: "分类",
        width: "90",
    }));
    const __VLS_246 = __VLS_245({
        prop: "category",
        label: "分类",
        width: "90",
    }, ...__VLS_functionalComponentArgsRest(__VLS_245));
    const __VLS_248 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_249 = __VLS_asFunctionalComponent(__VLS_248, new __VLS_248({
        prop: "status",
        label: "状态",
        width: "90",
    }));
    const __VLS_250 = __VLS_249({
        prop: "status",
        label: "状态",
        width: "90",
    }, ...__VLS_functionalComponentArgsRest(__VLS_249));
    __VLS_251.slots.default;
    {
        const { default: __VLS_thisSlot } = __VLS_251.slots;
        const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
        (row.status === 1 ? "上架" : "下架");
    }
    var __VLS_251;
    const __VLS_252 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_253 = __VLS_asFunctionalComponent(__VLS_252, new __VLS_252({
        label: "操作",
        minWidth: "260",
    }));
    const __VLS_254 = __VLS_253({
        label: "操作",
        minWidth: "260",
    }, ...__VLS_functionalComponentArgsRest(__VLS_253));
    __VLS_255.slots.default;
    {
        const { default: __VLS_thisSlot } = __VLS_255.slots;
        const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
        const __VLS_256 = {}.ElSpace;
        /** @type {[typeof __VLS_components.ElSpace, typeof __VLS_components.elSpace, typeof __VLS_components.ElSpace, typeof __VLS_components.elSpace, ]} */ ;
        // @ts-ignore
        const __VLS_257 = __VLS_asFunctionalComponent(__VLS_256, new __VLS_256({
            wrap: true,
        }));
        const __VLS_258 = __VLS_257({
            wrap: true,
        }, ...__VLS_functionalComponentArgsRest(__VLS_257));
        __VLS_259.slots.default;
        const __VLS_260 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        const __VLS_261 = __VLS_asFunctionalComponent(__VLS_260, new __VLS_260({
            ...{ 'onClick': {} },
            size: "small",
        }));
        const __VLS_262 = __VLS_261({
            ...{ 'onClick': {} },
            size: "small",
        }, ...__VLS_functionalComponentArgsRest(__VLS_261));
        let __VLS_264;
        let __VLS_265;
        let __VLS_266;
        const __VLS_267 = {
            onClick: (...[$event]) => {
                if (!!(__VLS_ctx.isUser))
                    return;
                if (!(__VLS_ctx.isMerchant))
                    return;
                __VLS_ctx.editDish(row);
            }
        };
        __VLS_263.slots.default;
        var __VLS_263;
        const __VLS_268 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        const __VLS_269 = __VLS_asFunctionalComponent(__VLS_268, new __VLS_268({
            ...{ 'onClick': {} },
            size: "small",
            type: (row.status === 1 ? 'warning' : 'success'),
        }));
        const __VLS_270 = __VLS_269({
            ...{ 'onClick': {} },
            size: "small",
            type: (row.status === 1 ? 'warning' : 'success'),
        }, ...__VLS_functionalComponentArgsRest(__VLS_269));
        let __VLS_272;
        let __VLS_273;
        let __VLS_274;
        const __VLS_275 = {
            onClick: (...[$event]) => {
                if (!!(__VLS_ctx.isUser))
                    return;
                if (!(__VLS_ctx.isMerchant))
                    return;
                __VLS_ctx.toggleDishStatus(row);
            }
        };
        __VLS_271.slots.default;
        (row.status === 1 ? "下架" : "上架");
        var __VLS_271;
        const __VLS_276 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        const __VLS_277 = __VLS_asFunctionalComponent(__VLS_276, new __VLS_276({
            ...{ 'onClick': {} },
            size: "small",
            type: "danger",
        }));
        const __VLS_278 = __VLS_277({
            ...{ 'onClick': {} },
            size: "small",
            type: "danger",
        }, ...__VLS_functionalComponentArgsRest(__VLS_277));
        let __VLS_280;
        let __VLS_281;
        let __VLS_282;
        const __VLS_283 = {
            onClick: (...[$event]) => {
                if (!!(__VLS_ctx.isUser))
                    return;
                if (!(__VLS_ctx.isMerchant))
                    return;
                __VLS_ctx.removeDish(row.id);
            }
        };
        __VLS_279.slots.default;
        var __VLS_279;
        var __VLS_259;
    }
    var __VLS_255;
    var __VLS_231;
    var __VLS_179;
    var __VLS_175;
    const __VLS_284 = {}.ElCol;
    /** @type {[typeof __VLS_components.ElCol, typeof __VLS_components.elCol, typeof __VLS_components.ElCol, typeof __VLS_components.elCol, ]} */ ;
    // @ts-ignore
    const __VLS_285 = __VLS_asFunctionalComponent(__VLS_284, new __VLS_284({
        span: (24),
        ...{ class: "block" },
    }));
    const __VLS_286 = __VLS_285({
        span: (24),
        ...{ class: "block" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_285));
    __VLS_287.slots.default;
    const __VLS_288 = {}.ElCard;
    /** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
    // @ts-ignore
    const __VLS_289 = __VLS_asFunctionalComponent(__VLS_288, new __VLS_288({}));
    const __VLS_290 = __VLS_289({}, ...__VLS_functionalComponentArgsRest(__VLS_289));
    __VLS_291.slots.default;
    {
        const { header: __VLS_thisSlot } = __VLS_291.slots;
    }
    const __VLS_292 = {}.ElForm;
    /** @type {[typeof __VLS_components.ElForm, typeof __VLS_components.elForm, typeof __VLS_components.ElForm, typeof __VLS_components.elForm, ]} */ ;
    // @ts-ignore
    const __VLS_293 = __VLS_asFunctionalComponent(__VLS_292, new __VLS_292({
        inline: true,
    }));
    const __VLS_294 = __VLS_293({
        inline: true,
    }, ...__VLS_functionalComponentArgsRest(__VLS_293));
    __VLS_295.slots.default;
    const __VLS_296 = {}.ElFormItem;
    /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
    // @ts-ignore
    const __VLS_297 = __VLS_asFunctionalComponent(__VLS_296, new __VLS_296({
        label: "菜单名称",
    }));
    const __VLS_298 = __VLS_297({
        label: "菜单名称",
    }, ...__VLS_functionalComponentArgsRest(__VLS_297));
    __VLS_299.slots.default;
    const __VLS_300 = {}.ElInput;
    /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
    // @ts-ignore
    const __VLS_301 = __VLS_asFunctionalComponent(__VLS_300, new __VLS_300({
        modelValue: (__VLS_ctx.menuForm.name),
    }));
    const __VLS_302 = __VLS_301({
        modelValue: (__VLS_ctx.menuForm.name),
    }, ...__VLS_functionalComponentArgsRest(__VLS_301));
    var __VLS_299;
    const __VLS_304 = {}.ElFormItem;
    /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
    // @ts-ignore
    const __VLS_305 = __VLS_asFunctionalComponent(__VLS_304, new __VLS_304({
        label: "日期",
    }));
    const __VLS_306 = __VLS_305({
        label: "日期",
    }, ...__VLS_functionalComponentArgsRest(__VLS_305));
    __VLS_307.slots.default;
    const __VLS_308 = {}.ElDatePicker;
    /** @type {[typeof __VLS_components.ElDatePicker, typeof __VLS_components.elDatePicker, ]} */ ;
    // @ts-ignore
    const __VLS_309 = __VLS_asFunctionalComponent(__VLS_308, new __VLS_308({
        modelValue: (__VLS_ctx.menuForm.saleDate),
        type: "date",
        valueFormat: "YYYY-MM-DD",
    }));
    const __VLS_310 = __VLS_309({
        modelValue: (__VLS_ctx.menuForm.saleDate),
        type: "date",
        valueFormat: "YYYY-MM-DD",
    }, ...__VLS_functionalComponentArgsRest(__VLS_309));
    var __VLS_307;
    const __VLS_312 = {}.ElFormItem;
    /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
    // @ts-ignore
    const __VLS_313 = __VLS_asFunctionalComponent(__VLS_312, new __VLS_312({
        label: "开始",
    }));
    const __VLS_314 = __VLS_313({
        label: "开始",
    }, ...__VLS_functionalComponentArgsRest(__VLS_313));
    __VLS_315.slots.default;
    const __VLS_316 = {}.ElTimePicker;
    /** @type {[typeof __VLS_components.ElTimePicker, typeof __VLS_components.elTimePicker, ]} */ ;
    // @ts-ignore
    const __VLS_317 = __VLS_asFunctionalComponent(__VLS_316, new __VLS_316({
        modelValue: (__VLS_ctx.menuForm.startTime),
        valueFormat: "HH:mm:ss",
    }));
    const __VLS_318 = __VLS_317({
        modelValue: (__VLS_ctx.menuForm.startTime),
        valueFormat: "HH:mm:ss",
    }, ...__VLS_functionalComponentArgsRest(__VLS_317));
    var __VLS_315;
    const __VLS_320 = {}.ElFormItem;
    /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
    // @ts-ignore
    const __VLS_321 = __VLS_asFunctionalComponent(__VLS_320, new __VLS_320({
        label: "结束",
    }));
    const __VLS_322 = __VLS_321({
        label: "结束",
    }, ...__VLS_functionalComponentArgsRest(__VLS_321));
    __VLS_323.slots.default;
    const __VLS_324 = {}.ElTimePicker;
    /** @type {[typeof __VLS_components.ElTimePicker, typeof __VLS_components.elTimePicker, ]} */ ;
    // @ts-ignore
    const __VLS_325 = __VLS_asFunctionalComponent(__VLS_324, new __VLS_324({
        modelValue: (__VLS_ctx.menuForm.endTime),
        valueFormat: "HH:mm:ss",
    }));
    const __VLS_326 = __VLS_325({
        modelValue: (__VLS_ctx.menuForm.endTime),
        valueFormat: "HH:mm:ss",
    }, ...__VLS_functionalComponentArgsRest(__VLS_325));
    var __VLS_323;
    var __VLS_295;
    const __VLS_328 = {}.ElTable;
    /** @type {[typeof __VLS_components.ElTable, typeof __VLS_components.elTable, typeof __VLS_components.ElTable, typeof __VLS_components.elTable, ]} */ ;
    // @ts-ignore
    const __VLS_329 = __VLS_asFunctionalComponent(__VLS_328, new __VLS_328({
        data: (__VLS_ctx.merchantDishes),
        size: "small",
    }));
    const __VLS_330 = __VLS_329({
        data: (__VLS_ctx.merchantDishes),
        size: "small",
    }, ...__VLS_functionalComponentArgsRest(__VLS_329));
    __VLS_331.slots.default;
    const __VLS_332 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_333 = __VLS_asFunctionalComponent(__VLS_332, new __VLS_332({
        prop: "name",
        label: "菜品",
        minWidth: "120",
    }));
    const __VLS_334 = __VLS_333({
        prop: "name",
        label: "菜品",
        minWidth: "120",
    }, ...__VLS_functionalComponentArgsRest(__VLS_333));
    const __VLS_336 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_337 = __VLS_asFunctionalComponent(__VLS_336, new __VLS_336({
        label: "售价",
        width: "130",
    }));
    const __VLS_338 = __VLS_337({
        label: "售价",
        width: "130",
    }, ...__VLS_functionalComponentArgsRest(__VLS_337));
    __VLS_339.slots.default;
    {
        const { default: __VLS_thisSlot } = __VLS_339.slots;
        const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
        const __VLS_340 = {}.ElInputNumber;
        /** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
        // @ts-ignore
        const __VLS_341 = __VLS_asFunctionalComponent(__VLS_340, new __VLS_340({
            modelValue: (__VLS_ctx.menuItemMap[row.id].salePrice),
            min: (0.01),
            step: (0.5),
            size: "small",
        }));
        const __VLS_342 = __VLS_341({
            modelValue: (__VLS_ctx.menuItemMap[row.id].salePrice),
            min: (0.01),
            step: (0.5),
            size: "small",
        }, ...__VLS_functionalComponentArgsRest(__VLS_341));
    }
    var __VLS_339;
    const __VLS_344 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_345 = __VLS_asFunctionalComponent(__VLS_344, new __VLS_344({
        label: "库存",
        width: "120",
    }));
    const __VLS_346 = __VLS_345({
        label: "库存",
        width: "120",
    }, ...__VLS_functionalComponentArgsRest(__VLS_345));
    __VLS_347.slots.default;
    {
        const { default: __VLS_thisSlot } = __VLS_347.slots;
        const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
        const __VLS_348 = {}.ElInputNumber;
        /** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
        // @ts-ignore
        const __VLS_349 = __VLS_asFunctionalComponent(__VLS_348, new __VLS_348({
            modelValue: (__VLS_ctx.menuItemMap[row.id].stock),
            min: (0),
            step: (10),
            size: "small",
        }));
        const __VLS_350 = __VLS_349({
            modelValue: (__VLS_ctx.menuItemMap[row.id].stock),
            min: (0),
            step: (10),
            size: "small",
        }, ...__VLS_functionalComponentArgsRest(__VLS_349));
    }
    var __VLS_347;
    const __VLS_352 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_353 = __VLS_asFunctionalComponent(__VLS_352, new __VLS_352({
        label: "入选",
        width: "100",
    }));
    const __VLS_354 = __VLS_353({
        label: "入选",
        width: "100",
    }, ...__VLS_functionalComponentArgsRest(__VLS_353));
    __VLS_355.slots.default;
    {
        const { default: __VLS_thisSlot } = __VLS_355.slots;
        const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
        const __VLS_356 = {}.ElSwitch;
        /** @type {[typeof __VLS_components.ElSwitch, typeof __VLS_components.elSwitch, ]} */ ;
        // @ts-ignore
        const __VLS_357 = __VLS_asFunctionalComponent(__VLS_356, new __VLS_356({
            modelValue: (__VLS_ctx.menuItemMap[row.id].enabled),
        }));
        const __VLS_358 = __VLS_357({
            modelValue: (__VLS_ctx.menuItemMap[row.id].enabled),
        }, ...__VLS_functionalComponentArgsRest(__VLS_357));
    }
    var __VLS_355;
    var __VLS_331;
    const __VLS_360 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_361 = __VLS_asFunctionalComponent(__VLS_360, new __VLS_360({
        ...{ 'onClick': {} },
        ...{ class: "publish-btn" },
        type: "primary",
        loading: (__VLS_ctx.publishingMenu),
    }));
    const __VLS_362 = __VLS_361({
        ...{ 'onClick': {} },
        ...{ class: "publish-btn" },
        type: "primary",
        loading: (__VLS_ctx.publishingMenu),
    }, ...__VLS_functionalComponentArgsRest(__VLS_361));
    let __VLS_364;
    let __VLS_365;
    let __VLS_366;
    const __VLS_367 = {
        onClick: (__VLS_ctx.publishMenu)
    };
    __VLS_363.slots.default;
    var __VLS_363;
    var __VLS_291;
    var __VLS_287;
    const __VLS_368 = {}.ElCol;
    /** @type {[typeof __VLS_components.ElCol, typeof __VLS_components.elCol, typeof __VLS_components.ElCol, typeof __VLS_components.elCol, ]} */ ;
    // @ts-ignore
    const __VLS_369 = __VLS_asFunctionalComponent(__VLS_368, new __VLS_368({
        span: (16),
    }));
    const __VLS_370 = __VLS_369({
        span: (16),
    }, ...__VLS_functionalComponentArgsRest(__VLS_369));
    __VLS_371.slots.default;
    const __VLS_372 = {}.ElCard;
    /** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
    // @ts-ignore
    const __VLS_373 = __VLS_asFunctionalComponent(__VLS_372, new __VLS_372({}));
    const __VLS_374 = __VLS_373({}, ...__VLS_functionalComponentArgsRest(__VLS_373));
    __VLS_375.slots.default;
    {
        const { header: __VLS_thisSlot } = __VLS_375.slots;
    }
    const __VLS_376 = {}.ElTable;
    /** @type {[typeof __VLS_components.ElTable, typeof __VLS_components.elTable, typeof __VLS_components.ElTable, typeof __VLS_components.elTable, ]} */ ;
    // @ts-ignore
    const __VLS_377 = __VLS_asFunctionalComponent(__VLS_376, new __VLS_376({
        data: (__VLS_ctx.merchantOrders),
        size: "small",
    }));
    const __VLS_378 = __VLS_377({
        data: (__VLS_ctx.merchantOrders),
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
                if (!!(__VLS_ctx.isUser))
                    return;
                if (!(__VLS_ctx.isMerchant))
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
                if (!!(__VLS_ctx.isUser))
                    return;
                if (!(__VLS_ctx.isMerchant))
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
                if (!!(__VLS_ctx.isUser))
                    return;
                if (!(__VLS_ctx.isMerchant))
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
    var __VLS_375;
    var __VLS_371;
    const __VLS_432 = {}.ElCol;
    /** @type {[typeof __VLS_components.ElCol, typeof __VLS_components.elCol, typeof __VLS_components.ElCol, typeof __VLS_components.elCol, ]} */ ;
    // @ts-ignore
    const __VLS_433 = __VLS_asFunctionalComponent(__VLS_432, new __VLS_432({
        span: (8),
    }));
    const __VLS_434 = __VLS_433({
        span: (8),
    }, ...__VLS_functionalComponentArgsRest(__VLS_433));
    __VLS_435.slots.default;
    const __VLS_436 = {}.ElCard;
    /** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
    // @ts-ignore
    const __VLS_437 = __VLS_asFunctionalComponent(__VLS_436, new __VLS_436({}));
    const __VLS_438 = __VLS_437({}, ...__VLS_functionalComponentArgsRest(__VLS_437));
    __VLS_439.slots.default;
    {
        const { header: __VLS_thisSlot } = __VLS_439.slots;
    }
    const __VLS_440 = {}.ElForm;
    /** @type {[typeof __VLS_components.ElForm, typeof __VLS_components.elForm, typeof __VLS_components.ElForm, typeof __VLS_components.elForm, ]} */ ;
    // @ts-ignore
    const __VLS_441 = __VLS_asFunctionalComponent(__VLS_440, new __VLS_440({
        labelWidth: "80px",
    }));
    const __VLS_442 = __VLS_441({
        labelWidth: "80px",
    }, ...__VLS_functionalComponentArgsRest(__VLS_441));
    __VLS_443.slots.default;
    const __VLS_444 = {}.ElFormItem;
    /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
    // @ts-ignore
    const __VLS_445 = __VLS_asFunctionalComponent(__VLS_444, new __VLS_444({
        label: "窗口",
    }));
    const __VLS_446 = __VLS_445({
        label: "窗口",
    }, ...__VLS_functionalComponentArgsRest(__VLS_445));
    __VLS_447.slots.default;
    const __VLS_448 = {}.ElSelect;
    /** @type {[typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, ]} */ ;
    // @ts-ignore
    const __VLS_449 = __VLS_asFunctionalComponent(__VLS_448, new __VLS_448({
        modelValue: (__VLS_ctx.selectedWindowId),
        placeholder: "请选择窗口",
        ...{ style: {} },
    }));
    const __VLS_450 = __VLS_449({
        modelValue: (__VLS_ctx.selectedWindowId),
        placeholder: "请选择窗口",
        ...{ style: {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_449));
    __VLS_451.slots.default;
    for (const [w] of __VLS_getVForSourceType((__VLS_ctx.windows))) {
        const __VLS_452 = {}.ElOption;
        /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
        // @ts-ignore
        const __VLS_453 = __VLS_asFunctionalComponent(__VLS_452, new __VLS_452({
            key: (w.id),
            label: (`${w.name} (${w.location})`),
            value: (w.id),
        }));
        const __VLS_454 = __VLS_453({
            key: (w.id),
            label: (`${w.name} (${w.location})`),
            value: (w.id),
        }, ...__VLS_functionalComponentArgsRest(__VLS_453));
    }
    var __VLS_451;
    var __VLS_447;
    var __VLS_443;
    const __VLS_456 = {}.ElSpace;
    /** @type {[typeof __VLS_components.ElSpace, typeof __VLS_components.elSpace, typeof __VLS_components.ElSpace, typeof __VLS_components.elSpace, ]} */ ;
    // @ts-ignore
    const __VLS_457 = __VLS_asFunctionalComponent(__VLS_456, new __VLS_456({
        wrap: true,
    }));
    const __VLS_458 = __VLS_457({
        wrap: true,
    }, ...__VLS_functionalComponentArgsRest(__VLS_457));
    __VLS_459.slots.default;
    const __VLS_460 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_461 = __VLS_asFunctionalComponent(__VLS_460, new __VLS_460({
        ...{ 'onClick': {} },
        type: "primary",
    }));
    const __VLS_462 = __VLS_461({
        ...{ 'onClick': {} },
        type: "primary",
    }, ...__VLS_functionalComponentArgsRest(__VLS_461));
    let __VLS_464;
    let __VLS_465;
    let __VLS_466;
    const __VLS_467 = {
        onClick: (__VLS_ctx.callNext)
    };
    __VLS_463.slots.default;
    var __VLS_463;
    const __VLS_468 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_469 = __VLS_asFunctionalComponent(__VLS_468, new __VLS_468({
        ...{ 'onClick': {} },
    }));
    const __VLS_470 = __VLS_469({
        ...{ 'onClick': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_469));
    let __VLS_472;
    let __VLS_473;
    let __VLS_474;
    const __VLS_475 = {
        onClick: (__VLS_ctx.loadQueue)
    };
    __VLS_471.slots.default;
    var __VLS_471;
    var __VLS_459;
    const __VLS_476 = {}.ElDivider;
    /** @type {[typeof __VLS_components.ElDivider, typeof __VLS_components.elDivider, ]} */ ;
    // @ts-ignore
    const __VLS_477 = __VLS_asFunctionalComponent(__VLS_476, new __VLS_476({}));
    const __VLS_478 = __VLS_477({}, ...__VLS_functionalComponentArgsRest(__VLS_477));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    (__VLS_ctx.queueList.length);
    for (const [item] of __VLS_getVForSourceType((__VLS_ctx.queueList))) {
        const __VLS_480 = {}.ElTag;
        /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
        // @ts-ignore
        const __VLS_481 = __VLS_asFunctionalComponent(__VLS_480, new __VLS_480({
            key: (item),
            ...{ class: "queue-tag" },
        }));
        const __VLS_482 = __VLS_481({
            key: (item),
            ...{ class: "queue-tag" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_481));
        __VLS_483.slots.default;
        (item);
        var __VLS_483;
    }
    const __VLS_484 = {}.ElDivider;
    /** @type {[typeof __VLS_components.ElDivider, typeof __VLS_components.elDivider, ]} */ ;
    // @ts-ignore
    const __VLS_485 = __VLS_asFunctionalComponent(__VLS_484, new __VLS_484({}));
    const __VLS_486 = __VLS_485({}, ...__VLS_functionalComponentArgsRest(__VLS_485));
    const __VLS_488 = {}.ElInput;
    /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
    // @ts-ignore
    const __VLS_489 = __VLS_asFunctionalComponent(__VLS_488, new __VLS_488({
        modelValue: (__VLS_ctx.verifyCode),
        placeholder: "输入取餐码，例如 408765",
    }));
    const __VLS_490 = __VLS_489({
        modelValue: (__VLS_ctx.verifyCode),
        placeholder: "输入取餐码，例如 408765",
    }, ...__VLS_functionalComponentArgsRest(__VLS_489));
    const __VLS_492 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_493 = __VLS_asFunctionalComponent(__VLS_492, new __VLS_492({
        ...{ 'onClick': {} },
        ...{ class: "verify-btn" },
        type: "success",
    }));
    const __VLS_494 = __VLS_493({
        ...{ 'onClick': {} },
        ...{ class: "verify-btn" },
        type: "success",
    }, ...__VLS_functionalComponentArgsRest(__VLS_493));
    let __VLS_496;
    let __VLS_497;
    let __VLS_498;
    const __VLS_499 = {
        onClick: (__VLS_ctx.verifyPickup)
    };
    __VLS_495.slots.default;
    var __VLS_495;
    const __VLS_500 = {}.ElDivider;
    /** @type {[typeof __VLS_components.ElDivider, typeof __VLS_components.elDivider, ]} */ ;
    // @ts-ignore
    const __VLS_501 = __VLS_asFunctionalComponent(__VLS_500, new __VLS_500({}));
    const __VLS_502 = __VLS_501({}, ...__VLS_functionalComponentArgsRest(__VLS_501));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "section-sub-title" },
    });
    const __VLS_504 = {}.ElInput;
    /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
    // @ts-ignore
    const __VLS_505 = __VLS_asFunctionalComponent(__VLS_504, new __VLS_504({
        modelValue: (__VLS_ctx.searchPickupCode),
        placeholder: "输入取餐码进行查询",
    }));
    const __VLS_506 = __VLS_505({
        modelValue: (__VLS_ctx.searchPickupCode),
        placeholder: "输入取餐码进行查询",
    }, ...__VLS_functionalComponentArgsRest(__VLS_505));
    const __VLS_508 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_509 = __VLS_asFunctionalComponent(__VLS_508, new __VLS_508({
        ...{ 'onClick': {} },
        ...{ class: "verify-btn" },
        type: "primary",
        plain: true,
    }));
    const __VLS_510 = __VLS_509({
        ...{ 'onClick': {} },
        ...{ class: "verify-btn" },
        type: "primary",
        plain: true,
    }, ...__VLS_functionalComponentArgsRest(__VLS_509));
    let __VLS_512;
    let __VLS_513;
    let __VLS_514;
    const __VLS_515 = {
        onClick: (__VLS_ctx.searchOrderByCode)
    };
    __VLS_511.slots.default;
    var __VLS_511;
    if (__VLS_ctx.searchedOrder) {
        const __VLS_516 = {}.ElDescriptions;
        /** @type {[typeof __VLS_components.ElDescriptions, typeof __VLS_components.elDescriptions, typeof __VLS_components.ElDescriptions, typeof __VLS_components.elDescriptions, ]} */ ;
        // @ts-ignore
        const __VLS_517 = __VLS_asFunctionalComponent(__VLS_516, new __VLS_516({
            column: (1),
            border: true,
            ...{ class: "search-result" },
        }));
        const __VLS_518 = __VLS_517({
            column: (1),
            border: true,
            ...{ class: "search-result" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_517));
        __VLS_519.slots.default;
        const __VLS_520 = {}.ElDescriptionsItem;
        /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
        // @ts-ignore
        const __VLS_521 = __VLS_asFunctionalComponent(__VLS_520, new __VLS_520({
            label: "订单ID",
        }));
        const __VLS_522 = __VLS_521({
            label: "订单ID",
        }, ...__VLS_functionalComponentArgsRest(__VLS_521));
        __VLS_523.slots.default;
        (__VLS_ctx.searchedOrder.id);
        var __VLS_523;
        const __VLS_524 = {}.ElDescriptionsItem;
        /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
        // @ts-ignore
        const __VLS_525 = __VLS_asFunctionalComponent(__VLS_524, new __VLS_524({
            label: "用户ID",
        }));
        const __VLS_526 = __VLS_525({
            label: "用户ID",
        }, ...__VLS_functionalComponentArgsRest(__VLS_525));
        __VLS_527.slots.default;
        (__VLS_ctx.searchedOrder.userId);
        var __VLS_527;
        const __VLS_528 = {}.ElDescriptionsItem;
        /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
        // @ts-ignore
        const __VLS_529 = __VLS_asFunctionalComponent(__VLS_528, new __VLS_528({
            label: "窗口ID",
        }));
        const __VLS_530 = __VLS_529({
            label: "窗口ID",
        }, ...__VLS_functionalComponentArgsRest(__VLS_529));
        __VLS_531.slots.default;
        (__VLS_ctx.searchedOrder.windowId);
        var __VLS_531;
        const __VLS_532 = {}.ElDescriptionsItem;
        /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
        // @ts-ignore
        const __VLS_533 = __VLS_asFunctionalComponent(__VLS_532, new __VLS_532({
            label: "状态",
        }));
        const __VLS_534 = __VLS_533({
            label: "状态",
        }, ...__VLS_functionalComponentArgsRest(__VLS_533));
        __VLS_535.slots.default;
        (__VLS_ctx.statusText(__VLS_ctx.searchedOrder.status));
        var __VLS_535;
        const __VLS_536 = {}.ElDescriptionsItem;
        /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
        // @ts-ignore
        const __VLS_537 = __VLS_asFunctionalComponent(__VLS_536, new __VLS_536({
            label: "取餐码",
        }));
        const __VLS_538 = __VLS_537({
            label: "取餐码",
        }, ...__VLS_functionalComponentArgsRest(__VLS_537));
        __VLS_539.slots.default;
        (__VLS_ctx.searchedOrder.pickupCode);
        var __VLS_539;
        const __VLS_540 = {}.ElDescriptionsItem;
        /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
        // @ts-ignore
        const __VLS_541 = __VLS_asFunctionalComponent(__VLS_540, new __VLS_540({
            label: "叫号码",
        }));
        const __VLS_542 = __VLS_541({
            label: "叫号码",
        }, ...__VLS_functionalComponentArgsRest(__VLS_541));
        __VLS_543.slots.default;
        (__VLS_ctx.searchedOrder.pickupNo || "-");
        var __VLS_543;
        var __VLS_519;
    }
    var __VLS_439;
    var __VLS_435;
    var __VLS_171;
}
else {
    const __VLS_544 = {}.ElRow;
    /** @type {[typeof __VLS_components.ElRow, typeof __VLS_components.elRow, typeof __VLS_components.ElRow, typeof __VLS_components.elRow, ]} */ ;
    // @ts-ignore
    const __VLS_545 = __VLS_asFunctionalComponent(__VLS_544, new __VLS_544({
        gutter: (16),
    }));
    const __VLS_546 = __VLS_545({
        gutter: (16),
    }, ...__VLS_functionalComponentArgsRest(__VLS_545));
    __VLS_547.slots.default;
    const __VLS_548 = {}.ElCol;
    /** @type {[typeof __VLS_components.ElCol, typeof __VLS_components.elCol, typeof __VLS_components.ElCol, typeof __VLS_components.elCol, ]} */ ;
    // @ts-ignore
    const __VLS_549 = __VLS_asFunctionalComponent(__VLS_548, new __VLS_548({
        span: (10),
    }));
    const __VLS_550 = __VLS_549({
        span: (10),
    }, ...__VLS_functionalComponentArgsRest(__VLS_549));
    __VLS_551.slots.default;
    const __VLS_552 = {}.ElCard;
    /** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
    // @ts-ignore
    const __VLS_553 = __VLS_asFunctionalComponent(__VLS_552, new __VLS_552({}));
    const __VLS_554 = __VLS_553({}, ...__VLS_functionalComponentArgsRest(__VLS_553));
    __VLS_555.slots.default;
    {
        const { header: __VLS_thisSlot } = __VLS_555.slots;
    }
    const __VLS_556 = {}.ElForm;
    /** @type {[typeof __VLS_components.ElForm, typeof __VLS_components.elForm, typeof __VLS_components.ElForm, typeof __VLS_components.elForm, ]} */ ;
    // @ts-ignore
    const __VLS_557 = __VLS_asFunctionalComponent(__VLS_556, new __VLS_556({
        labelWidth: "95px",
    }));
    const __VLS_558 = __VLS_557({
        labelWidth: "95px",
    }, ...__VLS_functionalComponentArgsRest(__VLS_557));
    __VLS_559.slots.default;
    const __VLS_560 = {}.ElFormItem;
    /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
    // @ts-ignore
    const __VLS_561 = __VLS_asFunctionalComponent(__VLS_560, new __VLS_560({
        label: "窗口名称",
    }));
    const __VLS_562 = __VLS_561({
        label: "窗口名称",
    }, ...__VLS_functionalComponentArgsRest(__VLS_561));
    __VLS_563.slots.default;
    const __VLS_564 = {}.ElInput;
    /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
    // @ts-ignore
    const __VLS_565 = __VLS_asFunctionalComponent(__VLS_564, new __VLS_564({
        modelValue: (__VLS_ctx.windowForm.name),
        placeholder: "例如：1号档口-盖浇饭",
    }));
    const __VLS_566 = __VLS_565({
        modelValue: (__VLS_ctx.windowForm.name),
        placeholder: "例如：1号档口-盖浇饭",
    }, ...__VLS_functionalComponentArgsRest(__VLS_565));
    var __VLS_563;
    const __VLS_568 = {}.ElFormItem;
    /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
    // @ts-ignore
    const __VLS_569 = __VLS_asFunctionalComponent(__VLS_568, new __VLS_568({
        label: "位置",
    }));
    const __VLS_570 = __VLS_569({
        label: "位置",
    }, ...__VLS_functionalComponentArgsRest(__VLS_569));
    __VLS_571.slots.default;
    const __VLS_572 = {}.ElInput;
    /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
    // @ts-ignore
    const __VLS_573 = __VLS_asFunctionalComponent(__VLS_572, new __VLS_572({
        modelValue: (__VLS_ctx.windowForm.location),
        placeholder: "例如：食堂一楼东侧",
    }));
    const __VLS_574 = __VLS_573({
        modelValue: (__VLS_ctx.windowForm.location),
        placeholder: "例如：食堂一楼东侧",
    }, ...__VLS_functionalComponentArgsRest(__VLS_573));
    var __VLS_571;
    const __VLS_576 = {}.ElFormItem;
    /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
    // @ts-ignore
    const __VLS_577 = __VLS_asFunctionalComponent(__VLS_576, new __VLS_576({
        label: "商家账号",
    }));
    const __VLS_578 = __VLS_577({
        label: "商家账号",
    }, ...__VLS_functionalComponentArgsRest(__VLS_577));
    __VLS_579.slots.default;
    const __VLS_580 = {}.ElSelect;
    /** @type {[typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, ]} */ ;
    // @ts-ignore
    const __VLS_581 = __VLS_asFunctionalComponent(__VLS_580, new __VLS_580({
        modelValue: (__VLS_ctx.windowForm.merchantId),
        placeholder: "请选择商家",
        ...{ style: {} },
    }));
    const __VLS_582 = __VLS_581({
        modelValue: (__VLS_ctx.windowForm.merchantId),
        placeholder: "请选择商家",
        ...{ style: {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_581));
    __VLS_583.slots.default;
    for (const [m] of __VLS_getVForSourceType((__VLS_ctx.merchantUsers))) {
        const __VLS_584 = {}.ElOption;
        /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
        // @ts-ignore
        const __VLS_585 = __VLS_asFunctionalComponent(__VLS_584, new __VLS_584({
            key: (m.id),
            label: (`${m.nickname} (${m.phone})`),
            value: (m.id),
        }));
        const __VLS_586 = __VLS_585({
            key: (m.id),
            label: (`${m.nickname} (${m.phone})`),
            value: (m.id),
        }, ...__VLS_functionalComponentArgsRest(__VLS_585));
    }
    var __VLS_583;
    var __VLS_579;
    const __VLS_588 = {}.ElFormItem;
    /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
    // @ts-ignore
    const __VLS_589 = __VLS_asFunctionalComponent(__VLS_588, new __VLS_588({
        label: "叫号前缀",
    }));
    const __VLS_590 = __VLS_589({
        label: "叫号前缀",
    }, ...__VLS_functionalComponentArgsRest(__VLS_589));
    __VLS_591.slots.default;
    const __VLS_592 = {}.ElInput;
    /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
    // @ts-ignore
    const __VLS_593 = __VLS_asFunctionalComponent(__VLS_592, new __VLS_592({
        modelValue: (__VLS_ctx.windowForm.pickupPrefix),
        maxlength: "2",
        placeholder: "例如：A",
    }));
    const __VLS_594 = __VLS_593({
        modelValue: (__VLS_ctx.windowForm.pickupPrefix),
        maxlength: "2",
        placeholder: "例如：A",
    }, ...__VLS_functionalComponentArgsRest(__VLS_593));
    var __VLS_591;
    const __VLS_596 = {}.ElFormItem;
    /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
    // @ts-ignore
    const __VLS_597 = __VLS_asFunctionalComponent(__VLS_596, new __VLS_596({}));
    const __VLS_598 = __VLS_597({}, ...__VLS_functionalComponentArgsRest(__VLS_597));
    __VLS_599.slots.default;
    const __VLS_600 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_601 = __VLS_asFunctionalComponent(__VLS_600, new __VLS_600({
        ...{ 'onClick': {} },
        type: "primary",
        loading: (__VLS_ctx.creatingWindow),
    }));
    const __VLS_602 = __VLS_601({
        ...{ 'onClick': {} },
        type: "primary",
        loading: (__VLS_ctx.creatingWindow),
    }, ...__VLS_functionalComponentArgsRest(__VLS_601));
    let __VLS_604;
    let __VLS_605;
    let __VLS_606;
    const __VLS_607 = {
        onClick: (__VLS_ctx.createWindow)
    };
    __VLS_603.slots.default;
    var __VLS_603;
    var __VLS_599;
    var __VLS_559;
    var __VLS_555;
    var __VLS_551;
    const __VLS_608 = {}.ElCol;
    /** @type {[typeof __VLS_components.ElCol, typeof __VLS_components.elCol, typeof __VLS_components.ElCol, typeof __VLS_components.elCol, ]} */ ;
    // @ts-ignore
    const __VLS_609 = __VLS_asFunctionalComponent(__VLS_608, new __VLS_608({
        span: (14),
    }));
    const __VLS_610 = __VLS_609({
        span: (14),
    }, ...__VLS_functionalComponentArgsRest(__VLS_609));
    __VLS_611.slots.default;
    const __VLS_612 = {}.ElCard;
    /** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
    // @ts-ignore
    const __VLS_613 = __VLS_asFunctionalComponent(__VLS_612, new __VLS_612({
        ...{ class: "order-card" },
    }));
    const __VLS_614 = __VLS_613({
        ...{ class: "order-card" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_613));
    __VLS_615.slots.default;
    {
        const { header: __VLS_thisSlot } = __VLS_615.slots;
    }
    const __VLS_616 = {}.ElTable;
    /** @type {[typeof __VLS_components.ElTable, typeof __VLS_components.elTable, typeof __VLS_components.ElTable, typeof __VLS_components.elTable, ]} */ ;
    // @ts-ignore
    const __VLS_617 = __VLS_asFunctionalComponent(__VLS_616, new __VLS_616({
        data: (__VLS_ctx.windows),
        size: "small",
    }));
    const __VLS_618 = __VLS_617({
        data: (__VLS_ctx.windows),
        size: "small",
    }, ...__VLS_functionalComponentArgsRest(__VLS_617));
    __VLS_619.slots.default;
    const __VLS_620 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_621 = __VLS_asFunctionalComponent(__VLS_620, new __VLS_620({
        prop: "id",
        label: "ID",
        width: "70",
    }));
    const __VLS_622 = __VLS_621({
        prop: "id",
        label: "ID",
        width: "70",
    }, ...__VLS_functionalComponentArgsRest(__VLS_621));
    const __VLS_624 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_625 = __VLS_asFunctionalComponent(__VLS_624, new __VLS_624({
        prop: "name",
        label: "窗口名称",
        minWidth: "120",
    }));
    const __VLS_626 = __VLS_625({
        prop: "name",
        label: "窗口名称",
        minWidth: "120",
    }, ...__VLS_functionalComponentArgsRest(__VLS_625));
    const __VLS_628 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_629 = __VLS_asFunctionalComponent(__VLS_628, new __VLS_628({
        prop: "location",
        label: "位置",
        minWidth: "140",
    }));
    const __VLS_630 = __VLS_629({
        prop: "location",
        label: "位置",
        minWidth: "140",
    }, ...__VLS_functionalComponentArgsRest(__VLS_629));
    const __VLS_632 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_633 = __VLS_asFunctionalComponent(__VLS_632, new __VLS_632({
        prop: "merchantId",
        label: "商家ID",
        width: "90",
    }));
    const __VLS_634 = __VLS_633({
        prop: "merchantId",
        label: "商家ID",
        width: "90",
    }, ...__VLS_functionalComponentArgsRest(__VLS_633));
    const __VLS_636 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_637 = __VLS_asFunctionalComponent(__VLS_636, new __VLS_636({
        prop: "pickupPrefix",
        label: "前缀",
        width: "80",
    }));
    const __VLS_638 = __VLS_637({
        prop: "pickupPrefix",
        label: "前缀",
        width: "80",
    }, ...__VLS_functionalComponentArgsRest(__VLS_637));
    const __VLS_640 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_641 = __VLS_asFunctionalComponent(__VLS_640, new __VLS_640({
        prop: "status",
        label: "状态",
        width: "90",
    }));
    const __VLS_642 = __VLS_641({
        prop: "status",
        label: "状态",
        width: "90",
    }, ...__VLS_functionalComponentArgsRest(__VLS_641));
    __VLS_643.slots.default;
    {
        const { default: __VLS_thisSlot } = __VLS_643.slots;
        const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
        (row.status === 1 ? "启用" : "停用");
    }
    var __VLS_643;
    var __VLS_619;
    var __VLS_615;
    const __VLS_644 = {}.ElCard;
    /** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
    // @ts-ignore
    const __VLS_645 = __VLS_asFunctionalComponent(__VLS_644, new __VLS_644({
        ...{ class: "order-card" },
    }));
    const __VLS_646 = __VLS_645({
        ...{ class: "order-card" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_645));
    __VLS_647.slots.default;
    {
        const { header: __VLS_thisSlot } = __VLS_647.slots;
    }
    const __VLS_648 = {}.ElTable;
    /** @type {[typeof __VLS_components.ElTable, typeof __VLS_components.elTable, typeof __VLS_components.ElTable, typeof __VLS_components.elTable, ]} */ ;
    // @ts-ignore
    const __VLS_649 = __VLS_asFunctionalComponent(__VLS_648, new __VLS_648({
        data: (__VLS_ctx.allUsers),
        size: "small",
    }));
    const __VLS_650 = __VLS_649({
        data: (__VLS_ctx.allUsers),
        size: "small",
    }, ...__VLS_functionalComponentArgsRest(__VLS_649));
    __VLS_651.slots.default;
    const __VLS_652 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_653 = __VLS_asFunctionalComponent(__VLS_652, new __VLS_652({
        prop: "id",
        label: "ID",
        width: "70",
    }));
    const __VLS_654 = __VLS_653({
        prop: "id",
        label: "ID",
        width: "70",
    }, ...__VLS_functionalComponentArgsRest(__VLS_653));
    const __VLS_656 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_657 = __VLS_asFunctionalComponent(__VLS_656, new __VLS_656({
        prop: "phone",
        label: "手机号",
        width: "130",
    }));
    const __VLS_658 = __VLS_657({
        prop: "phone",
        label: "手机号",
        width: "130",
    }, ...__VLS_functionalComponentArgsRest(__VLS_657));
    const __VLS_660 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_661 = __VLS_asFunctionalComponent(__VLS_660, new __VLS_660({
        prop: "nickname",
        label: "昵称",
        minWidth: "100",
    }));
    const __VLS_662 = __VLS_661({
        prop: "nickname",
        label: "昵称",
        minWidth: "100",
    }, ...__VLS_functionalComponentArgsRest(__VLS_661));
    const __VLS_664 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_665 = __VLS_asFunctionalComponent(__VLS_664, new __VLS_664({
        prop: "role",
        label: "角色",
        width: "90",
    }));
    const __VLS_666 = __VLS_665({
        prop: "role",
        label: "角色",
        width: "90",
    }, ...__VLS_functionalComponentArgsRest(__VLS_665));
    __VLS_667.slots.default;
    {
        const { default: __VLS_thisSlot } = __VLS_667.slots;
        const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
        (__VLS_ctx.roleNameByValue(row.role));
    }
    var __VLS_667;
    const __VLS_668 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_669 = __VLS_asFunctionalComponent(__VLS_668, new __VLS_668({
        prop: "status",
        label: "状态",
        width: "80",
    }));
    const __VLS_670 = __VLS_669({
        prop: "status",
        label: "状态",
        width: "80",
    }, ...__VLS_functionalComponentArgsRest(__VLS_669));
    __VLS_671.slots.default;
    {
        const { default: __VLS_thisSlot } = __VLS_671.slots;
        const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
        (row.status === 1 ? "启用" : "停用");
    }
    var __VLS_671;
    var __VLS_651;
    var __VLS_647;
    var __VLS_611;
    var __VLS_547;
}
const __VLS_672 = {}.ElDialog;
/** @type {[typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, ]} */ ;
// @ts-ignore
const __VLS_673 = __VLS_asFunctionalComponent(__VLS_672, new __VLS_672({
    modelValue: (__VLS_ctx.detailVisible),
    title: "订单详情",
    width: "720px",
}));
const __VLS_674 = __VLS_673({
    modelValue: (__VLS_ctx.detailVisible),
    title: "订单详情",
    width: "720px",
}, ...__VLS_functionalComponentArgsRest(__VLS_673));
__VLS_675.slots.default;
if (__VLS_ctx.detailOrder) {
    const __VLS_676 = {}.ElDescriptions;
    /** @type {[typeof __VLS_components.ElDescriptions, typeof __VLS_components.elDescriptions, typeof __VLS_components.ElDescriptions, typeof __VLS_components.elDescriptions, ]} */ ;
    // @ts-ignore
    const __VLS_677 = __VLS_asFunctionalComponent(__VLS_676, new __VLS_676({
        column: (2),
        border: true,
    }));
    const __VLS_678 = __VLS_677({
        column: (2),
        border: true,
    }, ...__VLS_functionalComponentArgsRest(__VLS_677));
    __VLS_679.slots.default;
    const __VLS_680 = {}.ElDescriptionsItem;
    /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
    // @ts-ignore
    const __VLS_681 = __VLS_asFunctionalComponent(__VLS_680, new __VLS_680({
        label: "订单ID",
    }));
    const __VLS_682 = __VLS_681({
        label: "订单ID",
    }, ...__VLS_functionalComponentArgsRest(__VLS_681));
    __VLS_683.slots.default;
    (__VLS_ctx.detailOrder.id);
    var __VLS_683;
    const __VLS_684 = {}.ElDescriptionsItem;
    /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
    // @ts-ignore
    const __VLS_685 = __VLS_asFunctionalComponent(__VLS_684, new __VLS_684({
        label: "订单号",
    }));
    const __VLS_686 = __VLS_685({
        label: "订单号",
    }, ...__VLS_functionalComponentArgsRest(__VLS_685));
    __VLS_687.slots.default;
    (__VLS_ctx.detailOrder.orderNo);
    var __VLS_687;
    const __VLS_688 = {}.ElDescriptionsItem;
    /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
    // @ts-ignore
    const __VLS_689 = __VLS_asFunctionalComponent(__VLS_688, new __VLS_688({
        label: "窗口ID",
    }));
    const __VLS_690 = __VLS_689({
        label: "窗口ID",
    }, ...__VLS_functionalComponentArgsRest(__VLS_689));
    __VLS_691.slots.default;
    (__VLS_ctx.detailOrder.windowId);
    var __VLS_691;
    const __VLS_692 = {}.ElDescriptionsItem;
    /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
    // @ts-ignore
    const __VLS_693 = __VLS_asFunctionalComponent(__VLS_692, new __VLS_692({
        label: "状态",
    }));
    const __VLS_694 = __VLS_693({
        label: "状态",
    }, ...__VLS_functionalComponentArgsRest(__VLS_693));
    __VLS_695.slots.default;
    (__VLS_ctx.statusText(__VLS_ctx.detailOrder.status));
    var __VLS_695;
    const __VLS_696 = {}.ElDescriptionsItem;
    /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
    // @ts-ignore
    const __VLS_697 = __VLS_asFunctionalComponent(__VLS_696, new __VLS_696({
        label: "取餐码",
    }));
    const __VLS_698 = __VLS_697({
        label: "取餐码",
    }, ...__VLS_functionalComponentArgsRest(__VLS_697));
    __VLS_699.slots.default;
    (__VLS_ctx.detailOrder.pickupCode);
    var __VLS_699;
    const __VLS_700 = {}.ElDescriptionsItem;
    /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
    // @ts-ignore
    const __VLS_701 = __VLS_asFunctionalComponent(__VLS_700, new __VLS_700({
        label: "叫号码",
    }));
    const __VLS_702 = __VLS_701({
        label: "叫号码",
    }, ...__VLS_functionalComponentArgsRest(__VLS_701));
    __VLS_703.slots.default;
    (__VLS_ctx.detailOrder.pickupNo || "-");
    var __VLS_703;
    const __VLS_704 = {}.ElDescriptionsItem;
    /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
    // @ts-ignore
    const __VLS_705 = __VLS_asFunctionalComponent(__VLS_704, new __VLS_704({
        label: "金额",
    }));
    const __VLS_706 = __VLS_705({
        label: "金额",
    }, ...__VLS_functionalComponentArgsRest(__VLS_705));
    __VLS_707.slots.default;
    (__VLS_ctx.detailOrder.totalAmount);
    var __VLS_707;
    const __VLS_708 = {}.ElDescriptionsItem;
    /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
    // @ts-ignore
    const __VLS_709 = __VLS_asFunctionalComponent(__VLS_708, new __VLS_708({
        label: "备注",
    }));
    const __VLS_710 = __VLS_709({
        label: "备注",
    }, ...__VLS_functionalComponentArgsRest(__VLS_709));
    __VLS_711.slots.default;
    (__VLS_ctx.detailOrder.remark || "-");
    var __VLS_711;
    var __VLS_679;
}
const __VLS_712 = {}.ElDivider;
/** @type {[typeof __VLS_components.ElDivider, typeof __VLS_components.elDivider, ]} */ ;
// @ts-ignore
const __VLS_713 = __VLS_asFunctionalComponent(__VLS_712, new __VLS_712({}));
const __VLS_714 = __VLS_713({}, ...__VLS_functionalComponentArgsRest(__VLS_713));
const __VLS_716 = {}.ElTable;
/** @type {[typeof __VLS_components.ElTable, typeof __VLS_components.elTable, typeof __VLS_components.ElTable, typeof __VLS_components.elTable, ]} */ ;
// @ts-ignore
const __VLS_717 = __VLS_asFunctionalComponent(__VLS_716, new __VLS_716({
    data: (__VLS_ctx.detailOrder?.items || []),
    size: "small",
}));
const __VLS_718 = __VLS_717({
    data: (__VLS_ctx.detailOrder?.items || []),
    size: "small",
}, ...__VLS_functionalComponentArgsRest(__VLS_717));
__VLS_719.slots.default;
const __VLS_720 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_721 = __VLS_asFunctionalComponent(__VLS_720, new __VLS_720({
    prop: "dishName",
    label: "菜品",
    minWidth: "130",
}));
const __VLS_722 = __VLS_721({
    prop: "dishName",
    label: "菜品",
    minWidth: "130",
}, ...__VLS_functionalComponentArgsRest(__VLS_721));
const __VLS_724 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_725 = __VLS_asFunctionalComponent(__VLS_724, new __VLS_724({
    prop: "quantity",
    label: "数量",
    width: "80",
}));
const __VLS_726 = __VLS_725({
    prop: "quantity",
    label: "数量",
    width: "80",
}, ...__VLS_functionalComponentArgsRest(__VLS_725));
const __VLS_728 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_729 = __VLS_asFunctionalComponent(__VLS_728, new __VLS_728({
    prop: "unitPrice",
    label: "单价",
    width: "90",
}));
const __VLS_730 = __VLS_729({
    prop: "unitPrice",
    label: "单价",
    width: "90",
}, ...__VLS_functionalComponentArgsRest(__VLS_729));
const __VLS_732 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_733 = __VLS_asFunctionalComponent(__VLS_732, new __VLS_732({
    prop: "subtotal",
    label: "小计",
    width: "100",
}));
const __VLS_734 = __VLS_733({
    prop: "subtotal",
    label: "小计",
    width: "100",
}, ...__VLS_functionalComponentArgsRest(__VLS_733));
var __VLS_719;
var __VLS_675;
/** @type {__VLS_StyleScopedClasses['wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['top-card']} */ ;
/** @type {__VLS_StyleScopedClasses['head']} */ ;
/** @type {__VLS_StyleScopedClasses['summary']} */ ;
/** @type {__VLS_StyleScopedClasses['order-card']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['publish-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['queue-tag']} */ ;
/** @type {__VLS_StyleScopedClasses['verify-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['section-sub-title']} */ ;
/** @type {__VLS_StyleScopedClasses['verify-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['search-result']} */ ;
/** @type {__VLS_StyleScopedClasses['order-card']} */ ;
/** @type {__VLS_StyleScopedClasses['order-card']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            loading: loading,
            submitting: submitting,
            windows: windows,
            orders: orders,
            merchantOrders: merchantOrders,
            merchantUsers: merchantUsers,
            allUsers: allUsers,
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
            creatingWindow: creatingWindow,
            creatingDish: creatingDish,
            publishingMenu: publishingMenu,
            windowForm: windowForm,
            dishForm: dishForm,
            menuForm: menuForm,
            menuItemMap: menuItemMap,
            roleLabel: roleLabel,
            isUser: isUser,
            isMerchant: isMerchant,
            flatDishes: flatDishes,
            selectedCount: selectedCount,
            totalAmount: totalAmount,
            loadAll: loadAll,
            submitOrder: submitOrder,
            statusText: statusText,
            changeStatus: changeStatus,
            loadQueue: loadQueue,
            callNext: callNext,
            verifyPickup: verifyPickup,
            searchOrderByCode: searchOrderByCode,
            showOrderDetail: showOrderDetail,
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
