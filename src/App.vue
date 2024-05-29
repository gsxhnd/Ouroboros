<script setup lang="ts">
import { onBeforeMount, onMounted } from "vue";
import { usePreferencesStore } from "@/stores/preferences";
const preferencesStore = usePreferencesStore();
import { useRoute, useRouter } from "vue-router";

const router = useRouter();
// const route = useRoute();

onBeforeMount(async () => {
  await preferencesStore.init();
  if (preferencesStore.p?.appConfig.libraries.length === 0) {
    router.push("/init");
  }
});

onMounted(() => {});
</script>

<template v-if="preferences.p">
  <router-view class="router-view" />
</template>

<style scoped></style>
