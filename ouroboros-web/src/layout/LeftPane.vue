<template>
  <div class="left-pane">
    <left-title-bar></left-title-bar>
    <Accordion :value="'file'">
      <AccordionPanel value="file">
        <template #default
          >123
          <AccordionContent
            ><template #default><tree-file></tree-file></template
          ></AccordionContent>
        </template>
      </AccordionPanel>
      <AccordionPanel value="1">
        <template #default
          >123
          <AccordionContent><template #default>123</template></AccordionContent>
        </template>
      </AccordionPanel>
      <AccordionPanel value="2">
        <template #default
          >123
          <AccordionContent><template #default>123</template></AccordionContent>
        </template>
      </AccordionPanel>
    </Accordion>
  </div>
</template>

<script setup lang="ts">
import LeftTitleBar from "@/components/titlebar/LeftTitleBar.vue";
import TreeFile from "@/components/TreeFile.vue";

import Accordion from "primevue/accordion";
import AccordionPanel from "primevue/accordionpanel";
import AccordionContent from "primevue/accordioncontent";

import { onMounted } from "vue";

onMounted(() => {});
</script>

<style scoped lang="less">
.left-pane {
  padding: 2px;
}
</style>
