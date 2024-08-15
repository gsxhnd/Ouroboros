<template>
  <div class="left-title-bar electron-drag">
    <div class="button-group">
      <i class="pi pi-cog" @click="openPreference"></i>
      <i class="pi pi-spin pi-spinner"></i>
      <i class="pi pi-spin pi-spinner"></i>
    </div>
  </div>
</template>
<script setup lang="ts">
import { useRoute, useRouter } from "vue-router";
import { useDialog } from "primevue/usedialog";
import Setting from "@/components/Setting.vue";
const dialog = useDialog();

const router = useRouter();
const route = useRoute();

function openPreference() {
  dialog.open(Setting, {
    props: {
      modal: true,
      closable: false,
      draggable: false,
      showHeader: false,
      dismissableMask: true,
      contentClass: "setting-dialog",
    },
    onClose: (options: any) => {
      console.log("close opt: ", options);
    },
  });
  // router.push({ path: "/setting", replace: true, query: route.query });
}
</script>

<style scoped>
.left-title-bar {
  display: flex;
  height: 30px;
  flex-direction: row-reverse;
  .button-group {
    display: flex;
    align-items: center;
    /* padding-right: 10px; */
    i {
      cursor: pointer;
      margin-right: 10px;
    }
  }
}
</style>
