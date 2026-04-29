import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import { getDisplayApi, getWindowsApi } from "../api/pickup";
const router = useRouter();
const windows = ref([]);
const windowId = ref(null);
const display = ref(null);
const ws = ref(null);
const wsConnected = ref(false);
const wsMessages = ref([]);
const wsStatus = computed(() => (wsConnected.value ? "WebSocket 已连接" : "WebSocket 未连接"));
const nowTime = () => new Date().toLocaleTimeString("zh-CN", { hour12: false });
const addMessage = (type, payload) => {
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
        }
        catch {
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
    if (!windowId.value)
        return;
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
    }
    else {
        ElMessage.warning("暂无窗口，请先由管理员创建窗口");
    }
    connectWs();
});
watch(windowId, async () => {
    await loadDisplay();
});
onUnmounted(() => {
    if (ws.value)
        ws.value.close();
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
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({}));
const __VLS_2 = __VLS_1({}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_3.slots.default;
{
    const { header: __VLS_thisSlot } = __VLS_3.slots;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "head" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    const __VLS_4 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_5 = __VLS_asFunctionalComponent(__VLS_4, new __VLS_4({
        ...{ 'onClick': {} },
    }));
    const __VLS_6 = __VLS_5({
        ...{ 'onClick': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_5));
    let __VLS_8;
    let __VLS_9;
    let __VLS_10;
    const __VLS_11 = {
        onClick: (__VLS_ctx.goHome)
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
const __VLS_16 = {}.ElSelect;
/** @type {[typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, ]} */ ;
// @ts-ignore
const __VLS_17 = __VLS_asFunctionalComponent(__VLS_16, new __VLS_16({
    modelValue: (__VLS_ctx.windowId),
    placeholder: "选择窗口",
    ...{ style: {} },
}));
const __VLS_18 = __VLS_17({
    modelValue: (__VLS_ctx.windowId),
    placeholder: "选择窗口",
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_17));
__VLS_19.slots.default;
for (const [w] of __VLS_getVForSourceType((__VLS_ctx.windows))) {
    const __VLS_20 = {}.ElOption;
    /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
    // @ts-ignore
    const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({
        key: (w.id),
        label: (`${w.name} (${w.location})`),
        value: (w.id),
    }));
    const __VLS_22 = __VLS_21({
        key: (w.id),
        label: (`${w.name} (${w.location})`),
        value: (w.id),
    }, ...__VLS_functionalComponentArgsRest(__VLS_21));
}
var __VLS_19;
const __VLS_24 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_25 = __VLS_asFunctionalComponent(__VLS_24, new __VLS_24({
    ...{ 'onClick': {} },
    disabled: (!__VLS_ctx.windowId),
}));
const __VLS_26 = __VLS_25({
    ...{ 'onClick': {} },
    disabled: (!__VLS_ctx.windowId),
}, ...__VLS_functionalComponentArgsRest(__VLS_25));
let __VLS_28;
let __VLS_29;
let __VLS_30;
const __VLS_31 = {
    onClick: (__VLS_ctx.loadDisplay)
};
__VLS_27.slots.default;
var __VLS_27;
var __VLS_15;
const __VLS_32 = {}.ElDivider;
/** @type {[typeof __VLS_components.ElDivider, typeof __VLS_components.elDivider, ]} */ ;
// @ts-ignore
const __VLS_33 = __VLS_asFunctionalComponent(__VLS_32, new __VLS_32({}));
const __VLS_34 = __VLS_33({}, ...__VLS_functionalComponentArgsRest(__VLS_33));
if (__VLS_ctx.display) {
    const __VLS_36 = {}.ElDescriptions;
    /** @type {[typeof __VLS_components.ElDescriptions, typeof __VLS_components.elDescriptions, typeof __VLS_components.ElDescriptions, typeof __VLS_components.elDescriptions, ]} */ ;
    // @ts-ignore
    const __VLS_37 = __VLS_asFunctionalComponent(__VLS_36, new __VLS_36({
        column: (2),
        border: true,
    }));
    const __VLS_38 = __VLS_37({
        column: (2),
        border: true,
    }, ...__VLS_functionalComponentArgsRest(__VLS_37));
    __VLS_39.slots.default;
    const __VLS_40 = {}.ElDescriptionsItem;
    /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
    // @ts-ignore
    const __VLS_41 = __VLS_asFunctionalComponent(__VLS_40, new __VLS_40({
        label: "当前窗口",
    }));
    const __VLS_42 = __VLS_41({
        label: "当前窗口",
    }, ...__VLS_functionalComponentArgsRest(__VLS_41));
    __VLS_43.slots.default;
    (__VLS_ctx.display.windowId);
    var __VLS_43;
    const __VLS_44 = {}.ElDescriptionsItem;
    /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
    // @ts-ignore
    const __VLS_45 = __VLS_asFunctionalComponent(__VLS_44, new __VLS_44({
        label: "当前叫号",
    }));
    const __VLS_46 = __VLS_45({
        label: "当前叫号",
    }, ...__VLS_functionalComponentArgsRest(__VLS_45));
    __VLS_47.slots.default;
    (__VLS_ctx.display.currentPickupNo || "-");
    var __VLS_47;
    const __VLS_48 = {}.ElDescriptionsItem;
    /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
    // @ts-ignore
    const __VLS_49 = __VLS_asFunctionalComponent(__VLS_48, new __VLS_48({
        label: "当前订单",
    }));
    const __VLS_50 = __VLS_49({
        label: "当前订单",
    }, ...__VLS_functionalComponentArgsRest(__VLS_49));
    __VLS_51.slots.default;
    (__VLS_ctx.display.currentOrderId || "-");
    var __VLS_51;
    const __VLS_52 = {}.ElDescriptionsItem;
    /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
    // @ts-ignore
    const __VLS_53 = __VLS_asFunctionalComponent(__VLS_52, new __VLS_52({
        label: "等待数量",
    }));
    const __VLS_54 = __VLS_53({
        label: "等待数量",
    }, ...__VLS_functionalComponentArgsRest(__VLS_53));
    __VLS_55.slots.default;
    (__VLS_ctx.display.waitingCount);
    var __VLS_55;
    var __VLS_39;
}
const __VLS_56 = {}.ElDivider;
/** @type {[typeof __VLS_components.ElDivider, typeof __VLS_components.elDivider, ]} */ ;
// @ts-ignore
const __VLS_57 = __VLS_asFunctionalComponent(__VLS_56, new __VLS_56({}));
const __VLS_58 = __VLS_57({}, ...__VLS_functionalComponentArgsRest(__VLS_57));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "section-title" },
});
for (const [id] of __VLS_getVForSourceType((__VLS_ctx.display?.waitingOrderIds || []))) {
    const __VLS_60 = {}.ElTag;
    /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
    // @ts-ignore
    const __VLS_61 = __VLS_asFunctionalComponent(__VLS_60, new __VLS_60({
        key: (id),
        ...{ class: "tag" },
    }));
    const __VLS_62 = __VLS_61({
        key: (id),
        ...{ class: "tag" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_61));
    __VLS_63.slots.default;
    (id);
    var __VLS_63;
}
const __VLS_64 = {}.ElDivider;
/** @type {[typeof __VLS_components.ElDivider, typeof __VLS_components.elDivider, ]} */ ;
// @ts-ignore
const __VLS_65 = __VLS_asFunctionalComponent(__VLS_64, new __VLS_64({}));
const __VLS_66 = __VLS_65({}, ...__VLS_functionalComponentArgsRest(__VLS_65));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "section-title" },
});
for (const [item] of __VLS_getVForSourceType((__VLS_ctx.display?.recentCalls || []))) {
    const __VLS_68 = {}.ElTag;
    /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
    // @ts-ignore
    const __VLS_69 = __VLS_asFunctionalComponent(__VLS_68, new __VLS_68({
        key: (item),
        ...{ class: "tag" },
        type: "success",
    }));
    const __VLS_70 = __VLS_69({
        key: (item),
        ...{ class: "tag" },
        type: "success",
    }, ...__VLS_functionalComponentArgsRest(__VLS_69));
    __VLS_71.slots.default;
    (item);
    var __VLS_71;
}
const __VLS_72 = {}.ElDivider;
/** @type {[typeof __VLS_components.ElDivider, typeof __VLS_components.elDivider, ]} */ ;
// @ts-ignore
const __VLS_73 = __VLS_asFunctionalComponent(__VLS_72, new __VLS_72({}));
const __VLS_74 = __VLS_73({}, ...__VLS_functionalComponentArgsRest(__VLS_73));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "section-title" },
});
const __VLS_76 = {}.ElAlert;
/** @type {[typeof __VLS_components.ElAlert, typeof __VLS_components.elAlert, ]} */ ;
// @ts-ignore
const __VLS_77 = __VLS_asFunctionalComponent(__VLS_76, new __VLS_76({
    title: (__VLS_ctx.wsStatus),
    type: (__VLS_ctx.wsConnected ? 'success' : 'warning'),
    showIcon: true,
    closable: (false),
}));
const __VLS_78 = __VLS_77({
    title: (__VLS_ctx.wsStatus),
    type: (__VLS_ctx.wsConnected ? 'success' : 'warning'),
    showIcon: true,
    closable: (false),
}, ...__VLS_functionalComponentArgsRest(__VLS_77));
const __VLS_80 = {}.ElTable;
/** @type {[typeof __VLS_components.ElTable, typeof __VLS_components.elTable, typeof __VLS_components.ElTable, typeof __VLS_components.elTable, ]} */ ;
// @ts-ignore
const __VLS_81 = __VLS_asFunctionalComponent(__VLS_80, new __VLS_80({
    data: (__VLS_ctx.wsMessages),
    size: "small",
    ...{ style: {} },
}));
const __VLS_82 = __VLS_81({
    data: (__VLS_ctx.wsMessages),
    size: "small",
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_81));
__VLS_83.slots.default;
const __VLS_84 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_85 = __VLS_asFunctionalComponent(__VLS_84, new __VLS_84({
    prop: "time",
    label: "时间",
    width: "120",
}));
const __VLS_86 = __VLS_85({
    prop: "time",
    label: "时间",
    width: "120",
}, ...__VLS_functionalComponentArgsRest(__VLS_85));
const __VLS_88 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_89 = __VLS_asFunctionalComponent(__VLS_88, new __VLS_88({
    prop: "type",
    label: "类型",
    width: "100",
}));
const __VLS_90 = __VLS_89({
    prop: "type",
    label: "类型",
    width: "100",
}, ...__VLS_functionalComponentArgsRest(__VLS_89));
const __VLS_92 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_93 = __VLS_asFunctionalComponent(__VLS_92, new __VLS_92({
    prop: "payload",
    label: "消息内容",
}));
const __VLS_94 = __VLS_93({
    prop: "payload",
    label: "消息内容",
}, ...__VLS_functionalComponentArgsRest(__VLS_93));
var __VLS_83;
var __VLS_3;
/** @type {__VLS_StyleScopedClasses['wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['head']} */ ;
/** @type {__VLS_StyleScopedClasses['section-title']} */ ;
/** @type {__VLS_StyleScopedClasses['tag']} */ ;
/** @type {__VLS_StyleScopedClasses['section-title']} */ ;
/** @type {__VLS_StyleScopedClasses['tag']} */ ;
/** @type {__VLS_StyleScopedClasses['section-title']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            windows: windows,
            windowId: windowId,
            display: display,
            wsConnected: wsConnected,
            wsMessages: wsMessages,
            wsStatus: wsStatus,
            loadDisplay: loadDisplay,
            goHome: goHome,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
