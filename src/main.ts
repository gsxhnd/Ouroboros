import { createApp } from "vue";
import { createPinia } from "pinia";
import { router } from "@/router";
import "./style.less";

// primevue
import PrimeVue from "primevue/config";
import "primevue/resources/themes/aura-light-green/theme.css";

import App from "./App.vue";

const pinia = createPinia();

const app = createApp(App);
app.use(PrimeVue);
app.use(router);
app.use(pinia);

app.mount("#app");
