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

export interface ChangePasswordPayload {
  oldPassword: string;
  newPassword: string;
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

export interface UserListQuery {
  page?: number;
  size?: number;
  role?: number;
  status?: number;
  phone?: string;
  nickname?: string;
  studentNo?: string;
}

export async function queryUserListApi(query: UserListQuery = {}) {
  const params = new URLSearchParams();
  params.set("page", String(query.page ?? 1));
  params.set("size", String(query.size ?? 10));
  if (query.role !== undefined) params.set("role", String(query.role));
  if (query.status !== undefined) params.set("status", String(query.status));
  if (query.phone) params.set("phone", query.phone);
  if (query.nickname) params.set("nickname", query.nickname);
  if (query.studentNo) params.set("studentNo", query.studentNo);
  const resp = await request.get<{ code: number; msg: string; data: UserPageData }>(`/user/list?${params.toString()}`);
  return resp.data.data || { records: [], total: 0, current: 1, size: 10 };
}

export async function updateMeApi(payload: UserUpdatePayload) {
  await request.put("/user/me", payload);
}

export async function changePasswordApi(payload: ChangePasswordPayload) {
  await request.put("/user/me/password", payload);
}

export async function refreshTokenApi() {
  const resp = await request.post<{ code: number; msg: string; data: { accessToken: string } }>("/user/refresh");
  return resp.data.data?.accessToken;
}

export async function updateUserStatusApi(id: number, value: 0 | 1) {
  await request.put(`/user/${id}/status?value=${value}`);
}

export async function deleteUserApi(id: number) {
  await request.delete(`/user/${id}`);
}

export async function resetUserPasswordApi(id: number, password: string) {
  await request.post(`/user/${id}/reset-password`, { password });
}
