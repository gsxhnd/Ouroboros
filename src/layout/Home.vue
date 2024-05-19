<!-- <template>
  <div class="layout">
    <left-pane></left-pane>
    <content></content>
    <right-pane></right-pane>
  </div>
</template> -->

<template>
  <v-app id="inspire">
    <left-pane></left-pane>
    <v-main>
      <router-view></router-view>
    </v-main>
    <right-pane></right-pane>
  </v-app>
</template>

<script setup lang="ts">
import LeftPane from "./LeftPane.vue";
import RightPane from "./RightPane.vue";
import Content from "./Content.vue";
</script>

<style scoped lang="less">
.v-app-bar {
  background-color: #e9ebf2;
}
</style>
