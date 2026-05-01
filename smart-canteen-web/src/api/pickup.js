import request from "../utils/request";
export async function getWindowsApi() {
    const resp = await request.get("/pickup/windows");
    const data = resp.data.data;
    if (Array.isArray(data))
        return data;
    return data?.records || [];
}
export async function getWindowsPageApi(query = {}) {
    const params = new URLSearchParams();
    params.set("page", String(query.page ?? 1));
    params.set("size", String(query.size ?? 10));
    if (query.status !== undefined)
        params.set("status", String(query.status));
    if (query.merchantId !== undefined)
        params.set("merchantId", String(query.merchantId));
    if (query.keyword)
        params.set("keyword", query.keyword);
    const resp = await request.get(`/pickup/windows?${params.toString()}`);
    return resp.data.data || { records: [], total: 0, current: 1, size: 10 };
}
export async function getWindowQueueApi(windowId) {
    const resp = await request.get(`/pickup/${windowId}/queue`);
    return resp.data.data || [];
}
export async function callNextApi(windowId) {
    const resp = await request.post(`/pickup/${windowId}/call`);
    return resp.data.data;
}
export async function verifyPickupApi(pickupCode) {
    const resp = await request.post("/pickup/verify", { pickupCode });
    return resp.data;
}
export async function createWindowApi(payload) {
    const resp = await request.post("/pickup/window", payload);
    return resp.data.data;
}
export async function updateWindowApi(id, payload) {
    await request.put(`/pickup/window/${id}`, payload);
}
export async function updateWindowStatusApi(id, value) {
    await request.put(`/pickup/window/${id}/status?value=${value}`);
}
export async function deleteWindowApi(id) {
    await request.delete(`/pickup/window/${id}`);
}
export async function getDisplayApi(windowId) {
    const resp = await request.get(`/pickup/${windowId}/display`);
    return resp.data.data;
}
