import { createInstance } from "localforage";

export const localStore = createInstance({
  name: "ouroboros",
});
