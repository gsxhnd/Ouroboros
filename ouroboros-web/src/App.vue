<script setup lang="ts">
import { onMounted } from "vue";
import { usePreferencesStore } from "@/stores/preferences";
import DynamicDialog from "primevue/dynamicdialog";
const preferencesStore = usePreferencesStore();
// import { SupportLanguage } from "@/locales/i18n";

onMounted(async () => {
  console.log("onMount");
  await preferencesStore.init();
  console.log("onMount end");
});
</script>

<template>
  <DynamicDialog class="dialog" />
  <router-view class="router-view" />
</template>

<style scoped lang="less"></style>
