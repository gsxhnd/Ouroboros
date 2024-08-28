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
        background: "var(--p-splitter-gutter-bg-1)",
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
    inplace: {
      root: {
        padding: 0,
      },
    },
  },
  primitive: {
    bg: {
      1: "#414246",
      2: "#37383c",
    },
    pane: {
      1: "#414246",
      2: "#37383c",
    },
    surface: { 100: "#414246", 200: "#37383c" },
    tree: {
      hover: "rgb(255, 255, 255, 10%)",
      selected: "rgb(255, 255, 255, 20%)",
    },
    splitter: {
      gutter: {
        bg: { 1: "#404040", 2: "var(--p-pane-2)" },
      },
      hover: "#006dff",
    },
  },
  semantic: {
    // colorScheme: null,
    colorScheme: {
      light: {
        surface: {},
      },
      dark: {
        surface: {},
      },
    },
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
