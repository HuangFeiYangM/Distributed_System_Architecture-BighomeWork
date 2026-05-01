import request from "../utils/request";

export interface OrderItem {
  dishId: number;
  menuDishId: number;
  dishName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface OrderRecord {
  id: number;
  orderNo: string;
  userId: number;
  windowId: number;
  totalAmount: number;
  status: number;
  pickupNo: string | null;
  pickupCode: string;
  remark: string | null;
  createTime: string;
  items: OrderItem[];
}

export interface CreateOrderPayload {
  windowId: number;
  remark?: string;
  items: Array<{
    menuDishId: number;
    quantity: number;
  }>;
}

export interface OrderPageData {
  records: OrderRecord[];
  total: number;
  current: number;
  size: number;
}

export async function createOrderApi(payload: CreateOrderPayload) {
  const resp = await request.post<{ code: number; msg: string; data: OrderRecord }>("/order", payload);
  return resp.data.data;
}

export async function getMyOrdersApi(page = 1, size = 10) {
  const resp = await request.get<{ code: number; msg: string; data: OrderPageData }>(
    `/order/my?page=${page}&size=${size}`
  );
  return resp.data.data || { records: [], total: 0, current: page, size };
}

export interface MerchantOrderQuery {
  page?: number;
  size?: number;
  status?: number;
  windowId?: number;
  keyword?: string;
  dateFrom?: string;
  dateTo?: string;
}

export async function getMerchantOrdersApi(query: MerchantOrderQuery = {}) {
  const params = new URLSearchParams();
  params.set("page", String(query.page ?? 1));
  params.set("size", String(query.size ?? 10));
  if (query.status !== undefined) params.set("status", String(query.status));
  if (query.windowId !== undefined) params.set("windowId", String(query.windowId));
  if (query.keyword) params.set("keyword", query.keyword);
  if (query.dateFrom) params.set("dateFrom", query.dateFrom);
  if (query.dateTo) params.set("dateTo", query.dateTo);
  const resp = await request.get<{ code: number; msg: string; data: OrderPageData }>(`/order/merchant?${params.toString()}`);
  return resp.data.data || { records: [], total: 0, current: 1, size: 10 };
}

export async function updateOrderRemarkApi(orderId: number, remark: string) {
  const encodedRemark = encodeURIComponent(remark);
  await request.post(`/order/${orderId}/remark?remark=${encodedRemark}`);
}

export async function updateOrderStatusApi(orderId: number, action: "accept" | "cook" | "ready") {
  const resp = await request.put<{ code: number; msg: string; data: null }>(`/order/${orderId}/${action}`);
  return resp.data;
}

export async function cancelOrderApi(orderId: number) {
  const resp = await request.put<{ code: number; msg: string; data: null }>(`/order/${orderId}/cancel`);
  return resp.data;
}

export async function getOrderDetailApi(orderId: number) {
  const resp = await request.get<{ code: number; msg: string; data: OrderRecord }>(`/order/${orderId}`);
  return resp.data.data;
}

export interface OrderBrief {
  id: number;
  userId: number;
  windowId: number;
  status: number;
  pickupCode: string;
  pickupNo: string | null;
}

export async function getOrderByPickupCodeApi(code: string) {
  const resp = await request.get<{ code: number; msg: string; data: OrderBrief }>(`/order/pickup-code/${code}`);
  return resp.data.data;
}
