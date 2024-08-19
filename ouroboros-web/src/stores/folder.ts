import { defineStore } from "pinia";
import { Folder } from "@/vite-env";

export const userFolderStore = defineStore("folder", {
  state: () => ({
    folders: [] as Array<Folder>,
  }),
});
