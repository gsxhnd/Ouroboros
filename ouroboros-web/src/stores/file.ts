import { defineStore } from "pinia";
import { File } from "@/ouroboros";
import { ref, Ref } from "vue";
import { usePreferencesStore } from "./preferences";
import { computed } from "vue";
import { getFiles as getFilesApi } from "@/api/file";

export const useFileStore = defineStore("file", () => {
  const files: Ref<Array<File>> = ref([]);

  const target = computed(() => {
    const preferenceStore = usePreferencesStore();
    return preferenceStore.target;
  });

  async function getFiles(folderId: number) {
    return await getFilesApi(target.value, folderId).then((f) => {
      files.value = f;
    });
  }

  return { files, getFiles };
});
