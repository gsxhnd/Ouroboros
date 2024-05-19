<template>
  <v-navigation-drawer location="right" class="right-pane">
    <v-list>
      <v-list-item title="Drawer right"></v-list-item>
    </v-list>
  </v-navigation-drawer>
</template>

<script setup lang="ts"></script>

<style scoped lang="less">
.right-pane {
  display: flex;
  &::before {
    content: "";
    // color: transparent;
    border-top: 100px solid black;
    cursor: move;
    height: 100%;
  }
  //   resize: horizontal;
  //   overflow-x: auto;
  //   opacity: 0;
  //   width: 1px;
  //   height: 100%;
  //   cursor: col-resize;
}
</style>
