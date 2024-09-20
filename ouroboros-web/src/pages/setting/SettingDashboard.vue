<template>
  <div></div>
  <div class="columns is-desktop is-gapless">
    <div class="column">1</div>
    <div class="column">
      <multiselect
        v-model="languageSelected"
        :options="languageOptions"
        :searchable="false"
        :show-labels="false"
        :allow-empty="false"
        label="label"
        track-by="value"
        placeholder="Pick a value"
        @update:modelValue="changeLanguage"
      ></multiselect>
    </div>
  </div>
</template>

<script setup lang="ts">
import Multiselect from "vue-multiselect";
import { ref, onBeforeMount } from "vue";

import { usePreferencesStore } from "@/stores/preferences";
import { SupportLanguages } from "@/locales/i18n";
const preferencesStore = usePreferencesStore();

interface languageOptions {
  label: string;
  value: SupportLanguages;
}

const languageSelected = ref({ label: "中文", value: "zh-CN" });
const languageOptions = ref([
  {
    label: "中文",
    value: "zh-CN",
  },
  {
    label: "English",
    value: "en-US",
  },
]);

preferencesStore.$subscribe((_mutation, state) => {
  languageOptions.value.findIndex((item) => {
    if (item.value === state.useLanguage) {
      languageSelected.value = item;
    }
  });
});

async function changeLanguage(value: languageOptions, id: any) {
  await preferencesStore.changeLanguage(value.value);
}
</script>

<style scoped lang="scss"></style>
