import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "../stores/auth";
import LoginView from "../views/LoginView.vue";
import HomeView from "../views/HomeView.vue";
const router = createRouter({
    history: createWebHistory(),
    routes: [
        { path: "/login", name: "login", component: LoginView },
        { path: "/", name: "home", component: HomeView, meta: { requiresAuth: true } }
    ]
});
router.beforeEach((to) => {
    const authStore = useAuthStore();
    if (to.meta.requiresAuth && !authStore.token) {
        return "/login";
    }
    if (to.path === "/login" && authStore.token) {
        return "/";
    }
    return true;
});
export default router;
