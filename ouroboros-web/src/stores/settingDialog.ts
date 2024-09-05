import { defineStore } from "pinia";
import { ref } from "vue";

export const userSettingDialogStore = defineStore("settingDialog", () => {
  const sideItems = ref([
    {
      label: "General",
      children: [
        {
          label: "Dashboard",
          item: "dashboard",
          activated: true,
        },
      ],
    },
    {
      label: "AAA",
      children: [
        {
          label: "A",
          item: "a",
          activated: false,
        },
      ],
    },
  ]);
  const selectedItem = ref("dashboard");

  function selectItem(item: string, pIndex: number, index: number) {
    sideItems.value.forEach((p) => {
      p.children.forEach((c) => {
        c.activated = false;
      });
    });
    sideItems.value[pIndex].children[index].activated = true;
    selectedItem.value = item;
  }

  return { sideItems, selectedItem, selectItem };
});
