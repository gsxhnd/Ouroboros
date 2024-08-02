import { createI18n } from "vue-i18n";
import enUS from "./en-US.json";
import zhCN from "./zh-CN.json";

const instance = createI18n({
  legacy: false,
  locale: "zh-CN",
  fallbackLocale: "en-US",
  messages: {
    "zh-CN": zhCN,
    "en-US": enUS,
  },
});

export default instance;

export const i18n = instance.global;
