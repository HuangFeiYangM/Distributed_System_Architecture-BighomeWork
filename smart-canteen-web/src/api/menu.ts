import request from "../utils/request";

export interface MenuDish {
  id: number;
  menuId: number;
  dishId: number;
  dishName: string;
  salePrice: number;
  stock: number;
  sold: number;
  status: number;
}

export interface TodayMenu {
  id: number;
  name: string;
  merchantId?: number;
  merchantName?: string;
  windowId?: number | null;
  windowName?: string | null;
  createTime?: string;
  updateTime?: string;
  saleDate: string;
  startTime: string;
  endTime: string;
  status: number;
  dishes: MenuDish[];
}

export interface MenuPageData {
  records: TodayMenu[];
  total: number;
  current: number;
  size: number;
}

export interface StockRecord {
  menuDishId: number;
  menuId: number;
  menuName: string;
  dishId: number;
  dishName: string;
  merchantId: number;
  merchantName: string;
  stock: number;
  sold: number;
  status: number;
  saleDate: string;
  stockThreshold: number;
}

export interface StockPageData {
  records: StockRecord[];
  total: number;
  current: number;
  size: number;
}

export async function getTodayMenusApi() {
  const resp = await request.get<{ code: number; msg: string; data: TodayMenu[] }>("/menu/today");
  return resp.data.data || [];
}

export interface PublishMenuItem {
  dishId: number;
  salePrice: number;
  stock: number;
}

export interface PublishMenuPayload {
  name: string;
  saleDate: string;
  startTime: string;
  endTime: string;
  items: PublishMenuItem[];
}

export async function publishMenuApi(payload: PublishMenuPayload) {
  const resp = await request.post<{ code: number; msg: string; data: { id: number } }>("/menu", payload);
  return resp.data.data;
}

export interface MenuDishDetail {
  id: number;
  menuId: number;
  dishId: number;
  dishName: string;
  salePrice: number;
  stock: number;
  sold: number;
  status: number;
}

export async function getMenuDishDetailApi(menuDishId: number) {
  const resp = await request.get<{ code: number; msg: string; data: MenuDishDetail }>(`/menu/dish/${menuDishId}`);
  return resp.data.data;
}

export async function getMenuDetailApi(menuId: number) {
  const resp = await request.get<{ code: number; msg: string; data: TodayMenu }>(`/menu/${menuId}`);
  return resp.data.data;
}

export interface MenuListQuery {
  page?: number;
  size?: number;
  name?: string;
  merchantId?: number;
  saleDate?: string;
  status?: number;
  startDate?: string;
  endDate?: string;
}

export async function getMenuListApi(query: MenuListQuery = {}) {
  const params = new URLSearchParams();
  params.set("page", String(query.page ?? 1));
  params.set("size", String(query.size ?? 10));
  if (query.name) params.set("name", query.name);
  if (query.merchantId !== undefined) params.set("merchantId", String(query.merchantId));
  if (query.saleDate) params.set("saleDate", query.saleDate);
  if (query.status !== undefined) params.set("status", String(query.status));
  if (query.startDate) params.set("startDate", query.startDate);
  if (query.endDate) params.set("endDate", query.endDate);
  const resp = await request.get<{ code: number; msg: string; data: MenuPageData }>(`/menu/list?${params.toString()}`);
  return resp.data.data || { records: [], total: 0, current: 1, size: 10 };
}

export interface MerchantStockQuery {
  page?: number;
  size?: number;
  keyword?: string;
  status?: number;
  menuId?: number;
  dishId?: number;
  saleDate?: string;
}

export interface AdminStockQuery extends MerchantStockQuery {
  merchantId?: number;
  lowStockOnly?: boolean;
}

export interface StockUpdatePayload {
  op: "SET" | "INCR" | "DECR";
  value: number;
  reason?: string;
}

export async function getMerchantStockApi(query: MerchantStockQuery = {}) {
  const params = new URLSearchParams();
  params.set("page", String(query.page ?? 1));
  params.set("size", String(query.size ?? 10));
  if (query.keyword) params.set("keyword", query.keyword);
  if (query.status !== undefined) params.set("status", String(query.status));
  if (query.menuId !== undefined) params.set("menuId", String(query.menuId));
  if (query.dishId !== undefined) params.set("dishId", String(query.dishId));
  if (query.saleDate) params.set("saleDate", query.saleDate);
  const resp = await request.get<{ code: number; msg: string; data: StockPageData }>(`/menu/stock/merchant?${params.toString()}`);
  return resp.data.data || { records: [], total: 0, current: 1, size: 10 };
}

export async function getAdminStockApi(query: AdminStockQuery = {}) {
  const params = new URLSearchParams();
  params.set("page", String(query.page ?? 1));
  params.set("size", String(query.size ?? 10));
  if (query.merchantId !== undefined) params.set("merchantId", String(query.merchantId));
  if (query.keyword) params.set("keyword", query.keyword);
  if (query.status !== undefined) params.set("status", String(query.status));
  if (query.menuId !== undefined) params.set("menuId", String(query.menuId));
  if (query.dishId !== undefined) params.set("dishId", String(query.dishId));
  if (query.saleDate) params.set("saleDate", query.saleDate);
  if (query.lowStockOnly !== undefined) params.set("lowStockOnly", String(query.lowStockOnly));
  const resp = await request.get<{ code: number; msg: string; data: StockPageData }>(`/menu/stock/list?${params.toString()}`);
  return resp.data.data || { records: [], total: 0, current: 1, size: 10 };
}

export async function updateStockApi(menuDishId: number, payload: StockUpdatePayload) {
  const resp = await request.put<{ code: number; msg: string; data: MenuDishDetail }>(`/menu/stock/${menuDishId}`, payload);
  return resp.data.data;
}

export interface AdminMenuUpdatePayload {
  name?: string;
  saleDate?: string;
  startTime?: string;
  endTime?: string;
}

export interface AdminMenuDishUpdatePayload {
  dishId: number;
  salePrice?: number;
  status?: number;
}

export async function adminUpdateMenuApi(menuId: number, payload: AdminMenuUpdatePayload) {
  await request.put(`/menu/${menuId}`, payload);
}

export async function adminUpdateMenuStatusApi(menuId: number, value: 0 | 1) {
  await request.put(`/menu/${menuId}/status?value=${value}`);
}

export async function adminDeleteMenuApi(menuId: number) {
  await request.delete(`/menu/${menuId}`);
}

export async function adminUpdateMenuDishApi(menuDishId: number, payload: AdminMenuDishUpdatePayload) {
  await request.put(`/menu/dish/${menuDishId}`, payload);
}
