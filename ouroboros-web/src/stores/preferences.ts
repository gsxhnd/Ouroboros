import { defineStore } from "pinia";
import { i18n, Language } from "@/locales/i18n";
import { localStore } from "@/utils/store";

import { usePreferredLanguages } from "@vueuse/core";
import { Ref, ref, computed } from "vue";

const languages = usePreferredLanguages();

export const usePreferencesStore = defineStore("preferences", () => {
  const useBrowser: Ref<boolean> = ref(false);
  const useElectron: Ref<boolean> = ref(false);
  const target: Ref<string> = ref("");
  const useLanguage: Ref<Language> = ref("en-US");
  const showModal: Ref<boolean> = ref(false);
  const showSidePanel: Ref<boolean> = ref(true);
  const sidePanelSize: Ref<Array<number>> = ref([20, 60, 20]);

  async function init() {
    if (!window.electronAPI) {
      useBrowser.value = true;
      target.value = "web";
    } else {
      useElectron.value = true;
      target.value = "desktop";
    }

    let l = await localStore
      .getItem<Language>("useLanguage")
      .then((l) => {
        if (l != null) return l;
        if (languages.value[0] == "zh-CN") return "zh-CN";
        return "en-US";
      })
      .then((v) => {
        return localStore.setItem("useLanguage", v);
      });
    useLanguage.value = l;
    i18n.locale.value = l;
  }

  async function changeLanguage(l: Language) {
    localStore.setItem("useLanguage", l).then((v) => {
      useLanguage.value = v;
      i18n.locale.value = v;
    });
  }

  async function changeTheme() {}

  async function toggleSidePanel() {
    showSidePanel.value = !showSidePanel.value;
  }

  async function resizeSidePanel(size: Array<number>) {
    sidePanelSize.value = size;
  }

  return {
    useBrowser,
    useElectron,
    useLanguage,
    target,
    showSidePanel,
    sidePanelSize,
    showModal,
    init,
    changeLanguage,
    toggleSidePanel,
    changeTheme,
    resizeSidePanel,
  };
});
