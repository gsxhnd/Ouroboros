<template>
  <div class="left-title-bar electron-drag app-header-height">
    <div class="button-group">
      <i class="icon pi pi-cog" @click="openPreference"></i>
      <i
        class="icon pi pi-spin pi-spinner"
        @click="preferencesStore.toggleSidePanel()"
      ></i>
    </div>
  </div>

  <setting></setting>
</template>
<script setup lang="ts">
import Setting from "@/components/Setting.vue";
import { usePreferencesStore } from "@/stores/preferences";

const preferencesStore = usePreferencesStore();

function openPreference() {
  preferencesStore.showModal = true;
}
</script>

<style scoped>
.left-title-bar {
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
