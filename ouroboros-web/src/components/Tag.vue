<template>
  <div ref="dropdown" class="dropdown" v-auto-animate>
    <strong class="dropdown-label" @click="show = !show">
      Click me to open!
    </strong>
    <p class="dropdown-content" v-if="show">Lorum ipsum...</p>
  </div>
</template>
<style scoped lang="scss">
.dropdown {
  color: white;
}
</style>
<script setup lang="ts">
import { ref } from "vue";
const show = ref(false);
</script>
