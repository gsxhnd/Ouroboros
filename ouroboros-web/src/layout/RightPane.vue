<template>
  <div>
    <right-title-bar></right-title-bar>
    <span>{{ $t("message.hello") }}</span>
  </div>
</template>
<script setup lang="ts">
import RightTitleBar from "@/components/titlebar/RightTitleBar.vue";
</script>

<style scoped lang="less">
.right-pane {
}
</style>
