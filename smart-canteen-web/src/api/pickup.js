import request from "../utils/request";
export async function getWindowsApi() {
    const resp = await request.get("/pickup/windows");
    return resp.data.data || [];
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
export async function getDisplayApi(windowId) {
    const resp = await request.get(`/pickup/${windowId}/display`);
    return resp.data.data;
}
