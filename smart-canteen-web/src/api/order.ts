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

export async function createOrderApi(payload: CreateOrderPayload) {
  const resp = await request.post<{ code: number; msg: string; data: OrderRecord }>("/order", payload);
  return resp.data.data;
}

export async function getMyOrdersApi(page = 1, size = 10) {
  const resp = await request.get<{ code: number; msg: string; data: { records: OrderRecord[] } }>(
    `/order/my?page=${page}&size=${size}`
  );
  return resp.data.data?.records || [];
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
