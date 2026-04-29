import request from "../utils/request";
import type { LoginUser } from "../stores/auth";

export interface LoginPayload {
  phone: string;
  password: string;
}

export async function loginApi(payload: LoginPayload) {
  const resp = await request.post<{ code: number; msg: string; data: LoginUser }>("/user/login", payload);
  return resp.data.data;
}

export async function meApi() {
  const resp = await request.get("/user/me");
  return resp.data.data;
}
