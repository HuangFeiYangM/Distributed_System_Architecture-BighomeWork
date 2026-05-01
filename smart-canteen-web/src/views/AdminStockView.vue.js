import { onMounted, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import { useRouter } from "vue-router";
import { getAdminStockApi, updateStockApi } from "../api/menu";
import { useAuthStore } from "../stores/auth";
const router = useRouter();
const authStore = useAuthStore();
const loading = ref(false);
const saving = ref(false);
const records = ref([]);
const total = ref(0);
const opVisible = ref(false);
const activeMenuDishId = ref(null);
const query = reactive({
    page: 1,
    size: 10,
    merchantId: undefined,
    keyword: "",
    status: undefined,
    menuId: undefined,
    dishId: undefined,
    saleDate: "",
    lowStockOnly: false
});
const opForm = reactive({
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
    }
    finally {
        loading.value = false;
    }
};
const onSearch = async () => {
    query.page = 1;
    await loadData();
};
const onPageChange = async (page) => {
    query.page = page;
    await loadData();
};
const onSizeChange = async (size) => {
    query.size = size;
    query.page = 1;
    await loadData();
};
const openOp = (row, op) => {
    activeMenuDishId.value = row.menuDishId;
    opForm.op = op;
    opForm.value = op === "SET" ? row.stock : 1;
    opForm.reason = "";
    opVisible.value = true;
};
const submitOp = async () => {
    if (!activeMenuDishId.value)
        return;
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
    }
    finally {
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
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "page-wrap" },
});
const __VLS_0 = {}.ElCard;
/** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({}));
const __VLS_2 = __VLS_1({}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_3.slots.default;
{
    const { header: __VLS_thisSlot } = __VLS_3.slots;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "header-row" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    const __VLS_4 = {}.ElSpace;
    /** @type {[typeof __VLS_components.ElSpace, typeof __VLS_components.elSpace, typeof __VLS_components.ElSpace, typeof __VLS_components.elSpace, ]} */ ;
    // @ts-ignore
    const __VLS_5 = __VLS_asFunctionalComponent(__VLS_4, new __VLS_4({}));
    const __VLS_6 = __VLS_5({}, ...__VLS_functionalComponentArgsRest(__VLS_5));
    __VLS_7.slots.default;
    const __VLS_8 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({
        ...{ 'onClick': {} },
    }));
    const __VLS_10 = __VLS_9({
        ...{ 'onClick': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_9));
    let __VLS_12;
    let __VLS_13;
    let __VLS_14;
    const __VLS_15 = {
        onClick: (__VLS_ctx.goHome)
    };
    __VLS_11.slots.default;
    var __VLS_11;
    const __VLS_16 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_17 = __VLS_asFunctionalComponent(__VLS_16, new __VLS_16({
        ...{ 'onClick': {} },
        type: "primary",
        loading: (__VLS_ctx.loading),
    }));
    const __VLS_18 = __VLS_17({
        ...{ 'onClick': {} },
        type: "primary",
        loading: (__VLS_ctx.loading),
    }, ...__VLS_functionalComponentArgsRest(__VLS_17));
    let __VLS_20;
    let __VLS_21;
    let __VLS_22;
    const __VLS_23 = {
        onClick: (__VLS_ctx.loadData)
    };
    __VLS_19.slots.default;
    var __VLS_19;
    var __VLS_7;
}
const __VLS_24 = {}.ElSpace;
/** @type {[typeof __VLS_components.ElSpace, typeof __VLS_components.elSpace, typeof __VLS_components.ElSpace, typeof __VLS_components.elSpace, ]} */ ;
// @ts-ignore
const __VLS_25 = __VLS_asFunctionalComponent(__VLS_24, new __VLS_24({
    wrap: true,
    ...{ class: "query-row" },
}));
const __VLS_26 = __VLS_25({
    wrap: true,
    ...{ class: "query-row" },
}, ...__VLS_functionalComponentArgsRest(__VLS_25));
__VLS_27.slots.default;
const __VLS_28 = {}.ElInputNumber;
/** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
// @ts-ignore
const __VLS_29 = __VLS_asFunctionalComponent(__VLS_28, new __VLS_28({
    modelValue: (__VLS_ctx.query.merchantId),
    min: (1),
    step: (1),
    placeholder: "商家ID",
}));
const __VLS_30 = __VLS_29({
    modelValue: (__VLS_ctx.query.merchantId),
    min: (1),
    step: (1),
    placeholder: "商家ID",
}, ...__VLS_functionalComponentArgsRest(__VLS_29));
const __VLS_32 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_33 = __VLS_asFunctionalComponent(__VLS_32, new __VLS_32({
    modelValue: (__VLS_ctx.query.keyword),
    placeholder: "菜品/菜单关键字",
    ...{ class: "query-item" },
    clearable: true,
}));
const __VLS_34 = __VLS_33({
    modelValue: (__VLS_ctx.query.keyword),
    placeholder: "菜品/菜单关键字",
    ...{ class: "query-item" },
    clearable: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_33));
const __VLS_36 = {}.ElInputNumber;
/** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
// @ts-ignore
const __VLS_37 = __VLS_asFunctionalComponent(__VLS_36, new __VLS_36({
    modelValue: (__VLS_ctx.query.menuId),
    min: (1),
    step: (1),
    placeholder: "菜单ID",
}));
const __VLS_38 = __VLS_37({
    modelValue: (__VLS_ctx.query.menuId),
    min: (1),
    step: (1),
    placeholder: "菜单ID",
}, ...__VLS_functionalComponentArgsRest(__VLS_37));
const __VLS_40 = {}.ElInputNumber;
/** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
// @ts-ignore
const __VLS_41 = __VLS_asFunctionalComponent(__VLS_40, new __VLS_40({
    modelValue: (__VLS_ctx.query.dishId),
    min: (1),
    step: (1),
    placeholder: "菜品ID",
}));
const __VLS_42 = __VLS_41({
    modelValue: (__VLS_ctx.query.dishId),
    min: (1),
    step: (1),
    placeholder: "菜品ID",
}, ...__VLS_functionalComponentArgsRest(__VLS_41));
const __VLS_44 = {}.ElSelect;
/** @type {[typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, ]} */ ;
// @ts-ignore
const __VLS_45 = __VLS_asFunctionalComponent(__VLS_44, new __VLS_44({
    modelValue: (__VLS_ctx.query.status),
    clearable: true,
    placeholder: "状态",
    ...{ class: "query-item" },
}));
const __VLS_46 = __VLS_45({
    modelValue: (__VLS_ctx.query.status),
    clearable: true,
    placeholder: "状态",
    ...{ class: "query-item" },
}, ...__VLS_functionalComponentArgsRest(__VLS_45));
__VLS_47.slots.default;
const __VLS_48 = {}.ElOption;
/** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
// @ts-ignore
const __VLS_49 = __VLS_asFunctionalComponent(__VLS_48, new __VLS_48({
    value: (1),
    label: "可售",
}));
const __VLS_50 = __VLS_49({
    value: (1),
    label: "可售",
}, ...__VLS_functionalComponentArgsRest(__VLS_49));
const __VLS_52 = {}.ElOption;
/** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
// @ts-ignore
const __VLS_53 = __VLS_asFunctionalComponent(__VLS_52, new __VLS_52({
    value: (0),
    label: "停售",
}));
const __VLS_54 = __VLS_53({
    value: (0),
    label: "停售",
}, ...__VLS_functionalComponentArgsRest(__VLS_53));
var __VLS_47;
const __VLS_56 = {}.ElDatePicker;
/** @type {[typeof __VLS_components.ElDatePicker, typeof __VLS_components.elDatePicker, ]} */ ;
// @ts-ignore
const __VLS_57 = __VLS_asFunctionalComponent(__VLS_56, new __VLS_56({
    modelValue: (__VLS_ctx.query.saleDate),
    type: "date",
    valueFormat: "YYYY-MM-DD",
    placeholder: "售卖日期",
}));
const __VLS_58 = __VLS_57({
    modelValue: (__VLS_ctx.query.saleDate),
    type: "date",
    valueFormat: "YYYY-MM-DD",
    placeholder: "售卖日期",
}, ...__VLS_functionalComponentArgsRest(__VLS_57));
const __VLS_60 = {}.ElSwitch;
/** @type {[typeof __VLS_components.ElSwitch, typeof __VLS_components.elSwitch, ]} */ ;
// @ts-ignore
const __VLS_61 = __VLS_asFunctionalComponent(__VLS_60, new __VLS_60({
    modelValue: (__VLS_ctx.query.lowStockOnly),
    activeText: "仅低库存",
}));
const __VLS_62 = __VLS_61({
    modelValue: (__VLS_ctx.query.lowStockOnly),
    activeText: "仅低库存",
}, ...__VLS_functionalComponentArgsRest(__VLS_61));
const __VLS_64 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_65 = __VLS_asFunctionalComponent(__VLS_64, new __VLS_64({
    ...{ 'onClick': {} },
    type: "primary",
}));
const __VLS_66 = __VLS_65({
    ...{ 'onClick': {} },
    type: "primary",
}, ...__VLS_functionalComponentArgsRest(__VLS_65));
let __VLS_68;
let __VLS_69;
let __VLS_70;
const __VLS_71 = {
    onClick: (__VLS_ctx.onSearch)
};
__VLS_67.slots.default;
var __VLS_67;
var __VLS_27;
const __VLS_72 = {}.ElTable;
/** @type {[typeof __VLS_components.ElTable, typeof __VLS_components.elTable, typeof __VLS_components.ElTable, typeof __VLS_components.elTable, ]} */ ;
// @ts-ignore
const __VLS_73 = __VLS_asFunctionalComponent(__VLS_72, new __VLS_72({
    data: (__VLS_ctx.records),
    size: "small",
}));
const __VLS_74 = __VLS_73({
    data: (__VLS_ctx.records),
    size: "small",
}, ...__VLS_functionalComponentArgsRest(__VLS_73));
__VLS_asFunctionalDirective(__VLS_directives.vLoading)(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.loading) }, null, null);
__VLS_75.slots.default;
const __VLS_76 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_77 = __VLS_asFunctionalComponent(__VLS_76, new __VLS_76({
    prop: "menuDishId",
    label: "菜单菜品ID",
    width: "120",
}));
const __VLS_78 = __VLS_77({
    prop: "menuDishId",
    label: "菜单菜品ID",
    width: "120",
}, ...__VLS_functionalComponentArgsRest(__VLS_77));
const __VLS_80 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_81 = __VLS_asFunctionalComponent(__VLS_80, new __VLS_80({
    prop: "merchantId",
    label: "商家ID",
    width: "90",
}));
const __VLS_82 = __VLS_81({
    prop: "merchantId",
    label: "商家ID",
    width: "90",
}, ...__VLS_functionalComponentArgsRest(__VLS_81));
const __VLS_84 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_85 = __VLS_asFunctionalComponent(__VLS_84, new __VLS_84({
    prop: "merchantName",
    label: "商家",
    width: "130",
}));
const __VLS_86 = __VLS_85({
    prop: "merchantName",
    label: "商家",
    width: "130",
}, ...__VLS_functionalComponentArgsRest(__VLS_85));
const __VLS_88 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_89 = __VLS_asFunctionalComponent(__VLS_88, new __VLS_88({
    prop: "menuName",
    label: "菜单",
    minWidth: "140",
}));
const __VLS_90 = __VLS_89({
    prop: "menuName",
    label: "菜单",
    minWidth: "140",
}, ...__VLS_functionalComponentArgsRest(__VLS_89));
const __VLS_92 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_93 = __VLS_asFunctionalComponent(__VLS_92, new __VLS_92({
    prop: "dishName",
    label: "菜品",
    minWidth: "130",
}));
const __VLS_94 = __VLS_93({
    prop: "dishName",
    label: "菜品",
    minWidth: "130",
}, ...__VLS_functionalComponentArgsRest(__VLS_93));
const __VLS_96 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_97 = __VLS_asFunctionalComponent(__VLS_96, new __VLS_96({
    prop: "saleDate",
    label: "日期",
    width: "120",
}));
const __VLS_98 = __VLS_97({
    prop: "saleDate",
    label: "日期",
    width: "120",
}, ...__VLS_functionalComponentArgsRest(__VLS_97));
const __VLS_100 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_101 = __VLS_asFunctionalComponent(__VLS_100, new __VLS_100({
    prop: "stock",
    label: "库存",
    width: "90",
}));
const __VLS_102 = __VLS_101({
    prop: "stock",
    label: "库存",
    width: "90",
}, ...__VLS_functionalComponentArgsRest(__VLS_101));
const __VLS_104 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_105 = __VLS_asFunctionalComponent(__VLS_104, new __VLS_104({
    prop: "sold",
    label: "已售",
    width: "90",
}));
const __VLS_106 = __VLS_105({
    prop: "sold",
    label: "已售",
    width: "90",
}, ...__VLS_functionalComponentArgsRest(__VLS_105));
const __VLS_108 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_109 = __VLS_asFunctionalComponent(__VLS_108, new __VLS_108({
    prop: "stockThreshold",
    label: "阈值",
    width: "90",
}));
const __VLS_110 = __VLS_109({
    prop: "stockThreshold",
    label: "阈值",
    width: "90",
}, ...__VLS_functionalComponentArgsRest(__VLS_109));
const __VLS_112 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_113 = __VLS_asFunctionalComponent(__VLS_112, new __VLS_112({
    label: "操作",
    minWidth: "250",
}));
const __VLS_114 = __VLS_113({
    label: "操作",
    minWidth: "250",
}, ...__VLS_functionalComponentArgsRest(__VLS_113));
__VLS_115.slots.default;
{
    const { default: __VLS_thisSlot } = __VLS_115.slots;
    const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
    const __VLS_116 = {}.ElSpace;
    /** @type {[typeof __VLS_components.ElSpace, typeof __VLS_components.elSpace, typeof __VLS_components.ElSpace, typeof __VLS_components.elSpace, ]} */ ;
    // @ts-ignore
    const __VLS_117 = __VLS_asFunctionalComponent(__VLS_116, new __VLS_116({
        wrap: true,
    }));
    const __VLS_118 = __VLS_117({
        wrap: true,
    }, ...__VLS_functionalComponentArgsRest(__VLS_117));
    __VLS_119.slots.default;
    const __VLS_120 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_121 = __VLS_asFunctionalComponent(__VLS_120, new __VLS_120({
        ...{ 'onClick': {} },
        size: "small",
    }));
    const __VLS_122 = __VLS_121({
        ...{ 'onClick': {} },
        size: "small",
    }, ...__VLS_functionalComponentArgsRest(__VLS_121));
    let __VLS_124;
    let __VLS_125;
    let __VLS_126;
    const __VLS_127 = {
        onClick: (...[$event]) => {
            __VLS_ctx.openOp(row, 'INCR');
        }
    };
    __VLS_123.slots.default;
    var __VLS_123;
    const __VLS_128 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_129 = __VLS_asFunctionalComponent(__VLS_128, new __VLS_128({
        ...{ 'onClick': {} },
        size: "small",
    }));
    const __VLS_130 = __VLS_129({
        ...{ 'onClick': {} },
        size: "small",
    }, ...__VLS_functionalComponentArgsRest(__VLS_129));
    let __VLS_132;
    let __VLS_133;
    let __VLS_134;
    const __VLS_135 = {
        onClick: (...[$event]) => {
            __VLS_ctx.openOp(row, 'DECR');
        }
    };
    __VLS_131.slots.default;
    var __VLS_131;
    const __VLS_136 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_137 = __VLS_asFunctionalComponent(__VLS_136, new __VLS_136({
        ...{ 'onClick': {} },
        size: "small",
        type: "warning",
    }));
    const __VLS_138 = __VLS_137({
        ...{ 'onClick': {} },
        size: "small",
        type: "warning",
    }, ...__VLS_functionalComponentArgsRest(__VLS_137));
    let __VLS_140;
    let __VLS_141;
    let __VLS_142;
    const __VLS_143 = {
        onClick: (...[$event]) => {
            __VLS_ctx.openOp(row, 'SET');
        }
    };
    __VLS_139.slots.default;
    var __VLS_139;
    var __VLS_119;
}
var __VLS_115;
var __VLS_75;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "pager" },
});
const __VLS_144 = {}.ElPagination;
/** @type {[typeof __VLS_components.ElPagination, typeof __VLS_components.elPagination, ]} */ ;
// @ts-ignore
const __VLS_145 = __VLS_asFunctionalComponent(__VLS_144, new __VLS_144({
    ...{ 'onCurrentChange': {} },
    ...{ 'onSizeChange': {} },
    background: true,
    layout: "total, sizes, prev, pager, next",
    total: (__VLS_ctx.total),
    currentPage: (__VLS_ctx.query.page),
    pageSize: (__VLS_ctx.query.size),
    pageSizes: ([10, 20, 50]),
}));
const __VLS_146 = __VLS_145({
    ...{ 'onCurrentChange': {} },
    ...{ 'onSizeChange': {} },
    background: true,
    layout: "total, sizes, prev, pager, next",
    total: (__VLS_ctx.total),
    currentPage: (__VLS_ctx.query.page),
    pageSize: (__VLS_ctx.query.size),
    pageSizes: ([10, 20, 50]),
}, ...__VLS_functionalComponentArgsRest(__VLS_145));
let __VLS_148;
let __VLS_149;
let __VLS_150;
const __VLS_151 = {
    onCurrentChange: (__VLS_ctx.onPageChange)
};
const __VLS_152 = {
    onSizeChange: (__VLS_ctx.onSizeChange)
};
var __VLS_147;
var __VLS_3;
const __VLS_153 = {}.ElDialog;
/** @type {[typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, ]} */ ;
// @ts-ignore
const __VLS_154 = __VLS_asFunctionalComponent(__VLS_153, new __VLS_153({
    modelValue: (__VLS_ctx.opVisible),
    title: "库存操作",
    width: "420px",
}));
const __VLS_155 = __VLS_154({
    modelValue: (__VLS_ctx.opVisible),
    title: "库存操作",
    width: "420px",
}, ...__VLS_functionalComponentArgsRest(__VLS_154));
__VLS_156.slots.default;
const __VLS_157 = {}.ElForm;
/** @type {[typeof __VLS_components.ElForm, typeof __VLS_components.elForm, typeof __VLS_components.ElForm, typeof __VLS_components.elForm, ]} */ ;
// @ts-ignore
const __VLS_158 = __VLS_asFunctionalComponent(__VLS_157, new __VLS_157({
    labelWidth: "90px",
}));
const __VLS_159 = __VLS_158({
    labelWidth: "90px",
}, ...__VLS_functionalComponentArgsRest(__VLS_158));
__VLS_160.slots.default;
const __VLS_161 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_162 = __VLS_asFunctionalComponent(__VLS_161, new __VLS_161({
    label: "操作类型",
}));
const __VLS_163 = __VLS_162({
    label: "操作类型",
}, ...__VLS_functionalComponentArgsRest(__VLS_162));
__VLS_164.slots.default;
const __VLS_165 = {}.ElTag;
/** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
// @ts-ignore
const __VLS_166 = __VLS_asFunctionalComponent(__VLS_165, new __VLS_165({}));
const __VLS_167 = __VLS_166({}, ...__VLS_functionalComponentArgsRest(__VLS_166));
__VLS_168.slots.default;
(__VLS_ctx.opForm.op);
var __VLS_168;
var __VLS_164;
const __VLS_169 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_170 = __VLS_asFunctionalComponent(__VLS_169, new __VLS_169({
    label: "数值",
}));
const __VLS_171 = __VLS_170({
    label: "数值",
}, ...__VLS_functionalComponentArgsRest(__VLS_170));
__VLS_172.slots.default;
const __VLS_173 = {}.ElInputNumber;
/** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
// @ts-ignore
const __VLS_174 = __VLS_asFunctionalComponent(__VLS_173, new __VLS_173({
    modelValue: (__VLS_ctx.opForm.value),
    min: (0),
    step: (1),
}));
const __VLS_175 = __VLS_174({
    modelValue: (__VLS_ctx.opForm.value),
    min: (0),
    step: (1),
}, ...__VLS_functionalComponentArgsRest(__VLS_174));
var __VLS_172;
const __VLS_177 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_178 = __VLS_asFunctionalComponent(__VLS_177, new __VLS_177({
    label: "原因",
}));
const __VLS_179 = __VLS_178({
    label: "原因",
}, ...__VLS_functionalComponentArgsRest(__VLS_178));
__VLS_180.slots.default;
const __VLS_181 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_182 = __VLS_asFunctionalComponent(__VLS_181, new __VLS_181({
    modelValue: (__VLS_ctx.opForm.reason),
    placeholder: "可选，记录变更原因",
}));
const __VLS_183 = __VLS_182({
    modelValue: (__VLS_ctx.opForm.reason),
    placeholder: "可选，记录变更原因",
}, ...__VLS_functionalComponentArgsRest(__VLS_182));
var __VLS_180;
var __VLS_160;
{
    const { footer: __VLS_thisSlot } = __VLS_156.slots;
    const __VLS_185 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_186 = __VLS_asFunctionalComponent(__VLS_185, new __VLS_185({
        ...{ 'onClick': {} },
    }));
    const __VLS_187 = __VLS_186({
        ...{ 'onClick': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_186));
    let __VLS_189;
    let __VLS_190;
    let __VLS_191;
    const __VLS_192 = {
        onClick: (...[$event]) => {
            __VLS_ctx.opVisible = false;
        }
    };
    __VLS_188.slots.default;
    var __VLS_188;
    const __VLS_193 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_194 = __VLS_asFunctionalComponent(__VLS_193, new __VLS_193({
        ...{ 'onClick': {} },
        type: "primary",
        loading: (__VLS_ctx.saving),
    }));
    const __VLS_195 = __VLS_194({
        ...{ 'onClick': {} },
        type: "primary",
        loading: (__VLS_ctx.saving),
    }, ...__VLS_functionalComponentArgsRest(__VLS_194));
    let __VLS_197;
    let __VLS_198;
    let __VLS_199;
    const __VLS_200 = {
        onClick: (__VLS_ctx.submitOp)
    };
    __VLS_196.slots.default;
    var __VLS_196;
}
var __VLS_156;
/** @type {__VLS_StyleScopedClasses['page-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['header-row']} */ ;
/** @type {__VLS_StyleScopedClasses['query-row']} */ ;
/** @type {__VLS_StyleScopedClasses['query-item']} */ ;
/** @type {__VLS_StyleScopedClasses['query-item']} */ ;
/** @type {__VLS_StyleScopedClasses['pager']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            loading: loading,
            saving: saving,
            records: records,
            total: total,
            opVisible: opVisible,
            query: query,
            opForm: opForm,
            goHome: goHome,
            loadData: loadData,
            onSearch: onSearch,
            onPageChange: onPageChange,
            onSizeChange: onSizeChange,
            openOp: openOp,
            submitOp: submitOp,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
