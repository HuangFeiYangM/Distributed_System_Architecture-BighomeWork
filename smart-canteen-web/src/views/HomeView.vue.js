import { computed, onMounted, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import { useRouter } from "vue-router";
import { getTodayMenusApi, publishMenuApi } from "../api/menu";
import { getMyOrdersApi, createOrderApi, updateOrderStatusApi } from "../api/order";
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
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
(__VLS_ctx.roleLabel);
var __VLS_15;
var __VLS_3;
if (__VLS_ctx.isUser) {
    const __VLS_32 = {}.ElRow;
    /** @type {[typeof __VLS_components.ElRow, typeof __VLS_components.elRow, typeof __VLS_components.ElRow, typeof __VLS_components.elRow, ]} */ ;
    // @ts-ignore
    const __VLS_33 = __VLS_asFunctionalComponent(__VLS_32, new __VLS_32({
        gutter: (16),
    }));
    const __VLS_34 = __VLS_33({
        gutter: (16),
    }, ...__VLS_functionalComponentArgsRest(__VLS_33));
    __VLS_35.slots.default;
    const __VLS_36 = {}.ElCol;
    /** @type {[typeof __VLS_components.ElCol, typeof __VLS_components.elCol, typeof __VLS_components.ElCol, typeof __VLS_components.elCol, ]} */ ;
    // @ts-ignore
    const __VLS_37 = __VLS_asFunctionalComponent(__VLS_36, new __VLS_36({
        span: (12),
    }));
    const __VLS_38 = __VLS_37({
        span: (12),
    }, ...__VLS_functionalComponentArgsRest(__VLS_37));
    __VLS_39.slots.default;
    const __VLS_40 = {}.ElCard;
    /** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
    // @ts-ignore
    const __VLS_41 = __VLS_asFunctionalComponent(__VLS_40, new __VLS_40({}));
    const __VLS_42 = __VLS_41({}, ...__VLS_functionalComponentArgsRest(__VLS_41));
    __VLS_43.slots.default;
    {
        const { header: __VLS_thisSlot } = __VLS_43.slots;
    }
    if (__VLS_ctx.flatDishes.length === 0) {
        const __VLS_44 = {}.ElEmpty;
        /** @type {[typeof __VLS_components.ElEmpty, typeof __VLS_components.elEmpty, ]} */ ;
        // @ts-ignore
        const __VLS_45 = __VLS_asFunctionalComponent(__VLS_44, new __VLS_44({
            description: "当前无可用菜单",
        }));
        const __VLS_46 = __VLS_45({
            description: "当前无可用菜单",
        }, ...__VLS_functionalComponentArgsRest(__VLS_45));
    }
    else {
        const __VLS_48 = {}.ElTable;
        /** @type {[typeof __VLS_components.ElTable, typeof __VLS_components.elTable, typeof __VLS_components.ElTable, typeof __VLS_components.elTable, ]} */ ;
        // @ts-ignore
        const __VLS_49 = __VLS_asFunctionalComponent(__VLS_48, new __VLS_48({
            data: (__VLS_ctx.flatDishes),
            size: "small",
        }));
        const __VLS_50 = __VLS_49({
            data: (__VLS_ctx.flatDishes),
            size: "small",
        }, ...__VLS_functionalComponentArgsRest(__VLS_49));
        __VLS_51.slots.default;
        const __VLS_52 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_53 = __VLS_asFunctionalComponent(__VLS_52, new __VLS_52({
            prop: "dishName",
            label: "菜品",
            minWidth: "120",
        }));
        const __VLS_54 = __VLS_53({
            prop: "dishName",
            label: "菜品",
            minWidth: "120",
        }, ...__VLS_functionalComponentArgsRest(__VLS_53));
        const __VLS_56 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_57 = __VLS_asFunctionalComponent(__VLS_56, new __VLS_56({
            prop: "salePrice",
            label: "价格",
            width: "90",
        }));
        const __VLS_58 = __VLS_57({
            prop: "salePrice",
            label: "价格",
            width: "90",
        }, ...__VLS_functionalComponentArgsRest(__VLS_57));
        __VLS_59.slots.default;
        {
            const { default: __VLS_thisSlot } = __VLS_59.slots;
            const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
            (row.salePrice);
        }
        var __VLS_59;
        const __VLS_60 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_61 = __VLS_asFunctionalComponent(__VLS_60, new __VLS_60({
            prop: "stock",
            label: "库存",
            width: "80",
        }));
        const __VLS_62 = __VLS_61({
            prop: "stock",
            label: "库存",
            width: "80",
        }, ...__VLS_functionalComponentArgsRest(__VLS_61));
        const __VLS_64 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_65 = __VLS_asFunctionalComponent(__VLS_64, new __VLS_64({
            label: "数量",
            width: "120",
        }));
        const __VLS_66 = __VLS_65({
            label: "数量",
            width: "120",
        }, ...__VLS_functionalComponentArgsRest(__VLS_65));
        __VLS_67.slots.default;
        {
            const { default: __VLS_thisSlot } = __VLS_67.slots;
            const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
            const __VLS_68 = {}.ElInputNumber;
            /** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
            // @ts-ignore
            const __VLS_69 = __VLS_asFunctionalComponent(__VLS_68, new __VLS_68({
                modelValue: (__VLS_ctx.quantityMap[row.id]),
                min: (0),
                max: (20),
                step: (1),
                size: "small",
            }));
            const __VLS_70 = __VLS_69({
                modelValue: (__VLS_ctx.quantityMap[row.id]),
                min: (0),
                max: (20),
                step: (1),
                size: "small",
            }, ...__VLS_functionalComponentArgsRest(__VLS_69));
        }
        var __VLS_67;
        var __VLS_51;
    }
    var __VLS_43;
    var __VLS_39;
    const __VLS_72 = {}.ElCol;
    /** @type {[typeof __VLS_components.ElCol, typeof __VLS_components.elCol, typeof __VLS_components.ElCol, typeof __VLS_components.elCol, ]} */ ;
    // @ts-ignore
    const __VLS_73 = __VLS_asFunctionalComponent(__VLS_72, new __VLS_72({
        span: (12),
    }));
    const __VLS_74 = __VLS_73({
        span: (12),
    }, ...__VLS_functionalComponentArgsRest(__VLS_73));
    __VLS_75.slots.default;
    const __VLS_76 = {}.ElCard;
    /** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
    // @ts-ignore
    const __VLS_77 = __VLS_asFunctionalComponent(__VLS_76, new __VLS_76({}));
    const __VLS_78 = __VLS_77({}, ...__VLS_functionalComponentArgsRest(__VLS_77));
    __VLS_79.slots.default;
    {
        const { header: __VLS_thisSlot } = __VLS_79.slots;
    }
    const __VLS_80 = {}.ElForm;
    /** @type {[typeof __VLS_components.ElForm, typeof __VLS_components.elForm, typeof __VLS_components.ElForm, typeof __VLS_components.elForm, ]} */ ;
    // @ts-ignore
    const __VLS_81 = __VLS_asFunctionalComponent(__VLS_80, new __VLS_80({
        labelWidth: "90px",
    }));
    const __VLS_82 = __VLS_81({
        labelWidth: "90px",
    }, ...__VLS_functionalComponentArgsRest(__VLS_81));
    __VLS_83.slots.default;
    const __VLS_84 = {}.ElFormItem;
    /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
    // @ts-ignore
    const __VLS_85 = __VLS_asFunctionalComponent(__VLS_84, new __VLS_84({
        label: "取餐窗口",
    }));
    const __VLS_86 = __VLS_85({
        label: "取餐窗口",
    }, ...__VLS_functionalComponentArgsRest(__VLS_85));
    __VLS_87.slots.default;
    const __VLS_88 = {}.ElSelect;
    /** @type {[typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, ]} */ ;
    // @ts-ignore
    const __VLS_89 = __VLS_asFunctionalComponent(__VLS_88, new __VLS_88({
        modelValue: (__VLS_ctx.selectedWindowId),
        placeholder: "请选择窗口",
        ...{ style: {} },
    }));
    const __VLS_90 = __VLS_89({
        modelValue: (__VLS_ctx.selectedWindowId),
        placeholder: "请选择窗口",
        ...{ style: {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_89));
    __VLS_91.slots.default;
    for (const [w] of __VLS_getVForSourceType((__VLS_ctx.windows))) {
        const __VLS_92 = {}.ElOption;
        /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
        // @ts-ignore
        const __VLS_93 = __VLS_asFunctionalComponent(__VLS_92, new __VLS_92({
            key: (w.id),
            label: (`${w.name} (${w.location})`),
            value: (w.id),
        }));
        const __VLS_94 = __VLS_93({
            key: (w.id),
            label: (`${w.name} (${w.location})`),
            value: (w.id),
        }, ...__VLS_functionalComponentArgsRest(__VLS_93));
    }
    var __VLS_91;
    var __VLS_87;
    const __VLS_96 = {}.ElFormItem;
    /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
    // @ts-ignore
    const __VLS_97 = __VLS_asFunctionalComponent(__VLS_96, new __VLS_96({
        label: "备注",
    }));
    const __VLS_98 = __VLS_97({
        label: "备注",
    }, ...__VLS_functionalComponentArgsRest(__VLS_97));
    __VLS_99.slots.default;
    const __VLS_100 = {}.ElInput;
    /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
    // @ts-ignore
    const __VLS_101 = __VLS_asFunctionalComponent(__VLS_100, new __VLS_100({
        modelValue: (__VLS_ctx.remark),
        placeholder: "例如：少辣、不加葱",
    }));
    const __VLS_102 = __VLS_101({
        modelValue: (__VLS_ctx.remark),
        placeholder: "例如：少辣、不加葱",
    }, ...__VLS_functionalComponentArgsRest(__VLS_101));
    var __VLS_99;
    var __VLS_83;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "summary" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
    (__VLS_ctx.selectedCount);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
    (__VLS_ctx.totalAmount.toFixed(2));
    const __VLS_104 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_105 = __VLS_asFunctionalComponent(__VLS_104, new __VLS_104({
        ...{ 'onClick': {} },
        type: "primary",
        loading: (__VLS_ctx.submitting),
    }));
    const __VLS_106 = __VLS_105({
        ...{ 'onClick': {} },
        type: "primary",
        loading: (__VLS_ctx.submitting),
    }, ...__VLS_functionalComponentArgsRest(__VLS_105));
    let __VLS_108;
    let __VLS_109;
    let __VLS_110;
    const __VLS_111 = {
        onClick: (__VLS_ctx.submitOrder)
    };
    __VLS_107.slots.default;
    var __VLS_107;
    var __VLS_79;
    var __VLS_75;
    var __VLS_35;
}
if (__VLS_ctx.isUser) {
    const __VLS_112 = {}.ElCard;
    /** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
    // @ts-ignore
    const __VLS_113 = __VLS_asFunctionalComponent(__VLS_112, new __VLS_112({
        ...{ class: "order-card" },
    }));
    const __VLS_114 = __VLS_113({
        ...{ class: "order-card" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_113));
    __VLS_115.slots.default;
    {
        const { header: __VLS_thisSlot } = __VLS_115.slots;
    }
    const __VLS_116 = {}.ElTable;
    /** @type {[typeof __VLS_components.ElTable, typeof __VLS_components.elTable, typeof __VLS_components.ElTable, typeof __VLS_components.elTable, ]} */ ;
    // @ts-ignore
    const __VLS_117 = __VLS_asFunctionalComponent(__VLS_116, new __VLS_116({
        data: (__VLS_ctx.orders),
        size: "small",
    }));
    const __VLS_118 = __VLS_117({
        data: (__VLS_ctx.orders),
        size: "small",
    }, ...__VLS_functionalComponentArgsRest(__VLS_117));
    __VLS_119.slots.default;
    const __VLS_120 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_121 = __VLS_asFunctionalComponent(__VLS_120, new __VLS_120({
        prop: "id",
        label: "订单ID",
        width: "90",
    }));
    const __VLS_122 = __VLS_121({
        prop: "id",
        label: "订单ID",
        width: "90",
    }, ...__VLS_functionalComponentArgsRest(__VLS_121));
    const __VLS_124 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_125 = __VLS_asFunctionalComponent(__VLS_124, new __VLS_124({
        prop: "orderNo",
        label: "订单号",
        minWidth: "160",
    }));
    const __VLS_126 = __VLS_125({
        prop: "orderNo",
        label: "订单号",
        minWidth: "160",
    }, ...__VLS_functionalComponentArgsRest(__VLS_125));
    const __VLS_128 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_129 = __VLS_asFunctionalComponent(__VLS_128, new __VLS_128({
        prop: "totalAmount",
        label: "金额",
        width: "90",
    }));
    const __VLS_130 = __VLS_129({
        prop: "totalAmount",
        label: "金额",
        width: "90",
    }, ...__VLS_functionalComponentArgsRest(__VLS_129));
    __VLS_131.slots.default;
    {
        const { default: __VLS_thisSlot } = __VLS_131.slots;
        const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
        (row.totalAmount);
    }
    var __VLS_131;
    const __VLS_132 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_133 = __VLS_asFunctionalComponent(__VLS_132, new __VLS_132({
        prop: "status",
        label: "状态",
        width: "110",
    }));
    const __VLS_134 = __VLS_133({
        prop: "status",
        label: "状态",
        width: "110",
    }, ...__VLS_functionalComponentArgsRest(__VLS_133));
    __VLS_135.slots.default;
    {
        const { default: __VLS_thisSlot } = __VLS_135.slots;
        const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
        (__VLS_ctx.statusText(row.status));
    }
    var __VLS_135;
    const __VLS_136 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_137 = __VLS_asFunctionalComponent(__VLS_136, new __VLS_136({
        prop: "pickupCode",
        label: "取餐码",
        width: "110",
    }));
    const __VLS_138 = __VLS_137({
        prop: "pickupCode",
        label: "取餐码",
        width: "110",
    }, ...__VLS_functionalComponentArgsRest(__VLS_137));
    const __VLS_140 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_141 = __VLS_asFunctionalComponent(__VLS_140, new __VLS_140({
        prop: "pickupNo",
        label: "叫号码",
        width: "90",
    }));
    const __VLS_142 = __VLS_141({
        prop: "pickupNo",
        label: "叫号码",
        width: "90",
    }, ...__VLS_functionalComponentArgsRest(__VLS_141));
    const __VLS_144 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_145 = __VLS_asFunctionalComponent(__VLS_144, new __VLS_144({
        prop: "createTime",
        label: "创建时间",
        minWidth: "170",
    }));
    const __VLS_146 = __VLS_145({
        prop: "createTime",
        label: "创建时间",
        minWidth: "170",
    }, ...__VLS_functionalComponentArgsRest(__VLS_145));
    var __VLS_119;
    var __VLS_115;
}
else if (__VLS_ctx.isMerchant) {
    const __VLS_148 = {}.ElRow;
    /** @type {[typeof __VLS_components.ElRow, typeof __VLS_components.elRow, typeof __VLS_components.ElRow, typeof __VLS_components.elRow, ]} */ ;
    // @ts-ignore
    const __VLS_149 = __VLS_asFunctionalComponent(__VLS_148, new __VLS_148({
        gutter: (16),
    }));
    const __VLS_150 = __VLS_149({
        gutter: (16),
    }, ...__VLS_functionalComponentArgsRest(__VLS_149));
    __VLS_151.slots.default;
    const __VLS_152 = {}.ElCol;
    /** @type {[typeof __VLS_components.ElCol, typeof __VLS_components.elCol, typeof __VLS_components.ElCol, typeof __VLS_components.elCol, ]} */ ;
    // @ts-ignore
    const __VLS_153 = __VLS_asFunctionalComponent(__VLS_152, new __VLS_152({
        span: (24),
        ...{ class: "block" },
    }));
    const __VLS_154 = __VLS_153({
        span: (24),
        ...{ class: "block" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_153));
    __VLS_155.slots.default;
    const __VLS_156 = {}.ElCard;
    /** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
    // @ts-ignore
    const __VLS_157 = __VLS_asFunctionalComponent(__VLS_156, new __VLS_156({}));
    const __VLS_158 = __VLS_157({}, ...__VLS_functionalComponentArgsRest(__VLS_157));
    __VLS_159.slots.default;
    {
        const { header: __VLS_thisSlot } = __VLS_159.slots;
    }
    const __VLS_160 = {}.ElForm;
    /** @type {[typeof __VLS_components.ElForm, typeof __VLS_components.elForm, typeof __VLS_components.ElForm, typeof __VLS_components.elForm, ]} */ ;
    // @ts-ignore
    const __VLS_161 = __VLS_asFunctionalComponent(__VLS_160, new __VLS_160({
        inline: true,
    }));
    const __VLS_162 = __VLS_161({
        inline: true,
    }, ...__VLS_functionalComponentArgsRest(__VLS_161));
    __VLS_163.slots.default;
    const __VLS_164 = {}.ElFormItem;
    /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
    // @ts-ignore
    const __VLS_165 = __VLS_asFunctionalComponent(__VLS_164, new __VLS_164({
        label: "名称",
    }));
    const __VLS_166 = __VLS_165({
        label: "名称",
    }, ...__VLS_functionalComponentArgsRest(__VLS_165));
    __VLS_167.slots.default;
    const __VLS_168 = {}.ElInput;
    /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
    // @ts-ignore
    const __VLS_169 = __VLS_asFunctionalComponent(__VLS_168, new __VLS_168({
        modelValue: (__VLS_ctx.dishForm.name),
        placeholder: "例如：宫保鸡丁",
    }));
    const __VLS_170 = __VLS_169({
        modelValue: (__VLS_ctx.dishForm.name),
        placeholder: "例如：宫保鸡丁",
    }, ...__VLS_functionalComponentArgsRest(__VLS_169));
    var __VLS_167;
    const __VLS_172 = {}.ElFormItem;
    /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
    // @ts-ignore
    const __VLS_173 = __VLS_asFunctionalComponent(__VLS_172, new __VLS_172({
        label: "价格",
    }));
    const __VLS_174 = __VLS_173({
        label: "价格",
    }, ...__VLS_functionalComponentArgsRest(__VLS_173));
    __VLS_175.slots.default;
    const __VLS_176 = {}.ElInputNumber;
    /** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
    // @ts-ignore
    const __VLS_177 = __VLS_asFunctionalComponent(__VLS_176, new __VLS_176({
        modelValue: (__VLS_ctx.dishForm.price),
        min: (0.01),
        step: (0.5),
    }));
    const __VLS_178 = __VLS_177({
        modelValue: (__VLS_ctx.dishForm.price),
        min: (0.01),
        step: (0.5),
    }, ...__VLS_functionalComponentArgsRest(__VLS_177));
    var __VLS_175;
    const __VLS_180 = {}.ElFormItem;
    /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
    // @ts-ignore
    const __VLS_181 = __VLS_asFunctionalComponent(__VLS_180, new __VLS_180({
        label: "分类",
    }));
    const __VLS_182 = __VLS_181({
        label: "分类",
    }, ...__VLS_functionalComponentArgsRest(__VLS_181));
    __VLS_183.slots.default;
    const __VLS_184 = {}.ElInput;
    /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
    // @ts-ignore
    const __VLS_185 = __VLS_asFunctionalComponent(__VLS_184, new __VLS_184({
        modelValue: (__VLS_ctx.dishForm.category),
        placeholder: "主食/小吃/饮料",
    }));
    const __VLS_186 = __VLS_185({
        modelValue: (__VLS_ctx.dishForm.category),
        placeholder: "主食/小吃/饮料",
    }, ...__VLS_functionalComponentArgsRest(__VLS_185));
    var __VLS_183;
    const __VLS_188 = {}.ElFormItem;
    /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
    // @ts-ignore
    const __VLS_189 = __VLS_asFunctionalComponent(__VLS_188, new __VLS_188({}));
    const __VLS_190 = __VLS_189({}, ...__VLS_functionalComponentArgsRest(__VLS_189));
    __VLS_191.slots.default;
    const __VLS_192 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_193 = __VLS_asFunctionalComponent(__VLS_192, new __VLS_192({
        ...{ 'onClick': {} },
        type: "primary",
        loading: (__VLS_ctx.creatingDish),
    }));
    const __VLS_194 = __VLS_193({
        ...{ 'onClick': {} },
        type: "primary",
        loading: (__VLS_ctx.creatingDish),
    }, ...__VLS_functionalComponentArgsRest(__VLS_193));
    let __VLS_196;
    let __VLS_197;
    let __VLS_198;
    const __VLS_199 = {
        onClick: (__VLS_ctx.saveDish)
    };
    __VLS_195.slots.default;
    (__VLS_ctx.dishForm.id ? "更新菜品" : "新增菜品");
    var __VLS_195;
    if (__VLS_ctx.dishForm.id) {
        const __VLS_200 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        const __VLS_201 = __VLS_asFunctionalComponent(__VLS_200, new __VLS_200({
            ...{ 'onClick': {} },
        }));
        const __VLS_202 = __VLS_201({
            ...{ 'onClick': {} },
        }, ...__VLS_functionalComponentArgsRest(__VLS_201));
        let __VLS_204;
        let __VLS_205;
        let __VLS_206;
        const __VLS_207 = {
            onClick: (__VLS_ctx.resetDishForm)
        };
        __VLS_203.slots.default;
        var __VLS_203;
    }
    var __VLS_191;
    var __VLS_163;
    const __VLS_208 = {}.ElTable;
    /** @type {[typeof __VLS_components.ElTable, typeof __VLS_components.elTable, typeof __VLS_components.ElTable, typeof __VLS_components.elTable, ]} */ ;
    // @ts-ignore
    const __VLS_209 = __VLS_asFunctionalComponent(__VLS_208, new __VLS_208({
        data: (__VLS_ctx.merchantDishes),
        size: "small",
    }));
    const __VLS_210 = __VLS_209({
        data: (__VLS_ctx.merchantDishes),
        size: "small",
    }, ...__VLS_functionalComponentArgsRest(__VLS_209));
    __VLS_211.slots.default;
    const __VLS_212 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_213 = __VLS_asFunctionalComponent(__VLS_212, new __VLS_212({
        prop: "id",
        label: "ID",
        width: "70",
    }));
    const __VLS_214 = __VLS_213({
        prop: "id",
        label: "ID",
        width: "70",
    }, ...__VLS_functionalComponentArgsRest(__VLS_213));
    const __VLS_216 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_217 = __VLS_asFunctionalComponent(__VLS_216, new __VLS_216({
        prop: "name",
        label: "菜品",
        minWidth: "120",
    }));
    const __VLS_218 = __VLS_217({
        prop: "name",
        label: "菜品",
        minWidth: "120",
    }, ...__VLS_functionalComponentArgsRest(__VLS_217));
    const __VLS_220 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_221 = __VLS_asFunctionalComponent(__VLS_220, new __VLS_220({
        prop: "price",
        label: "价格",
        width: "90",
    }));
    const __VLS_222 = __VLS_221({
        prop: "price",
        label: "价格",
        width: "90",
    }, ...__VLS_functionalComponentArgsRest(__VLS_221));
    const __VLS_224 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_225 = __VLS_asFunctionalComponent(__VLS_224, new __VLS_224({
        prop: "category",
        label: "分类",
        width: "90",
    }));
    const __VLS_226 = __VLS_225({
        prop: "category",
        label: "分类",
        width: "90",
    }, ...__VLS_functionalComponentArgsRest(__VLS_225));
    const __VLS_228 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_229 = __VLS_asFunctionalComponent(__VLS_228, new __VLS_228({
        prop: "status",
        label: "状态",
        width: "90",
    }));
    const __VLS_230 = __VLS_229({
        prop: "status",
        label: "状态",
        width: "90",
    }, ...__VLS_functionalComponentArgsRest(__VLS_229));
    __VLS_231.slots.default;
    {
        const { default: __VLS_thisSlot } = __VLS_231.slots;
        const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
        (row.status === 1 ? "上架" : "下架");
    }
    var __VLS_231;
    const __VLS_232 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_233 = __VLS_asFunctionalComponent(__VLS_232, new __VLS_232({
        label: "操作",
        minWidth: "260",
    }));
    const __VLS_234 = __VLS_233({
        label: "操作",
        minWidth: "260",
    }, ...__VLS_functionalComponentArgsRest(__VLS_233));
    __VLS_235.slots.default;
    {
        const { default: __VLS_thisSlot } = __VLS_235.slots;
        const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
        const __VLS_236 = {}.ElSpace;
        /** @type {[typeof __VLS_components.ElSpace, typeof __VLS_components.elSpace, typeof __VLS_components.ElSpace, typeof __VLS_components.elSpace, ]} */ ;
        // @ts-ignore
        const __VLS_237 = __VLS_asFunctionalComponent(__VLS_236, new __VLS_236({
            wrap: true,
        }));
        const __VLS_238 = __VLS_237({
            wrap: true,
        }, ...__VLS_functionalComponentArgsRest(__VLS_237));
        __VLS_239.slots.default;
        const __VLS_240 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        const __VLS_241 = __VLS_asFunctionalComponent(__VLS_240, new __VLS_240({
            ...{ 'onClick': {} },
            size: "small",
        }));
        const __VLS_242 = __VLS_241({
            ...{ 'onClick': {} },
            size: "small",
        }, ...__VLS_functionalComponentArgsRest(__VLS_241));
        let __VLS_244;
        let __VLS_245;
        let __VLS_246;
        const __VLS_247 = {
            onClick: (...[$event]) => {
                if (!!(__VLS_ctx.isUser))
                    return;
                if (!(__VLS_ctx.isMerchant))
                    return;
                __VLS_ctx.editDish(row);
            }
        };
        __VLS_243.slots.default;
        var __VLS_243;
        const __VLS_248 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        const __VLS_249 = __VLS_asFunctionalComponent(__VLS_248, new __VLS_248({
            ...{ 'onClick': {} },
            size: "small",
            type: (row.status === 1 ? 'warning' : 'success'),
        }));
        const __VLS_250 = __VLS_249({
            ...{ 'onClick': {} },
            size: "small",
            type: (row.status === 1 ? 'warning' : 'success'),
        }, ...__VLS_functionalComponentArgsRest(__VLS_249));
        let __VLS_252;
        let __VLS_253;
        let __VLS_254;
        const __VLS_255 = {
            onClick: (...[$event]) => {
                if (!!(__VLS_ctx.isUser))
                    return;
                if (!(__VLS_ctx.isMerchant))
                    return;
                __VLS_ctx.toggleDishStatus(row);
            }
        };
        __VLS_251.slots.default;
        (row.status === 1 ? "下架" : "上架");
        var __VLS_251;
        const __VLS_256 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        const __VLS_257 = __VLS_asFunctionalComponent(__VLS_256, new __VLS_256({
            ...{ 'onClick': {} },
            size: "small",
            type: "danger",
        }));
        const __VLS_258 = __VLS_257({
            ...{ 'onClick': {} },
            size: "small",
            type: "danger",
        }, ...__VLS_functionalComponentArgsRest(__VLS_257));
        let __VLS_260;
        let __VLS_261;
        let __VLS_262;
        const __VLS_263 = {
            onClick: (...[$event]) => {
                if (!!(__VLS_ctx.isUser))
                    return;
                if (!(__VLS_ctx.isMerchant))
                    return;
                __VLS_ctx.removeDish(row.id);
            }
        };
        __VLS_259.slots.default;
        var __VLS_259;
        var __VLS_239;
    }
    var __VLS_235;
    var __VLS_211;
    var __VLS_159;
    var __VLS_155;
    const __VLS_264 = {}.ElCol;
    /** @type {[typeof __VLS_components.ElCol, typeof __VLS_components.elCol, typeof __VLS_components.ElCol, typeof __VLS_components.elCol, ]} */ ;
    // @ts-ignore
    const __VLS_265 = __VLS_asFunctionalComponent(__VLS_264, new __VLS_264({
        span: (24),
        ...{ class: "block" },
    }));
    const __VLS_266 = __VLS_265({
        span: (24),
        ...{ class: "block" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_265));
    __VLS_267.slots.default;
    const __VLS_268 = {}.ElCard;
    /** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
    // @ts-ignore
    const __VLS_269 = __VLS_asFunctionalComponent(__VLS_268, new __VLS_268({}));
    const __VLS_270 = __VLS_269({}, ...__VLS_functionalComponentArgsRest(__VLS_269));
    __VLS_271.slots.default;
    {
        const { header: __VLS_thisSlot } = __VLS_271.slots;
    }
    const __VLS_272 = {}.ElForm;
    /** @type {[typeof __VLS_components.ElForm, typeof __VLS_components.elForm, typeof __VLS_components.ElForm, typeof __VLS_components.elForm, ]} */ ;
    // @ts-ignore
    const __VLS_273 = __VLS_asFunctionalComponent(__VLS_272, new __VLS_272({
        inline: true,
    }));
    const __VLS_274 = __VLS_273({
        inline: true,
    }, ...__VLS_functionalComponentArgsRest(__VLS_273));
    __VLS_275.slots.default;
    const __VLS_276 = {}.ElFormItem;
    /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
    // @ts-ignore
    const __VLS_277 = __VLS_asFunctionalComponent(__VLS_276, new __VLS_276({
        label: "菜单名称",
    }));
    const __VLS_278 = __VLS_277({
        label: "菜单名称",
    }, ...__VLS_functionalComponentArgsRest(__VLS_277));
    __VLS_279.slots.default;
    const __VLS_280 = {}.ElInput;
    /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
    // @ts-ignore
    const __VLS_281 = __VLS_asFunctionalComponent(__VLS_280, new __VLS_280({
        modelValue: (__VLS_ctx.menuForm.name),
    }));
    const __VLS_282 = __VLS_281({
        modelValue: (__VLS_ctx.menuForm.name),
    }, ...__VLS_functionalComponentArgsRest(__VLS_281));
    var __VLS_279;
    const __VLS_284 = {}.ElFormItem;
    /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
    // @ts-ignore
    const __VLS_285 = __VLS_asFunctionalComponent(__VLS_284, new __VLS_284({
        label: "日期",
    }));
    const __VLS_286 = __VLS_285({
        label: "日期",
    }, ...__VLS_functionalComponentArgsRest(__VLS_285));
    __VLS_287.slots.default;
    const __VLS_288 = {}.ElDatePicker;
    /** @type {[typeof __VLS_components.ElDatePicker, typeof __VLS_components.elDatePicker, ]} */ ;
    // @ts-ignore
    const __VLS_289 = __VLS_asFunctionalComponent(__VLS_288, new __VLS_288({
        modelValue: (__VLS_ctx.menuForm.saleDate),
        type: "date",
        valueFormat: "YYYY-MM-DD",
    }));
    const __VLS_290 = __VLS_289({
        modelValue: (__VLS_ctx.menuForm.saleDate),
        type: "date",
        valueFormat: "YYYY-MM-DD",
    }, ...__VLS_functionalComponentArgsRest(__VLS_289));
    var __VLS_287;
    const __VLS_292 = {}.ElFormItem;
    /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
    // @ts-ignore
    const __VLS_293 = __VLS_asFunctionalComponent(__VLS_292, new __VLS_292({
        label: "开始",
    }));
    const __VLS_294 = __VLS_293({
        label: "开始",
    }, ...__VLS_functionalComponentArgsRest(__VLS_293));
    __VLS_295.slots.default;
    const __VLS_296 = {}.ElTimePicker;
    /** @type {[typeof __VLS_components.ElTimePicker, typeof __VLS_components.elTimePicker, ]} */ ;
    // @ts-ignore
    const __VLS_297 = __VLS_asFunctionalComponent(__VLS_296, new __VLS_296({
        modelValue: (__VLS_ctx.menuForm.startTime),
        valueFormat: "HH:mm:ss",
    }));
    const __VLS_298 = __VLS_297({
        modelValue: (__VLS_ctx.menuForm.startTime),
        valueFormat: "HH:mm:ss",
    }, ...__VLS_functionalComponentArgsRest(__VLS_297));
    var __VLS_295;
    const __VLS_300 = {}.ElFormItem;
    /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
    // @ts-ignore
    const __VLS_301 = __VLS_asFunctionalComponent(__VLS_300, new __VLS_300({
        label: "结束",
    }));
    const __VLS_302 = __VLS_301({
        label: "结束",
    }, ...__VLS_functionalComponentArgsRest(__VLS_301));
    __VLS_303.slots.default;
    const __VLS_304 = {}.ElTimePicker;
    /** @type {[typeof __VLS_components.ElTimePicker, typeof __VLS_components.elTimePicker, ]} */ ;
    // @ts-ignore
    const __VLS_305 = __VLS_asFunctionalComponent(__VLS_304, new __VLS_304({
        modelValue: (__VLS_ctx.menuForm.endTime),
        valueFormat: "HH:mm:ss",
    }));
    const __VLS_306 = __VLS_305({
        modelValue: (__VLS_ctx.menuForm.endTime),
        valueFormat: "HH:mm:ss",
    }, ...__VLS_functionalComponentArgsRest(__VLS_305));
    var __VLS_303;
    var __VLS_275;
    const __VLS_308 = {}.ElTable;
    /** @type {[typeof __VLS_components.ElTable, typeof __VLS_components.elTable, typeof __VLS_components.ElTable, typeof __VLS_components.elTable, ]} */ ;
    // @ts-ignore
    const __VLS_309 = __VLS_asFunctionalComponent(__VLS_308, new __VLS_308({
        data: (__VLS_ctx.merchantDishes),
        size: "small",
    }));
    const __VLS_310 = __VLS_309({
        data: (__VLS_ctx.merchantDishes),
        size: "small",
    }, ...__VLS_functionalComponentArgsRest(__VLS_309));
    __VLS_311.slots.default;
    const __VLS_312 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_313 = __VLS_asFunctionalComponent(__VLS_312, new __VLS_312({
        prop: "name",
        label: "菜品",
        minWidth: "120",
    }));
    const __VLS_314 = __VLS_313({
        prop: "name",
        label: "菜品",
        minWidth: "120",
    }, ...__VLS_functionalComponentArgsRest(__VLS_313));
    const __VLS_316 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_317 = __VLS_asFunctionalComponent(__VLS_316, new __VLS_316({
        label: "售价",
        width: "130",
    }));
    const __VLS_318 = __VLS_317({
        label: "售价",
        width: "130",
    }, ...__VLS_functionalComponentArgsRest(__VLS_317));
    __VLS_319.slots.default;
    {
        const { default: __VLS_thisSlot } = __VLS_319.slots;
        const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
        const __VLS_320 = {}.ElInputNumber;
        /** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
        // @ts-ignore
        const __VLS_321 = __VLS_asFunctionalComponent(__VLS_320, new __VLS_320({
            modelValue: (__VLS_ctx.menuItemMap[row.id].salePrice),
            min: (0.01),
            step: (0.5),
            size: "small",
        }));
        const __VLS_322 = __VLS_321({
            modelValue: (__VLS_ctx.menuItemMap[row.id].salePrice),
            min: (0.01),
            step: (0.5),
            size: "small",
        }, ...__VLS_functionalComponentArgsRest(__VLS_321));
    }
    var __VLS_319;
    const __VLS_324 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_325 = __VLS_asFunctionalComponent(__VLS_324, new __VLS_324({
        label: "库存",
        width: "120",
    }));
    const __VLS_326 = __VLS_325({
        label: "库存",
        width: "120",
    }, ...__VLS_functionalComponentArgsRest(__VLS_325));
    __VLS_327.slots.default;
    {
        const { default: __VLS_thisSlot } = __VLS_327.slots;
        const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
        const __VLS_328 = {}.ElInputNumber;
        /** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
        // @ts-ignore
        const __VLS_329 = __VLS_asFunctionalComponent(__VLS_328, new __VLS_328({
            modelValue: (__VLS_ctx.menuItemMap[row.id].stock),
            min: (0),
            step: (10),
            size: "small",
        }));
        const __VLS_330 = __VLS_329({
            modelValue: (__VLS_ctx.menuItemMap[row.id].stock),
            min: (0),
            step: (10),
            size: "small",
        }, ...__VLS_functionalComponentArgsRest(__VLS_329));
    }
    var __VLS_327;
    const __VLS_332 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_333 = __VLS_asFunctionalComponent(__VLS_332, new __VLS_332({
        label: "入选",
        width: "100",
    }));
    const __VLS_334 = __VLS_333({
        label: "入选",
        width: "100",
    }, ...__VLS_functionalComponentArgsRest(__VLS_333));
    __VLS_335.slots.default;
    {
        const { default: __VLS_thisSlot } = __VLS_335.slots;
        const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
        const __VLS_336 = {}.ElSwitch;
        /** @type {[typeof __VLS_components.ElSwitch, typeof __VLS_components.elSwitch, ]} */ ;
        // @ts-ignore
        const __VLS_337 = __VLS_asFunctionalComponent(__VLS_336, new __VLS_336({
            modelValue: (__VLS_ctx.menuItemMap[row.id].enabled),
        }));
        const __VLS_338 = __VLS_337({
            modelValue: (__VLS_ctx.menuItemMap[row.id].enabled),
        }, ...__VLS_functionalComponentArgsRest(__VLS_337));
    }
    var __VLS_335;
    var __VLS_311;
    const __VLS_340 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_341 = __VLS_asFunctionalComponent(__VLS_340, new __VLS_340({
        ...{ 'onClick': {} },
        ...{ class: "publish-btn" },
        type: "primary",
        loading: (__VLS_ctx.publishingMenu),
    }));
    const __VLS_342 = __VLS_341({
        ...{ 'onClick': {} },
        ...{ class: "publish-btn" },
        type: "primary",
        loading: (__VLS_ctx.publishingMenu),
    }, ...__VLS_functionalComponentArgsRest(__VLS_341));
    let __VLS_344;
    let __VLS_345;
    let __VLS_346;
    const __VLS_347 = {
        onClick: (__VLS_ctx.publishMenu)
    };
    __VLS_343.slots.default;
    var __VLS_343;
    var __VLS_271;
    var __VLS_267;
    const __VLS_348 = {}.ElCol;
    /** @type {[typeof __VLS_components.ElCol, typeof __VLS_components.elCol, typeof __VLS_components.ElCol, typeof __VLS_components.elCol, ]} */ ;
    // @ts-ignore
    const __VLS_349 = __VLS_asFunctionalComponent(__VLS_348, new __VLS_348({
        span: (16),
    }));
    const __VLS_350 = __VLS_349({
        span: (16),
    }, ...__VLS_functionalComponentArgsRest(__VLS_349));
    __VLS_351.slots.default;
    const __VLS_352 = {}.ElCard;
    /** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
    // @ts-ignore
    const __VLS_353 = __VLS_asFunctionalComponent(__VLS_352, new __VLS_352({}));
    const __VLS_354 = __VLS_353({}, ...__VLS_functionalComponentArgsRest(__VLS_353));
    __VLS_355.slots.default;
    {
        const { header: __VLS_thisSlot } = __VLS_355.slots;
    }
    const __VLS_356 = {}.ElTable;
    /** @type {[typeof __VLS_components.ElTable, typeof __VLS_components.elTable, typeof __VLS_components.ElTable, typeof __VLS_components.elTable, ]} */ ;
    // @ts-ignore
    const __VLS_357 = __VLS_asFunctionalComponent(__VLS_356, new __VLS_356({
        data: (__VLS_ctx.merchantOrders),
        size: "small",
    }));
    const __VLS_358 = __VLS_357({
        data: (__VLS_ctx.merchantOrders),
        size: "small",
    }, ...__VLS_functionalComponentArgsRest(__VLS_357));
    __VLS_359.slots.default;
    const __VLS_360 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_361 = __VLS_asFunctionalComponent(__VLS_360, new __VLS_360({
        prop: "id",
        label: "订单ID",
        width: "90",
    }));
    const __VLS_362 = __VLS_361({
        prop: "id",
        label: "订单ID",
        width: "90",
    }, ...__VLS_functionalComponentArgsRest(__VLS_361));
    const __VLS_364 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_365 = __VLS_asFunctionalComponent(__VLS_364, new __VLS_364({
        prop: "orderNo",
        label: "订单号",
        minWidth: "160",
    }));
    const __VLS_366 = __VLS_365({
        prop: "orderNo",
        label: "订单号",
        minWidth: "160",
    }, ...__VLS_functionalComponentArgsRest(__VLS_365));
    const __VLS_368 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_369 = __VLS_asFunctionalComponent(__VLS_368, new __VLS_368({
        prop: "windowId",
        label: "窗口ID",
        width: "90",
    }));
    const __VLS_370 = __VLS_369({
        prop: "windowId",
        label: "窗口ID",
        width: "90",
    }, ...__VLS_functionalComponentArgsRest(__VLS_369));
    const __VLS_372 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_373 = __VLS_asFunctionalComponent(__VLS_372, new __VLS_372({
        prop: "status",
        label: "状态",
        width: "100",
    }));
    const __VLS_374 = __VLS_373({
        prop: "status",
        label: "状态",
        width: "100",
    }, ...__VLS_functionalComponentArgsRest(__VLS_373));
    __VLS_375.slots.default;
    {
        const { default: __VLS_thisSlot } = __VLS_375.slots;
        const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
        (__VLS_ctx.statusText(row.status));
    }
    var __VLS_375;
    const __VLS_376 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_377 = __VLS_asFunctionalComponent(__VLS_376, new __VLS_376({
        prop: "pickupCode",
        label: "取餐码",
        width: "110",
    }));
    const __VLS_378 = __VLS_377({
        prop: "pickupCode",
        label: "取餐码",
        width: "110",
    }, ...__VLS_functionalComponentArgsRest(__VLS_377));
    const __VLS_380 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_381 = __VLS_asFunctionalComponent(__VLS_380, new __VLS_380({
        label: "操作",
        minWidth: "240",
    }));
    const __VLS_382 = __VLS_381({
        label: "操作",
        minWidth: "240",
    }, ...__VLS_functionalComponentArgsRest(__VLS_381));
    __VLS_383.slots.default;
    {
        const { default: __VLS_thisSlot } = __VLS_383.slots;
        const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
        const __VLS_384 = {}.ElSpace;
        /** @type {[typeof __VLS_components.ElSpace, typeof __VLS_components.elSpace, typeof __VLS_components.ElSpace, typeof __VLS_components.elSpace, ]} */ ;
        // @ts-ignore
        const __VLS_385 = __VLS_asFunctionalComponent(__VLS_384, new __VLS_384({
            wrap: true,
        }));
        const __VLS_386 = __VLS_385({
            wrap: true,
        }, ...__VLS_functionalComponentArgsRest(__VLS_385));
        __VLS_387.slots.default;
        const __VLS_388 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        const __VLS_389 = __VLS_asFunctionalComponent(__VLS_388, new __VLS_388({
            ...{ 'onClick': {} },
            size: "small",
            disabled: (row.status !== 0),
        }));
        const __VLS_390 = __VLS_389({
            ...{ 'onClick': {} },
            size: "small",
            disabled: (row.status !== 0),
        }, ...__VLS_functionalComponentArgsRest(__VLS_389));
        let __VLS_392;
        let __VLS_393;
        let __VLS_394;
        const __VLS_395 = {
            onClick: (...[$event]) => {
                if (!!(__VLS_ctx.isUser))
                    return;
                if (!(__VLS_ctx.isMerchant))
                    return;
                __VLS_ctx.changeStatus(row.id, 'accept');
            }
        };
        __VLS_391.slots.default;
        var __VLS_391;
        const __VLS_396 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        const __VLS_397 = __VLS_asFunctionalComponent(__VLS_396, new __VLS_396({
            ...{ 'onClick': {} },
            size: "small",
            disabled: (row.status !== 1),
        }));
        const __VLS_398 = __VLS_397({
            ...{ 'onClick': {} },
            size: "small",
            disabled: (row.status !== 1),
        }, ...__VLS_functionalComponentArgsRest(__VLS_397));
        let __VLS_400;
        let __VLS_401;
        let __VLS_402;
        const __VLS_403 = {
            onClick: (...[$event]) => {
                if (!!(__VLS_ctx.isUser))
                    return;
                if (!(__VLS_ctx.isMerchant))
                    return;
                __VLS_ctx.changeStatus(row.id, 'cook');
            }
        };
        __VLS_399.slots.default;
        var __VLS_399;
        const __VLS_404 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        const __VLS_405 = __VLS_asFunctionalComponent(__VLS_404, new __VLS_404({
            ...{ 'onClick': {} },
            size: "small",
            type: "success",
            disabled: (row.status !== 2),
        }));
        const __VLS_406 = __VLS_405({
            ...{ 'onClick': {} },
            size: "small",
            type: "success",
            disabled: (row.status !== 2),
        }, ...__VLS_functionalComponentArgsRest(__VLS_405));
        let __VLS_408;
        let __VLS_409;
        let __VLS_410;
        const __VLS_411 = {
            onClick: (...[$event]) => {
                if (!!(__VLS_ctx.isUser))
                    return;
                if (!(__VLS_ctx.isMerchant))
                    return;
                __VLS_ctx.changeStatus(row.id, 'ready');
            }
        };
        __VLS_407.slots.default;
        var __VLS_407;
        var __VLS_387;
    }
    var __VLS_383;
    var __VLS_359;
    var __VLS_355;
    var __VLS_351;
    const __VLS_412 = {}.ElCol;
    /** @type {[typeof __VLS_components.ElCol, typeof __VLS_components.elCol, typeof __VLS_components.ElCol, typeof __VLS_components.elCol, ]} */ ;
    // @ts-ignore
    const __VLS_413 = __VLS_asFunctionalComponent(__VLS_412, new __VLS_412({
        span: (8),
    }));
    const __VLS_414 = __VLS_413({
        span: (8),
    }, ...__VLS_functionalComponentArgsRest(__VLS_413));
    __VLS_415.slots.default;
    const __VLS_416 = {}.ElCard;
    /** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
    // @ts-ignore
    const __VLS_417 = __VLS_asFunctionalComponent(__VLS_416, new __VLS_416({}));
    const __VLS_418 = __VLS_417({}, ...__VLS_functionalComponentArgsRest(__VLS_417));
    __VLS_419.slots.default;
    {
        const { header: __VLS_thisSlot } = __VLS_419.slots;
    }
    const __VLS_420 = {}.ElForm;
    /** @type {[typeof __VLS_components.ElForm, typeof __VLS_components.elForm, typeof __VLS_components.ElForm, typeof __VLS_components.elForm, ]} */ ;
    // @ts-ignore
    const __VLS_421 = __VLS_asFunctionalComponent(__VLS_420, new __VLS_420({
        labelWidth: "80px",
    }));
    const __VLS_422 = __VLS_421({
        labelWidth: "80px",
    }, ...__VLS_functionalComponentArgsRest(__VLS_421));
    __VLS_423.slots.default;
    const __VLS_424 = {}.ElFormItem;
    /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
    // @ts-ignore
    const __VLS_425 = __VLS_asFunctionalComponent(__VLS_424, new __VLS_424({
        label: "窗口",
    }));
    const __VLS_426 = __VLS_425({
        label: "窗口",
    }, ...__VLS_functionalComponentArgsRest(__VLS_425));
    __VLS_427.slots.default;
    const __VLS_428 = {}.ElSelect;
    /** @type {[typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, ]} */ ;
    // @ts-ignore
    const __VLS_429 = __VLS_asFunctionalComponent(__VLS_428, new __VLS_428({
        modelValue: (__VLS_ctx.selectedWindowId),
        placeholder: "请选择窗口",
        ...{ style: {} },
    }));
    const __VLS_430 = __VLS_429({
        modelValue: (__VLS_ctx.selectedWindowId),
        placeholder: "请选择窗口",
        ...{ style: {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_429));
    __VLS_431.slots.default;
    for (const [w] of __VLS_getVForSourceType((__VLS_ctx.windows))) {
        const __VLS_432 = {}.ElOption;
        /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
        // @ts-ignore
        const __VLS_433 = __VLS_asFunctionalComponent(__VLS_432, new __VLS_432({
            key: (w.id),
            label: (`${w.name} (${w.location})`),
            value: (w.id),
        }));
        const __VLS_434 = __VLS_433({
            key: (w.id),
            label: (`${w.name} (${w.location})`),
            value: (w.id),
        }, ...__VLS_functionalComponentArgsRest(__VLS_433));
    }
    var __VLS_431;
    var __VLS_427;
    var __VLS_423;
    const __VLS_436 = {}.ElSpace;
    /** @type {[typeof __VLS_components.ElSpace, typeof __VLS_components.elSpace, typeof __VLS_components.ElSpace, typeof __VLS_components.elSpace, ]} */ ;
    // @ts-ignore
    const __VLS_437 = __VLS_asFunctionalComponent(__VLS_436, new __VLS_436({
        wrap: true,
    }));
    const __VLS_438 = __VLS_437({
        wrap: true,
    }, ...__VLS_functionalComponentArgsRest(__VLS_437));
    __VLS_439.slots.default;
    const __VLS_440 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_441 = __VLS_asFunctionalComponent(__VLS_440, new __VLS_440({
        ...{ 'onClick': {} },
        type: "primary",
    }));
    const __VLS_442 = __VLS_441({
        ...{ 'onClick': {} },
        type: "primary",
    }, ...__VLS_functionalComponentArgsRest(__VLS_441));
    let __VLS_444;
    let __VLS_445;
    let __VLS_446;
    const __VLS_447 = {
        onClick: (__VLS_ctx.callNext)
    };
    __VLS_443.slots.default;
    var __VLS_443;
    const __VLS_448 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_449 = __VLS_asFunctionalComponent(__VLS_448, new __VLS_448({
        ...{ 'onClick': {} },
    }));
    const __VLS_450 = __VLS_449({
        ...{ 'onClick': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_449));
    let __VLS_452;
    let __VLS_453;
    let __VLS_454;
    const __VLS_455 = {
        onClick: (__VLS_ctx.loadQueue)
    };
    __VLS_451.slots.default;
    var __VLS_451;
    var __VLS_439;
    const __VLS_456 = {}.ElDivider;
    /** @type {[typeof __VLS_components.ElDivider, typeof __VLS_components.elDivider, ]} */ ;
    // @ts-ignore
    const __VLS_457 = __VLS_asFunctionalComponent(__VLS_456, new __VLS_456({}));
    const __VLS_458 = __VLS_457({}, ...__VLS_functionalComponentArgsRest(__VLS_457));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    (__VLS_ctx.queueList.length);
    for (const [item] of __VLS_getVForSourceType((__VLS_ctx.queueList))) {
        const __VLS_460 = {}.ElTag;
        /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
        // @ts-ignore
        const __VLS_461 = __VLS_asFunctionalComponent(__VLS_460, new __VLS_460({
            key: (item),
            ...{ class: "queue-tag" },
        }));
        const __VLS_462 = __VLS_461({
            key: (item),
            ...{ class: "queue-tag" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_461));
        __VLS_463.slots.default;
        (item);
        var __VLS_463;
    }
    const __VLS_464 = {}.ElDivider;
    /** @type {[typeof __VLS_components.ElDivider, typeof __VLS_components.elDivider, ]} */ ;
    // @ts-ignore
    const __VLS_465 = __VLS_asFunctionalComponent(__VLS_464, new __VLS_464({}));
    const __VLS_466 = __VLS_465({}, ...__VLS_functionalComponentArgsRest(__VLS_465));
    const __VLS_468 = {}.ElInput;
    /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
    // @ts-ignore
    const __VLS_469 = __VLS_asFunctionalComponent(__VLS_468, new __VLS_468({
        modelValue: (__VLS_ctx.verifyCode),
        placeholder: "输入取餐码，例如 408765",
    }));
    const __VLS_470 = __VLS_469({
        modelValue: (__VLS_ctx.verifyCode),
        placeholder: "输入取餐码，例如 408765",
    }, ...__VLS_functionalComponentArgsRest(__VLS_469));
    const __VLS_472 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_473 = __VLS_asFunctionalComponent(__VLS_472, new __VLS_472({
        ...{ 'onClick': {} },
        ...{ class: "verify-btn" },
        type: "success",
    }));
    const __VLS_474 = __VLS_473({
        ...{ 'onClick': {} },
        ...{ class: "verify-btn" },
        type: "success",
    }, ...__VLS_functionalComponentArgsRest(__VLS_473));
    let __VLS_476;
    let __VLS_477;
    let __VLS_478;
    const __VLS_479 = {
        onClick: (__VLS_ctx.verifyPickup)
    };
    __VLS_475.slots.default;
    var __VLS_475;
    var __VLS_419;
    var __VLS_415;
    var __VLS_151;
}
else {
    const __VLS_480 = {}.ElRow;
    /** @type {[typeof __VLS_components.ElRow, typeof __VLS_components.elRow, typeof __VLS_components.ElRow, typeof __VLS_components.elRow, ]} */ ;
    // @ts-ignore
    const __VLS_481 = __VLS_asFunctionalComponent(__VLS_480, new __VLS_480({
        gutter: (16),
    }));
    const __VLS_482 = __VLS_481({
        gutter: (16),
    }, ...__VLS_functionalComponentArgsRest(__VLS_481));
    __VLS_483.slots.default;
    const __VLS_484 = {}.ElCol;
    /** @type {[typeof __VLS_components.ElCol, typeof __VLS_components.elCol, typeof __VLS_components.ElCol, typeof __VLS_components.elCol, ]} */ ;
    // @ts-ignore
    const __VLS_485 = __VLS_asFunctionalComponent(__VLS_484, new __VLS_484({
        span: (10),
    }));
    const __VLS_486 = __VLS_485({
        span: (10),
    }, ...__VLS_functionalComponentArgsRest(__VLS_485));
    __VLS_487.slots.default;
    const __VLS_488 = {}.ElCard;
    /** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
    // @ts-ignore
    const __VLS_489 = __VLS_asFunctionalComponent(__VLS_488, new __VLS_488({}));
    const __VLS_490 = __VLS_489({}, ...__VLS_functionalComponentArgsRest(__VLS_489));
    __VLS_491.slots.default;
    {
        const { header: __VLS_thisSlot } = __VLS_491.slots;
    }
    const __VLS_492 = {}.ElForm;
    /** @type {[typeof __VLS_components.ElForm, typeof __VLS_components.elForm, typeof __VLS_components.ElForm, typeof __VLS_components.elForm, ]} */ ;
    // @ts-ignore
    const __VLS_493 = __VLS_asFunctionalComponent(__VLS_492, new __VLS_492({
        labelWidth: "95px",
    }));
    const __VLS_494 = __VLS_493({
        labelWidth: "95px",
    }, ...__VLS_functionalComponentArgsRest(__VLS_493));
    __VLS_495.slots.default;
    const __VLS_496 = {}.ElFormItem;
    /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
    // @ts-ignore
    const __VLS_497 = __VLS_asFunctionalComponent(__VLS_496, new __VLS_496({
        label: "窗口名称",
    }));
    const __VLS_498 = __VLS_497({
        label: "窗口名称",
    }, ...__VLS_functionalComponentArgsRest(__VLS_497));
    __VLS_499.slots.default;
    const __VLS_500 = {}.ElInput;
    /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
    // @ts-ignore
    const __VLS_501 = __VLS_asFunctionalComponent(__VLS_500, new __VLS_500({
        modelValue: (__VLS_ctx.windowForm.name),
        placeholder: "例如：1号档口-盖浇饭",
    }));
    const __VLS_502 = __VLS_501({
        modelValue: (__VLS_ctx.windowForm.name),
        placeholder: "例如：1号档口-盖浇饭",
    }, ...__VLS_functionalComponentArgsRest(__VLS_501));
    var __VLS_499;
    const __VLS_504 = {}.ElFormItem;
    /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
    // @ts-ignore
    const __VLS_505 = __VLS_asFunctionalComponent(__VLS_504, new __VLS_504({
        label: "位置",
    }));
    const __VLS_506 = __VLS_505({
        label: "位置",
    }, ...__VLS_functionalComponentArgsRest(__VLS_505));
    __VLS_507.slots.default;
    const __VLS_508 = {}.ElInput;
    /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
    // @ts-ignore
    const __VLS_509 = __VLS_asFunctionalComponent(__VLS_508, new __VLS_508({
        modelValue: (__VLS_ctx.windowForm.location),
        placeholder: "例如：食堂一楼东侧",
    }));
    const __VLS_510 = __VLS_509({
        modelValue: (__VLS_ctx.windowForm.location),
        placeholder: "例如：食堂一楼东侧",
    }, ...__VLS_functionalComponentArgsRest(__VLS_509));
    var __VLS_507;
    const __VLS_512 = {}.ElFormItem;
    /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
    // @ts-ignore
    const __VLS_513 = __VLS_asFunctionalComponent(__VLS_512, new __VLS_512({
        label: "商家账号",
    }));
    const __VLS_514 = __VLS_513({
        label: "商家账号",
    }, ...__VLS_functionalComponentArgsRest(__VLS_513));
    __VLS_515.slots.default;
    const __VLS_516 = {}.ElSelect;
    /** @type {[typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, ]} */ ;
    // @ts-ignore
    const __VLS_517 = __VLS_asFunctionalComponent(__VLS_516, new __VLS_516({
        modelValue: (__VLS_ctx.windowForm.merchantId),
        placeholder: "请选择商家",
        ...{ style: {} },
    }));
    const __VLS_518 = __VLS_517({
        modelValue: (__VLS_ctx.windowForm.merchantId),
        placeholder: "请选择商家",
        ...{ style: {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_517));
    __VLS_519.slots.default;
    for (const [m] of __VLS_getVForSourceType((__VLS_ctx.merchantUsers))) {
        const __VLS_520 = {}.ElOption;
        /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
        // @ts-ignore
        const __VLS_521 = __VLS_asFunctionalComponent(__VLS_520, new __VLS_520({
            key: (m.id),
            label: (`${m.nickname} (${m.phone})`),
            value: (m.id),
        }));
        const __VLS_522 = __VLS_521({
            key: (m.id),
            label: (`${m.nickname} (${m.phone})`),
            value: (m.id),
        }, ...__VLS_functionalComponentArgsRest(__VLS_521));
    }
    var __VLS_519;
    var __VLS_515;
    const __VLS_524 = {}.ElFormItem;
    /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
    // @ts-ignore
    const __VLS_525 = __VLS_asFunctionalComponent(__VLS_524, new __VLS_524({
        label: "叫号前缀",
    }));
    const __VLS_526 = __VLS_525({
        label: "叫号前缀",
    }, ...__VLS_functionalComponentArgsRest(__VLS_525));
    __VLS_527.slots.default;
    const __VLS_528 = {}.ElInput;
    /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
    // @ts-ignore
    const __VLS_529 = __VLS_asFunctionalComponent(__VLS_528, new __VLS_528({
        modelValue: (__VLS_ctx.windowForm.pickupPrefix),
        maxlength: "2",
        placeholder: "例如：A",
    }));
    const __VLS_530 = __VLS_529({
        modelValue: (__VLS_ctx.windowForm.pickupPrefix),
        maxlength: "2",
        placeholder: "例如：A",
    }, ...__VLS_functionalComponentArgsRest(__VLS_529));
    var __VLS_527;
    const __VLS_532 = {}.ElFormItem;
    /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
    // @ts-ignore
    const __VLS_533 = __VLS_asFunctionalComponent(__VLS_532, new __VLS_532({}));
    const __VLS_534 = __VLS_533({}, ...__VLS_functionalComponentArgsRest(__VLS_533));
    __VLS_535.slots.default;
    const __VLS_536 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_537 = __VLS_asFunctionalComponent(__VLS_536, new __VLS_536({
        ...{ 'onClick': {} },
        type: "primary",
        loading: (__VLS_ctx.creatingWindow),
    }));
    const __VLS_538 = __VLS_537({
        ...{ 'onClick': {} },
        type: "primary",
        loading: (__VLS_ctx.creatingWindow),
    }, ...__VLS_functionalComponentArgsRest(__VLS_537));
    let __VLS_540;
    let __VLS_541;
    let __VLS_542;
    const __VLS_543 = {
        onClick: (__VLS_ctx.createWindow)
    };
    __VLS_539.slots.default;
    var __VLS_539;
    var __VLS_535;
    var __VLS_495;
    var __VLS_491;
    var __VLS_487;
    const __VLS_544 = {}.ElCol;
    /** @type {[typeof __VLS_components.ElCol, typeof __VLS_components.elCol, typeof __VLS_components.ElCol, typeof __VLS_components.elCol, ]} */ ;
    // @ts-ignore
    const __VLS_545 = __VLS_asFunctionalComponent(__VLS_544, new __VLS_544({
        span: (14),
    }));
    const __VLS_546 = __VLS_545({
        span: (14),
    }, ...__VLS_functionalComponentArgsRest(__VLS_545));
    __VLS_547.slots.default;
    const __VLS_548 = {}.ElCard;
    /** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
    // @ts-ignore
    const __VLS_549 = __VLS_asFunctionalComponent(__VLS_548, new __VLS_548({
        ...{ class: "order-card" },
    }));
    const __VLS_550 = __VLS_549({
        ...{ class: "order-card" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_549));
    __VLS_551.slots.default;
    {
        const { header: __VLS_thisSlot } = __VLS_551.slots;
    }
    const __VLS_552 = {}.ElTable;
    /** @type {[typeof __VLS_components.ElTable, typeof __VLS_components.elTable, typeof __VLS_components.ElTable, typeof __VLS_components.elTable, ]} */ ;
    // @ts-ignore
    const __VLS_553 = __VLS_asFunctionalComponent(__VLS_552, new __VLS_552({
        data: (__VLS_ctx.windows),
        size: "small",
    }));
    const __VLS_554 = __VLS_553({
        data: (__VLS_ctx.windows),
        size: "small",
    }, ...__VLS_functionalComponentArgsRest(__VLS_553));
    __VLS_555.slots.default;
    const __VLS_556 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_557 = __VLS_asFunctionalComponent(__VLS_556, new __VLS_556({
        prop: "id",
        label: "ID",
        width: "70",
    }));
    const __VLS_558 = __VLS_557({
        prop: "id",
        label: "ID",
        width: "70",
    }, ...__VLS_functionalComponentArgsRest(__VLS_557));
    const __VLS_560 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_561 = __VLS_asFunctionalComponent(__VLS_560, new __VLS_560({
        prop: "name",
        label: "窗口名称",
        minWidth: "120",
    }));
    const __VLS_562 = __VLS_561({
        prop: "name",
        label: "窗口名称",
        minWidth: "120",
    }, ...__VLS_functionalComponentArgsRest(__VLS_561));
    const __VLS_564 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_565 = __VLS_asFunctionalComponent(__VLS_564, new __VLS_564({
        prop: "location",
        label: "位置",
        minWidth: "140",
    }));
    const __VLS_566 = __VLS_565({
        prop: "location",
        label: "位置",
        minWidth: "140",
    }, ...__VLS_functionalComponentArgsRest(__VLS_565));
    const __VLS_568 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_569 = __VLS_asFunctionalComponent(__VLS_568, new __VLS_568({
        prop: "merchantId",
        label: "商家ID",
        width: "90",
    }));
    const __VLS_570 = __VLS_569({
        prop: "merchantId",
        label: "商家ID",
        width: "90",
    }, ...__VLS_functionalComponentArgsRest(__VLS_569));
    const __VLS_572 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_573 = __VLS_asFunctionalComponent(__VLS_572, new __VLS_572({
        prop: "pickupPrefix",
        label: "前缀",
        width: "80",
    }));
    const __VLS_574 = __VLS_573({
        prop: "pickupPrefix",
        label: "前缀",
        width: "80",
    }, ...__VLS_functionalComponentArgsRest(__VLS_573));
    const __VLS_576 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_577 = __VLS_asFunctionalComponent(__VLS_576, new __VLS_576({
        prop: "status",
        label: "状态",
        width: "90",
    }));
    const __VLS_578 = __VLS_577({
        prop: "status",
        label: "状态",
        width: "90",
    }, ...__VLS_functionalComponentArgsRest(__VLS_577));
    __VLS_579.slots.default;
    {
        const { default: __VLS_thisSlot } = __VLS_579.slots;
        const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
        (row.status === 1 ? "启用" : "停用");
    }
    var __VLS_579;
    var __VLS_555;
    var __VLS_551;
    const __VLS_580 = {}.ElCard;
    /** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
    // @ts-ignore
    const __VLS_581 = __VLS_asFunctionalComponent(__VLS_580, new __VLS_580({
        ...{ class: "order-card" },
    }));
    const __VLS_582 = __VLS_581({
        ...{ class: "order-card" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_581));
    __VLS_583.slots.default;
    {
        const { header: __VLS_thisSlot } = __VLS_583.slots;
    }
    const __VLS_584 = {}.ElTable;
    /** @type {[typeof __VLS_components.ElTable, typeof __VLS_components.elTable, typeof __VLS_components.ElTable, typeof __VLS_components.elTable, ]} */ ;
    // @ts-ignore
    const __VLS_585 = __VLS_asFunctionalComponent(__VLS_584, new __VLS_584({
        data: (__VLS_ctx.allUsers),
        size: "small",
    }));
    const __VLS_586 = __VLS_585({
        data: (__VLS_ctx.allUsers),
        size: "small",
    }, ...__VLS_functionalComponentArgsRest(__VLS_585));
    __VLS_587.slots.default;
    const __VLS_588 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_589 = __VLS_asFunctionalComponent(__VLS_588, new __VLS_588({
        prop: "id",
        label: "ID",
        width: "70",
    }));
    const __VLS_590 = __VLS_589({
        prop: "id",
        label: "ID",
        width: "70",
    }, ...__VLS_functionalComponentArgsRest(__VLS_589));
    const __VLS_592 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_593 = __VLS_asFunctionalComponent(__VLS_592, new __VLS_592({
        prop: "phone",
        label: "手机号",
        width: "130",
    }));
    const __VLS_594 = __VLS_593({
        prop: "phone",
        label: "手机号",
        width: "130",
    }, ...__VLS_functionalComponentArgsRest(__VLS_593));
    const __VLS_596 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_597 = __VLS_asFunctionalComponent(__VLS_596, new __VLS_596({
        prop: "nickname",
        label: "昵称",
        minWidth: "100",
    }));
    const __VLS_598 = __VLS_597({
        prop: "nickname",
        label: "昵称",
        minWidth: "100",
    }, ...__VLS_functionalComponentArgsRest(__VLS_597));
    const __VLS_600 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_601 = __VLS_asFunctionalComponent(__VLS_600, new __VLS_600({
        prop: "role",
        label: "角色",
        width: "90",
    }));
    const __VLS_602 = __VLS_601({
        prop: "role",
        label: "角色",
        width: "90",
    }, ...__VLS_functionalComponentArgsRest(__VLS_601));
    __VLS_603.slots.default;
    {
        const { default: __VLS_thisSlot } = __VLS_603.slots;
        const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
        (__VLS_ctx.roleNameByValue(row.role));
    }
    var __VLS_603;
    const __VLS_604 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_605 = __VLS_asFunctionalComponent(__VLS_604, new __VLS_604({
        prop: "status",
        label: "状态",
        width: "80",
    }));
    const __VLS_606 = __VLS_605({
        prop: "status",
        label: "状态",
        width: "80",
    }, ...__VLS_functionalComponentArgsRest(__VLS_605));
    __VLS_607.slots.default;
    {
        const { default: __VLS_thisSlot } = __VLS_607.slots;
        const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
        (row.status === 1 ? "启用" : "停用");
    }
    var __VLS_607;
    var __VLS_587;
    var __VLS_583;
    var __VLS_547;
    var __VLS_483;
}
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
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
