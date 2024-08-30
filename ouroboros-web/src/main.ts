import { createApp } from "vue";
import { createPinia } from "pinia";
import { router } from "@/router";

import i18nInstance from "./locales/i18n.ts";

// context menu
import "@imengyu/vue3-context-menu/lib/vue3-context-menu.css";
import ContextMenu from "@imengyu/vue3-context-menu";

import "splitpanes/dist/splitpanes.css";
import "primeicons/primeicons.css";
import "./themes/common.scss";
import "./style.scss";

import App from "./App.vue";

const pinia = createPinia();
const app = createApp(App);

app.use(i18nInstance);
app.use(pinia);
app.use(router);
app.use(ContextMenu);
app.mount("#app");
