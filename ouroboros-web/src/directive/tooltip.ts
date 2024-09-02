import { Directive, DirectiveBinding, watch } from "vue";
import { computePosition, flip, shift, offset } from "@floating-ui/vue";
import { useElementHover } from "@vueuse/core";

export const tooltip: Directive = {
  mounted(el: HTMLElement, binding: DirectiveBinding) {
    const tooltipParent = document.createElement("div");
    tooltipParent.className = "tooltip";
    tooltipParent.textContent = binding.value;

    const isHover = useElementHover(el);

    watch(isHover, (newV, _oldV) => {
      if (newV) {
        el.insertAdjacentElement("afterend", tooltipParent);
        computePosition(el, tooltipParent, {
          placement: "bottom",
          middleware: [offset(6), flip(), shift()],
        }).then(({ x, y }) => {
          Object.assign(tooltipParent.style, {
            left: `${x}px`,
            top: `${y}px`,
          });
        });
        tooltipParent.style.display = "block";
      } else {
        tooltipParent.remove();
      }
    });
  },
};
