import { Directive, DirectiveBinding } from "vue";
import { offset } from "@floating-ui/vue";

export const tooltip: Directive = {
  mounted(el: HTMLElement, binding: DirectiveBinding) {
    const tooltipParent = document.createElement("div");
    tooltipParent.className = "tooltip-container";
    tooltipParent.style.display = "block";
    tooltipParent.textContent = "111111111111";
    el.insertAdjacentElement("afterend", tooltipParent);
    console.log(binding);
  },
};
