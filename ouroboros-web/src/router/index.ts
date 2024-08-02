import { createRouter, createWebHashHistory, RouteRecordRaw } from "vue-router";
import { usePreferencesStore } from "@/stores/preferences";

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

router.beforeEach(async (to, _from) => {
  const preferencesStore = usePreferencesStore();
  await preferencesStore.getPreferences();

  if (
    to.name != "Init" &&
    (preferencesStore.preference === null ||
      preferencesStore.preference.appConfig.libraries.length === 0)
  ) {
    return { name: "Init" };
  }

  preferencesStore.preference?.appConfig.libraries.forEach((library) => {
    const { path, use } = library;
    console.log(path, use);
  });

  // console.log(preferencesStore.preference);
  // console.log(from);
  // console.log(to);
  // return true;
});

export { router };
