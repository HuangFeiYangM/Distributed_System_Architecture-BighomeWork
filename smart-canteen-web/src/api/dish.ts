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
}

export interface DishPayload {
  name: string;
  description?: string;
  price: number;
  image?: string;
  category?: string;
}

export async function getDishListApi(page = 1, size = 50, merchantId?: number) {
  const query = merchantId ? `?page=${page}&size=${size}&merchantId=${merchantId}` : `?page=${page}&size=${size}`;
  const resp = await request.get<{ code: number; msg: string; data: { records: Dish[] } }>(`/dish/list${query}`);
  return resp.data.data?.records || [];
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
