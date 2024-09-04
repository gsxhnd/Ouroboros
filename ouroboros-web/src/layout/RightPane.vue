<template>
  <div class="right-pane">
    <RightHeader />
    <span>{{ $t("message.hello") }}</span>
  </div>
</template>
<script setup lang="ts">
import RightHeader from "./header/RightHeader.vue";
</script>

<style scoped lang="scss">
.right-pane {
  background-color: var(--app-pane-background-2);
  height: 100vh;
}
</style>
