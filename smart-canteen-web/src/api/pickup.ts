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

export interface WindowPageData {
  records: PickupWindow[];
  total: number;
  current: number;
  size: number;
}

export async function getWindowsApi() {
  const resp = await request.get<{ code: number; msg: string; data: PickupWindow[] | WindowPageData }>("/pickup/windows");
  const data = resp.data.data;
  if (Array.isArray(data)) return data;
  return data?.records || [];
}

export interface WindowListQuery {
  page?: number;
  size?: number;
  status?: number;
  merchantId?: number;
  keyword?: string;
}

export async function getWindowsPageApi(query: WindowListQuery = {}) {
  const params = new URLSearchParams();
  params.set("page", String(query.page ?? 1));
  params.set("size", String(query.size ?? 10));
  if (query.status !== undefined) params.set("status", String(query.status));
  if (query.merchantId !== undefined) params.set("merchantId", String(query.merchantId));
  if (query.keyword) params.set("keyword", query.keyword);
  const resp = await request.get<{ code: number; msg: string; data: WindowPageData }>(`/pickup/windows?${params.toString()}`);
  return resp.data.data || { records: [], total: 0, current: 1, size: 10 };
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

export async function updateWindowApi(id: number, payload: CreateWindowPayload) {
  await request.put(`/pickup/window/${id}`, payload);
}

export async function updateWindowStatusApi(id: number, value: 0 | 1) {
  await request.put(`/pickup/window/${id}/status?value=${value}`);
}

export async function deleteWindowApi(id: number) {
  await request.delete(`/pickup/window/${id}`);
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
