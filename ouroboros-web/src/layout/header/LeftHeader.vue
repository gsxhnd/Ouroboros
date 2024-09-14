<template>
  <div class="left-header electron-drag app-header">
    <div class="button-group">
      <i
        v-tooltip="'setting'"
        class="icon pi pi-cog"
        @click="openPreference"
      ></i>
      <i
        v-tooltip="'test'"
        class="icon pi pi-spin pi-spinner"
        @click="preferencesStore.toggleSidePanel()"
      ></i>
    </div>
  </div>

  <Setting />
</template>
<script setup lang="ts">
import Setting from "@/pages/setting/Setting.vue";
import { usePreferencesStore } from "@/stores/preferences";
const preferencesStore = usePreferencesStore();

function openPreference() {
  preferencesStore.showModal = true;
}
</script>

<style scoped>
.left-header {
  display: flex;
  flex-direction: row-reverse;
  .button-group {
    display: flex;
    align-items: center;
    .icon {
      cursor: pointer;
      margin-right: 10px;
    }
  }
}
</style>
