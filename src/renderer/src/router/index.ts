import { createRouter, createWebHashHistory, RouteRecordRaw } from "vue-router";

import HelloWorld from "@/components/HelloWorld.vue";
import Home from "@/layout/Home.vue";
const Login = { template: "<div>Login</div>" };

const RootRoute: RouteRecordRaw = {
  path: "/",
  name: "Root",
  component: Home,
  meta: {
    title: "Root",
  },
  children: [
    {
      path: "/aaa/",
      component: HelloWorld,
    },
  ],
};

const LoginRoute: RouteRecordRaw = {
  path: "/login",
  name: "Login",
  component: Login,
  meta: {
    title: "",
  },
};

const router = createRouter({
  history: createWebHashHistory(),
  routes: [RootRoute, LoginRoute],
  // strict: true,
});

export { router };
