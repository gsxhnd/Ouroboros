<template>
  <title-bar></title-bar>
  <hello-world></hello-world>
  <div class="layout-container">
    <div class="layout-sidebar">
      <router-view></router-view>
    </div>
  </div>
</template>

<script setup lang="ts">
import TitleBar from "./TitleBar.vue";
import HelloWorld from "@/components/HelloWorld.vue";
</script>

<style scoped lang="less"></style>
