import { defineStore } from "pinia";
const TOKEN_KEY = "canteen_token";
const USER_ID_KEY = "canteen_user_id";
const ROLE_KEY = "canteen_role";
export const useAuthStore = defineStore("auth", {
    state: () => ({
        token: localStorage.getItem(TOKEN_KEY) || "",
        userId: Number(localStorage.getItem(USER_ID_KEY) || "") || null,
        role: Number(localStorage.getItem(ROLE_KEY) || "") || null
    }),
    actions: {
        setLogin(data) {
            this.token = data.accessToken;
            this.userId = data.userId;
            this.role = data.role;
            localStorage.setItem(TOKEN_KEY, data.accessToken);
            localStorage.setItem(USER_ID_KEY, String(data.userId));
            localStorage.setItem(ROLE_KEY, String(data.role));
        },
        setToken(token) {
            this.token = token;
            localStorage.setItem(TOKEN_KEY, token);
        },
        logout() {
            this.token = "";
            this.userId = null;
            this.role = null;
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem(USER_ID_KEY);
            localStorage.removeItem(ROLE_KEY);
        }
    }
});
