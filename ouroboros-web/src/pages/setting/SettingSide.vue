<template>
  <aside class="menu">
    <template v-for="(item, pIndex) in settingDialogStore.sideItems">
      <p class="menu-label">{{ item.label }}</p>
      <ul class="menu-list">
        <li v-for="(v, index) in item.children">
          <a
            :class="{ 'is-active': v.activated }"
            @click="settingDialogStore.selectItem(v.item, pIndex, index)"
            >{{ v.label }}</a
          >
        </li>
      </ul>
    </template>
  </aside>
</template>

<style scoped lang="scss"></style>

<script setup lang="ts">
import { userSettingDialogStore } from "@/stores/settingDialog";
const settingDialogStore = userSettingDialogStore();
</script>
