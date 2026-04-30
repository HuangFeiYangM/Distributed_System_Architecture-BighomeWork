import request from "../utils/request";
import type { LoginUser } from "../stores/auth";

export interface LoginPayload {
  phone: string;
  password: string;
}

export interface RegisterPayload {
  phone: string;
  password: string;
  nickname: string;
  studentNo: string;
}

export interface UserRecord {
  id: number;
  phone: string;
  nickname: string;
  role: number;
  status: number;
}

export interface UserPageData {
  records: UserRecord[];
  total: number;
  current: number;
  size: number;
}

export interface UserProfile {
  id: number;
  phone: string;
  studentNo: string;
  nickname: string;
  avatar?: string;
  role: number;
  status: number;
}

export interface UserUpdatePayload {
  nickname?: string;
  avatar?: string;
}

export async function loginApi(payload: LoginPayload) {
  const resp = await request.post<{ code: number; msg: string; data: LoginUser }>("/user/login", payload);
  return resp.data.data;
}

export async function registerApi(payload: RegisterPayload) {
  await request.post("/user/register", payload);
}

export async function meApi() {
  const resp = await request.get<{ code: number; msg: string; data: UserProfile }>("/user/me");
  return resp.data.data;
}

export async function getUserListApi(page = 1, size = 100) {
  const resp = await request.get<{ code: number; msg: string; data: UserPageData }>(
    `/user/list?page=${page}&size=${size}`
  );
  return resp.data.data || { records: [], total: 0, current: page, size };
}

export async function updateMeApi(payload: UserUpdatePayload) {
  await request.put("/user/me", payload);
}

export async function refreshTokenApi() {
  const resp = await request.post<{ code: number; msg: string; data: { accessToken: string } }>("/user/refresh");
  return resp.data.data?.accessToken;
}
