import { defineStore } from "pinia";
import { i18n, Language } from "@/locales/i18n";
import { getPreferencesAPI, getPreferencesEAPI } from "@/api/preferences";
import { localStore } from "@/utils/store";
import { usePreset } from "@primevue/themes";
import { darkTheme } from "@/themes/theme";

interface preferences {
  useBrowser: boolean;
  useElectron: boolean;
  useLanguage: string;
  preference: PreferencesData | null;
}

export const usePreferencesStore = defineStore("preferences", {
  state: (): preferences => ({
    useBrowser: false,
    useElectron: false,
    useLanguage: "en-US",
    preference: null,
  }),

  actions: {
    async init() {
      if (!window.electronAPI) {
        this.useBrowser = true;
      } else {
        this.useElectron = true;
      }

      await localStore.getItem<string>("useLanguage").then((res) => {
        if (res) {
          this.useLanguage = res;
        }
      });
    },

    async getPreferences() {
      if (!window.electronAPI) {
        this.useBrowser = true;
        await getPreferencesAPI();
      } else {
        const preferences = await getPreferencesEAPI();
        this.preference = preferences;
      }
    },

    async changeLanguage(l: Language) {
      localStore.setItem("useLanguage", l).then((v) => {
        this.useLanguage = v;
        i18n.locale.value = v;
      });
    },

    async changeTheme() {
      usePreset(darkTheme);
    },
  },
});
