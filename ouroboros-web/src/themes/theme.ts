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
    splitter: {
      root: {},
      gutter: {
        background: "--p-stone-950",
      },
      handle: {
        background: "--p-stone-950",
      },
    },
  },
});

console.log(darkTheme);
