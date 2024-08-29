<template>
  <!-- Default slot usage -->
  <GridLayout
    class="region"
    ref="region"
    v-model:layout="layout"
    :col-num="10"
    :row-height="50"
    :is-draggable="false"
    :is-resizable="false"
    :vertical-compact="true"
    :responsive="false"
    use-css-transforms
  >
    <GridItem
      v-for="item in layout"
      :key="item.i"
      :x="item.x"
      :y="item.y"
      :w="item.w"
      :h="item.h"
      :i="item.i"
      @resize="handleResize"
    >
      <img
        src="https://www.baidu.com/img/flexible/logo/pc/result.png"
        @dragstart="onDragStart"
        draggable="true"
      />
    </GridItem>
  </GridLayout>
  <!-- <div>{{ mouse }}</div>

  <div ref="regionRef" class="selection-area" :style="regionConfig"></div> -->
</template>
<style lang="less">
.vgl-item {
  background-color: aliceblue;
  img {
    height: 100%;
    width: 100%;
    object-fit: contain;
  }
}
.selection-area {
  position: fixed;
  background-color: red;
}
</style>
<script setup lang="ts">
import { GridLayout, GridItem } from "grid-layout-plus";
import { reactive, ref, Ref, onMounted } from "vue";
// import { useMouseInElement, useMousePressed } from "@vueuse/core";

const region: Ref<HTMLElement | null> = ref(null);
// const mouse = reactive(useMouseInElement(region));
// const { pressed } = useMousePressed();
// const regionConfig = ref({
//   top: "0px",
//   left: "0px",
//   width: "0px",
//   height: "0px",
// });
// const start = ref({ x: 0, y: 0 });

const layout = reactive([
  { x: 0, y: 0, w: 1, h: 1, i: "0" },
  { x: 1, y: 0, w: 1, h: 1, i: "1" },
  { x: 2, y: 0, w: 1, h: 1, i: "2" },
  { x: 3, y: 0, w: 1, h: 1, i: "3" },
  { x: 4, y: 0, w: 1, h: 1, i: "4" },
  { x: 5, y: 0, w: 1, h: 1, i: "5" },
  { x: 6, y: 0, w: 1, h: 1, i: "6" },
  { x: 7, y: 0, w: 1, h: 1, i: "7" },
]);

onMounted(() => {});

// const onMousedown = () => {
//   console.log("onMousedown");
//   if (mouse.isOutside) return;
//   start.value = { x: mouse.x, y: mouse.y };
// };

// const onMouseup = () => {
//   console.log("onMouseup");
//   start.value = { x: 0, y: 0 };
//   regionConfig.value = {
//     top: "0px",
//     left: "0px",
//     width: "0px",
//     height: "0px",
//   };
// };

// const onMousemove = () => {
//   console.log("onMousemove");
//   if (!pressed.value) return;

//   const x = mouse.x - start.value.x;
//   const y = mouse.y - start.value.y;

//   regionConfig.value.width = Math.abs(x) + "px";
//   regionConfig.value.height = Math.abs(y) + "px";

//   if (x < 0) {
//     regionConfig.value.left = mouse.x + "px";
//   } else {
//     regionConfig.value.left = start.value.x + "px";
//   }

//   if (y < 0) {
//     regionConfig.value.top = mouse.y + "px";
//   } else {
//     regionConfig.value.top = start.value.y + "px";
//   }
// };

function handleResize() {}

function onDragStart(event: DragEvent) {
  console.log(event.dataTransfer?.setData("123", "123"));
}
</script>
