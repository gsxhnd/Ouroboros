<template>
  <Draggable
    v-model="data"
    ref="tree"
    virtualization
    class="mtl-tree dirtree"
    treeLine
    :externalDataHandler="dropFile"
    :onExternalDragOver="() => true"
  >
    <template #default="{ node, stat }" class="test">
      <i
        v-if="!stat.open"
        @click.native="stat.open = !stat.open"
        class="pi pi-angle-right"
        style="font-size: 1rem"
      ></i>
      <i
        v-if="stat.open"
        @click.native="stat.open = !stat.open"
        class="pi pi-angle-down"
        style="font-size: 1rem"
      ></i>

      <div
        class="dropzone"
        @contextmenu="onButtonClick"
        @click="
          () => {
            console.log(stat, node);
          }
        "
      >
        <span class="mtl-ml">{{ node.text }}</span>
      </div>
    </template>
  </Draggable>
  <button @click="remove">remove</button>
</template>

<script setup lang="ts">
import ContextMenu from "@imengyu/vue3-context-menu";
import { Draggable } from "@he-tree/vue";
import "@he-tree/vue/style/default.css";
import "@he-tree/vue/style/material-design.css";
import { getFolders } from "@/api/folder";

import { ref, onMounted, onBeforeMount } from "vue";
import type { Ref } from "vue";

const tree = ref();
const data: Ref<Array<any>> = ref([]);

onBeforeMount(async () => {
  console.log("onBeforeMount");
  let l: Array<any> = [];
  await getFolders().then((res: Array<any>) => {
    console.log(res);
    res.forEach((e) => {
      console.log("foreach");
      if (e["parent_id"] === 0) {
        l.push({
          text: e.name,
          children: [{ text: "aaa" }],
        });
      }
    });
  });
  console.log(tree.value.addMulti(l));
});

onMounted(() => {});

function onButtonClick(e: MouseEvent) {
  //Show component mode menu
  // show.value = true;
  // optionsComponent.value.x = e.x;
  // optionsComponent.value.y = e.y;
  //prevent the browser's default menu
  e.preventDefault();
  //show your menu
  ContextMenu.showContextMenu({
    x: e.x,
    y: e.y,
    iconFontClass: "pi",
    theme: "mac dark",
    items: [
      {
        label: "A menu item",
        iconFontClass: "pi-folder",
        onClick: () => {
          alert("You click a menu item");
        },
      },
      {
        label: "A submenu",
        children: [{ label: "Item1" }, { label: "Item2" }, { label: "Item3" }],
      },
    ],
  });
}

function dropFile(event: DragEvent) {
  console.log("drop");
  console.log(event);
  event.preventDefault();
  event.stopPropagation();

  console.log(event.dataTransfer?.files);
  console.log(event);
}

function remove() {
  tree.value.closeAll();
  console.log(tree.value);
  console.log(tree.value.getData());
  console.log(tree.value.stats);
  console.log(tree.value.removeMulti(tree.value.stats));
}
</script>

<style scoped lang="less">
.dirtree {
  height: 500px;
  :deep(.tree-node:hover) {
    background-color: rgb(255 255 255 / 10%);
  }
  .tree-node {
    display: flex;
    width: 100%;
  }

  .mtl-ml {
    width: 100%;
    text-align: left;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  input {
    width: 0px;
  }
  .dropzone {
    width: 100%;
    display: flex;
  }
}
</style>
