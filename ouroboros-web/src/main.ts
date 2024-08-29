import { createApp } from "vue";
import { createPinia } from "pinia";
import { router } from "@/router";

import i18nInstance from "./locales/i18n.ts";

// primevue
import PrimeVue from "primevue/config";
import "primeicons/primeicons.css";
import DialogService from "primevue/dialogservice";
import { oneDarkTheme } from "@/themes";

// context menu
import "@imengyu/vue3-context-menu/lib/vue3-context-menu.css";
import ContextMenu from "@imengyu/vue3-context-menu";

import App from "./App.vue";

import "bulma/css/bulma.min.css";
import "./style.less";
import "splitpanes/dist/splitpanes.css";

const pinia = createPinia();
const app = createApp(App);

app.use(i18nInstance);
app.use(pinia);
app.use(router);
app.use(PrimeVue, {
  theme: {
    preset: oneDarkTheme,
  },
});
app.use(DialogService);
app.use(ContextMenu);
app.mount("#app");
