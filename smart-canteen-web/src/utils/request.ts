import axios from "axios";
import { ElMessage } from "element-plus";
import { useAuthStore } from "../stores/auth";

interface ApiResult<T> {
  code: number;
  msg: string;
  data: T;
}

const request = axios.create({
  baseURL: "/api",
  timeout: 15000
});

request.interceptors.request.use((config) => {
  const auth = useAuthStore();
  if (auth.token) {
    config.headers.Authorization = `Bearer ${auth.token}`;
  }
  return config;
});

request.interceptors.response.use(
  (response) => {
    const body = response.data as ApiResult<unknown>;
    if (typeof body?.code === "number" && body.code !== 200) {
      ElMessage.error(body.msg || "请求失败");
      return Promise.reject(new Error(body.msg || "请求失败"));
    }
    return response;
  },
  (error) => {
    ElMessage.error(error?.message || "网络异常");
    return Promise.reject(error);
  }
);

export default request;
