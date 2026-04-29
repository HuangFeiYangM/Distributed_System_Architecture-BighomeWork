import request from "../utils/request";
export async function getDishListApi(page = 1, size = 50, merchantId) {
    const query = merchantId ? `?page=${page}&size=${size}&merchantId=${merchantId}` : `?page=${page}&size=${size}`;
    const resp = await request.get(`/dish/list${query}`);
    return resp.data.data?.records || [];
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
