import request from "../utils/request";
export async function getDishListApi(page = 1, size = 50, merchantId) {
    const query = merchantId ? `?page=${page}&size=${size}&merchantId=${merchantId}` : `?page=${page}&size=${size}`;
    const resp = await request.get(`/dish/list${query}`);
    return resp.data.data?.records || [];
}
export async function getDishPageApi(query = {}) {
    const params = new URLSearchParams();
    params.set("page", String(query.page ?? 1));
    params.set("size", String(query.size ?? 10));
    if (query.merchantId !== undefined)
        params.set("merchantId", String(query.merchantId));
    if (query.name)
        params.set("name", query.name);
    if (query.category)
        params.set("category", query.category);
    if (query.status !== undefined)
        params.set("status", String(query.status));
    if (query.minPrice !== undefined)
        params.set("minPrice", String(query.minPrice));
    if (query.maxPrice !== undefined)
        params.set("maxPrice", String(query.maxPrice));
    const resp = await request.get(`/dish/list?${params.toString()}`);
    return resp.data.data || { records: [], total: 0, current: 1, size: 10 };
}
export async function createDishApi(payload) {
    const resp = await request.post("/dish", payload);
    return resp.data.data;
}
export async function updateDishApi(id, payload) {
    await request.put(`/dish/${id}`, payload);
}
export async function deleteDishApi(id) {
    await request.delete(`/dish/${id}`);
}
export async function updateDishStatusApi(id, value) {
    await request.put(`/dish/${id}/status?value=${value}`);
}
export async function getDishDetailApi(id) {
    const resp = await request.get(`/dish/${id}`);
    return resp.data.data;
}
