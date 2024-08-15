import { createRouter, createWebHashHistory, RouteRecordRaw } from "vue-router";
import { usePreferencesStore } from "@/stores/preferences";

import Home from "@/layout/Home.vue";
import InitElectron from "@/pages/InitElectron.vue";
import InitBrowser from "@/pages/InitBrowser.vue";
import Dashboard from "@/pages/Dashboard.vue";

const RootRoute: RouteRecordRaw = {
  path: "/",
  name: "Root",
  component: Home,
  meta: {
    title: "Root",
  },
  children: [{ path: "", name: "Dashboard", component: Dashboard }],
};

const InitRouter: RouteRecordRaw = {
  path: "/init",
  name: "Init",
  meta: {
    title: "",
  },
  children: [
    { path: "electron", name: "InitElectron", component: InitElectron },
    { path: "browser", name: "InitBrowser", component: InitBrowser },
  ],
};

const router = createRouter({
  history: createWebHashHistory(),
  routes: [RootRoute, InitRouter],
  strict: true,
});

router.beforeEach(async (to, _from) => {
  const preferencesStore = usePreferencesStore();

  if (
    to.name != "InitElectron" &&
    !preferencesStore.useBrowser &&
    (preferencesStore.preference === null ||
      preferencesStore.preference.appConfig.libraries.length === 0)
  ) {
    preferencesStore.preference?.appConfig.libraries.forEach((library) => {
      const { path, use } = library;
      console.log(path, use);
    });
    return { name: "InitElectron" };
  }
});

export { router };
