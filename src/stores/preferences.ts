import { Preference } from "@/vite-env";
import { defineStore } from "pinia";

interface preferences {
  p: Preference | null;
}

export const usePreferencesStore = defineStore("preferences", {
  state: (): preferences => ({
    p: null,
  }),
  actions: {
    init() {
      if (window.electronAPI) {
        window.electronAPI
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
