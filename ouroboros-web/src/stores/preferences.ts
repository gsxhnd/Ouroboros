// import { Preference } from "@/vite-env";
import { defineStore } from "pinia";
import { i18n } from "@/locales/i18n";

interface preferences {
  preference: PreferencesData | null;
}

export const usePreferencesStore = defineStore("preferences", {
  state: (): preferences => ({
    preference: null,
  }),

  actions: {
    async getPreferences() {
      if (!window.electronAPI) return;
      const preferences = await window.electronAPI.loadPreferences();
      this.preference = preferences;
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
