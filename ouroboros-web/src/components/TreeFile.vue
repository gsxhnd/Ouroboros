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
    <template #default="{ node, stat }">
      <OpenIcon
        v-if="stat.children.length"
        :open="stat.open"
        class="mtl-mr"
        @click.native="stat.open = !stat.open"
      />

      <div class="dropzone" @contextmenu="onButtonClick">
        <span class="mtl-ml">{{ node.text }}</span>
      </div>
    </template>
  </Draggable>
  <context-menu v-model:show="show" :options="optionsComponent">
    <context-menu-item label="Simple item" />
    <context-menu-sperator /><!--use this to add sperator-->
    <context-menu-group label="Menu with child">
      <context-menu-item label="Item1" />
      <context-menu-item label="Item2" />
      <context-menu-group label="Child with v-for 50">
        <context-menu-item
          v-for="index of 50"
          :key="index"
          :label="'Item3-' + index"
        />
      </context-menu-group>
    </context-menu-group>
  </context-menu>
</template>

<script setup lang="ts">
import ContextMenu from "@imengyu/vue3-context-menu";
import { Draggable, OpenIcon } from "@he-tree/vue";
import "@he-tree/vue/style/default.css";
import "@he-tree/vue/style/material-design.css";

import { ref, onMounted } from "vue";

const show = ref(false);
const optionsComponent = ref({
  zIndex: 3,
  minWidth: 230,
  x: 500,
  y: 200,
});

const data = ref([
  {
    text: "Projects",
    children: [
      {
        text: "Frontend",
        children: [
          {
            text: "Vue",
            children: [
              {
                text: "Nuxt",
              },
            ],
          },
          {
            text: "React",
            children: [
              {
                text: "Next",
              },
            ],
          },
          {
            text: "Angular",
          },
        ],
      },
      {
        text: "Backend",
      },
    ],
  },
  {
    text: "Videos",
    children: [
      {
        text: "Movie",
        children: [
          {
            text: "The Godfather",
          },
          {
            text: "La Dolce Vita",
          },
          {
            text: "In the Mood for Love",
          },
        ],
      },
      {
        text: "AD",
      },
      {
        text: "Shorts",
      },
    ],
  },
  {
    text: "Photos",
    children: [
      {
        text: "Animals",
      },
      {
        text: "Buildings",
      },
      {
        text: "Sky",
      },
      {
        text: "Sea",
      },
    ],
  },
  {
    text: "Music",
    children: [
      {
        text: "My Happy Melodies.",
      },
      {
        text: "Hello Summer.",
      },
      {
        text: "An Overture To Happiness.",
      },
      {
        text: "Sunny Days.",
      },
      {
        text: "Every One Need Adventure.",
      },
      {
        text: "Happy, Chill Radio.",
      },
      {
        text: "I Found My Way.",
      },
      {
        text: "Early, Early Morning.",
      },
    ],
  },
  {
    text: "Games",
    children: [
      {
        text: "swimming",
      },
      {
        text: "cycling",
      },
      {
        text: "tennis",
      },
      {
        text: "boxing",
      },
    ],
  },
  {
    text: "Download",
  },
]);

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
onMounted(() => {});
</script>

<style scoped lang="less">
.dirtree {
  height: 500px;
  :deep(.tree-node:hover) {
    background-color: rgb(255 255 255 / 10%);
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
}
</style>
