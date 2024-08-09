<template>
  <div class="content-pane">
    <content-title-bar></content-title-bar>
    <span @click="test">{{ $t("message.hello") }}</span>
    <div>
      <waterfall
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
      </waterfall>
    </div>
    <router-view></router-view>
  </div>
</template>

<script setup lang="ts">
import { reactive, onBeforeMount, onMounted } from "vue";
import Viewer from "viewerjs";
import "viewerjs/dist/viewer.min.css";
import Waterfall from "@/components/Waterfall.vue";
import ContentTitleBar from "@/components/titlebar/ContentTitleBar.vue";
import { usePreferencesStore } from "@/stores/preferences";
const preferencesStore = usePreferencesStore();

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

const waterfallOption = reactive({
  loading: false,
  bottomDistance: 0,
  // 是否只展示图片，这是自定义加的一个属性
  onlyImage: false,
  topPreloadScreenCount: 0,
  bottomPreloadScreenCount: 0,
  virtual: true,
  gap: 10,
  padding: 15,
  itemMinWidth: 220,
  minColumnCount: 2,
  maxColumnCount: 10,
});

const data = reactive({
  page: 0,
  size: 30,
  total: 0,
  max: 0,
  list: [] as ItemOption[],
  end: false,
});

onBeforeMount(async () => {
  await loadData();
});

onMounted(async () => {});

function showViewer() {
  console.log("showViewer");
  let g = document.getElementById("image");
  if (g == null) return;

  const viewer = new Viewer(g, {
    inline: true,
    hidden: function () {
      viewer.destroy();
    },
  });
  viewer.show();
}

const calcItemHeight = (item: ItemOption, itemWidth: number) => {
  return item.height * (itemWidth / item.width);
};

const loadData = async () => {
  if (data.end) {
    return;
  }
  data.page += 1;
  const response = await fetch(
    `https://mock.tatakai.top/images?page=${data.page}&size=${data.size}&mode=simple`
  );
  const result = await response.json();
  if (!result.list.length) {
    data.end = true;
    return;
  }
  data.total = result.total;
  data.max = result.max;
  data.list = [...data.list, ...result.list];
};

function test() {
  preferencesStore.changeLanuage("en");
}
</script>

<style scoped lang="less">
.content-pane {
  height: 100%;
  overflow: auto;
  background-color: rgb(55, 56, 60);
}
</style>
