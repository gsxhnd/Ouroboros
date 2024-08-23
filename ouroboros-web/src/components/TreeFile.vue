<template>
  <Draggable
    v-model="folders"
    ref="tree"
    virtualization
    class="mtl-tree dir-tree"
    treeLine
    updateBehavior="modify"
    :externalDataHandler="dropFile"
    :onExternalDragOver="() => true"
    @click:node="onClickNode"
  >
    <template
      #default="{ node, stat }: { node: any, stat: Stat<Folder> }"
      class="test"
    >
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
        :class="{ selected: selectFolderId == stat.data.id }"
        @contextmenu="onButtonClick"
      >
        <span class="mtl-ml">{{ node.name }}</span>
      </div>
    </template>
  </Draggable>
</template>

<script setup lang="ts">
import ContextMenu from "@imengyu/vue3-context-menu";
import { Draggable } from "@he-tree/vue";
import { Stat } from "@he-tree/tree-utils";
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
const tree = ref<InstanceType<typeof Draggable>>();
const folders: Ref<Array<TreeFolder>> = ref([]);
const selectFolderId: Ref<number> = ref(0);

onBeforeMount(async () => {
  await folderStore.getFolders();
  let f = convertToTree(folderStore.folders);
  console.log(f);
  tree.value?.addMulti(f);
});

onMounted(() => {
  console.log(typeof tree.value);
  console.log(tree);
});

// async function addRow(node: any) {
//   console.log(node);
//   await folderStore.addFolder();
//   let f = convertToTree(folderStore.folders);
//   folders.value = f;
// }

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

function onClickNode(stat: Stat<TreeFolder>) {
  console.log(stat.data.id);
  console.log(stat);
  selectFolderId.value = stat.data.id;
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
</script>

<style scoped lang="less">
.dir-tree {
  height: 100%;
  width: 100%;
  :deep(.tree-node:hover) {
    background-color: var(--p-tree-hover);
  }
  :deep(.tree-node:has(.tree-node-inner .selected)) {
    background-color: var(--p-tree-selected);
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
