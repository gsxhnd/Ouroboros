import Aura from "@primevue/themes/aura";
import { definePreset } from "@primevue/themes";

export const lightTheme = definePreset(Aura, {
  components: {
    splitter: {
      gutter: {},
    },
  },
});

export const darkTheme = definePreset(Aura, {
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
        background: "var(--p-bg-1)",
        color: "white",
      },
      gutter: {
        background: "--p-stone-800",
      },
      handle: {
        background: "--p-stone-800",
      },
    },
  },
  primitive: {
    bg: {
      1: "#414246",
      2: "#37383c",
    },
  },
});

console.log(darkTheme);
