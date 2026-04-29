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
  saleDate: string;
  startTime: string;
  endTime: string;
  status: number;
  dishes: MenuDish[];
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
