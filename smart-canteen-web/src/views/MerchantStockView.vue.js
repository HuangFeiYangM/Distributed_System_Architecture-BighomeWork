import { onMounted, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import { useRouter } from "vue-router";
import { getMerchantStockApi, updateStockApi } from "../api/menu";
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
    keyword: "",
    status: undefined,
    menuId: undefined,
    dishId: undefined,
    saleDate: ""
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
        const pageData = await getMerchantStockApi(query);
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
    if (authStore.role !== 1) {
        ElMessage.error("仅商家可访问该页面");
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
const __VLS_28 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_29 = __VLS_asFunctionalComponent(__VLS_28, new __VLS_28({
    modelValue: (__VLS_ctx.query.keyword),
    placeholder: "菜品/菜单关键字",
    ...{ class: "query-item" },
    clearable: true,
}));
const __VLS_30 = __VLS_29({
    modelValue: (__VLS_ctx.query.keyword),
    placeholder: "菜品/菜单关键字",
    ...{ class: "query-item" },
    clearable: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_29));
const __VLS_32 = {}.ElInputNumber;
/** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
// @ts-ignore
const __VLS_33 = __VLS_asFunctionalComponent(__VLS_32, new __VLS_32({
    modelValue: (__VLS_ctx.query.menuId),
    min: (1),
    step: (1),
    placeholder: "菜单ID",
}));
const __VLS_34 = __VLS_33({
    modelValue: (__VLS_ctx.query.menuId),
    min: (1),
    step: (1),
    placeholder: "菜单ID",
}, ...__VLS_functionalComponentArgsRest(__VLS_33));
const __VLS_36 = {}.ElInputNumber;
/** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
// @ts-ignore
const __VLS_37 = __VLS_asFunctionalComponent(__VLS_36, new __VLS_36({
    modelValue: (__VLS_ctx.query.dishId),
    min: (1),
    step: (1),
    placeholder: "菜品ID",
}));
const __VLS_38 = __VLS_37({
    modelValue: (__VLS_ctx.query.dishId),
    min: (1),
    step: (1),
    placeholder: "菜品ID",
}, ...__VLS_functionalComponentArgsRest(__VLS_37));
const __VLS_40 = {}.ElSelect;
/** @type {[typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, ]} */ ;
// @ts-ignore
const __VLS_41 = __VLS_asFunctionalComponent(__VLS_40, new __VLS_40({
    modelValue: (__VLS_ctx.query.status),
    clearable: true,
    placeholder: "状态",
    ...{ class: "query-item" },
}));
const __VLS_42 = __VLS_41({
    modelValue: (__VLS_ctx.query.status),
    clearable: true,
    placeholder: "状态",
    ...{ class: "query-item" },
}, ...__VLS_functionalComponentArgsRest(__VLS_41));
__VLS_43.slots.default;
const __VLS_44 = {}.ElOption;
/** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
// @ts-ignore
const __VLS_45 = __VLS_asFunctionalComponent(__VLS_44, new __VLS_44({
    value: (1),
    label: "可售",
}));
const __VLS_46 = __VLS_45({
    value: (1),
    label: "可售",
}, ...__VLS_functionalComponentArgsRest(__VLS_45));
const __VLS_48 = {}.ElOption;
/** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
// @ts-ignore
const __VLS_49 = __VLS_asFunctionalComponent(__VLS_48, new __VLS_48({
    value: (0),
    label: "停售",
}));
const __VLS_50 = __VLS_49({
    value: (0),
    label: "停售",
}, ...__VLS_functionalComponentArgsRest(__VLS_49));
var __VLS_43;
const __VLS_52 = {}.ElDatePicker;
/** @type {[typeof __VLS_components.ElDatePicker, typeof __VLS_components.elDatePicker, ]} */ ;
// @ts-ignore
const __VLS_53 = __VLS_asFunctionalComponent(__VLS_52, new __VLS_52({
    modelValue: (__VLS_ctx.query.saleDate),
    type: "date",
    valueFormat: "YYYY-MM-DD",
    placeholder: "售卖日期",
}));
const __VLS_54 = __VLS_53({
    modelValue: (__VLS_ctx.query.saleDate),
    type: "date",
    valueFormat: "YYYY-MM-DD",
    placeholder: "售卖日期",
}, ...__VLS_functionalComponentArgsRest(__VLS_53));
const __VLS_56 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_57 = __VLS_asFunctionalComponent(__VLS_56, new __VLS_56({
    ...{ 'onClick': {} },
    type: "primary",
}));
const __VLS_58 = __VLS_57({
    ...{ 'onClick': {} },
    type: "primary",
}, ...__VLS_functionalComponentArgsRest(__VLS_57));
let __VLS_60;
let __VLS_61;
let __VLS_62;
const __VLS_63 = {
    onClick: (__VLS_ctx.onSearch)
};
__VLS_59.slots.default;
var __VLS_59;
var __VLS_27;
const __VLS_64 = {}.ElTable;
/** @type {[typeof __VLS_components.ElTable, typeof __VLS_components.elTable, typeof __VLS_components.ElTable, typeof __VLS_components.elTable, ]} */ ;
// @ts-ignore
const __VLS_65 = __VLS_asFunctionalComponent(__VLS_64, new __VLS_64({
    data: (__VLS_ctx.records),
    size: "small",
}));
const __VLS_66 = __VLS_65({
    data: (__VLS_ctx.records),
    size: "small",
}, ...__VLS_functionalComponentArgsRest(__VLS_65));
__VLS_asFunctionalDirective(__VLS_directives.vLoading)(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.loading) }, null, null);
__VLS_67.slots.default;
const __VLS_68 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_69 = __VLS_asFunctionalComponent(__VLS_68, new __VLS_68({
    prop: "menuDishId",
    label: "菜单菜品ID",
    width: "120",
}));
const __VLS_70 = __VLS_69({
    prop: "menuDishId",
    label: "菜单菜品ID",
    width: "120",
}, ...__VLS_functionalComponentArgsRest(__VLS_69));
const __VLS_72 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_73 = __VLS_asFunctionalComponent(__VLS_72, new __VLS_72({
    prop: "menuName",
    label: "菜单",
    minWidth: "140",
}));
const __VLS_74 = __VLS_73({
    prop: "menuName",
    label: "菜单",
    minWidth: "140",
}, ...__VLS_functionalComponentArgsRest(__VLS_73));
const __VLS_76 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_77 = __VLS_asFunctionalComponent(__VLS_76, new __VLS_76({
    prop: "dishName",
    label: "菜品",
    minWidth: "130",
}));
const __VLS_78 = __VLS_77({
    prop: "dishName",
    label: "菜品",
    minWidth: "130",
}, ...__VLS_functionalComponentArgsRest(__VLS_77));
const __VLS_80 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_81 = __VLS_asFunctionalComponent(__VLS_80, new __VLS_80({
    prop: "saleDate",
    label: "日期",
    width: "120",
}));
const __VLS_82 = __VLS_81({
    prop: "saleDate",
    label: "日期",
    width: "120",
}, ...__VLS_functionalComponentArgsRest(__VLS_81));
const __VLS_84 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_85 = __VLS_asFunctionalComponent(__VLS_84, new __VLS_84({
    prop: "stock",
    label: "库存",
    width: "90",
}));
const __VLS_86 = __VLS_85({
    prop: "stock",
    label: "库存",
    width: "90",
}, ...__VLS_functionalComponentArgsRest(__VLS_85));
const __VLS_88 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_89 = __VLS_asFunctionalComponent(__VLS_88, new __VLS_88({
    prop: "sold",
    label: "已售",
    width: "90",
}));
const __VLS_90 = __VLS_89({
    prop: "sold",
    label: "已售",
    width: "90",
}, ...__VLS_functionalComponentArgsRest(__VLS_89));
const __VLS_92 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_93 = __VLS_asFunctionalComponent(__VLS_92, new __VLS_92({
    prop: "stockThreshold",
    label: "阈值",
    width: "90",
}));
const __VLS_94 = __VLS_93({
    prop: "stockThreshold",
    label: "阈值",
    width: "90",
}, ...__VLS_functionalComponentArgsRest(__VLS_93));
const __VLS_96 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_97 = __VLS_asFunctionalComponent(__VLS_96, new __VLS_96({
    label: "状态",
    width: "90",
}));
const __VLS_98 = __VLS_97({
    label: "状态",
    width: "90",
}, ...__VLS_functionalComponentArgsRest(__VLS_97));
__VLS_99.slots.default;
{
    const { default: __VLS_thisSlot } = __VLS_99.slots;
    const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
    (row.status === 1 ? "可售" : "停售");
}
var __VLS_99;
const __VLS_100 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_101 = __VLS_asFunctionalComponent(__VLS_100, new __VLS_100({
    label: "操作",
    minWidth: "250",
}));
const __VLS_102 = __VLS_101({
    label: "操作",
    minWidth: "250",
}, ...__VLS_functionalComponentArgsRest(__VLS_101));
__VLS_103.slots.default;
{
    const { default: __VLS_thisSlot } = __VLS_103.slots;
    const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
    const __VLS_104 = {}.ElSpace;
    /** @type {[typeof __VLS_components.ElSpace, typeof __VLS_components.elSpace, typeof __VLS_components.ElSpace, typeof __VLS_components.elSpace, ]} */ ;
    // @ts-ignore
    const __VLS_105 = __VLS_asFunctionalComponent(__VLS_104, new __VLS_104({
        wrap: true,
    }));
    const __VLS_106 = __VLS_105({
        wrap: true,
    }, ...__VLS_functionalComponentArgsRest(__VLS_105));
    __VLS_107.slots.default;
    const __VLS_108 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_109 = __VLS_asFunctionalComponent(__VLS_108, new __VLS_108({
        ...{ 'onClick': {} },
        size: "small",
    }));
    const __VLS_110 = __VLS_109({
        ...{ 'onClick': {} },
        size: "small",
    }, ...__VLS_functionalComponentArgsRest(__VLS_109));
    let __VLS_112;
    let __VLS_113;
    let __VLS_114;
    const __VLS_115 = {
        onClick: (...[$event]) => {
            __VLS_ctx.openOp(row, 'INCR');
        }
    };
    __VLS_111.slots.default;
    var __VLS_111;
    const __VLS_116 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_117 = __VLS_asFunctionalComponent(__VLS_116, new __VLS_116({
        ...{ 'onClick': {} },
        size: "small",
    }));
    const __VLS_118 = __VLS_117({
        ...{ 'onClick': {} },
        size: "small",
    }, ...__VLS_functionalComponentArgsRest(__VLS_117));
    let __VLS_120;
    let __VLS_121;
    let __VLS_122;
    const __VLS_123 = {
        onClick: (...[$event]) => {
            __VLS_ctx.openOp(row, 'DECR');
        }
    };
    __VLS_119.slots.default;
    var __VLS_119;
    const __VLS_124 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_125 = __VLS_asFunctionalComponent(__VLS_124, new __VLS_124({
        ...{ 'onClick': {} },
        size: "small",
        type: "warning",
    }));
    const __VLS_126 = __VLS_125({
        ...{ 'onClick': {} },
        size: "small",
        type: "warning",
    }, ...__VLS_functionalComponentArgsRest(__VLS_125));
    let __VLS_128;
    let __VLS_129;
    let __VLS_130;
    const __VLS_131 = {
        onClick: (...[$event]) => {
            __VLS_ctx.openOp(row, 'SET');
        }
    };
    __VLS_127.slots.default;
    var __VLS_127;
    var __VLS_107;
}
var __VLS_103;
var __VLS_67;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "pager" },
});
const __VLS_132 = {}.ElPagination;
/** @type {[typeof __VLS_components.ElPagination, typeof __VLS_components.elPagination, ]} */ ;
// @ts-ignore
const __VLS_133 = __VLS_asFunctionalComponent(__VLS_132, new __VLS_132({
    ...{ 'onCurrentChange': {} },
    ...{ 'onSizeChange': {} },
    background: true,
    layout: "total, sizes, prev, pager, next",
    total: (__VLS_ctx.total),
    currentPage: (__VLS_ctx.query.page),
    pageSize: (__VLS_ctx.query.size),
    pageSizes: ([10, 20, 50]),
}));
const __VLS_134 = __VLS_133({
    ...{ 'onCurrentChange': {} },
    ...{ 'onSizeChange': {} },
    background: true,
    layout: "total, sizes, prev, pager, next",
    total: (__VLS_ctx.total),
    currentPage: (__VLS_ctx.query.page),
    pageSize: (__VLS_ctx.query.size),
    pageSizes: ([10, 20, 50]),
}, ...__VLS_functionalComponentArgsRest(__VLS_133));
let __VLS_136;
let __VLS_137;
let __VLS_138;
const __VLS_139 = {
    onCurrentChange: (__VLS_ctx.onPageChange)
};
const __VLS_140 = {
    onSizeChange: (__VLS_ctx.onSizeChange)
};
var __VLS_135;
var __VLS_3;
const __VLS_141 = {}.ElDialog;
/** @type {[typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, ]} */ ;
// @ts-ignore
const __VLS_142 = __VLS_asFunctionalComponent(__VLS_141, new __VLS_141({
    modelValue: (__VLS_ctx.opVisible),
    title: "库存操作",
    width: "420px",
}));
const __VLS_143 = __VLS_142({
    modelValue: (__VLS_ctx.opVisible),
    title: "库存操作",
    width: "420px",
}, ...__VLS_functionalComponentArgsRest(__VLS_142));
__VLS_144.slots.default;
const __VLS_145 = {}.ElForm;
/** @type {[typeof __VLS_components.ElForm, typeof __VLS_components.elForm, typeof __VLS_components.ElForm, typeof __VLS_components.elForm, ]} */ ;
// @ts-ignore
const __VLS_146 = __VLS_asFunctionalComponent(__VLS_145, new __VLS_145({
    labelWidth: "90px",
}));
const __VLS_147 = __VLS_146({
    labelWidth: "90px",
}, ...__VLS_functionalComponentArgsRest(__VLS_146));
__VLS_148.slots.default;
const __VLS_149 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_150 = __VLS_asFunctionalComponent(__VLS_149, new __VLS_149({
    label: "操作类型",
}));
const __VLS_151 = __VLS_150({
    label: "操作类型",
}, ...__VLS_functionalComponentArgsRest(__VLS_150));
__VLS_152.slots.default;
const __VLS_153 = {}.ElTag;
/** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
// @ts-ignore
const __VLS_154 = __VLS_asFunctionalComponent(__VLS_153, new __VLS_153({}));
const __VLS_155 = __VLS_154({}, ...__VLS_functionalComponentArgsRest(__VLS_154));
__VLS_156.slots.default;
(__VLS_ctx.opForm.op);
var __VLS_156;
var __VLS_152;
const __VLS_157 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_158 = __VLS_asFunctionalComponent(__VLS_157, new __VLS_157({
    label: "数值",
}));
const __VLS_159 = __VLS_158({
    label: "数值",
}, ...__VLS_functionalComponentArgsRest(__VLS_158));
__VLS_160.slots.default;
const __VLS_161 = {}.ElInputNumber;
/** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
// @ts-ignore
const __VLS_162 = __VLS_asFunctionalComponent(__VLS_161, new __VLS_161({
    modelValue: (__VLS_ctx.opForm.value),
    min: (0),
    step: (1),
}));
const __VLS_163 = __VLS_162({
    modelValue: (__VLS_ctx.opForm.value),
    min: (0),
    step: (1),
}, ...__VLS_functionalComponentArgsRest(__VLS_162));
var __VLS_160;
const __VLS_165 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_166 = __VLS_asFunctionalComponent(__VLS_165, new __VLS_165({
    label: "原因",
}));
const __VLS_167 = __VLS_166({
    label: "原因",
}, ...__VLS_functionalComponentArgsRest(__VLS_166));
__VLS_168.slots.default;
const __VLS_169 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_170 = __VLS_asFunctionalComponent(__VLS_169, new __VLS_169({
    modelValue: (__VLS_ctx.opForm.reason),
    placeholder: "可选，记录变更原因",
}));
const __VLS_171 = __VLS_170({
    modelValue: (__VLS_ctx.opForm.reason),
    placeholder: "可选，记录变更原因",
}, ...__VLS_functionalComponentArgsRest(__VLS_170));
var __VLS_168;
var __VLS_148;
{
    const { footer: __VLS_thisSlot } = __VLS_144.slots;
    const __VLS_173 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_174 = __VLS_asFunctionalComponent(__VLS_173, new __VLS_173({
        ...{ 'onClick': {} },
    }));
    const __VLS_175 = __VLS_174({
        ...{ 'onClick': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_174));
    let __VLS_177;
    let __VLS_178;
    let __VLS_179;
    const __VLS_180 = {
        onClick: (...[$event]) => {
            __VLS_ctx.opVisible = false;
        }
    };
    __VLS_176.slots.default;
    var __VLS_176;
    const __VLS_181 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_182 = __VLS_asFunctionalComponent(__VLS_181, new __VLS_181({
        ...{ 'onClick': {} },
        type: "primary",
        loading: (__VLS_ctx.saving),
    }));
    const __VLS_183 = __VLS_182({
        ...{ 'onClick': {} },
        type: "primary",
        loading: (__VLS_ctx.saving),
    }, ...__VLS_functionalComponentArgsRest(__VLS_182));
    let __VLS_185;
    let __VLS_186;
    let __VLS_187;
    const __VLS_188 = {
        onClick: (__VLS_ctx.submitOp)
    };
    __VLS_184.slots.default;
    var __VLS_184;
}
var __VLS_144;
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
