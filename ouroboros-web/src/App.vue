<script setup lang="ts">
import { onMounted, onBeforeMount } from "vue";
import { usePreferencesStore } from "@/stores/preferences";
const preferencesStore = usePreferencesStore();
// import { SupportLanguage } from "@/locales/i18n";

onBeforeMount(() => {
  const doc = document.documentElement;
  doc.dataset.theme = "oneDark";
});

onMounted(async () => {
  await preferencesStore.init();
});
</script>

<template>
  <router-view class="router-view" />
</template>
<style scoped lang="scss"></style>
