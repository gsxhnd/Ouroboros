<template>
  <div class="modal" :class="{ 'is-active': preferencesStore.showModal }">
    <div class="modal-background"></div>
    <div class="modal-content" v-on-click-outside="closeModal">
      <div class="left" @click="changeLanguage">
        <SettingSide />
      </div>
      <div class="right">
        <template v-if="settingDialogStore.selectedItem == 'dashboard'">
          <SettingDashboard />
        </template>
      </div>
    </div>
  </div>
</template>
<style scoped lang="scss">
.modal-content {
  height: 60vh;
  width: 40vw;
  display: flex;
  border-radius: 8px;
  color: white;
  .left {
    padding: 20px 5px;
    width: 30%;
    background-color: var(--app-pane-background-1);
  }
  .right {
    width: 70%;
    padding: 20px 5px;
    background-color: var(--app-pane-background-2);
  }
}
</style>
<script setup lang="ts">
import { ref, Ref, onBeforeMount } from "vue";
import { usePreferencesStore } from "@/stores/preferences";
import { userSettingDialogStore } from "@/stores/settingDialog";
import { Language } from "@/locales/i18n";
import { vOnClickOutside } from "@vueuse/components";
import SettingSide from "./SettingSide.vue";
import SettingDashboard from "./SettingDashboard.vue";

interface LanguageOption {
  name: string;
  code: Language;
}

const isActive = ref(true);
const preferencesStore = usePreferencesStore();
const settingDialogStore = userSettingDialogStore();

const selected: Ref<LanguageOption> = ref({ name: "中文", code: "zh-CN" });
const options: Ref<Array<LanguageOption>> = ref([
  { name: "中文", code: "zh-CN" },
  { name: "English", code: "en-US" },
]);

onBeforeMount(async () => {
  let index = options.value.findIndex(
    (item) => item.code === preferencesStore.useLanguage
  );

  selected.value = options.value[index];
});

async function changeLanguage() {
  await preferencesStore.changeLanguage("zh-CN");
  await preferencesStore.changeTheme();
}

function closeModal() {
  // alert("close");
  isActive.value = false;
  preferencesStore.showModal = false;
}
</script>
