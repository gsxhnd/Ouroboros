// import { Preference } from "@/vite-env";
import { defineStore } from "pinia";

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
    },
  },
});
