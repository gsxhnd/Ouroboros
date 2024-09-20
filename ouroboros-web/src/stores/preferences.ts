import { defineStore } from "pinia";
import { i18n, SupportLanguages } from "@/locales/i18n";
import { localStore } from "@/utils/store";

import { usePreferredLanguages } from "@vueuse/core";
import { Ref, ref, computed } from "vue";

const languages = usePreferredLanguages();

export const usePreferencesStore = defineStore("preferences", () => {
  const useBrowser: Ref<boolean> = ref(false);
  const useElectron: Ref<boolean> = ref(false);
  const target: Ref<string> = ref("");
  const useLanguage: Ref<string> = ref("en-US");
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

    await localStore
      .getItem<SupportLanguages>("useLanguage")
      .then((l) => {
        if (l != null) return l;
        if (languages.value[0] == "zh-CN") return "zh-CN";
        return "en-US";
      })
      .then((v) => {
        changeLanguage(v);
      });
  }

  async function changeLanguage(l: SupportLanguages) {
    await localStore.setItem("useLanguage", l).then((v) => {
      if (v === "zh-CN" || v === "en-US") {
        useLanguage.value = v;
        i18n.global.locale.value = l;
      }
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
