import { defineStore } from "pinia";
import { i18n } from "@/locales/i18n";
import { getPreferencesAPI, getPreferencesEAPI } from "@/api/preferences";

interface preferences {
  useBrowser: boolean;
  useLanuage: string;
  preference: PreferencesData | null;
}

export const usePreferencesStore = defineStore("preferences", {
  state: (): preferences => ({
    useBrowser: false,
    useLanuage: "zh-CN",
    preference: null,
  }),

  actions: {
    async getPreferences() {
      if (!window.electronAPI) {
        this.useBrowser = true;
        await getPreferencesAPI();
      } else {
        const preferences = await getPreferencesEAPI();
        this.preference = preferences;
      }
    },

    async sync() {
      if (this.useBrowser) {
      } else {
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
