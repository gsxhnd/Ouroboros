<template>
  <Draggable
    ref="tree"
    virtualization
    class="mtl-tree dir-tree"
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
          async () => {
            await folderStore.addFolder();
            console.log(stat, node);
          }
        "
      >
        <span class="mtl-ml">{{ node.name }}</span>
      </div>
    </template>
  </Draggable>
</template>

<script setup lang="ts">
import ContextMenu from "@imengyu/vue3-context-menu";
import { Draggable } from "@he-tree/vue";
import "@he-tree/vue/style/default.css";
import "@he-tree/vue/style/material-design.css";
import { userFolderStore } from "@/stores/folder";
import { ref, onMounted, onBeforeMount, Ref } from "vue";
import { Folder } from "@type";

interface TreeFolder {
  id: number;
  name: string;
  children: Array<TreeFolder>;
}

const folderStore = userFolderStore();
const tree = ref();
const folders: Ref<Array<TreeFolder>> = ref([]);

folderStore.$subscribe((mutation, state) => {
  let f = convertToTree(folderStore.folders);
  tree.value.addMulti(f);
});

onBeforeMount(async () => {
  await folderStore.getFolders();
});

onMounted(() => {});

function convertToTree(folders: Array<Folder>): Array<TreeFolder> {
  const map: { [key: number]: TreeFolder } = {};
  const roots: Array<TreeFolder> = [];

  // 首先将所有文件夹放入 map 中
  folders.forEach((folder) => {
    map[folder.id] = {
      id: folder.id,
      name: folder.name,
      children: [],
    };
  });

  // 然后构建树结构
  folders.forEach((folder) => {
    if (folder.pid === 0) {
      roots.push(map[folder.id]);
    } else {
      if (map[folder.pid]) {
        map[folder.pid].children.push(map[folder.id]);
      }
    }
  });

  return roots;
}

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

// function remove() {
//   tree.value.closeAll();
//   console.log(tree.value);
//   console.log(tree.value.getData());
//   console.log(tree.value.stats);
//   console.log(tree.value.removeMulti(tree.value.stats));
// }
</script>

<style scoped lang="less">
.dir-tree {
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
