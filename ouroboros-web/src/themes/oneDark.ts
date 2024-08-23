import Aura from "@primevue/themes/aura";
import { definePreset } from "@primevue/themes";

export const oneDarkTheme = definePreset(Aura, {
  components: {
    dialog: {
      content: {
        padding: 0,
      },
      root: {
        borderColor: "",
        background: "",
        color: "",
        borderRadius: "",
      },
    },
    splitter: {
      root: {
        background: "var(--p-bg-2)",
        color: "white",
      },
      gutter: {
        background: "--p-stone-800",
      },
      handle: {
        background: "--p-stone-800",
      },
    },
    accordion: {
      content: {
        background: "",
      },
      panel: {
        borderColor: "",
        borderWidth: "0",
      },
    },
  },
  primitive: {
    bg: {
      1: "#414246",
      2: "#37383c",
    },
    tree: {
      hover: "rgb(255, 255, 255, 10%)",
      selected: "rgb(255, 255, 255, 20%)",
    },
    splitter: {
      bg: "var(--p-slate-700)",
      hover: "#006dff",
    },
  },
  semantic: {
    focusRing: {
      color: "",
      offset: "0",
      shadow: "none",
      style: "none",
      width: "0",
    },
  },
});

console.log(oneDarkTheme);
