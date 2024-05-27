<template>
  <div class="left-pane">
    <left-title-bar></left-title-bar>
    <Tree
      :value="nodes"
      class="w-full md:w-30rem"
      @contextmenu="onImageRightClick"
    >
    </Tree>
    <ContextMenu ref="menu" :model="items" />
    left pane
  </div>
</template>

<script setup lang="ts">
import LeftTitleBar from "@/components/titlebar/LeftTitleBar.vue";
import Tree from "primevue/tree";
import ContextMenu from "primevue/contextmenu";

import { ref, onMounted, Ref } from "vue";

const menu = ref();
const onImageRightClick = (event: any) => {
  menu.value.show(event);
};

const nodes: Ref<Array<object>> | Ref<undefined> = ref([
  {
    key: "a",
    label: "test",
    expandedIcon: "",
    icon: "pi pi-folder",
    children: [{ key: "aa", label: "testaa" }],
  },
  {
    key: "b",
    label: "testb",
    icon: "pi pi-folder",
  },
]);

const items = ref([
  { label: "Copy", icon: "pi pi-copy" },
  { label: "Rename", icon: "pi pi-file-edit" },
]);

onMounted(() => {});
</script>

<style scoped lang="less"></style>
