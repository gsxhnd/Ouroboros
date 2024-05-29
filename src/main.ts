import { createApp } from "vue";
import { createPinia } from "pinia";
import { router } from "@/router";
import "./style.less";

// primevue
import PrimeVue from "primevue/config";
import "primevue/resources/themes/aura-light-green/theme.css";
import "primeicons/primeicons.css";

import "@imengyu/vue3-context-menu/lib/vue3-context-menu.css";
import ContextMenu from "@imengyu/vue3-context-menu";

import App from "./App.vue";

const pinia = createPinia();

const app = createApp(App);
app.use(PrimeVue);
app.use(ContextMenu);
app.use(router);
app.use(pinia);

app.mount("#app");
