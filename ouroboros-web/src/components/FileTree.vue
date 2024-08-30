<template>
  <Draggable
    v-model="folders"
    ref="tree"
    virtualization
    class="mtl-tree folder-tree"
    treeLine
    updateBehavior="modify"
    :externalDataHandler="dropFile"
    :onExternalDragOver="() => true"
    @click:node="onClickNode"
  >
    <template
      #default="{ node, stat }: { node: TreeFolder, stat: Stat<Folder> }"
    >
      <i
        v-if="!stat.open && node.children.length > 0"
        @click.native="stat.open = !stat.open"
        class="pi pi-angle-right"
        style="font-size: 1rem"
      ></i>
      <i
        v-if="stat.open && node.children.length > 0"
        @click.native="stat.open = !stat.open"
        class="pi pi-angle-down"
        style="font-size: 1rem"
      ></i>

      <div
        class="dropzone"
        :class="{ selected: folderStore.selectedFolderId == stat.data.id }"
        @contextmenu="(e) => onMenuClick(e, node)"
      >
        <i
          v-if="!stat.open || node.children.length == 0"
          class="pi pi-folder"
          style="font-size: 1rem"
        ></i>
        <i
          v-if="stat.open && node.children.length > 0"
          class="pi pi-folder-open"
          style="font-size: 1rem"
        ></i>
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
import { ref, onMounted, onBeforeMount, Ref } from "vue";
import { useI18n } from "vue-i18n";

import { userFolderStore } from "@/stores/folder";
import { Folder } from "@/ouroboros";

interface TreeFolder {
  id: number;
  name: string;
  children: Array<TreeFolder>;
}

const i18n = useI18n();
const folderStore = userFolderStore();
const tree = ref<InstanceType<typeof Draggable>>();
const folders: Ref<Array<TreeFolder>> = ref([]);
const editFolderId: Ref<number> = ref(0);

onBeforeMount(async () => {
  await folderStore.getFolders();
  let f = convertToTree(folderStore.folders);
  tree.value?.addMulti(f);
});

onMounted(() => {
  console.log(typeof tree.value);
  console.log(tree);
});

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

async function onClickNode(stat: Stat<TreeFolder>) {
  // await folderStore.getFolders();
  // let f = convertToTree(folderStore.folders);
  // tree.value?.addMulti(f);
  folderStore.selectedFolderId = stat.data.id;
}

function onMenuClick(e: MouseEvent, node: TreeFolder) {
  //Show component mode menu
  // show.value = true;
  // optionsComponent.value.x = e.x;
  // optionsComponent.value.y = e.y;
  //prevent the browser's default menu
  console.log(e);
  e.preventDefault();
  //show your menu
  ContextMenu.showContextMenu({
    x: e.x,
    y: e.y,
    iconFontClass: "pi",
    theme: "mac dark",
    items: [
      {
        label: i18n.t("message.Tag"),
        iconFontClass: "pi-folder",
        onClick: () => {
          editFolderId.value = node.id;
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
  console.log(event.dataTransfer?.getData("123"));
  console.log(event);
}
</script>

<style scoped lang="scss">
.folder-tree {
  font-size: 18px;
  height: 100%;
  width: 100%;
  :deep(.tree-node) {
    &:hover {
      background-color: var(--app-file-tree-hover);
    }
    &:has(.tree-node-inner .selected) {
      background-color: var(--app-file-tree-selected);
    }
  }

  .mtl-ml {
    font-size: 16px;
    width: 100%;
    text-align: left;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .dropzone {
    margin-left: 2px;
    width: 100%;
    display: flex;
    align-items: center;
    .folder-name-input {
      font-size: 1em;
      padding: 0 4px;
      border-radius: 2px;
      border: none;
      height: 100%;
      width: 80%;
    }
  }
}
</style>
