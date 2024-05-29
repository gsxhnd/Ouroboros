import { createRouter, createWebHashHistory, RouteRecordRaw } from "vue-router";

import Home from "@/layout/Home.vue";
import Init from "@/pages/Init.vue";

const RootRoute: RouteRecordRaw = {
  path: "/",
  name: "Root",
  component: Home,
  meta: {
    title: "Root",
  },
  children: [
    // {
    //   path: "/aaa/",
    // },
  ],
};

const InitRouter: RouteRecordRaw = {
  path: "/init",
  name: "Init",
  component: Init,
  meta: {
    title: "",
  },
};

const router = createRouter({
  history: createWebHashHistory(),
  routes: [RootRoute, InitRouter],
  // strict: true,
});

export { router };
