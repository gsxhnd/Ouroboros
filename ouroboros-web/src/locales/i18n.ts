import { createI18n } from "vue-i18n";
import enUS from "./en-US.json";
import zhCN from "./zh-CN.json";

// async function createInstance() {
//   let l = await localStore
//     .getItem<string>("useLanguage")
//     .then((l) => {
//       if (l != null) return l;
//       if (languages.value[0] == "zh-CN") return "zh-CN";
//       return "en-US";
//     })
//     .then((v) => {
//       return localStore.setItem("useLanguage", v);
//     });

//   return createI18n({
//     legacy: false,
//     locale: "en-US",
//     fallbackLocale: "en-US",
//     messages: {
//       "zh-CN": zhCN,
//       "en-US": enUS,
//     },
//   });
// }

const instance = createI18n({
  legacy: false,
  locale: "en-US",
  fallbackLocale: "en-US",
  messages: {
    "zh-CN": zhCN,
    "en-US": enUS,
  },
});

export default instance;
export const i18n = instance.global;

export const SupportLanguage: Array<Language> = ["zh-CN", "en-US"];
export type Language = "zh-CN" | "en-US";
