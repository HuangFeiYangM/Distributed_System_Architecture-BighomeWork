import request from "../utils/request";
export async function loginApi(payload) {
    const resp = await request.post("/user/login", payload);
    return resp.data.data;
}
export async function registerApi(payload) {
    await request.post("/user/register", payload);
}
export async function meApi() {
    const resp = await request.get("/user/me");
    return resp.data.data;
}
export async function getUserListApi(page = 1, size = 100) {
    const resp = await request.get(`/user/list?page=${page}&size=${size}`);
    return resp.data.data || { records: [], total: 0, current: page, size };
}
export async function queryUserListApi(query = {}) {
    const params = new URLSearchParams();
    params.set("page", String(query.page ?? 1));
    params.set("size", String(query.size ?? 10));
    if (query.role !== undefined)
        params.set("role", String(query.role));
    if (query.status !== undefined)
        params.set("status", String(query.status));
    if (query.phone)
        params.set("phone", query.phone);
    if (query.nickname)
        params.set("nickname", query.nickname);
    if (query.studentNo)
        params.set("studentNo", query.studentNo);
    const resp = await request.get(`/user/list?${params.toString()}`);
    return resp.data.data || { records: [], total: 0, current: 1, size: 10 };
}
export async function updateMeApi(payload) {
    await request.put("/user/me", payload);
}
export async function changePasswordApi(payload) {
    await request.put("/user/me/password", payload);
}
export async function refreshTokenApi() {
    const resp = await request.post("/user/refresh");
    return resp.data.data?.accessToken;
}
export async function updateUserStatusApi(id, value) {
    await request.put(`/user/${id}/status?value=${value}`);
}
export async function deleteUserApi(id) {
    await request.delete(`/user/${id}`);
}
export async function resetUserPasswordApi(id, password) {
    await request.post(`/user/${id}/reset-password`, { password });
}
