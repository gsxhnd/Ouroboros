import { createApp } from "vue";
import { createPinia } from "pinia";
import { router } from "@/router";

import i18nInstance from "./locales/i18n.ts";

// primevue
import PrimeVue from "primevue/config";
import Aura from "@primevue/themes/aura";
import "primeicons/primeicons.css";
import DialogService from "primevue/dialogservice";

// context menu
import "@imengyu/vue3-context-menu/lib/vue3-context-menu.css";
import ContextMenu from "@imengyu/vue3-context-menu";

import App from "./App.vue";
import "./style.less";

const pinia = createPinia();

const app = createApp(App);
app.use(i18nInstance);
app.use(pinia);
app.use(router);
app.use(PrimeVue, {
  theme: {
    preset: Aura,
  },
});
app.use(DialogService);
app.use(ContextMenu);

app.mount("#app");
