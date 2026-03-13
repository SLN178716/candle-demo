<script setup lang="ts">
import { ref } from 'vue'

const message = ref('')
</script>

<template>
  <div class="container">
    <el-card class="card">
      <h1>Candle + WASM Demo</h1>
      <p v-if="message">{{ message }}</p>
      <p v-else>Loading WASM...</p>
    </el-card>
  </div>
</template>

<style scoped>
.container {
  display: flex;
  justify-content: flex-start;
  align-items: flex-start;
  font-family: Arial, sans-serif;
}

.card {
  width: min(560px, 100%);
}

h1 {
  color: #333;
  margin: 0 0 1em;
  font-size: 28px;
  line-height: 1.2;
}

p {
  color: #666;
  font-size: 1.2em;
}
</style>
