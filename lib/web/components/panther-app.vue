<template>
  <!DOCTYPE html>
  <html>
    <head> </head>
    <body>
      <component :is="layout" />
    </body>
  </html>
</template>
<script lang="ts">
import { defineComponent } from 'vue'

export default defineComponent({
  name: 'PantherApp',
})
</script>
