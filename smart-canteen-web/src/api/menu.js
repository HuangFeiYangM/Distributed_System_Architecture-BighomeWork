import request from "../utils/request";
export async function getTodayMenusApi() {
    const resp = await request.get("/menu/today");
    return resp.data.data || [];
}
export async function publishMenuApi(payload) {
    const resp = await request.post("/menu", payload);
    return resp.data.data;
}
export async function getMenuDishDetailApi(menuDishId) {
    const resp = await request.get(`/menu/dish/${menuDishId}`);
    return resp.data.data;
}
export async function getMenuDetailApi(menuId) {
    const resp = await request.get(`/menu/${menuId}`);
    return resp.data.data;
}
export async function getMenuListApi(query = {}) {
    const params = new URLSearchParams();
    params.set("page", String(query.page ?? 1));
    params.set("size", String(query.size ?? 10));
    if (query.name)
        params.set("name", query.name);
    if (query.merchantId !== undefined)
        params.set("merchantId", String(query.merchantId));
    if (query.saleDate)
        params.set("saleDate", query.saleDate);
    if (query.status !== undefined)
        params.set("status", String(query.status));
    if (query.startDate)
        params.set("startDate", query.startDate);
    if (query.endDate)
        params.set("endDate", query.endDate);
    const resp = await request.get(`/menu/list?${params.toString()}`);
    return resp.data.data || { records: [], total: 0, current: 1, size: 10 };
}
export async function getMerchantStockApi(query = {}) {
    const params = new URLSearchParams();
    params.set("page", String(query.page ?? 1));
    params.set("size", String(query.size ?? 10));
    if (query.keyword)
        params.set("keyword", query.keyword);
    if (query.status !== undefined)
        params.set("status", String(query.status));
    if (query.menuId !== undefined)
        params.set("menuId", String(query.menuId));
    if (query.dishId !== undefined)
        params.set("dishId", String(query.dishId));
    if (query.saleDate)
        params.set("saleDate", query.saleDate);
    const resp = await request.get(`/menu/stock/merchant?${params.toString()}`);
    return resp.data.data || { records: [], total: 0, current: 1, size: 10 };
}
export async function getAdminStockApi(query = {}) {
    const params = new URLSearchParams();
    params.set("page", String(query.page ?? 1));
    params.set("size", String(query.size ?? 10));
    if (query.merchantId !== undefined)
        params.set("merchantId", String(query.merchantId));
    if (query.keyword)
        params.set("keyword", query.keyword);
    if (query.status !== undefined)
        params.set("status", String(query.status));
    if (query.menuId !== undefined)
        params.set("menuId", String(query.menuId));
    if (query.dishId !== undefined)
        params.set("dishId", String(query.dishId));
    if (query.saleDate)
        params.set("saleDate", query.saleDate);
    if (query.lowStockOnly !== undefined)
        params.set("lowStockOnly", String(query.lowStockOnly));
    const resp = await request.get(`/menu/stock/list?${params.toString()}`);
    return resp.data.data || { records: [], total: 0, current: 1, size: 10 };
}
export async function updateStockApi(menuDishId, payload) {
    const resp = await request.put(`/menu/stock/${menuDishId}`, payload);
    return resp.data.data;
}
export async function adminUpdateMenuApi(menuId, payload) {
    await request.put(`/menu/${menuId}`, payload);
}
export async function adminUpdateMenuStatusApi(menuId, value) {
    await request.put(`/menu/${menuId}/status?value=${value}`);
}
export async function adminDeleteMenuApi(menuId) {
    await request.delete(`/menu/${menuId}`);
}
export async function adminUpdateMenuDishApi(menuDishId, payload) {
    await request.put(`/menu/dish/${menuDishId}`, payload);
}
