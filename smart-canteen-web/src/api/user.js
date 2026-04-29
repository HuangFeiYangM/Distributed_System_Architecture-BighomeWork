import request from "../utils/request";
export async function loginApi(payload) {
    const resp = await request.post("/user/login", payload);
    return resp.data.data;
}
export async function meApi() {
    const resp = await request.get("/user/me");
    return resp.data.data;
}
export async function getUserListApi(page = 1, size = 100) {
    const resp = await request.get(`/user/list?page=${page}&size=${size}`);
    return resp.data.data?.records || [];
}
