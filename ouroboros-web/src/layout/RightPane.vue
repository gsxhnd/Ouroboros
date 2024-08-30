<template>
  <div class="right-pane">
    <right-title-bar></right-title-bar>
    <span>{{ $t("message.hello") }}</span>
  </div>
</template>
<script setup lang="ts">
import RightTitleBar from "@/components/titlebar/RightTitleBar.vue";
</script>

<style scoped lang="scss">
.right-pane {
  background-color: var(--app-pane-background-2);
  height: 100vh;
}
</style>
