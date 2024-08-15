<template>
  Setting
  <div class="card flex justify-center">
    <Select
      v-model="selected"
      :options="options"
      @change="changeLanguage($event)"
      optionLabel="name"
      placeholder="Select a City"
      class="w-full md:w-56"
    />
  </div>
</template>
<style lang="less">
.setting-dialog {
  height: 80vh;
  width: 60vw;
}
</style>
<script setup lang="ts">
import { ref, Ref, inject, onBeforeMount } from "vue";
import Select, { SelectChangeEvent } from "primevue/select";
import { usePreferencesStore } from "@/stores/preferences";
import { Language } from "@/locales/i18n";
import { DynamicDialogInstance } from "primevue/dynamicdialogoptions";
const preferencesStore = usePreferencesStore();

const dialogRef = inject<Ref<DynamicDialogInstance>>("dialogRef");

interface LanguageOption {
  name: string;
  code: Language;
}

const selected: Ref<LanguageOption> = ref({ name: "中文", code: "zh-CN" });

const options: Ref<Array<LanguageOption>> = ref([
  { name: "中文", code: "zh-CN" },
  { name: "English", code: "en-US" },
]);

onBeforeMount(async () => {
  let index = options.value.findIndex(
    (item) => item.code === preferencesStore.useLanguage
  );

  selected.value = options.value[index];
});

async function changeLanguage(event: SelectChangeEvent) {
  console.log(event.value);
  console.log(selected);
  await preferencesStore.changeLanguage(event.value.code);
  await preferencesStore.changeTheme();
  dialogRef?.value.close({ a: "a" });
}
</script>
