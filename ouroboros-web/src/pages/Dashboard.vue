<template>
  <!-- <waterfall
    class="image"
    id="image"
    :virtual="waterfallOption.virtual"
    :gap="waterfallOption.gap"
    :padding="waterfallOption.padding"
    :items="data.list"
    :item-min-width="waterfallOption.itemMinWidth"
    :calc-item-height="calcItemHeight"
  >
    <template #default="{ item }: { item: ItemOption }">
      <img @click="showViewer" :src="item.url" />
    </template>
  </waterfall> -->

  <div class="grid">
    <div class="cell">Cell 1</div>
    <div class="cell">Cell 2</div>
    <div class="cell">Cell 3</div>
    <div class="cell">Cell 4</div>
    <div class="cell">Cell 5</div>
    <div class="cell">Cell 6</div>
    <div class="cell">Cell 7</div>
    <div class="cell">Cell 8</div>
    <div class="cell">Cell 9</div>
    <div class="cell">Cell 10</div>
    <div class="cell">Cell 11</div>
    <div class="cell">Cell 12</div>
    <div class="cell">Cell 13</div>
    <div class="cell">Cell 14</div>
    <div class="cell">Cell 15</div>
    <div class="cell">Cell 16</div>
    <div class="cell">Cell 17</div>
    <div class="cell">Cell 18</div>
    <div class="cell">Cell 19</div>
    <div class="cell">Cell 20</div>
    <div class="cell">Cell 21</div>
    <div class="cell">Cell 22</div>
    <div class="cell">Cell 23</div>
    <div class="cell">Cell 24</div>
  </div>
</template>

<style scoped lang="scss">
.grid {
  .cell {
    background-color: aqua;
  }
}
</style>

<script setup lang="ts">
import { reactive, onBeforeMount, onMounted } from "vue";
import { userFolderStore } from "@/stores/folder";
import { useFileStore } from "@/stores/file";
// import Viewer from "viewerjs";
// import "viewerjs/dist/viewer.min.css";

interface ItemOption {
  id: number;
  title: string;
  url: string;
  width: number;
  height: number;
  avatar: string;
  user: string;
  views: number;
}

const folderStore = userFolderStore();
const fileStore = useFileStore();

folderStore.$subscribe((_mutation, state) => {
  if (state.selectedFolderId == 0) return;
  fileStore.getFiles(state.selectedFolderId);
});

// const waterfallOption = reactive({
//   loading: false,
//   bottomDistance: 0,
//   // 是否只展示图片，这是自定义加的一个属性
//   onlyImage: false,
//   topPreloadScreenCount: 0,
//   bottomPreloadScreenCount: 0,
//   virtual: true,
//   gap: 10,
//   padding: 15,
//   itemMinWidth: 220,
//   minColumnCount: 2,
//   maxColumnCount: 10,
// });

// const data = reactive({
//   page: 0,
//   size: 30,
//   total: 0,
//   max: 0,
//   list: [] as ItemOption[],
//   end: false,
// });

onBeforeMount(async () => {
  // await loadData();
});

onMounted(async () => {});

// function showViewer() {
//   console.log("showViewer");
//   let g = document.getElementById("image");
//   if (g == null) return;

//   const viewer = new Viewer(g, {
//     inline: true,
//     hidden: function () {
//       viewer.destroy();
//     },
//   });
//   viewer.show();
// }

// const calcItemHeight = (item: ItemOption, itemWidth: number) => {
//   return item.height * (itemWidth / item.width);
// };

// const loadData = async () => {
//   if (data.end) {
//     return;
//   }
//   data.page += 1;
//   const response = await fetch(
//     `https://mock.tatakai.top/images?page=${data.page}&size=${data.size}&mode=simple`
//   );
//   const result = await response.json();
//   if (!result.list.length) {
//     data.end = true;
//     return;
//   }
//   data.total = result.total;
//   data.max = result.max;
//   // data.list = [...data.list, ...result.list];
// };
</script>
