import request from "../utils/request";
export async function createOrderApi(payload) {
    const resp = await request.post("/order", payload);
    return resp.data.data;
}
export async function getMyOrdersApi(page = 1, size = 10) {
    const resp = await request.get(`/order/my?page=${page}&size=${size}`);
    return resp.data.data?.records || [];
}
export async function updateOrderStatusApi(orderId, action) {
    const resp = await request.put(`/order/${orderId}/${action}`);
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
