import request from "../utils/request";
export async function getTodayMenusApi() {
    const resp = await request.get("/menu/today");
    return resp.data.data || [];
}
export async function publishMenuApi(payload) {
    const resp = await request.post("/menu", payload);
    return resp.data.data;
}
