import request from "../utils/request";
export async function createOrderApi(payload) {
    const resp = await request.post("/order", payload);
    return resp.data.data;
}
export async function getMyOrdersApi(page = 1, size = 10) {
    const resp = await request.get(`/order/my?page=${page}&size=${size}`);
    return resp.data.data || { records: [], total: 0, current: page, size };
}
export async function getMerchantOrdersApi(query = {}) {
    const params = new URLSearchParams();
    params.set("page", String(query.page ?? 1));
    params.set("size", String(query.size ?? 10));
    if (query.status !== undefined)
        params.set("status", String(query.status));
    if (query.windowId !== undefined)
        params.set("windowId", String(query.windowId));
    if (query.keyword)
        params.set("keyword", query.keyword);
    if (query.dateFrom)
        params.set("dateFrom", query.dateFrom);
    if (query.dateTo)
        params.set("dateTo", query.dateTo);
    const resp = await request.get(`/order/merchant?${params.toString()}`);
    return resp.data.data || { records: [], total: 0, current: 1, size: 10 };
}
export async function updateOrderRemarkApi(orderId, remark) {
    const encodedRemark = encodeURIComponent(remark);
    await request.post(`/order/${orderId}/remark?remark=${encodedRemark}`);
}
export async function updateOrderStatusApi(orderId, action) {
    const resp = await request.put(`/order/${orderId}/${action}`);
    return resp.data;
}
export async function cancelOrderApi(orderId) {
    const resp = await request.put(`/order/${orderId}/cancel`);
    return resp.data;
}
export async function getOrderDetailApi(orderId) {
    const resp = await request.get(`/order/${orderId}`);
    return resp.data.data;
}
export async function getOrderByPickupCodeApi(code) {
    const resp = await request.get(`/order/pickup-code/${code}`);
    return resp.data.data;
}
