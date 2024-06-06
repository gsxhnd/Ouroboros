// import { Preference } from "@/vite-env";
import { defineStore } from "pinia";
import { i18n } from "@/locales/i18n";

interface preferences {
  p: Preferences | null;
}

export const usePreferencesStore = defineStore("preferences", {
  state: (): preferences => ({
    p: null,
  }),
  actions: {
    async init() {
      if (window.electronAPI) {
        await window.electronAPI
          .loadPreferences()
          .then((data) => {
            this.p = data;
          })
          .catch((err) => {
            console.error(err);
          });
      }
      // const { locale } = useI18n();

      if (!this.p?.appConfig.language) {
        // locale.value = "cn";
      }
    },
    async changeLanuage(_l: string) {
      if (i18n.locale.value === "en-US") {
        i18n.locale.value = "zh-CN";
      } else {
        i18n.locale.value = "en-US";
      }
    },
  },
});
