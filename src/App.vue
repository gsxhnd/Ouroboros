<script setup lang="ts">
import { onBeforeMount } from "vue";
import { usePreferencesStore } from "@/stores/preferences";
const preferencesStore = usePreferencesStore();

onBeforeMount(() => {
  preferencesStore.init();
});
</script>

<template>
  <router-view class="router-view" />
</template>

<style scoped></style>
