<template>
  <div class="title-bar">
    <v-btn variant="tonal" class="btn"> Button </v-btn>
    <div class="bar"></div>
    <div class="right"></div>
  </div>
</template>

<script setup lang="ts"></script>

<style scoped lang="less">
.title-bar {
  display: flex;
  height: 30px;
  // background-color: red;
  -webkit-user-select: none;
  .btn {
    height: 30px;
  }
  .bar {
    -webkit-app-region: drag;
    width: auto;
    flex: 1;
    background-color: red;
  }
  .right {
    width: 100px;
    background-color: green;
  }
}
</style>
