import request from "../utils/request";

export interface Dish {
  id: number;
  merchantId: number;
  name: string;
  description?: string;
  price: number;
  image?: string;
  category?: string;
  status: number;
  createTime?: string;
  updateTime?: string;
}

export interface DishPayload {
  name: string;
  description?: string;
  price: number;
  image?: string;
  category?: string;
}

export interface DishPageData {
  records: Dish[];
  total: number;
  current: number;
  size: number;
}

export interface DishListQuery {
  page?: number;
  size?: number;
  merchantId?: number;
  name?: string;
  category?: string;
  status?: number;
  minPrice?: number;
  maxPrice?: number;
}

export async function getDishListApi(page = 1, size = 50, merchantId?: number) {
  const query = merchantId ? `?page=${page}&size=${size}&merchantId=${merchantId}` : `?page=${page}&size=${size}`;
  const resp = await request.get<{ code: number; msg: string; data: { records: Dish[] } }>(`/dish/list${query}`);
  return resp.data.data?.records || [];
}

export async function getDishPageApi(query: DishListQuery = {}) {
  const params = new URLSearchParams();
  params.set("page", String(query.page ?? 1));
  params.set("size", String(query.size ?? 10));
  if (query.merchantId !== undefined) params.set("merchantId", String(query.merchantId));
  if (query.name) params.set("name", query.name);
  if (query.category) params.set("category", query.category);
  if (query.status !== undefined) params.set("status", String(query.status));
  if (query.minPrice !== undefined) params.set("minPrice", String(query.minPrice));
  if (query.maxPrice !== undefined) params.set("maxPrice", String(query.maxPrice));
  const resp = await request.get<{ code: number; msg: string; data: DishPageData }>(`/dish/list?${params.toString()}`);
  return resp.data.data || { records: [], total: 0, current: 1, size: 10 };
}

export async function createDishApi(payload: DishPayload) {
  const resp = await request.post<{ code: number; msg: string; data: Dish }>("/dish", payload);
  return resp.data.data;
}

export async function updateDishApi(id: number, payload: DishPayload) {
  await request.put(`/dish/${id}`, payload);
}

export async function deleteDishApi(id: number) {
  await request.delete(`/dish/${id}`);
}

export async function updateDishStatusApi(id: number, value: 0 | 1) {
  await request.put(`/dish/${id}/status?value=${value}`);
}

export async function getDishDetailApi(id: number) {
  const resp = await request.get<{ code: number; msg: string; data: Dish }>(`/dish/${id}`);
  return resp.data.data;
}
