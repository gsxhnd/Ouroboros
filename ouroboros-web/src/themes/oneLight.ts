import Aura from "@primevue/themes/aura";
import { definePreset } from "@primevue/themes";

export const oneLightTheme = definePreset(Aura, {
  components: {
    splitter: {
      gutter: {},
    },
  },
});
