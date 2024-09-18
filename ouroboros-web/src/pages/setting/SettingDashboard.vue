<template>
  <div></div>
  <div class="columns is-desktop is-gapless">
    <div class="column">1</div>
    <div class="column">
      <multiselect
        v-model="value"
        :options="options"
        :searchable="false"
        :show-labels="false"
        :allow-empty="false"
        placeholder="Pick a value"
      ></multiselect>
    </div>
  </div>
</template>

<script setup lang="ts">
import Multiselect from "vue-multiselect";
import { ref } from "vue";

const value = ref("");
const options = ref(["list", "of", "options"]);
</script>

<style scoped lang="scss"></style>
