<template>
  <div class="card">
    <!-- <Toast /> -->
    <FileUpload
      mode="basic"
      name="demo[]"
      customUpload
      @select="onSelectedFiles"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import FileUpload, { FileUploadSelectEvent } from "primevue/fileupload";
// import Button from "primevue/button";
// import { useToast } from "primevue/usetoast";

// const toast = useToast();

// const totalSize = ref(0);
// const totalSizePercent = ref(0);
const files = ref([]);

const onSelectedFiles = (event: FileUploadSelectEvent) => {
  console.log(event);
  files.value = event.files;
  // files.value.forEach((file) => {
  //   // totalSize.value += parseInt(formatSize(file.size));
  // });
  let path: string = event.files[0].path;
  window.electronAPI.copy({
    from: path,
    to: "",
  });
};
</script>
