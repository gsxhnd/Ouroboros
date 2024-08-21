import { defineStore } from "pinia";
import { Folder } from "@type";
import { ref, Ref } from "vue";
import { usePreferencesStore } from "./preferences";
import { getFolders as getFoldersApi } from "@/api/folder";
import { computed } from "vue";

export const userFolderStore = defineStore("folder", () => {
  const folders: Ref<Array<Folder>> = ref([]);

  const target = computed(() => {
    const preferenceStore = usePreferencesStore();
    return preferenceStore.target;
  });

  async function getFolders() {
    return await getFoldersApi(target.value).then((f) => {
      folders.value = f;
    });
  }

  async function addFolder() {
    let id = Math.random();
    let name = Math.random().toString(10);
    folders.value.push({
      id: id,
      name: name,
      pid: 0,
    });
  }

  return { folders, getFolders, addFolder };
});
