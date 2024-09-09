<template>
  <div class="right-pane">
    <RightHeader />
    <span>{{ $t("message.hello") }}</span>
    <div class="buttons">
      <button class="button is-primary is-light">Primary</button>
      <button class="button is-link is-light">Link</button>
    </div>
    <div class="buttons">
      <button class="button is-info is-light">Info</button>
      <button class="button is-success is-light">Success</button>
      <button class="button is-warning is-light">Warning</button>
      <button class="button is-danger is-light">Danger</button>
    </div>
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
