import request from "../utils/request";

export interface PickupWindow {
  id: number;
  name: string;
  location: string;
  merchantId: number;
  status: number;
  pickupPrefix: string;
}

export interface CreateWindowPayload {
  name: string;
  location: string;
  merchantId: number;
  pickupPrefix: string;
}

export async function getWindowsApi() {
  const resp = await request.get<{ code: number; msg: string; data: PickupWindow[] }>("/pickup/windows");
  return resp.data.data || [];
}

export async function getWindowQueueApi(windowId: number) {
  const resp = await request.get<{ code: number; msg: string; data: string[] }>(`/pickup/${windowId}/queue`);
  return resp.data.data || [];
}

export async function callNextApi(windowId: number) {
  const resp = await request.post<{ code: number; msg: string; data: string }>(`/pickup/${windowId}/call`);
  return resp.data.data;
}

export async function verifyPickupApi(pickupCode: string) {
  const resp = await request.post<{ code: number; msg: string; data: null }>("/pickup/verify", { pickupCode });
  return resp.data;
}

export async function createWindowApi(payload: CreateWindowPayload) {
  const resp = await request.post<{ code: number; msg: string; data: PickupWindow }>("/pickup/window", payload);
  return resp.data.data;
}

export interface PickupDisplay {
  windowId: number;
  currentPickupNo: string | null;
  currentOrderId: number | null;
  waitingCount: number;
  waitingOrderIds: string[];
  recentCalls: string[];
}

export async function getDisplayApi(windowId: number) {
  const resp = await request.get<{ code: number; msg: string; data: PickupDisplay }>(`/pickup/${windowId}/display`);
  return resp.data.data;
}
